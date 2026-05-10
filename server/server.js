require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- Serve Frontend Static Files ---
app.use(express.static(path.join(__dirname, '../client')));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully!'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas and Models ---
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }] 
});
const User = mongoose.model('User', userSchema);

const movieSchema = new mongoose.Schema({
    title: { type: String, required: true },
    posterUrl: { type: String, required: true },
    rating: { type: String },
    genres: { type: [String] },
});
const Movie = mongoose.model('Movie', movieSchema);

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
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, message: 'Signed in successfully!' });
    } catch (err) { res.status(500).json({ message: 'Error signing in' }); }
});

// Movie Data

// IMPORTANT: Put the specific routes first
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
        if (!movie) {
            return res.status(404).json({ message: 'Movie not found' });
        }
        res.json(movie);
    } catch (err) {
        console.error('Error retrieving movie details:', err);
        res.status(500).json({ message: 'Error retrieving movie details' });
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        const movies = await Movie.find();
        res.json(movies);
    } catch (err) { res.status(500).json({ message: 'Error retrieving movies' }); }
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


// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});