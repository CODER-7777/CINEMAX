const detailsContainer = document.getElementById('movie-details-container');
const API_BASE_URL = 'http://localhost:5000/api/movies';

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
        
        detailsContainer.innerHTML = `
            <img src="${movie.posterUrl}" alt="${movie.title}" style="width: 300px; float: left; margin-right: 30px;">
            <div style="overflow: hidden;">
                <h1>${movie.title}</h1>
                <p><strong>Rating:</strong> ${movie.rating}</p>
                <p><strong>Genres:</strong> ${movie.genres.join(' / ')}</p>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching movie details:', error);
        detailsContainer.innerHTML = `<p>${error.message}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', fetchAndRenderMovieDetails);