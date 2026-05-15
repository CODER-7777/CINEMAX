const detailsContainer = document.getElementById('movie-details-container');
const API_BASE_URL = '/api/movies';

function generateStarHTML(rating) {
    // Convert rating from 0-10 scale to 0-5 stars
    const stars = parseFloat(rating) / 2;
    const fullStars = Math.floor(stars);
    const hasHalf = (stars - fullStars) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
    
    let html = '<div class="star-rating">';
    for (let i = 0; i < fullStars; i++) html += '<span class="star filled">★</span>';
    if (hasHalf) html += '<span class="star half">★</span>';
    for (let i = 0; i < emptyStars; i++) html += '<span class="star">★</span>';
    html += '</div>';
    return html;
}

async function fetchAndRenderMovieDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    // This is a key debugging line. Check your browser console to see the ID.
    console.log('Fetching details for movie ID:', movieId);

    if (!movieId) {
        detailsContainer.innerHTML = '<p>No movie ID provided. Please go back to the main page.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/${movieId}`);
        if (!response.ok) {
            throw new Error('Movie not found');
        }
        const movie = await response.json();
        
        // Remove the default padding from your container so the background stretches fully
        detailsContainer.style.padding = '0';
        detailsContainer.style.maxWidth = '100%';

        // Dynamically create the Hero Banner AND the content below it
        detailsContainer.innerHTML = `
            <!-- BREADCRUMB NAVIGATION -->
            <div style="position: absolute; top: 20px; left: 5%; z-index: 10;">
                <a href="makemytrip.html" style="color: #b3b3b3; text-decoration: none; font-family: 'Inter', sans-serif;">Home</a> 
                <span style="color: #666; margin: 0 10px;">/</span> 
                <span style="color: #fff; font-family: 'Inter', sans-serif;">${movie.title}</span>
            </div>

            <!-- HERO BANNER -->
            <div class="hero-container" style="background-image: url('${movie.posterUrl}');">
                <div class="hero-overlay"></div>
                <div class="hero-content">
                    <img src="${movie.posterUrl}" alt="${movie.title}" class="hero-poster">
                    <div class="hero-text">
                        <h1>${movie.title}</h1>
                        <div class="hero-meta">
                            <span class="hero-rating">${generateStarHTML(movie.rating)} ${movie.rating}/10</span>
                            <span>${movie.year || '2024'}</span>
                            <span>${movie.runtime || 'N/A'}</span>
                        </div>
                        <p style="font-size: 1.1rem; max-width: 600px; line-height: 1.6; color: #d2d2d2;">
                            ${movie.synopsis || 'No synopsis available.'}
                        </p>
                        <p style="margin-top: 15px; color: #808080;"><strong>Genres:</strong> ${movie.genres.join(', ')}</p>
                        <p style="margin-top: 10px; color: #808080;">
                            <strong>Cast:</strong> ${movie.cast ? movie.cast.join(', ') : 'N/A'}
                        </p>
                    </div>
                </div>
            </div>

            <!-- LOWER CONTENT SECTION (Trailer & Details) -->
            <div style="padding: 50px 5%; max-width: 1200px; margin: 0 auto; color: #fff; font-family: 'Inter', sans-serif;">
                <h2 style="font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; letter-spacing: 1px; margin-bottom: 20px; color: #fff;">Watch Trailer</h2>
                
                <!-- YOUTUBE IFRAME -->
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); margin-bottom: 60px;">
                    <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            src="https://www.youtube.com/embed/${movie.trailerYoutubeId || 'dQw4w9WgXcQ'}?autoplay=0&rel=0" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                    </iframe>
                </div>

                <!-- SIMILAR MOVIES SECTION -->
                <h2 style="font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; letter-spacing: 1px; margin-bottom: 20px; color: #fff;">Similar Movies</h2>
                <div class="movies-list" style="padding-left: 0;">
                    <div class="card-container" id="similar-movies-list" style="justify-content: flex-start; margin: 0;">
                        <p style="color: #b3b3b3;">Loading similar movies...</p>
                    </div>
                </div>
            </div>
        `;

        // Fetch and render similar movies
        await fetchAndRenderSimilarMovies(movie);

    } catch (error) {
        console.error('Error fetching movie details:', error);
        detailsContainer.innerHTML = `<div style="padding: 50px; text-align: center;"><h2>${error.message}</h2></div>`;
    }
}

// Function to find and display movies with matching genres
async function fetchAndRenderSimilarMovies(currentMovie) {
    const similarContainer = document.getElementById('similar-movies-list');
    try {
        const response = await fetch(API_BASE_URL);
        const allMovies = await response.json();

        // Filter: Keep movies that share at least 1 genre, and exclude the current movie
        const similarMovies = allMovies.filter(m => {
            if (m._id === currentMovie._id) return false;
            return m.genres.some(genre => currentMovie.genres.includes(genre));
        });

        similarContainer.innerHTML = ''; // Clear loading text

        if (similarMovies.length === 0) {
            similarContainer.innerHTML = '<p style="color: #808080;">No similar movies found.</p>';
            return;
        }

        // Limit to 5 similar movies so it doesn't clutter the page
        similarMovies.slice(0, 5).forEach(movie => {
            const card = document.createElement('div');
            card.classList.add('card');
            card.style.marginRight = '20px'; // spacing
            card.innerHTML = `
                <a href="movie-details.html?id=${movie._id}" style="text-decoration:none; color:inherit;">
                    <img src="${movie.posterUrl}" alt="${movie.title}" class="card-img" width="200">
                    <h3 class="movie-title">${movie.title}</h3>
                    <p class="rating-text">Rating: ${movie.rating}</p>
                    <p class="genres-text">Genres: ${movie.genres.join(' / ')}</p>
                </a>
            `;
            similarContainer.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading similar movies:', error);
        similarContainer.innerHTML = '<p style="color: red;">Failed to load similar movies.</p>';
    }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderMovieDetails);
