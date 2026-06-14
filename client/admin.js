const BASE_URL = 'http://localhost:5000';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
        alert('Access Denied. Admins only.');
        window.location.href = 'makemytrip.html';
        return;
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = 'index.html';
    });

    fetchStats(token);
    fetchMovies();
    setupAddMovie(token);
});

function showError(msg) {
    const errDiv = document.getElementById('error-message');
    errDiv.textContent = msg;
    errDiv.style.display = 'block';
    setTimeout(() => { errDiv.style.display = 'none'; }, 5000);
}

async function fetchStats(token) {
    try {
        const response = await fetch(`${BASE_URL}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();

        document.getElementById('stat-users').textContent = data.totalUsers;
        document.getElementById('stat-movies').textContent = data.totalMovies;
        document.getElementById('stat-bookings').textContent = data.totalBookings;
        document.getElementById('stat-revenue').textContent = `₹${data.totalRevenue}`;

        renderCharts(data);
    } catch (error) {
        showError(error.message);
    }
}

function renderCharts(data) {
    // Dummy chart data for visual effect on the dashboard
    const ctx1 = document.getElementById('revenueChart').getContext('2d');
    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Kalki', 'Salaar', 'RRR', 'Eega', 'Hit 3'],
            datasets: [{
                label: 'Revenue (₹)',
                data: [15000, 12000, 20000, 8000, 5000],
                backgroundColor: '#E50914'
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    const ctx2 = document.getElementById('distChart').getContext('2d');
    new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Action', 'Sci-Fi', 'Comedy', 'Drama'],
            datasets: [{
                data: [40, 20, 25, 15],
                backgroundColor: ['#E50914', '#1f1f1f', '#444', '#888']
            }]
        },
        options: { responsive: true }
    });
}

async function fetchMovies() {
    try {
        const response = await fetch(`${BASE_URL}/api/movies`);
        const movies = await response.json();
        const tbody = document.getElementById('moviesTableBody');
        tbody.innerHTML = '';

        movies.forEach(movie => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${movie.title}</td>
                <td>${movie.year}</td>
                <td>${movie.rating}</td>
                <td>
                    <button class="btn-danger-outline btn-sm" onclick="deleteMovie('${movie._id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showError(error.message);
    }
}

async function deleteMovie(id) {
    if (!confirm('Are you sure you want to delete this movie?')) return;
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${BASE_URL}/api/movies/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete movie');
        fetchMovies(); // reload
    } catch (error) {
        showError(error.message);
    }
}

function setupAddMovie(token) {
    const form = document.getElementById('addMovieForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const movieData = {
            title: document.getElementById('movieTitle').value,
            posterUrl: document.getElementById('moviePoster').value,
            rating: document.getElementById('movieRating').value,
            genres: document.getElementById('movieGenres').value.split(',').map(s => s.trim())
        };

        try {
            const response = await fetch(`${BASE_URL}/api/movies`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(movieData)
            });
            if (!response.ok) throw new Error('Failed to add movie');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addMovieModal'));
            modal.hide();
            
            form.reset();
            fetchMovies();
        } catch (error) {
            showError(error.message);
        }
    });
}
