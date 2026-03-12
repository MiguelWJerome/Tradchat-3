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
        if (typeof(msg[2]) === 'string') {
            while (switch_room_mid_feed.length > 0) {
                var msg = switch_room_mid_feed.splice(0, 1)[0]
                appendMessage(msg['id'], msg['username'], msg['message'], msg['time-stamp'], msg['username'] === username)
            }
            switch_room_mid_feed_toggle = false
        }
    }
    else if (msg[0] === 'Get Rooms') {
        data = msg[1]
        for (var i in data) {
            createChatRoomOption(data[i]['roomname'], data[i]['description'], function(){
                switch_room(data[i]['roomname'])
            }, data[i]['emoji'])
        }
    }
    else if (msg[0] === 'Get Dms') {
        data = msg[1]
        for (var i in data) {
            createChatRoomOption(data[i]['username'], `${data[i]['first_name']} ${data[i]['last_name']}`, function(){
                switch_dm(data[i]['username'])
            }, `/static/profile-pictres/${data[i]['username']}.png`)
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
    clearAllChatRoomOptions()
    cl.send(JSON.stringify(['Switch Room', {'old-group': ROOM, 'room': roomname, 'username': username, 'password': password}]))
    switch_room_mid_feed_toggle = true
    ROOM = roomname
}

function switch_dm(dm_username) {
    clearAllChatRoomOptions()
    cl.send(JSON.stringify(['Switch DM', {'old-group': ROOM, 'new-dm': sortAndJoinStrings(dm_username, username), 'username': username, 'password': password}]))
    switch_room_mid_feed_toggle = true
    ROOM = sortAndJoinStrings(dm_username, username)
}

sendButton.addEventListener('click', function() {
    cl.send(JSON.stringify(['Message', {'setting': 'room', 'room': ROOM, 'username': localStorage['username'], 'password': localStorage['password'], 'time-stamp': Date(), 'message': chatInput.value, 'reply-index': -1, 'upload': ''}]))
    chatInput.value = ''
})

function create_dm(username) {
    // TODO: Implement create DM functionality
    cl.send(JSON.stringify(['Create DM', {'username': username}]))
}

function create_chat_room(roomname, description, emoji, roomtype) {
    // TODO: Implement create chat room functionality
    cl.send(JSON.stringify(['Create Room', {'username': username, 'password': password, 'roomname': roomname, 'description': description, 'emoji': emoji, 'roomtype': roomtype}]))
}


cl.on('message', recv)

cl.send(JSON.stringify(['Fetch Messages', {'username': username, 'password': password, 'room': 'mainroom', 'limit': 50, 'offset': 0}]))
setTimeout(function() {
    cl.send(JSON.stringify(['Get Dms', {'username': username, 'password': password}]))
}, 300);