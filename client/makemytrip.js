const API_URL = '/api/movies';
const movieCardContainer = document.getElementById('movie-card-container');
const movieSearchInput = document.getElementById('movie-search-input');
const hamburgerIcon=document.getElementById('hamburger-icon');
const sidebar=document.querySelector('.side-bar');
const overlay=document.querySelector('.overlay');

async function fetchAndRenderMovies(movies = null) {
    try {
        let moviesToRender;
        if (Array.isArray(movies)) {
            moviesToRender = movies;
        } else {
            const response = await fetch(API_URL);
            moviesToRender = await response.json();
        }

        movieCardContainer.innerHTML = '';
        if (moviesToRender.length === 0) {
            movieCardContainer.innerHTML = '<p>No movies saved. Upload some movies from the backend.</p>';
        } else {
            moviesToRender.forEach(movie => {
                const card = document.createElement('div');
                card.classList.add('card');
                card.innerHTML = `
                    <a href="movie-details.html?id=${movie._id}" style="text-decoration:none; color:inherit;">
                        <img src="${movie.posterUrl}" alt="${movie.title}" class="card-img" width="200">
                        <h3 class="movie-title">${movie.title}</h3>
                        <p class="rating-text">Rating: ${movie.rating}</p>
                        <p class="genres-text">Genres: ${movie.genres.join(' / ')}</p>
                        <span class="watchlist-btn" data-movie-id="${movie._id}">&#x2764;</span>
                    </a>
                `;
                movieCardContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
        movieCardContainer.innerHTML = '<p>No movies found.</p>';
    }
}


movieCardContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('watchlist-btn')) {
        const token = localStorage.getItem('userToken');
        if (!token) {
            alert('Movie is added to your watchlist');
            return;
        }

        const movieId = e.target.dataset.movieId;
        try {
            const response = await fetch('/api/users/watchlist/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ movieId }),
            });

            const data = await response.json();
            alert(data.message);
        } catch (error) {
            console.error('Error adding to watchlist:', error);
        }
    }
});

// Event listener for the search bar
if (movieSearchInput) {
    movieSearchInput.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length > 2) {
            try {
                const response = await fetch(`/api/movies/search?query=${query}`);
                const movies = await response.json();
                fetchAndRenderMovies(movies);
            } catch (error) {
                console.error('Error searching:', error);
            }
        } else if (query.length === 0) {
            fetchAndRenderMovies();
        }
    });
}

if(hamburgerIcon){
    hamburgerIcon.addEventListener('click',()=>{
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    });
}

if(overlay){
    overlay.addEventListener('click',()=>{
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
}
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderMovies();
    checkAuthStatus();
});

// --- AUTHENTICATION LOGIC ---
const signinForm = document.getElementById('signin-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showSigninBtn = document.getElementById('show-signin');
const authErrorMessage = document.getElementById('auth-error-message');
const navbarAuthBtn = document.getElementById('navbar-auth-btn');

function checkAuthStatus() {
    const token = localStorage.getItem('userToken');
    if (token && navbarAuthBtn) {
        navbarAuthBtn.innerText = 'Logout';
        navbarAuthBtn.onclick = () => {
            localStorage.removeItem('userToken');
            alert('Logged out successfully');
            window.location.reload();
        };
    }
}

// Toggle between Sign In and Sign Up forms
if (showSignupBtn && showSigninBtn) {
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signinForm.style.display = 'none';
        signupForm.style.display = 'flex';
        authErrorMessage.innerText = '';
    });

    showSigninBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.style.display = 'none';
        signinForm.style.display = 'flex';
        authErrorMessage.innerText = '';
    });
}

// Handle Sign In Submission
if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page refresh
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        try {
            const response = await fetch('/api/users/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                // Save the JWT token to the browser!
                localStorage.setItem('userToken', data.token);
                document.getElementById('id01').style.display = 'none'; // Close modal
                alert('Signed in successfully!');
                window.location.reload(); // Refresh to update navbar
            } else {
                authErrorMessage.innerText = data.message;
            }
        } catch (error) {
            authErrorMessage.innerText = 'Server error. Try again later.';
        }
    });
}

// Handle Sign Up Submission
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        try {
            const response = await fetch('/api/users/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                authErrorMessage.style.color = '#46d369'; // Green success text
                authErrorMessage.innerText = 'Account created! Please Sign In.';
                setTimeout(() => showSigninBtn.click(), 2000); // Auto-switch to signin
            } else {
                authErrorMessage.style.color = '#e50914';
                authErrorMessage.innerText = data.message;
            }
        } catch (error) {
            authErrorMessage.innerText = 'Server error. Try again later.';
        }
    });
}
