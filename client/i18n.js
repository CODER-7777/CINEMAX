const translations = {
    'en': {
        'nav_movies': 'Movies',
        'nav_stream': 'Stream',
        'nav_events': 'Events',
        'nav_plays': 'Plays',
        'nav_sports': 'Sports',
        'nav_activities': 'Activities',
        'nav_buzz': 'Buzz',
        'recommended_movies': 'Recommended Movies',
        'search_placeholder': 'Search for Movies, Events, Plays, Sports, and Activities',
        'sign_in': 'Sign In',
        'best_entertainment': 'The Best of Entertainment'
    },
    'hi': {
        'nav_movies': 'फ़िल्में',
        'nav_stream': 'स्ट्रीम',
        'nav_events': 'कार्यक्रम',
        'nav_plays': 'नाटक',
        'nav_sports': 'खेल',
        'nav_activities': 'गतिविधियां',
        'nav_buzz': 'चर्चा',
        'recommended_movies': 'अनुशंसित फ़िल्में',
        'search_placeholder': 'फ़िल्में, कार्यक्रम, नाटक, खेल और गतिविधियां खोजें',
        'sign_in': 'साइन इन करें',
        'best_entertainment': 'मनोरंजन का सर्वश्रेष्ठ'
    },
    'te': {
        'nav_movies': 'సినిమాలు',
        'nav_stream': 'స్ట్రీమ్',
        'nav_events': 'ఈవెంట్స్',
        'nav_plays': 'నాటకాలు',
        'nav_sports': 'క్రీడలు',
        'nav_activities': 'కార్యకలాపాలు',
        'nav_buzz': 'బజ్',
        'recommended_movies': 'సిఫార్సు చేయబడిన సినిమాలు',
        'search_placeholder': 'సినిమాలు, ఈవెంట్స్, నాటకాలు, క్రీడలు మరియు కార్యకలాపాల కోసం శోధించండి',
        'sign_in': 'సైన్ ఇన్ చేయండి',
        'best_entertainment': 'వినోదం యొక్క ఉత్తమమైనది'
    }
};

function changeLanguage(lang) {
    if (!translations[lang]) return;
    
    // Save preference
    localStorage.setItem('cinemax_lang', lang);
    
    const t = translations[lang];
    
    // Navbar
    const searchInput = document.getElementById('movie-search-input');
    if (searchInput) searchInput.placeholder = t['search_placeholder'];
    
    // Translate sections if they exist
    const subnavLinks = document.querySelectorAll('.subnavbar .navitem li a');
    if (subnavLinks.length >= 7) {
        subnavLinks[0].childNodes[0].nodeValue = t['nav_movies'];
        subnavLinks[1].childNodes[0].nodeValue = t['nav_stream'];
        subnavLinks[2].childNodes[0].nodeValue = t['nav_events'];
        subnavLinks[3].childNodes[0].nodeValue = t['nav_plays'];
        subnavLinks[4].childNodes[0].nodeValue = t['nav_sports'];
        subnavLinks[5].childNodes[0].nodeValue = t['nav_activities'];
        subnavLinks[6].childNodes[0].nodeValue = t['nav_buzz'];
    }
    
    const recTitle = document.getElementById('movies-section');
    if (recTitle) recTitle.childNodes[0].nodeValue = t['recommended_movies'];
    
    const enterTitle = document.getElementById('events-section');
    if (enterTitle) enterTitle.childNodes[0].nodeValue = t['best_entertainment'];
    
    const signinBtn = document.getElementById('navbar-auth-btn');
    if (signinBtn) signinBtn.innerText = t['sign_in'];
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('cinemax_lang') || 'en';
    
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        langSelect.value = savedLang;
        langSelect.addEventListener('change', (e) => {
            changeLanguage(e.target.value);
        });
    }
    
    changeLanguage(savedLang);
});
