const urlParams = new URLSearchParams(window.location.search);
const showtimeId = urlParams.get('showtimeId');
const token = localStorage.getItem('userToken');

if (!token) {
    alert("Please sign in to book tickets!");
    window.location.href = 'makemytrip.html';
}

const seatMapContainer = document.getElementById('seat-map');
const movieInfoContainer = document.getElementById('movie-info');
const selectedCountEl = document.getElementById('selected-count');
const selectedNamesEl = document.getElementById('selected-names');
const totalPriceEl = document.getElementById('total-price');
const payBtn = document.getElementById('pay-btn');

let selectedSeats = [];
let showtimeData = null;

async function loadShowtime() {
    try {
        const res = await fetch(`/api/showtimes/${showtimeId}`);
        if (!res.ok) throw new Error('Showtime not found');
        showtimeData = await res.json();
        
        // Update Header
        movieInfoContainer.innerHTML = `
            <h1>${showtimeData.movieId.title}</h1>
            <p>${showtimeData.theatreName} &bull; ${showtimeData.date} at ${showtimeData.time}</p>
        `;

        renderSeats();
    } catch (err) {
        movieInfoContainer.innerHTML = `<h1>Error</h1><p>Could not load showtime.</p>`;
        console.error(err);
    }
}

function renderSeats() {
    seatMapContainer.innerHTML = '';
    showtimeData.seats.forEach(seat => {
        const seatDiv = document.createElement('div');
        seatDiv.classList.add('seat');
        seatDiv.innerText = seat.id;
        
        if (seat.status === 'booked') {
            seatDiv.classList.add('booked');
        } else {
            seatDiv.classList.add('available');
            if (seat.type === 'Premium') seatDiv.classList.add('premium');
            if (seat.type === 'Recliner') seatDiv.classList.add('recliner');
            
            // Click handler for selection
            seatDiv.addEventListener('click', () => toggleSeatSelection(seat, seatDiv));
        }

        seatMapContainer.appendChild(seatDiv);
    });
}

function toggleSeatSelection(seat, seatDiv) {
    const isSelected = seatDiv.classList.contains('selected');
    
    if (isSelected) {
        seatDiv.classList.remove('selected');
        selectedSeats = selectedSeats.filter(s => s.id !== seat.id);
    } else {
        seatDiv.classList.add('selected');
        selectedSeats.push(seat);
    }
    
    updateCheckoutPanel();
}

function updateCheckoutPanel() {
    const totalAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const seatNames = selectedSeats.map(s => s.id).join(', ');
    
    selectedCountEl.innerText = selectedSeats.length;
    selectedNamesEl.innerText = selectedSeats.length > 0 ? seatNames : '-';
    totalPriceEl.innerText = totalAmount;
    
    payBtn.disabled = selectedSeats.length === 0;
}

payBtn.addEventListener('click', async () => {
    payBtn.innerText = 'Processing...';
    payBtn.disabled = true;
    
    const totalAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const seatIds = selectedSeats.map(s => s.id);

    try {
        // 1. Create Razorpay Order
        const orderRes = await fetch('/api/bookings/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ amount: totalAmount })
        });
        const orderData = await orderRes.json();

        // 2. Open Razorpay Checkout Modal
        const options = {
            key: 'rzp_test_SzFek7CvRbGDUY', // Razorpay Test Key ID
            amount: orderData.amount,
            currency: "INR",
            name: "CINEMAX TICKETS",
            description: "Movie Ticket Booking",
            order_id: orderData.id,
            handler: async function (response) {
                // 3. Verify Payment
                const verifyRes = await fetch('/api/bookings/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        showtimeId: showtimeId,
                        seatIds: seatIds,
                        totalAmount: totalAmount
                    })
                });
                
                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                    alert(`Payment Successful! Booking ID: ${verifyData.bookingId}`);
                    // Download the PDF Ticket automatically
                    window.open(`/api/bookings/${verifyData.bookingId}/ticket`, '_blank');
                    // Wait a moment before redirecting so the download starts
                    setTimeout(() => {
                        window.location.href = 'makemytrip.html'; 
                    }, 2000);
                } else {
                    alert("Payment Verification Failed!");
                }
            },
            theme: { color: "#e50914" }
        };
        
        const rzp1 = new Razorpay(options);
        rzp1.open();
        
        rzp1.on('payment.failed', function (response){
            alert("Payment Failed!");
            payBtn.innerText = 'Pay Now';
            payBtn.disabled = false;
        });

    } catch (err) {
        console.error(err);
        alert("An error occurred during payment.");
    }
});

loadShowtime();
