require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const Razorpay = require('razorpay');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { GoogleGenAI } = require('@google/genai');
const { exec } = require('child_process');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
let transporter = nodemailer.createTransport({
    jsonTransport: true
});
console.log('Nodemailer json transport ready (mocking emails).');

// Function to generate PDF buffer
const generateTicketBuffer = async (booking, showtime) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 30 });
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#111111');
            doc.fillColor('#E50914').font('Helvetica-Bold').fontSize(30).text('CINEMAX TICKET', 30, 30);
            doc.fillColor('#FFFFFF').font('Helvetica').fontSize(16).text(`Movie: ${showtime.movieId.title}`, 30, 80);
            doc.text(`Theatre: ${showtime.theatreName}`, 30, 110);
            doc.text(`Date & Time: ${showtime.date} | ${showtime.time}`, 30, 140);
            doc.text(`Seats: ${booking.seats.join(', ')}`, 30, 170);
            doc.text(`Amount Paid: Rs. ${booking.totalAmount}`, 30, 200);

            const qrCodeDataUrl = await QRCode.toDataURL(booking._id.toString());
            const imgBuffer = Buffer.from(qrCodeDataUrl.replace(/^data:image\/png;base64,/, ""), 'base64');
            doc.image(imgBuffer, doc.page.width - 150, 50, { fit: [100, 100] });
            doc.end();
        } catch (err) { reject(err); }
    });
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Serve Frontend Static Files ---
app.use(express.static(path.join(__dirname, '../client')));

// --- Database Connection is initialized after schemas below ---

// --- Schemas and Models ---
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }],
    points: { type: Number, default: 0 },
    resetOtp: { type: String },
    resetOtpExpiry: { type: Date }
});
const User = mongoose.model('User', userSchema);

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    posterUrl: { type: String, required: true },
    rating: { type: String },
    genres: { type: [String] },
    synopsis: { type: String, default: 'No synopsis available.' },
    trailerYoutubeId: { type: String, default: '' },
    cast: { type: [String], default: [] },
    runtime: { type: String, default: '' },
    year: { type: String, default: '' },
});

const Movie = mongoose.model('Movie', movieSchema);

// --- Phase 2 Models ---
const showtimeSchema = new mongoose.Schema({
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatreName: { type: String, required: true },
    date: { type: String, required: true }, // e.g. "2026-06-15"
    time: { type: String, required: true }, // e.g. "18:30"
    seats: [{
        id: String,       // e.g. "A1", "B4"
        type: { type: String, enum: ['Regular', 'Premium', 'Recliner'], default: 'Regular' },
        price: Number,
        status: { type: String, enum: ['available', 'selected', 'booked'], default: 'available' }
    }]
});
const Showtime = mongoose.model('Showtime', showtimeSchema);

const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    showtimeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Showtime', required: true },
    seats: [String],
    totalAmount: Number,
    paymentId: String,
    status: { type: String, enum: ['pending', 'confirmed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model('Booking', bookingSchema);

const reviewSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Review = mongoose.model('Review', reviewSchema);

// --- Database Connection and Auto-Seeding ---
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected successfully!');
        try {
            const movieCount = await Movie.countDocuments();
            if (movieCount === 0) {
                const dataPath = path.join(__dirname, 'movies-data.json');
                const data = fs.readFileSync(dataPath, 'utf8');
                const moviesToUpload = JSON.parse(data);
                await Movie.insertMany(moviesToUpload);
                console.log(`Auto-seeded ${moviesToUpload.length} movies.`);
            }

            const showtimeCount = await Showtime.countDocuments();
            if (showtimeCount === 0) {
                const movies = await Movie.find();
                let showtimes = [];
                const generateSeats = () => {
                    const seats = [];
                    const rows = ['A', 'B', 'C', 'D'];
                    rows.forEach((row) => {
                        let type = 'Regular'; let price = 150;
                        if (row === 'C') { type = 'Premium'; price = 250; }
                        if (row === 'D') { type = 'Recliner'; price = 400; }
                        
                        for (let col = 1; col <= 8; col++) {
                            seats.push({
                                id: `${row}${col}`, type, price, 
                                status: Math.random() > 0.85 ? 'booked' : 'available'
                            });
                        }
                    });
                    return seats;
                };

                for (let movie of movies) {
                    showtimes.push({
                        movieId: movie._id, theatreName: 'PVR: Inorbit Mall',
                        date: '2026-06-15', time: '18:30', seats: generateSeats()
                    });
                    showtimes.push({
                        movieId: movie._id, theatreName: 'INOX: GVK One',
                        date: '2026-06-15', time: '21:00', seats: generateSeats()
                    });
                }
                await Showtime.insertMany(showtimes);
                console.log(`Auto-seeded ${showtimes.length} showtimes.`);
            }
        } catch (seedErr) {
            console.error('Error during auto-seeding:', seedErr);
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// --- Middleware for Authentication ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
};

// --- API Endpoints (all defined BEFORE app.listen) ---

// User Authentication
app.post('/api/users/signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully!' });
    } catch (err) { res.status(500).json({ message: 'Error creating user' }); }
});

app.post('/api/users/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, message: 'Signed in successfully!', role: user.role, email: user.email });
    } catch (err) { res.status(500).json({ message: 'Error signing in' }); }
});

// Promote a user to admin (requires ADMIN_SECRET from .env)
app.post('/api/admin/promote', authenticateToken, async (req, res) => {
    const { adminSecret } = req.body;
    const secret = process.env.ADMIN_SECRET || 'cinemax_admin_2026';
    if (adminSecret !== secret) {
        return res.status(403).json({ message: 'Invalid admin secret key.' });
    }
    try {
        await User.findByIdAndUpdate(req.user.id, { role: 'admin' });
        // Issue a new token with updated role
        const newToken = jwt.sign({ id: req.user.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'You are now an Admin!', token: newToken, role: 'admin' });
    } catch (err) { res.status(500).json({ message: 'Error promoting user' }); }
});


app.post('/api/users/forgot-password',async(req,res)=>{
    const {email}=req.body;
    try{
        const user=await User.findOne({email});
        if(!user) return res.status(404).json({message:'User not found'});
        const otp =Math.floor(100000+Math.random()*900000).toString();
        user.resetOtp=otp;
        user.resetOtpExpiry=new Date(Date.now()+15*60*1000);
        await user.save();
        console.log(`\n\nEmail Sent`);
        console.log(`To:${email}`);
        console.log(`Subject:CINEMAX Password reset`);
        console.log(`Your OTP is : ${otp}`);
        console.log(`Thank You`);
        res.status(200).json({message:'OTP Generated Successfully ! Check your server terminal'});
    } 
    catch(err) {
        console.error(err);
        res.status(500).json({message:'Internal Server Error'});
    }
});


app.post('/api/users/reset-password',async(req,res)=>{
    const{email,otp,newPassword}=req.body;
    try{
        const user=await User.findOne({email});
        if(!user) return res.status(404).json({message:'User not found'});
        if(user.resetOtp !==otp || user.resetOtpExpiry< Date.now()){
            return res.status(400).json({message:'Invalid or Expired OTP'});
        }
        const hashedPassword=await bcrypt.hash(newPassword,10);
        user.password=hashedPassword;
        user.resetOtp=undefined;
        user.resetOtpExpiry=undefined;
        await user.save();
        res.status(200).json({message:'Password reset successfully! You can now sign in,'});
    }catch(err){
        res.status(500).json({message:'Error resetting the password.'});
    }
});

app.put('/api/users/:email/role', async (req, res) => {
    try {
        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
        
        const user = await User.findOneAndUpdate({ email: req.params.email }, { role }, { new: true });
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        res.json({ message: `Role updated to ${role} for ${user.email}`, user: { email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ message: 'Error updating role' });
    }
});

app.get('/api/movies/upload', async (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'movies-data.json');
        const data = fs.readFileSync(dataPath, 'utf8');
        const moviesToUpload = JSON.parse(data);

        await Movie.deleteMany({});
        
        const result = await Movie.insertMany(moviesToUpload);

        res.status(200).json({ message: 'Movies uploaded successfully!', count: result.length });
    } catch (err) { res.status(500).json({ message: 'Error uploading movies from file' }); }
});

app.get('/api/movies/search', async (req, res) => {
    const query = req.query.query;
    if (!query) { return res.status(400).json({ message: 'Search query is required' }); }
    try {
        const movies = await Movie.find({ title: { $regex: new RegExp(query, 'i') } });
        res.json(movies);
    } catch (err) { res.status(500).json({ message: 'Error searching for movies' }); }
});


// Now, put the generic routes after the specific ones
app.get('/api/movies/:id', async (req, res) => {
    try {
        const movie = await Movie.findById(req.params.id);
        if (!movie) return res.status(404).json({ message: 'Movie not found' });
        
        // Compute average rating from Reviews
        const reviews = await Review.find({ movieId: movie._id }).populate('userId', 'email');
        const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : movie.rating;
        
        res.json({ ...movie.toObject(), computedRating: avgRating, reviews });
    } catch (err) {
        console.error('Error retrieving movie details:', err);
        res.status(500).json({ message: 'Error retrieving movie details' });
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const { genre, rating } = req.query;
        let query = {};
        
        if (genre) {
            query.genres = { $in: [new RegExp(genre, 'i')] };
        }
        
        const movies = await Movie.find(query);
        
        // Manual filter for rating if provided (since it's a string in the DB currently)
        let filteredMovies = movies;
        if (rating) {
            const minRating = parseFloat(rating);
            filteredMovies = movies.filter(m => parseFloat(m.rating) >= minRating);
        }
        
        res.json(filteredMovies);
    } catch (err) { res.status(500).json({ message: 'Error retrieving movies' }); }
});

app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('watchlist');
        if (!user) return res.status(404).json({ message: 'User not found' });
        
        let prompt = "Recommend 5 movie titles. Only return a comma separated list of titles and nothing else. ";
        if (user.watchlist && user.watchlist.length > 0) {
            const titles = user.watchlist.map(m => m.title).join(', ');
            prompt += `Based on these movies I like: ${titles}.`;
        } else {
            prompt += `Recommend some popular blockbuster movies.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        const text = response.text;
        if (!text) return res.json([]);
        
        const suggestedTitles = text.split(',').map(t => t.trim().replace(/^"|"$/g, '').replace(/^\d+\.\s*/, '').replace(/\*/g, ''));
        
        const regexArray = suggestedTitles.map(t => new RegExp(`^${t}$`, 'i')); // try to match title
        const recommendedMovies = await Movie.find({ title: { $in: regexArray } }).limit(5);
        
        if (recommendedMovies.length < 5) {
            const extra = await Movie.find({ _id: { $nin: recommendedMovies.map(m => m._id) } }).limit(5 - recommendedMovies.length);
            recommendedMovies.push(...extra);
        }

        res.json(recommendedMovies);
    } catch (err) {
        console.error('Error in recommendations:', err);
        res.status(500).json({ message: 'Error fetching recommendations' });
    }
});


// User Watchlist
app.post('/api/users/watchlist/add', authenticateToken, async (req, res) => {
    const { movieId } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.watchlist.includes(movieId)) return res.status(400).json({ message: 'Movie is already in watchlist' });
        user.watchlist.push(movieId);
        await user.save();
        res.status(200).json({ message: 'Movie added to watchlist successfully' });
    } catch (err) { res.status(500).json({ message: 'Error adding movie to watchlist' }); }
});


app.get('/api/showtimes/seed', async (req, res) => {
    try {
        await Showtime.deleteMany({});
        const movies = await Movie.find();
        let showtimes = [];
        const generateSeats = () => {
            const seats = [];
            const rows = ['A', 'B', 'C', 'D'];
            rows.forEach((row) => {
                let type = 'Regular'; let price = 150;
                if (row === 'C') { type = 'Premium'; price = 250; }
                if (row === 'D') { type = 'Recliner'; price = 400; }
                
                for (let col = 1; col <= 8; col++) {
                    seats.push({
                        id: `${row}${col}`, type, price, 
                        status: Math.random() > 0.85 ? 'booked' : 'available' // Randomly pre-book 15% of seats
                    });
                }
            });
            return seats;
        };

        for (let movie of movies) {
            showtimes.push({
                movieId: movie._id, theatreName: 'PVR: Inorbit Mall',
                date: '2026-06-15', time: '18:30', seats: generateSeats()
            });
            showtimes.push({
                movieId: movie._id, theatreName: 'INOX: GVK One',
                date: '2026-06-15', time: '21:00', seats: generateSeats()
            });
        }
        await Showtime.insertMany(showtimes);
        res.json({ message: 'Seeded showtimes successfully!', count: showtimes.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Get Showtimes for a specific Movie
app.get('/api/showtimes/movie/:movieId', async (req, res) => {
    try {
        const showtimes = await Showtime.find({ movieId: req.params.movieId }).populate('movieId');
        res.json(showtimes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Get a single Showtime (for the seat map page)
app.get('/api/showtimes/:id', async (req, res) => {
    try {
        const showtime = await Showtime.findById(req.params.id).populate('movieId');
        res.json(showtime);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Create Razorpay Order
app.post('/api/bookings/create-order', authenticateToken, async (req, res) => {
    const { amount } = req.body;
    try {
        const options = { amount: amount * 100, currency: "INR", receipt: `receipt_${Date.now()}` };
        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (err) { res.status(500).json({ error: 'Error creating order' }); }
});

// 5. Verify Payment and Book Seats
app.post('/api/bookings/verify', authenticateToken, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, showtimeId, seatIds, totalAmount } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', razorpay.key_secret)
                                  .update(body.toString()).digest('hex');

    if (expectedSignature === razorpay_signature) {
        try {
            const booking = new Booking({
                userId: req.user.id, showtimeId, seats: seatIds, totalAmount, paymentId: razorpay_payment_id, status: 'confirmed'
            });
            await booking.save();

            // Mark seats as booked
            await Showtime.updateOne(
                { _id: showtimeId },
                { $set: { "seats.$[elem].status": "booked" } },
                { arrayFilters: [{ "elem.id": { $in: seatIds } }], multi: true }
            );

            // Add 50 Gamification points per seat booked
            const earnedPoints = seatIds.length * 50;
            await User.findByIdAndUpdate(req.user.id, { $inc: { points: earnedPoints } });

            // Broadcast real-time update
            io.emit('seatBooked', { showtimeId, seatIds });

            // Send Email with PDF
            try {
                const showtime = await Showtime.findById(showtimeId).populate('movieId');
                const user = await User.findById(req.user.id);
                const pdfBuffer = await generateTicketBuffer(booking, showtime);

                const info = await transporter.sendMail({
                    from: '"CINEMAX Tickets" <tickets@cinemax.com>',
                    to: user.email,
                    subject: 'Your CINEMAX Movie Ticket',
                    text: `Your booking for ${showtime.movieId.title} is confirmed. Attached is your ticket.`,
                    attachments: [{ filename: 'ticket.pdf', content: pdfBuffer }]
                });
                console.log("Ticket email sent! Preview URL: %s", nodemailer.getTestMessageUrl(info));
            } catch (emailErr) {
                console.error("Failed to send email:", emailErr);
            }

            res.json({ success: true, bookingId: booking._id });
        } catch (err) { res.status(500).json({ success: false, error: 'Database error' }); }
    } else {
        res.status(400).json({ success: false, error: 'Invalid signature' });
    }
});

app.get('/api/bookings/:id/ticket', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).send('Booking not found');
        const showtime = await Showtime.findById(booking.showtimeId).populate('movieId');
        
        const pdfBuffer = await generateTicketBuffer(booking, showtime);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ticket_${booking._id}.pdf`);
        res.send(pdfBuffer);
    } catch (err) { res.status(500).send('Error generating PDF'); }
});

// --- Admin Endpoints ---
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalMovies = await Movie.countDocuments();
        const totalBookings = await Booking.countDocuments();
        
        // Aggregate total revenue from confirmed bookings
        const revenueAgg = await Booking.aggregate([
            { $match: { status: 'confirmed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

        res.json({ totalUsers, totalMovies, totalBookings, totalRevenue });
    } catch (err) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
});

app.post('/api/movies', authenticateToken, isAdmin, async (req, res) => {
    try {
        const movie = new Movie(req.body);
        await movie.save();
        res.status(201).json({ message: 'Movie created successfully!', movie });
    } catch (err) {
        res.status(500).json({ message: 'Error creating movie' });
    }
});

app.put('/api/movies/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!movie) return res.status(404).json({ message: 'Movie not found' });
        res.json({ message: 'Movie updated successfully!', movie });
    } catch (err) {
        res.status(500).json({ message: 'Error updating movie' });
    }
});

app.delete('/api/movies/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const movie = await Movie.findByIdAndDelete(req.params.id);
        if (!movie) return res.status(404).json({ message: 'Movie not found' });
        res.json({ message: 'Movie deleted successfully!' });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting movie' });
    }
});

// Reviews Endpoints
app.post('/api/reviews', authenticateToken, async (req, res) => {
    const { movieId, rating, text } = req.body;
    try {
        const existing = await Review.findOne({ userId: req.user.id, movieId });
        if (existing) return res.status(400).json({ message: 'You have already reviewed this movie!' });
        
        const review = new Review({ userId: req.user.id, movieId, rating, text });
        await review.save();
        
        // Add 20 points for review
        await User.findByIdAndUpdate(req.user.id, { $inc: { points: 20 } });
        
        res.status(201).json({ message: 'Review added successfully' });
    } catch (err) { res.status(500).json({ message: 'Error adding review' }); }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ message: 'Error fetching user data' }); }
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Auto-launch the startup page on Windows
    exec(`start http://localhost:${port}`);
});