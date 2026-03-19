cl = io()

username = localStorage['username']
password = localStorage['password']

cl.send(JSON.stringify(['Join Room', {'room': 'mainroom', 'username': username, 'password': password}]))

let switch_room_mid_feed = []
let switch_room_mid_feed_toggle = false

function recv(message) {
    msg = eval(message)
    console.log(msg)
    if (msg[0] === 'Message') {
        if (switch_room_mid_feed_toggle) {
            switch_room_mid_feed.push(msg[1])
            return
        }
        else {
            data = msg[1]
            appendMessage(data['id'], data['username'], data['message'], data['time-stamp'], data['username'] === username)
        }
    }
    else if (msg[0] === 'Fetch Messages') {
        data = msg[1]
        for (var i in data) {
            appendMessage(data[i]['id'], data[i]['username'], data[i]['message'], data[i]['time-stamp'], data[i]['username'] === username)
        }
    }
    else if (msg[0] === 'Fetch Room Messages') {
        document.querySelector('#chat-feed').innerHTML = ''
        while (switch_room_mid_feed.length > 0) {
            var msg = switch_room_mid_feed.splice(0, 1)[0]
            appendMessage(msg['id'], msg['username'], msg['message'], msg['time-stamp'], msg['username'] === username)
        }
        switch_room_mid_feed_toggle = false
        data = msg[1]
        for (var i in data) {
            appendMessage(data[i]['id'], data[i]['username'], data[i]['message'], data[i]['time-stamp'], data[i]['username'] === username)
        }
        change_banner_picture(msg[3], false)
        document.querySelector('.room-title').textContent = msg[2].toUpperCase()
    }
    else if (msg[0] === 'Fetch DM Messages') {
        document.querySelector('#chat-feed').innerHTML = ''
        while (switch_room_mid_feed.length > 0) {
            var msg = switch_room_mid_feed.splice(0, 1)[0]
            appendMessage(msg['id'], msg['username'], msg['message'], msg['time-stamp'], msg['username'] === username)
        }
        switch_room_mid_feed_toggle = false
        data = msg[1]
        for (var i in data) {
            appendMessage(data[i]['id'], data[i]['username'], data[i]['message'], data[i]['time-stamp'], data[i]['username'] === username)
        }
        change_banner_picture(msg[3], true)
        let dmParts = msg[2].split('.$@-@&.');
        let actualUserDmUsername = dmParts[0] === username ? dmParts[1] : dmParts[0];
        document.querySelector('.room-title').textContent = actualUserDmUsername.toUpperCase()
    }
    else if (msg[0] === 'Get Rooms') {
        clearAllChatRoomOptions()
        data = msg[1]
        let unread = false
        for (var i in data) {
            let roomId = data[i]['name'];
            createChatRoomOption(roomId, data[i]['name'], data[i]['description'], function(){
                switch_room(data[i]['name'])
            }, false, unread, data[i]['emoji'], roomId===ROOM)
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
            createChatRoomOption(dmId, otherUsername, `${firstName} ${lastName}`, function(){
                switch_dm(otherUsername)
            }, `/static/profile-pictures/${otherUsername}.png`, true, true, (dmId===ROOM))
        }
        for (var i in data['read']) {
            let dmId = sortAndJoinStrings(username, data['read'][i]['username'])
            let otherUsername = data['read'][i]['username']
            let firstName = data['read'][i]['first_name']
            let lastName = data['read'][i]['last_name']
            createChatRoomOption(dmId, otherUsername, `${firstName} ${lastName}`, function(){
                switch_dm(otherUsername)
            }, `/static/profile-pictures/${otherUsername}.png`, false, true, (dmId===ROOM))
        }
    }

    else if (msg[0] === 'Create Room Results')
    {
        if (msg[1] === 'Room Already Exists')
        {
            Alert('Sorry, but that room already exists, please pick a different name.')
        }
        else if (msg[1] === 'Room Created')
        {
            Alert('Room Created succesfuly!', function(){
                location.reload()
            })
        }
    }

    else if (msg[0] === 'Create DM Results')
    {
        if (msg[1] === 'DM Already Exists')
        {
            Alert('Sorry, but that DM already exists, please pick a different user.')
        }
        else if (msg[1] === 'DM Created')
        {
            Alert('DM Created succesfuly!', function(){
                location.reload()
            })
        }
    }
}


let chatInput = document.querySelector('#chat-input')

let sendButton = document.querySelector('#send-btn')

chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendButton.click()
    }
})

function switch_room(roomname) {
    cl.send(JSON.stringify(['Switch Room', {'old-group': ROOM, 'room': roomname, 'username': username, 'password': password}]))
    switch_room_mid_feed_toggle = true
    ROOM = roomname
}

function switch_dm(dm_username) {
    cl.send(JSON.stringify(['Switch DM', {'old-group': ROOM, 'new-dm': sortAndJoinStrings(dm_username, username), 'username': username, 'password': password}]))
    switch_room_mid_feed_toggle = true
    ROOM = sortAndJoinStrings(dm_username, username)
}

sendButton.addEventListener('click', function() {
    cl.send(JSON.stringify(['Message', {'setting': 'room', 'room': ROOM, 'username': localStorage['username'], 'password': localStorage['password'], 'time-stamp': Date(), 'message': chatInput.value, 'reply-index': -1, 'upload': ''}]))
    chatInput.value = ''
})

function create_dm(user) {
    // TODO: Implement create DM functionality
    cl.send(JSON.stringify(['Create DM', {'username': username, 'password': password, 'user': user}]))
}

function create_chat_room(roomname, description, emoji, roomtype) {
    // TODO: Implement create chat room functionality
    cl.send(JSON.stringify(['Create Room', {'username': username, 'password': password, 'roomname': roomname, 'description': description, 'emoji': emoji, 'roomtype': roomtype}]))
}


document.getElementById('messenger-icon').addEventListener('click', function() {
    cl.send(JSON.stringify(['Get Dms', {'username': username, 'password': password}]))
});

document.getElementById('public-rooms-icon').addEventListener('click', function() {
    cl.send(JSON.stringify(['Get Rooms', {'username': username, 'password': password, 'roomtype': 'public'}]))
});

document.getElementById('private-rooms-icon').addEventListener('click', function() {
    cl.send(JSON.stringify(['Get Rooms', {'username': username, 'password': password, 'roomtype': 'private'}]))
});


cl.on('message', recv)

cl.send(JSON.stringify(['Fetch Messages', {'username': username, 'password': password, 'room': 'mainroom', 'limit': 50, 'offset': 0}]))
setTimeout(function() {
    cl.send(JSON.stringify(['Get Rooms', {'username': username, 'password': password, 'roomtype': 'public'}]))
}, 300);