const API_URL = 'http://localhost:5000/api/movies';
const movieCardContainer = document.getElementById('movie-card-container');
const movieSearchInput = document.getElementById('movie-search-input');

async function fetchAndRenderMovies(movies = null) {
    try {
        let moviesToRender;
        if (movies) {
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
            const response = await fetch('http://localhost:5000/api/users/watchlist/add', {
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
                const response = await fetch(`http://localhost:5000/api/movies/search?query=${query}`);
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

document.addEventListener('DOMContentLoaded', fetchAndRenderMovies);