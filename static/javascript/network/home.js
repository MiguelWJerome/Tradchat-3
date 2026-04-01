cl = io()

username = localStorage['username']
password = localStorage['password']

let currentUpload = null;

cl.send(JSON.stringify(['Join Room', { 'room': ROOM, 'username': username, 'password': password }]))

let network_coast_clear_for_setting_fetching_messages_to_false = false

let attached_to_bottom = true

let fetch_messages_data_queue = []
let fetch_special_reply_messages_data_queue = []

function recv(message) {
    msg = eval(message)
    console.log(msg)
    if (msg[0] === 'Message') {
        // Only process messages for the current room

        data = msg[1]

        if (attached_to_bottom) {
            appendMessage({ 'index': data['id'], 'username': data['username'], 'message': data['message'], 'timestamp': data['timestamp'], 'myself': data['username'] === username, 'replyIndex': data['reply_id'], 'realtime': true })
            if (data['reactions']) {
                let $target = $(`.message__bubble[aria-index="${data['id']}"]`);
                for (let r of data['reactions']) {
                    for (let u of r.users) {
                        add_reaction($target, r.emoji, u);
                    }
                }
            }
        }
        else {
            toggle_new_messages_btn(true)
        }
    }


    else if (msg[0] === 'Fetch Room Messages' || msg[0] === 'Fetch DM Messages') {
        // 1. LOCK IMMEDIATELY (Safety first)
        FetchingMessages = true;

        messageBubbleIndex = 0;
        data = msg[1];

        fetch_messages_data_queue.push(data);

        setTimeout(() => {
            let data = fetch_messages_data_queue.splice(0, 1)[0];

            if (data['underhead'] && data['overhead']) {
                data['overhead'] = false;
            }

            if (!data['overhead'] && !data['underhead']) {
                document.querySelector('#message-container').innerHTML = '';
            }

            // Process batch messages
            messages = data['messages'];

            if (data['underhead'] && messages.length < 1) {
                attached_to_bottom = true
                toggle_overhead_animation(false)
                return
            }

            for (var i in messages) {
                appendMessage({
                    'index': messages[i]['id'], 'username': messages[i]['username'],
                    'message': messages[i]['message'], 'timestamp': messages[i]['timestamp'],
                    'myself': messages[i]['username'] === username,
                    'replyIndex': messages[i]['reply_id'], 'overhead': data['overhead'], 'underhead': data['underhead']
                }, {
                    'scrollToBottom': !data['underhead'] && !data['overhead'],
                    'specialScrollTo': null
                });
                
                if (messages[i]['reactions']) {
                    let $target = $(`.message__bubble[aria-index="${messages[i]['id']}"]`);
                    for (let r of messages[i]['reactions']) {
                        for (let u of r.users) {
                            add_reaction($target, r.emoji, u);
                        }
                    }
                }
            }

            // Handle UI Updates
            if (msg[0] === 'Fetch Room Messages') {
                change_banner_picture(data['emoji'], false);
                document.querySelector('.room-title').textContent = data['room'].toUpperCase();
            } else {
                change_banner_picture(data['profile_picture'], true);
                let dmParts = data['room'].split('.$@-@&.');
                let actualUserDmUsername = dmParts[0] === username ? dmParts[1] : dmParts[0];
                document.querySelector('.room-title').textContent = actualUserDmUsername.toUpperCase();
            }

            toggle_overhead_animation(false);

            // 1. Keep FetchingMessages = true right now. 
            // Do NOT set it to false yet.

            // 2. Use a timeout to wait for the browser to finish rendering 
            // and for the scroll to stabilize.
            setTimeout(() => {
                FetchingMessages = false;
                // Clear your helper flags here too
                we_are_currently_appending_messages_rn = false;
                network_coast_clear_for_setting_fetching_messages_to_false = false;
                console.log("Sensor safely re-enabled.");
            }, 150); // 150ms is the "sweet spot" for DOM reflow 

        }, data['underhead'] || data['overhead'] ? OVERHEAD_LOADER_DELAY : 0);

    }
    else if (msg[0] === 'Get Rooms') {
        clearAllChatRoomOptions()
        data = msg[1]
        let unread = false
        for (var i in data) {
            let roomId = data[i]['name'];
            createChatRoomOption(roomId, data[i]['name'], data[i]['description'], function () {
                switch_room(data[i]['name'])
            }, false, unread, data[i]['emoji'], roomId === ROOM)
        }
    }
    else if (msg[0] === 'Get Dms') {
        clearAllChatRoomOptions()
        data = msg[1]
        for (var i in data['unread']) {
            let dmId = sortAndJoinStrings(username, data['unread'][i]['username'])
            let otherUsername = data['unread'][i]['username']
            let firstName = data['unread'][i]['first_name']
            let lastName = data['unread'][i]['last_name']
            createChatRoomOption(dmId, otherUsername, `${firstName} ${lastName}`, function () {
                switch_dm(otherUsername)
            }, `/static/profile-pictures/${otherUsername}.png`, true, true, (dmId === ROOM))
        }
        for (var i in data['read']) {
            let dmId = sortAndJoinStrings(username, data['read'][i]['username'])
            let otherUsername = data['read'][i]['username']
            let firstName = data['read'][i]['first_name']
            let lastName = data['read'][i]['last_name']
            createChatRoomOption(dmId, otherUsername, `${firstName} ${lastName}`, function () {
                switch_dm(otherUsername)
            }, `/static/profile-pictures/${otherUsername}.png`, false, true, (dmId === ROOM))
        }
    }

    else if (msg[0] === 'Fetch Special Reply Message') {
        const data = msg[1];
        const message = data['message'];
        const orgIndex = data['orgIndex'];

        // Find the reply indicator that was waiting for this data

        const $indicator = $(`.message__bubble[aria-index="${orgIndex}"]`);

        if ($indicator.length) {
            // Update the username
            $indicator.find('.reply-username').text(message.username);

            // Update the message preview text
            $indicator.find('.reply-preview-text').text(message.message);

            // Update the avatar image
            $indicator.find('.reply-avatar').attr('src', `/static/profile-pictures/${message.username}.png`);
        }
    }

    else if (msg[0] === 'Fetch Special Reply Messages') {
        document.querySelector('#message-container').innerHTML = '';

        let data = msg[1];

        fetch_special_reply_messages_data_queue.push(data);

        setTimeout(() => {
            let data = fetch_special_reply_messages_data_queue.splice(0, 1)[0];
            let messages = data['messages'];

            for (var i in messages) {
                let message = messages[i];
                appendMessage(
                    {
                        'index': message['id'],
                        'username': message['username'],
                        'message': message['message'],
                        'timestamp': message['timestamp'],
                        'myself': message['username'] === username,
                        'replyIndex': message['reply_id']
                    },
                    {
                        'scrollToBottom': false,
                        'specialScrollTo': data['index']
                    }
                )

                if (message['reactions']) {
                    let $target = $(`.message__bubble[aria-index="${message['id']}"]`);
                    for (let r of message['reactions']) {
                        for (let u of r.users) {
                            add_reaction($target, r.emoji, u);
                        }
                    }
                }
            }

            toggle_overhead_animation(false)
            attached_to_bottom = false
        }, OVERHEAD_LOADER_DELAY);
    }
    
    else if (msg[0] === 'Added Reaction') {
        const data = msg[1];
        let $target = $(`.message__bubble[aria-index="${data['index']}"]`);
        if ($target.length) {
            add_reaction($target, data['emoji'], data['username']);
        }
    }

    else if (msg[0] === 'Removed Reaction') {
        const data = msg[1];
        let $target = $(`.message__bubble[aria-index="${data['index']}"]`);
        if ($target.length) {
            remove_reaction($target, data['emoji'], data['username']);
        }
    }

    else if (msg[0] === 'Create Room Results') {
        if (msg[1] === 'Room Already Exists') {
            console.log('Room already exists');
        }
        else if (msg[1] === 'Room Created') {
            location.reload();
        }
    }

    else if (msg[0] === 'Create DM Results') {
        if (msg[1] === 'DM Already Exists') {
            console.log('DM already exists');
        }
        else if (msg[1] === 'DM Created') {
            location.reload();
        }
    }
}


let chatInput = document.querySelector('#chat-input')

let sendButton = document.querySelector('#send-btn')

chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendButton.click()
    }
})

function switch_room(roomname) {
    FetchingMessages = true; // Lock it IMMEDIATELY on click
    cl.send(JSON.stringify(['Switch Room', { 'old-group': ROOM, 'room': roomname, 'username': username, 'password': password, 'limit': INITIAL_LIMIT }]))
    ROOM = roomname
}

function switch_dm(dm_username) {
    FetchingMessages = true; // Lock it IMMEDIATELY on click
    cl.send(JSON.stringify(['Switch DM', { 'old-group': ROOM, 'new-dm': sortAndJoinStrings(dm_username, username), 'username': username, 'password': password, 'limit': INITIAL_LIMIT }]))
    ROOM = sortAndJoinStrings(dm_username, username)
}

// Global reply index tracker for the reply system
let currentreply_id = -1;

sendButton.addEventListener('click', function () {
    if (chatInput.value.trim() === "" && !currentUpload) return; // Optional: prevent empty messages

    let setting = 'room';
    if (ROOM.split('.$@-@&.').length > 1) {
        setting = 'dm';
    }

    // Send the actual currentreply_id instead of hardcoded -1
    cl.send(JSON.stringify(['Message', {
        'setting': setting,
        'room': ROOM,
        'username': localStorage['username'],
        'password': localStorage['password'],
        'time-stamp': Date(),
        'message': chatInput.value,
        'reply-index': currentreply_id, // Dynamic index
        'upload': ''
    }]));

    chatInput.value = '';

    // Clear the reply state after sending
    if (typeof cancelReply === 'function') {
        cancelReply();
    }
})

// Bind mainroom button to switch to public rooms and join mainroom
document.getElementById('back-to-mainroom').addEventListener('click', function () {
    // Switch tray selection to Public Rooms
    document.getElementById('messenger-icon').classList.remove('active');
    document.getElementById('private-rooms-icon').classList.remove('active');
    document.getElementById('public-rooms-icon').classList.add('active');

    // Get public rooms list
    cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'public' }]));

    // Switch to mainroom
    switch_room('mainroom');
});

// Bind Create button in sidebar to open modal
document.getElementById('create-btn').addEventListener('click', function () {
    roomModal('show');
    emojiPicker.re_attach('#selected-emoji', function (emoji) { document.querySelector('#selected-emoji').innerHTML = emoji })
});

function create_dm(user) {
    // TODO: Implement create DM functionality
    cl.send(JSON.stringify(['Create DM', { 'username': username, 'password': password, 'user': user }]))
}

function create_chat_room(roomname, description, emoji, roomtype) {
    // TODO: Implement create chat room functionality
    cl.send(JSON.stringify(['Create Room', { 'username': username, 'password': password, 'roomname': roomname, 'description': description, 'emoji': emoji, 'roomtype': roomtype }]))
}

function fetch_underhead_messages(offset_id) {
    FetchingMessages = true; // Lock it immediately so it doesn't fire twice
    toggle_overhead_animation(true);

    // Fetch newer messages after the message with offset_id
    fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages'
    cl.send(JSON.stringify([fetch_type, {
        'username': username,
        'password': password,
        'room': ROOM, // ROOM holds the sorted dm string
        'limit': FETCH_LIMIT,
        'offset': `>${offset_id}`
    }]));
}

function fetch_overhead_messages(offset_id) {
    FetchingMessages = true; // Lock it immediately so it doesn't fire twice
    toggle_overhead_animation(true);

    // Fetch older messages before the message with offset_id
    fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages'
    cl.send(JSON.stringify([fetch_type, {
        'username': username,
        'password': password,
        'room': ROOM, // ROOM holds the sorted dm string
        'limit': FETCH_LIMIT,
        'offset': offset_id
    }]));
}

function fetch_special_reply_message(index, orgIndex) {
    cl.send(JSON.stringify(['Fetch Special Reply Message', { 'username': username, 'password': password, 'index': index, 'orgIndex': orgIndex, 'room': ROOM }]))
}

function fetch_special_reply_messages(index) {
    cl.send(JSON.stringify(['Fetch Special Reply Messages', { 'username': username, 'password': password, 'index': index, 'room': ROOM, 'limit': SPECIAL_REPLY_LIMIT }]))
    toggle_overhead_animation(true)
}

function broadcast_added_reaction(index, emoji) {
    cl.send(JSON.stringify(['Added Reaction', { 'username': username, 'password': password, 'index': index, 'room': ROOM, 'emoji': emoji }]))
}

function broadcast_removed_reaction(index, emoji) {
    cl.send(JSON.stringify(['Removed Reaction', { 'username': username, 'password': password, 'index': index, 'room': ROOM, 'emoji': emoji }]))
}

function broadcast_delete_message(index) {
    cl.send(JSON.stringify(['Delete Message', { 'username': username, 'password': password, 'index': index, 'room': ROOM }]));
}

document.getElementById('messenger-icon').addEventListener('click', function () {
    cl.send(JSON.stringify(['Get Dms', { 'username': username, 'password': password }]))
});

document.getElementById('public-rooms-icon').addEventListener('click', function () {
    cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'public' }]))
});

document.getElementById('private-rooms-icon').addEventListener('click', function () {
    cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'private' }]))
});


const emojiPicker = new lc_emoji_picker('#emoji-btn', {
    emoji_json_url: '/static/emoji.json',
    selection_callback: function (emoji) { document.querySelector('#chat-input').value += emoji }
});

document.querySelector('#selected-emoji').onclick = function () {
    emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji })
};


// Create Room Form Handling
const createRoomForm = document.getElementById('create-room-form');
const roomNameInput = document.getElementById('room-name');
const roomDescInput = document.getElementById('room-description');
const roomEmojiInput = document.getElementById('room-emoji');

// Prevent Enter key from submitting when form is valid
function handleEnterKey(e) {
    if (e.key === 'Enter') {
        const form = e.target.closest('form');
        if (form && form.checkValidity()) {
            e.preventDefault();
        }
    }
}

roomNameInput.addEventListener('keypress', handleEnterKey);
roomDescInput.addEventListener('keypress', handleEnterKey);

// Input validation feedback
function validateInput(input) {
    if (input.value.trim().length > 0) {
        input.style.borderColor = 'var(--color-medium)';
    } else {
        input.style.borderColor = 'var(--color-dark)';
    }
}

roomNameInput.addEventListener('input', function () {
    validateInput(this);
});

roomDescInput.addEventListener('input', function () {
    validateInput(this);
});

// Form submission
if (createRoomForm) {
    createRoomForm.addEventListener('submit', function (e) {
        if (this.checkValidity()) {
            // All fields filled - prevent submission and call JS function
            e.preventDefault();

            const roomname = roomNameInput.value.trim();
            const description = roomDescInput.value.trim();
            const emoji = roomEmojiInput.value;
            const roomtype = document.querySelector('input[name="roomtype"]:checked').value;

            // Validate emoji is selected
            if (!emoji) {
                document.querySelector('.emoji-display').style.borderColor = 'red';
                return;
            }

            create_chat_room(roomname, description, emoji, roomtype);
        }
        // If form is not valid, let it submit naturally to show HTML5 validation
    });
}


cl.on('message', recv)



$(document).ready(function () {
    if (ROOM_TYPE === 'public') {

        document.getElementById('public-rooms-icon').classList.add('active');
        change_banner_picture(ROOM_EMOJI, false);
        document.querySelector('.room-title').textContent = ROOM.toUpperCase()
        changeSelectedRoomOption(ROOM)

        cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'public' }]))

    } else if (ROOM_TYPE === 'private') {

        document.getElementById('private-rooms-icon').classList.add('active');
        change_banner_picture(ROOM_EMOJI, false);
        document.querySelector('.room-title').textContent = ROOM.toUpperCase()
        changeSelectedRoomOption(ROOM)

        cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'private' }]))

    } else if (ROOM_TYPE === 'dm') {

        document.getElementById('messenger-icon').classList.add('active');
        change_banner_picture(ROOM_EMOJI, true);
        let dmParts = ROOM.split('.$@-@&.');
        let actualUserDmUsername = dmParts[0] === username ? dmParts[1] : dmParts[0];
        document.querySelector('.room-title').textContent = actualUserDmUsername.toUpperCase()
        changeSelectedRoomOption(ROOM)

        cl.send(JSON.stringify(['Get Dms', { 'username': username, 'password': password }]))

    }


    setTimeout(function () {
        // Set FetchingMessages to true BEFORE sending the request
        FetchingMessages = true;

        fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages';
        cl.send(JSON.stringify([fetch_type, {
            'username': username,
            'password': password,
            'room': ROOM,
            'limit': INITIAL_LIMIT,
            'offset': -1
        }]));
    }, 300);
});
