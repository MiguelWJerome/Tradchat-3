cl = io()

function recv(message) {
    msg = eval(message)
}

room = 'mainroom'

let chatInput = document.querySelector('#chat-input')

let sendButton = document.querySelector('#send-btn')

chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendButton.click()
    }
})

sendButton.addEventListener('click', function() {
    cl.send(JSON.stringify(['Message', {'setting': 'public room', 'room': room, 'username': localStorage['username'], 'password': localStorage['password'], 'time-stamp': new Date(), 'message': chatInput.value}]))
    chatInput.value = ''
})


cl.on('message', recv)