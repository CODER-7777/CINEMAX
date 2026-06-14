// NAAD.js - Final Polished JavaScript for Authentication and Redirection
const BASE_URL = 'http://localhost:5000';

// --- Auto-redirect to main page after 4 seconds ---
let redirectTimer = setTimeout(() => {
    window.location.href = 'makemytrip.html';
}, 4000);

// --- Constants for the landing page ---
const signInButton = document.getElementById('signInBtn');
const getStartedForm = document.getElementById('getStartedForm');

// Logic for the "Get Started" button on the main page
if (getStartedForm) {
    getStartedForm.addEventListener('submit', function(event) {
        event.preventDefault(); 
        clearTimeout(redirectTimer); // Cancel auto-redirect
        window.location.href = 'makemytrip.html';
    });
}

// Logic for the "Sign in" button on the main page
if (signInButton) {
    signInButton.addEventListener('click', function() {
        window.location.href = 'login.html';
    });
}

// --- Logic for the login.html page ---
const signInSection = document.getElementById('signInSection');
const signUpSection = document.getElementById('signUpSection');
const toggleSignUpLink = document.getElementById('toggleSignUp');
const toggleSignInLink = document.getElementById('toggleSignIn');

const signInForm = document.getElementById('signInForm');
const signUpForm = document.getElementById('signUpForm');

// Event listener for the sign-in form
if (signInForm) {
    signInForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('signInEmail').value;
        const password = document.getElementById('signInPassword').value;

        try {
            const response = await fetch(`${BASE_URL}/api/users/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            alert(data.message);
            if (response.ok) {
                window.location.href = 'makemytrip.html';
            }
        } catch (error) {
            console.error('Error during sign-in:', error);
            alert('An error occurred during sign-in. Please try again later.');
        }
    });
}

// Event listener for the sign-up form
if (signUpForm) {
    signUpForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const email = document.getElementById('signUpEmail').value;
        const password = document.getElementById('signUpPassword').value;

        try {
            const response = await fetch(`${BASE_URL}/api/users/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();
            alert(data.message);
            if (response.ok) {
                // Redirect to the sign-in form after successful sign-up
                signInSection.style.display = 'block';
                signUpSection.style.display = 'none';
            }
        } catch (error) {
            console.error('Error during sign-up:', error);
            alert('An error occurred during sign-up. Please try again later.');
        }
    });
}

// Toggle between sign-in and sign-up sections
if (toggleSignUpLink) {
    toggleSignUpLink.addEventListener('click', function(event) {
        event.preventDefault();
        signInSection.style.display = 'none';
        signUpSection.style.display = 'block';
    });
}

if (toggleSignInLink) {
    toggleSignInLink.addEventListener('click', function(event) {
        event.preventDefault();
        signInSection.style.display = 'block';
        signUpSection.style.display = 'none';
    });
}
