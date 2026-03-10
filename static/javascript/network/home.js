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
}



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