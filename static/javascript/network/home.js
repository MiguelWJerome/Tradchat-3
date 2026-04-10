cl = io()

username = localStorage['username']
password = localStorage['password']

let currentUpload = [];

let network_coast_clear_for_setting_fetching_messages_to_false = false

let attached_to_bottom = true

let fetch_messages_data_queue = []
let fetch_special_reply_messages_data_queue = []

function recv(message) {
    msg = eval(message);
    console.log(msg);
    if (msg[0] === 'Message') {
        data = msg[1];
        if (attached_to_bottom) {
            appendMessage({ 'index': data['id'], 'username': data['username'], 'message': data['message'], 'timestamp': data['timestamp'], 'myself': data['username'] === username, 'replyIndex': data['reply_id'], 'realtime': true, 'deleted': data['deleted'], 'upload': data['upload'] });
            if (data['reactions']) {
                let $target = $(`.message__bubble[aria-index="${data['id']}"]`);
                for (let r of data['reactions']) {
                    for (let u of r.users) {
                        add_reaction($target, r.emoji, u);
                    }
                }
            }
        } else {
            toggle_new_messages_btn(true);
        }
    }
    else if (msg[0] === 'Fetch Room Messages' || msg[0] === 'Fetch DM Messages') {
        FetchingMessages = true;
        messageBubbleIndex = 0;
        data = msg[1];
        fetch_messages_data_queue.push(data);
        setTimeout(() => {
            let data = fetch_messages_data_queue.splice(0, 1)[0];
            if (data['underhead'] && data['overhead']) data['overhead'] = false;
            if (!data['overhead'] && !data['underhead']) {
                document.querySelector('#message-container').innerHTML = '';
            }
            messages = data['messages'];
            if (data['underhead'] && messages.length < 1) {
                attached_to_bottom = true;
                toggle_overhead_animation(false);
                return;
            }
            for (var i in messages) {
                appendMessage({
                    'index': messages[i]['id'], 'username': messages[i]['username'],
                    'message': messages[i]['message'], 'timestamp': messages[i]['timestamp'],
                    'myself': messages[i]['username'] === username,
                    'replyIndex': messages[i]['reply_id'], 'overhead': data['overhead'], 'underhead': data['underhead'],
                    'deleted': messages[i]['deleted'], 'upload': messages[i]['upload']
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
            if (msg[0] === 'Fetch Room Messages') {
                window.myRole = data['myRole'] || 'Member';
                change_banner_picture(data['emoji'], false);
                document.querySelector('.room-title').textContent = data['room'].toUpperCase();
            } else {
                window.myRole = 'Member';
                change_banner_picture(data['profile_picture'], true);
                let dmParts = data['room'].split('.$@-@&.');
                let actualUserDmUsername = dmParts[0] === username ? dmParts[1] : dmParts[0];
                document.querySelector('.room-title').textContent = actualUserDmUsername.toUpperCase();
            }
            toggle_overhead_animation(false);
            setTimeout(() => {
                FetchingMessages = false;
                we_are_currently_appending_messages_rn = false;
                network_coast_clear_for_setting_fetching_messages_to_false = false;
            }, 150);
        }, data['underhead'] || data['overhead'] ? OVERHEAD_LOADER_DELAY : 0);
    }
    else if (msg[0] === 'Get Rooms') {
        clearAllChatRoomOptions();
        data = msg[1];
        let unread = false;
        for (let room of data) {
            let roomId = room['name'];
            createChatRoomOption(roomId, room['name'], room['description'], function () {
                switch_room(room['name']);
            }, false, unread, room['emoji'], roomId === ROOM);
        }
    }
    else if (msg[0] === 'Get Dms') {
        clearAllChatRoomOptions();
        data = msg[1];
        for (let dm of data['unread']) {
            let dmId = sortAndJoinStrings(username, dm['username']);
            let otherUsername = dm['username'];
            createChatRoomOption(dmId, otherUsername, `${dm['first_name']} ${dm['last_name']}`, function () {
                switch_dm(otherUsername);
            }, `/static/profile-pictures/${otherUsername}.png`, true, true, (dmId === ROOM));
        }
        for (let dm of data['read']) {
            let dmId = sortAndJoinStrings(username, dm['username']);
            let otherUsername = dm['username'];
            createChatRoomOption(dmId, otherUsername, `${dm['first_name']} ${dm['last_name']}`, function () {
                switch_dm(otherUsername);
            }, `/static/profile-pictures/${otherUsername}.png`, false, true, (dmId === ROOM));
        }
    }
    else if (msg[0] === 'Fetch Special Reply Message') {
        const data = msg[1];
        const message = data['message'];
        const orgIndex = data['orgIndex'];
        const $indicator = $(`.message__bubble[aria-index="${orgIndex}"]`);
        if ($indicator.length) {
            $indicator.find('.reply-username').text(message.username);
            const $previewText = $indicator.find('.reply-preview-text');
            $previewText.text(message.message);
            if (message.deleted) $previewText.css({"font-style": "italic", "color": "#777"});
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
                appendMessage({
                    'index': message['id'], 'username': message['username'],
                    'message': message['message'], 'timestamp': message['timestamp'],
                    'myself': message['username'] === username,
                    'replyIndex': message['reply_id'], 'deleted': message['deleted'], 'upload': message['upload']
                }, { 'scrollToBottom': false, 'specialScrollTo': data['index'] });
                if (message['reactions']) {
                    let $target = $(`.message__bubble[aria-index="${message['id']}"]`);
                    for (let r of message['reactions']) {
                        for (let u of r.users) add_reaction($target, r.emoji, u);
                    }
                }
            }
            toggle_overhead_animation(false);
            attached_to_bottom = false;
        }, OVERHEAD_LOADER_DELAY);
    }
    else if (msg[0] === 'Added Reaction') {
        const data = msg[1];
        let $target = $(`.message__bubble[aria-index="${data['index']}"]`);
        if ($target.length) add_reaction($target, data['emoji'], data['username']);
    }
    else if (msg[0] === 'Removed Reaction') {
        const data = msg[1];
        let $target = $(`.message__bubble[aria-index="${data['index']}"]`);
        if ($target.length) remove_reaction($target, data['emoji'], data['username']);
    }
    else if (msg[0] === 'Create Room Results') {
        if (msg[1] === 'Room Already Exists') Alert('Room already exists. Please choose a different name.');
        else if (msg[1] === 'Room Created') Alert('Room created successfully!', function() { location.reload(); });
    }
    else if (msg[0] === 'Create DM Results') {
        if (msg[1] === 'DM Already Exists') console.log('DM already exists');
        else if (msg[1] === 'DM Created') Alert('DM created successfully!', function() { location.reload(); });
    }
    else if (msg[0] === 'Get Room Members Results') {
        const data = msg[1];
        if (typeof renderRoomMembers === 'function') renderRoomMembers(data.members, data.myRole, data.roomType, roomMemberCallbacks);
    }
    else if (msg[0] === 'Room Member Updated') {
        if (window.isRoomDetailsOpen) cl.send(JSON.stringify(['Get Room Members', { 'username': username, 'password': password, 'room': ROOM }]));
    }
    else if (msg[0] === 'Room Error') Alert(msg[1]);
    else if (msg[0] === 'Room Deleted') {
        const data = msg[1];
        if (data.room === ROOM) {
            Alert(`Sorry, this room has been retired or deleted by its owner. We are redirecting you back to the main lobby.`, () => {
                switch_room('mainroom');
            });
        }
    }
    else if (msg[0] === 'Message Deleted') {
        const data = msg[1];
        const index = data['id'];
        const room = data['room'];

        if (room === ROOM) {
            let $bubble = $(`.message__bubble[aria-index="${index}"]`);
            if ($bubble.length) {
                const $msgGroup = $bubble.closest('.message');
                const isOwn = $msgGroup.hasClass('own');
                const $prevBubbles = $bubble.prevAll('.message__bubble');
                const $nextBubbles = $bubble.nextAll('.message__bubble');
                
                const $originalAvatar = $msgGroup.find('.message__avatar').first().clone();
                const $originalNameWrapper = $msgGroup.find('.message__content > div').first().clone();
                
                const $deletedGroup = $('<div>').addClass('message').addClass(isOwn ? 'own' : '');
                const $deletedContent = $('<div>').addClass('message__content');
                
                let $text = $bubble.find('.message__text');
                $text.text("(message has been deleted)").css({"font-style": "italic", "color": "#777"});
                $bubble.find('.message-actions').remove();
                $bubble.next('.message__reactions').remove(); 
                
                $deletedContent.append($bubble);
                $deletedGroup.append($deletedContent);
                
                if ($nextBubbles.length > 0) {
                    const $afterGroup = $('<div>').addClass('message').addClass(isOwn ? 'own' : '');
                    const $afterContent = $('<div>').addClass('message__content');
                    $afterContent.append($originalNameWrapper.clone());
                    $nextBubbles.get().reverse().forEach(el => {
                        $afterContent.append($(el));
                    });
                    $afterGroup.append($originalAvatar.clone(), $afterContent);
                    $msgGroup.after($afterGroup);
                    $afterGroup.before($deletedGroup);
                } else {
                    $msgGroup.after($deletedGroup);
                }
                
                if ($prevBubbles.length === 0) {
                    $msgGroup.remove();
                }

                $(`.reply-container[data-target-index="${index}"]`).each(function() {
                    let $preview = $(this).find('.reply-preview-text');
                    $preview.text("(message has been deleted)").css({"font-style": "italic", "color": "#777"});
                });
            }
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
    if (typeof window.closeRoomDetails === 'function') window.closeRoomDetails();
    if (document.getElementById('chat-panel-header')) {
        document.getElementById('chat-panel-header').style.cursor = 'pointer';
    }
    FetchingMessages = true;
    cl.send(JSON.stringify(['Switch Room', { 'old-group': ROOM, 'room': roomname, 'username': username, 'password': password, 'limit': INITIAL_LIMIT }]))
    ROOM = roomname
}

function switch_dm(dm_username) {
    if (typeof window.closeRoomDetails === 'function') window.closeRoomDetails();
    if (document.getElementById('chat-panel-header')) {
        document.getElementById('chat-panel-header').style.cursor = 'default';
    }
    FetchingMessages = true;
    cl.send(JSON.stringify(['Switch DM', { 'old-group': ROOM, 'new-dm': sortAndJoinStrings(dm_username, username), 'username': username, 'password': password, 'limit': INITIAL_LIMIT }]))
    ROOM = sortAndJoinStrings(dm_username, username)
}

window.emitCreateRoom = function(roomname, description, emoji, roomtype) {
    cl.send(JSON.stringify(['Create Room', {
        'username': username,
        'password': password,
        'roomname': roomname,
        'description': description,
        'emoji': emoji,
        'roomtype': roomtype
    }]));
};

let currentreply_id = -1;

sendButton.addEventListener('click', function () {
    if (chatInput.value.trim() === "" && currentUpload.length === 0) return;
    let setting = ROOM.split('.$@-@&.').length > 1 ? 'dm' : 'room';

    let uploadData = '';
    let imagesToUpload = [];

    let IDs = [];
    if (currentUpload.length > 0) {
        currentUpload.forEach((dataUrl, index) => {
            const randomID = Math.floor(Math.random() * 9000000000 + 1000000000);
            const uploadID = username + password + randomID + "_" + index;
            IDs.push(uploadID);
            imagesToUpload.push({ 'id': uploadID, 'image': dataUrl });
        });
        uploadData = IDs.join('|');
    }

    cl.send(JSON.stringify(['Message', {
        'setting': setting, 'room': ROOM, 'username': username,
        'password': password, 'time-stamp': Date(),
        'message': chatInput.value, 'reply-index': currentreply_id, 
        'upload': uploadData
    }]));

    if (imagesToUpload.length > 0) {
        setTimeout(() => {
            imagesToUpload.forEach(item => {
                cl.send(JSON.stringify(['Image Upload', {
                    'upload_id': item.id,
                    'image': item.image,
                    'username': username,
                    'password': password
                }]));
            });
        }, 200);
    }

    chatInput.value = '';
    clearUpload();
    if (typeof cancelReply === 'function') cancelReply();
})

function clearUpload() {
    currentUpload = [];
    $('#file-upload-input').val('');
    $('#upload-preview-strip').empty();
    $('#upload-preview-container').hide();
}

// previewClose listener handled in $(document).ready now

document.getElementById('back-to-mainroom').addEventListener('click', function () {
    document.getElementById('messenger-icon').classList.remove('active');
    document.getElementById('private-rooms-icon').classList.remove('active');
    document.getElementById('public-rooms-icon').classList.add('active');
    cl.send(JSON.stringify(['Get Rooms', { 'username': username, 'password': password, 'roomtype': 'public' }]));
    switch_room('mainroom');
});

document.getElementById('create-btn').addEventListener('click', function () {
    roomModal('show');
    emojiPicker.re_attach('#selected-emoji', function (emoji) { document.querySelector('#selected-emoji').innerHTML = emoji })
});

function create_dm(user) {
    cl.send(JSON.stringify(['Create DM', { 'username': username, 'password': password, 'user': user }]))
}

function create_chat_room(roomname, description, emoji, roomtype) {
    cl.send(JSON.stringify(['Create Room', { 'username': username, 'password': password, 'roomname': roomname, 'description': description, 'emoji': emoji, 'roomtype': roomtype }]))
}

function fetch_underhead_messages(offset_id) {
    FetchingMessages = true;
    toggle_overhead_animation(true);
    fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages'
    cl.send(JSON.stringify([fetch_type, { 'username': username, 'password': password, 'room': ROOM, 'limit': FETCH_LIMIT, 'offset': `>${offset_id}` }]));
}

function fetch_overhead_messages(offset_id) {
    FetchingMessages = true;
    toggle_overhead_animation(true);
    fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages'
    cl.send(JSON.stringify([fetch_type, { 'username': username, 'password': password, 'room': ROOM, 'limit': FETCH_LIMIT, 'offset': `<${offset_id}` }]));
}

window.broadcast_delete_message = function (index) {
    if (!index) return;
    cl.send(JSON.stringify(['Delete Message', { 'username': username, 'password': password, 'index': index, 'room': ROOM }]));
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

const createRoomForm = document.getElementById('create-room-form');
const roomNameInput = document.getElementById('room-name');
const roomDescInput = document.getElementById('room-description');
const roomEmojiInput = document.getElementById('room-emoji');

function handleEnterKey(e) {
    if (e.key === 'Enter') {
        const form = e.target.closest('form');
        if (form && form.checkValidity()) e.preventDefault();
    }
}

roomNameInput.addEventListener('keypress', handleEnterKey);
roomDescInput.addEventListener('keypress', handleEnterKey);

function validateInput(input) {
    input.style.borderColor = input.value.trim().length > 0 ? 'var(--color-medium)' : 'var(--color-dark)';
}

roomNameInput.addEventListener('input', function () { validateInput(this); });
roomDescInput.addEventListener('input', function () { validateInput(this); });

if (createRoomForm) {
    createRoomForm.addEventListener('submit', function (e) {
        if (this.checkValidity()) {
            e.preventDefault();
            const roomname = roomNameInput.value.trim();
            const description = roomDescInput.value.trim();
            const emoji = roomEmojiInput.value;
            const roomtype = document.querySelector('input[name="roomtype"]:checked').value;
            if (!emoji) {
                document.querySelector('.emoji-display').style.borderColor = 'red';
                return;
            }
            create_chat_room(roomname, description, emoji, roomtype);
        }
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
        FetchingMessages = true;
        fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages';
        cl.send(JSON.stringify([fetch_type, { 'username': username, 'password': password, 'room': ROOM, 'limit': INITIAL_LIMIT, 'offset': -1 }]));
    }, 300);
});

const roomMemberCallbacks = {
    onPromoteDemote: function(targetUsername, action) {
        cl.send(JSON.stringify(['Update Room Member', { 'username': username, 'password': password, 'room': ROOM, 'target_username': targetUsername, 'action': action }]));
    },
    onRemove: function(targetUsername) {
        cl.send(JSON.stringify(['Update Room Member', { 'username': username, 'password': password, 'room': ROOM, 'target_username': targetUsername, 'action': 'remove' }]));
    },
    onAdd: function(newUsername) {
        cl.send(JSON.stringify(['Add Room Member', { 'username': username, 'password': password, 'room': ROOM, 'new_username': newUsername }]));
    },
    onDeleteRoom: function() {
        cl.send(JSON.stringify(['Delete Room', { 'username': username, 'password': password, 'room': ROOM }]));
    }
};

window.onOpenRoomDetails = function() {
    cl.send(JSON.stringify(['Get Room Members', { 'username': username, 'password': password, 'room': ROOM }]));
};

$(document).ready(function() {
    if (ROOM_TYPE === 'dm') {
        const dmParts = ROOM.split('.$@-@&.');
        const otherUser = dmParts[0] === username ? dmParts[1] : dmParts[0];
        switch_dm(otherUser);
    } else {
        switch_room(ROOM);
    }

    // --- Image Upload Interaction (Multiple images) ---
    $('#upload-btn').on('click', () => $('#file-upload-input').click());

    $('#file-upload-input').on('change', function(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            if (file.size > 20 * 1024 * 1024) {
                if (typeof Alert === 'function') Alert(`"${file.name}" is too large. Please select images under 20MB.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    console.log(`[DEBUG] Image loaded in browser: ${img.width}x${img.height}`);
                    
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    let w = img.width;
                    let h = img.height;
                    const narrowest = Math.min(w, h);
                    
                    if (narrowest > 800) {
                        const scale = 800 / narrowest;
                        w = Math.floor(w * scale);
                        h = Math.floor(h * scale);
                        console.log(`[DEBUG] Resizing client-side to: ${w}x${h}`);
                    }
                    
                    canvas.width = w;
                    canvas.height = h;
                    ctx.drawImage(img, 0, 0, w, h);
                    
                    const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    console.log(`[DEBUG] Client-side processing complete. Final payload size: ${Math.round(resizedDataUrl.length / 1024)} KB`);
                    
                    currentUpload.push(resizedDataUrl);

                    // Build a thumbnail card with its own X
                    const idx = currentUpload.length - 1;
                    const $card = $(`
                        <div class="upload-preview-item" data-idx="${idx}">
                            <img src="${resizedDataUrl}" alt="Upload Preview" />
                            <button class="preview-close-btn" aria-label="Remove image">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    `);

                    $card.find('.preview-close-btn').on('click', function(e) {
                        e.preventDefault();
                        const cardIdx = parseInt($card.attr('data-idx'));
                        currentUpload.splice(cardIdx, 1);
                        $card.remove();
                        // Re-index remaining cards
                        $('#upload-preview-strip .upload-preview-item').each(function(i) {
                            $(this).attr('data-idx', i);
                        });
                        if (currentUpload.length === 0) {
                            $('#upload-preview-container').hide();
                        }
                    });

                    $('#upload-preview-strip').append($card);
                    $('#upload-preview-container').show();

                    if (attached_to_bottom) {
                        let $feed = $('#chat-feed');
                        $feed.scrollTop($feed[0].scrollHeight);
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Reset input so same files can be re-selected later
        $(this).val('');
    });
});
