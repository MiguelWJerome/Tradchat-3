// Network layer for GIF Admin Portal
// Handles all socket communication

const username = localStorage.getItem('username');
const password = localStorage.getItem('password');

if (username === null || password === null) {
    location.redirect('/login/');
}

const GIPHY_API_KEY = "aiWSDACCInT5DQcuk4hnjC7xMCeEspAv";

// Initialize socket connection
const cl = io();

/**
 * Search GIPHY API directly from browser
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @param {string} rating - Content rating (g, pg, pg-13)
 * @returns {Promise<Array>} GIF results
 */
async function searchGiphy(query, limit = 50, rating = 'g') {
    const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=${limit}&rating=${rating}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
}

/**
 * Send Add GIF request to server
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @param {string} giphyId - Giphy GIF ID
 * @param {Array<string>} keywords - Keywords for the GIF
 */
function emitAddGif(username, password, giphyId, keywords) {
    cl.send(JSON.stringify(['Add GIF', {    
        username: username,
        password: password,
        giphy_id: giphyId,
        keywords: keywords
    }]));
}

/**
 * Listen for Add GIF Result from server
 * @param {Function} callback - Handler for result
 */
function onAddGifResult(callback) {
    cl.on('message', function(msg) {
        const data = eval(msg);
        if (data[0] === 'Add GIF Result') {
            callback(data[1]);
        }
    });
}

/**
 * Get username from template
 * @returns {string} Username
 */
function getUsername() {
    return document.getElementById('username-data')?.dataset.username || '';
}

/**
 * Search local GIF database by keyword
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @param {string} query - Keyword query
 */
function emitGifSearch(username, password, query) {
    cl.send(JSON.stringify(['GIF Search', { 
        username: username,
        password: password,
        query: query
    }]));
}

/**
 * Send Delete GIF request to server
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @param {string} giphyId - Giphy GIF ID
 */
function emitDeleteGif(username, password, giphyId) {
    cl.send(JSON.stringify(['Delete Whitelisted GIF', {
        username: username,
        password: password,
        giphy_id: giphyId
    }]));
}

/**
 * Listen for GIF Search results
 * @param {Function} callback - Handler for results
 */
function onGifSearchResults(callback) {
    cl.on('message', function(msg) {
        const data = eval(msg);
        if (data[0] === 'GIF Search Results') {
            callback(data[1]);
        }
    });
}

/**
 * Listen for Delete GIF result
 * @param {Function} callback - Handler for result
 */
function onDeleteGifResult(callback) {
    cl.on('message', function(msg) {
        const data = eval(msg);
        if (data[0] === 'Delete Whitelisted GIF Result') {
            callback(data[1]);
        }
    });
}

// Export for use in looks layer
window.GifApproveNetwork = {
    searchGiphy,
    emitAddGif,
    emitGifSearch,
    emitDeleteGif,
    onAddGifResult,
    onGifSearchResults,
    onDeleteGifResult,
    getUsername
};
