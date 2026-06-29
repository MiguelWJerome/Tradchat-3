// Network layer for Admin Portal
// Handles all socket communication and HTTP requests

(function() {
    if (typeof cl === 'undefined') {
        window.cl = io();
    }

    // --- HTTP Requests ---
    function fetchAlerts() {
        return fetch('/admin/alerts/').then(res => res.json());
    }

    function markAlertAsRead(alertId) {
        return fetch(`/admin/alerts/seen/${alertId}/`, { method: 'POST' }).then(res => res.json());
    }

    // Resolve alert via POST
    function resolveAlert(alertId) {
        return fetch(`/admin/alerts/resolve/${alertId}/`, { method: 'POST' }).then(res => res.json());
    }

    // --- Socket Emitters ---
    function emitGetTargetAdminData(targetUser) {
        cl.send(JSON.stringify(['Get Target Admin Data', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            target_user: targetUser
        }]));
    }

    function emitGetAdminRequests() {
        cl.send(JSON.stringify(['Get Admin Requests', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password')
        }]));
    }

    // Create a pending action request (freeze, unfreeze, delete)
    function emitCreateAdminRequest(targetUser, actionType) {
        cl.send(JSON.stringify(['Create Admin Request', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            target_user: targetUser,
            action_type: actionType
        }]));
    }

    function emitVoteAdminRequest(requestId, vote) {
        cl.send(JSON.stringify(['Vote Admin Request', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            request_id: requestId,
            vote: vote
        }]));
    }

    function emitUpdateParentalLocks(targetUser, locks) {
        cl.send(JSON.stringify(['Update Parental Locks', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            target_user: targetUser,
            locks: locks
        }]));
    }

    function emitClearUnseenAction(tab) {
        cl.send(JSON.stringify(['Clear Unseen Action', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            tab: tab
        }]));
    }

    // --- GIF Approval Socket Emitters (Merged from network/gif_approve.js) ---
    const GIPHY_API_KEY = "aiWSDACCInT5DQcuk4hnjC7xMCeEspAv";

    async function searchGiphy(query, limit = 50, rating = 'g') {
        const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=${GIPHY_API_KEY}&limit=${limit}&rating=${rating}`;
        const response = await fetch(url);
        const data = await response.json();
        return data.data || [];
    }

    function emitAddGif(giphyId, keywords) {
        cl.send(JSON.stringify(['Add GIF', {    
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            giphy_id: giphyId,
            keywords: keywords
        }]));
    }

    function emitGifSearch(query) {
        cl.send(JSON.stringify(['GIF Search', { 
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            query: query
        }]));
    }

    function emitGetMatchingKeywords(query) {
        cl.send(JSON.stringify(['Get Matching Keywords', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            query: query
        }]));
    }

    function emitDeleteGif(giphyId) {
        cl.send(JSON.stringify(['Delete Whitelisted GIF', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            giphy_id: giphyId
        }]));
    }

    function emitGetGifKeywords(giphyId) {
        cl.send(JSON.stringify(['Get GIF Keywords', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            giphy_id: giphyId
        }]));
    }

    function emitUpdateGifKeywords(giphyId, keywords) {
        cl.send(JSON.stringify(['Update GIF Keywords', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            giphy_id: giphyId,
            keywords: keywords
        }]));
    }

    function emitAdminGetUserConversations(targetUser) {
        cl.send(JSON.stringify(['Admin Get User Conversations', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            target_user: targetUser
        }]));
    }

    function emitAdminGetConversationMessages(targetUser, convoType, targetId, beforeId = null, filterQuery = '') {
        cl.send(JSON.stringify(['Admin Get Conversation Messages', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            target_user: targetUser,
            convo_type: convoType,
            target_id: targetId,
            before_id: beforeId,
            filter_query: filterQuery
        }]));
    }

    // --- Socket Message Routing ---
    function setupSocketListener(onMessageCallback) {
        cl.on('message', function(msg) {
            let data;
            try {
                data = eval(msg);
            } catch(e) {
                return;
            }
            onMessageCallback(data);
        });
    }

    // Export for use in looks layer
    window.AdminNetwork = {
        fetchAlerts,
        markAlertAsRead,
        resolveAlert,
        emitGetTargetAdminData,
        emitGetAdminRequests,
        emitCreateAdminRequest,
        emitVoteAdminRequest,
        emitUpdateParentalLocks,
        emitClearUnseenAction,
        emitAdminGetUserConversations,
        emitAdminGetConversationMessages,
        // GIF approval emitters
        searchGiphy,
        emitAddGif,
        emitGifSearch,
        emitGetMatchingKeywords,
        emitDeleteGif,
        emitGetGifKeywords,
        emitUpdateGifKeywords,
        setupSocketListener
    };
})();

