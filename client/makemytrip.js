const BASE_URL = 'http://localhost:5000';
const API_URL = `${BASE_URL}/api/movies`;

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
const movieCardContainer = document.getElementById('movie-card-container');
const movieSearchInput = document.getElementById('movie-search-input');
const hamburgerIcon=document.getElementById('hamburger-icon');
const sidebar=document.querySelector('.sidebar');
const overlay=document.querySelector('.overlay');

const genreFilter = document.getElementById('genreFilter');
const ratingFilter = document.getElementById('ratingFilter');

if (genreFilter) genreFilter.addEventListener('change', () => fetchAndRenderMovies());
if (ratingFilter) ratingFilter.addEventListener('change', () => fetchAndRenderMovies());

async function fetchAndRenderMovies(movies = null) {
    try {
        let moviesToRender;
        if (Array.isArray(movies)) {
            moviesToRender = movies;
        } else {
            let url = API_URL;
            const params = new URLSearchParams();
            if (genreFilter && genreFilter.value) params.append('genre', genreFilter.value);
            if (ratingFilter && ratingFilter.value) params.append('rating', ratingFilter.value);
            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
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
                        <p class="rating-text">${generateStarHTML(movie.rating)} ${movie.rating}</p>
                        <p class="genres-text">Genres: ${movie.genres.join(' / ')}</p>
                        <span class="watchlist-btn" data-movie-id="${movie._id}">&#x2764;</span>
                    </a>
                `;
                movieCardContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error fetching movies:', error);
        if (movieCardContainer) {
            movieCardContainer.innerHTML = `<p style="color:red;">Error: ${error.message} - ${error.stack}</p>`;
        }
    }
}

async function fetchAndRenderAIRecommendations() {
    const token = localStorage.getItem('userToken');
    const aiSection = document.getElementById('ai-recommendations-section');
    const aiContainer = document.getElementById('ai-movie-card-container');
    
    if (!token) {
        if(aiSection) aiSection.style.display = 'none';
        return;
    }
    
    if (aiSection) aiSection.style.display = 'block';
    
    try {
        const response = await fetch(`${BASE_URL}/api/recommendations`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const movies = await response.json();
        
        aiContainer.innerHTML = '';
        if (!movies || movies.length === 0) {
            aiContainer.innerHTML = '<p style="color: #fff; padding-left: 20px;">No recommendations found right now.</p>';
        } else {
            movies.forEach(movie => {
                const card = document.createElement('div');
                card.classList.add('card');
                card.innerHTML = `
                    <a href="movie-details.html?id=${movie._id}" style="text-decoration:none; color:inherit;">
                        <img src="${movie.posterUrl}" alt="${movie.title}" class="card-img" width="200">
                        <h3 class="movie-title">${movie.title}</h3>
                        <p class="rating-text">${generateStarHTML(movie.rating)} ${movie.rating}</p>
                        <p class="genres-text">Genres: ${movie.genres.join(' / ')}</p>
                        <span class="watchlist-btn" data-movie-id="${movie._id}">&#x2764;</span>
                    </a>
                `;
                aiContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error('Error fetching AI recommendations:', error);
        if(aiContainer) aiContainer.innerHTML = '<p style="color: #fff; padding-left: 20px;">Could not load AI recommendations.</p>';
    }
}


movieCardContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('watchlist-btn')) {
        const token = localStorage.getItem('userToken');
        if (!token || isTokenExpired(token)) {
            document.getElementById('id01').style.display = 'block';
            return;
        }

        const movieId = e.target.dataset.movieId;
        try {
            const response = await fetch(`${BASE_URL}/api/users/watchlist/add`, {
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
                const response = await fetch(`${BASE_URL}/api/movies/search?query=${query}`);
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
    // Check if token is expired
    const token = localStorage.getItem('userToken');
    if (token && isTokenExpired(token)) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userEmail');
        // Token was expired, cleaned up silently
    }
    
    fetchAndRenderMovies();
    fetchAndRenderAIRecommendations();
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
    const email = localStorage.getItem('userEmail');
    
    if (token && navbarAuthBtn) {
        // Change button to show user avatar + dropdown
        const rightContainer = document.querySelector('.right-container');
        if (rightContainer) {
            // Replace "Sign In" button with user avatar & logout & points
            const userInitial = email ? email.charAt(0).toUpperCase() : 'U';
            rightContainer.innerHTML = `
                <a href="#" class="location">Hyderabad<ion-icon name="caret-down-sharp"></ion-icon></a>
                <span id="nav-points" style="color: gold; font-weight: bold; margin-right: 15px;">⭐ 0 Pts</span>
                <div class="user-avatar" id="user-avatar">${userInitial}</div>
                <button class="signin" id="logout-btn">Logout</button>
            `;
            
            // Fetch points
            fetch(`${BASE_URL}/api/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => res.json()).then(profile => {
                if (profile && profile.points !== undefined) {
                    document.getElementById('nav-points').innerText = `⭐ ${profile.points} Pts`;
                }
            }).catch(e => console.error("Could not fetch points:", e));
            
            // Logout handler
            document.getElementById('logout-btn').addEventListener('click', () => {
                localStorage.removeItem('userToken');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('role');
                window.location.reload();
            });
        }
        
        // Show Admin link if user is admin
        const role = localStorage.getItem('role');
        const adminLink = document.getElementById('admin-panel-link');
        if (role === 'admin' && adminLink) {
            adminLink.style.display = 'inline';
        }
        
        // Update sidebar greeting
        const sidebarGreeting = document.querySelector('.sidenavbar h1');
        if (sidebarGreeting && email) {
            sidebarGreeting.textContent = `Hey, ${email.split('@')[0]}!`;
        }
        
        // Update sidebar login button to "My Account"
        const sidebarLoginBtn = document.querySelector('.sidesubnavbar .login');
        if (sidebarLoginBtn) {
            sidebarLoginBtn.textContent = 'My Account';
            sidebarLoginBtn.onclick = null; // Remove modal trigger
        }
        
        // Enable disabled sidebar links
        document.querySelectorAll('.sidebar .btn-disabled').forEach(link => {
            link.classList.remove('btn-disabled');
        });
    }
}

function isTokenExpired(token) {
    try {
        // JWT has 3 parts: header.payload.signature
        const payload = JSON.parse(atob(token.split('.')[1]));
        // payload.exp is in seconds, Date.now() is in milliseconds
        return payload.exp * 1000 < Date.now();
    } catch (e) {
        return true; // If we can't decode it, treat as expired
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
            const response = await fetch(`${BASE_URL}/api/users/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();

            if (response.ok) {
                // Save the JWT token to the browser!
                localStorage.setItem('userToken', data.token);
                localStorage.setItem('userEmail', email);
                localStorage.setItem('role', data.role || 'user');
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
            const response = await fetch(`${BASE_URL}/api/users/signup`, {
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

const forgotPasswordForm=document.getElementById('forgot-password-form');
const resetPasswordForm=document.getElementById('reset-password-form');
const showForgotBtn=document.getElementById('show-forgot-password');
// const showSigninBtn=document.getElementById('show-signin');
const backToSignin1=document.getElementById('back-to-signin-1');
const backToSignin2=document.getElementById('back-to-signin-2');

function hideAllAuthForms(){
    if(signinForm) signinForm.style.display='none';
    if(signupForm) signupForm.style.display='none';
    if(forgotPasswordForm) forgotPasswordForm.style.display='none';
    if(resetPasswordForm) resetPasswordForm.style.display='none';
    if(authErrorMessage) authErrorMessage.innerText='';
}

if(showSignupBtn){
    showSignupBtn.addEventListener('click',(e)=>{
        e.preventDefault();
        hideAllAuthForms();
        signupForm.style.display='flex';
    });
}

if(showSigninBtn){
    showSigninBtn.addEventListener('click',(e)=>{
        e.preventDefault();
        hideAllAuthForms();
        signinForm.style.display='flex';
    });
}

if(showForgotBtn){
    showForgotBtn.addEventListener('click',(e)=>{
        e.preventDefault();
        hideAllAuthForms();
        forgotPasswordForm.style.display='flex';
    });
}

[backToSignin1, backToSignin2].forEach(btn => {
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            hideAllAuthForms();
            signinForm.style.display = 'flex';
        });
    }
});

if(forgotPasswordForm){
    forgotPasswordForm.addEventListener('submit',async(e)=>{
        e.preventDefault();
        const email=document.getElementById('forgot-email').value;
        try{
            const response=await fetch(`${BASE_URL}/api/users/forgot-password`,{
                method:'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data=await response.json();
            if(response.ok){
                authErrorMessage.style.color='#46d369';
                authErrorMessage.innerText=data.message;
                setTimeout(()=>{
                    hideAllAuthForms();
                    resetPasswordForm.style.display='flex';
                },1500);
            }
            else{
                authErrorMessage.style.color='#e50914';
                authErrorMessage.innerText=data.message;
            }
        }catch(error){
            authErrorMessage.style.color='#e50914';
            authErrorMessage.innerText='Server error. Try again later.';
        }
    });
}

if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value; 
        const otp = document.getElementById('reset-otp').value;
        const newPassword = document.getElementById('reset-new-password').value;
        try {
            const response = await fetch(`${BASE_URL}/api/users/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword })
            });
            const data = await response.json();
            if (response.ok) {
                authErrorMessage.style.color = '#46d369';
                authErrorMessage.innerText = data.message;
                // Go back to sign in after success
                setTimeout(() => {
                    hideAllAuthForms();
                    signinForm.style.display = 'flex';
                }, 2000);
            } else {
                authErrorMessage.style.color = '#e50914';
                authErrorMessage.innerText = data.message;
            }
        } catch (error) {
            authErrorMessage.style.color = '#e50914';
            authErrorMessage.innerText = 'Server error. Try again later.';
        }
    });
}