// jQuery reference - ensure jQuery is loaded
if (typeof $ === 'undefined') {
    // If jQuery is not loaded, create a simple reference
    // This assumes jQuery is already loaded via the HTML
    console.error('[home.js] jQuery not found');
}

cl = io()

username = localStorage['username']
password = localStorage['password']

cl.send(JSON.stringify(['Join Room', {'room': 'mainroom', 'username': username, 'password': password}]))

function recv(message) {
    msg = eval(message)
    console.log(msg)
    if (msg[0] === 'Message') {
        data = msg[1]
        appendMessage(data['id'], data['username'], data['message'], data['time-stamp'], data['username'] === username)
    }
    else if (msg[0] === 'Fetch Messages') {
        data = msg[1]
        for (var i in data) {
            appendMessage(data[i]['id'], data[i]['username'], data[i]['message'], data[i]['time-stamp'], data[i]['username'] === username)
        }
    }
    else if (msg[0] === 'Get Rooms') {
        // Get rooms and add them to the sidebar
    }
}

// Initialize sidebar tray functionality when document is ready
$(document).ready(function() {
    // 1. Set 'Messenger' as active by default on load
    $('.tray-item:first').addClass('active');

    // 2. Handle Tray Item Clicks
    $('.tray-item').on('click', function() {
        // Remove active class from all items
        $('.tray-item').removeClass('active');
        
        // Add active class to the clicked item
        $(this).addClass('active');
        
        // Get the label to determine what to show
        var selectedView = $(this).find('.tray-item__label').text().replace(/\s+/g, '').toLowerCase();
        
        console.log("[home.js] Switching sidebar view to:", selectedView);

        /* Placeholder for toggling content:
           Here you can add logic to filter your #sidebar-list 
           or fetch different data based on 'selectedView' 
        */
        if (selectedView === 'messenger') {
            // Show DMs
            console.log('[home.js] Showing Messenger (DMs)');
        } else if (selectedView === 'publicrooms') {
            // Show Public Rooms
            console.log('[home.js] Showing Public Rooms');
        } else if (selectedView === 'privaterooms') {
            // Show Private Rooms
            console.log('[home.js] Showing Private Rooms');
        }
    });
});

let chatInput = document.querySelector('#chat-input')

let sendButton = document.querySelector('#send-btn')

chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendButton.click()
    }
})

sendButton.addEventListener('click', function() {
    cl.send(JSON.stringify(['Message', {'setting': 'room', 'room': room, 'username': localStorage['username'], 'password': localStorage['password'], 'time-stamp': Date(), 'message': chatInput.value, 'reply-index': -1, 'upload': ''}]))
    chatInput.value = ''
})


cl.on('message', recv)

cl.send(JSON.stringify(['Fetch Messages', {'room': 'mainroom', 'limit': 50, 'offset': 0}]))
setTimeout(function() {
    cl.send(JSON.stringify(['Get Rooms', {'username': username, 'password': password}]))
}, 500);