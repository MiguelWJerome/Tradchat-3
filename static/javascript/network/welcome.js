cl = io()

cl.connect('http://'+document.domain+':'+location.port)

if (typeof(localStorage['username']) !== 'undefined' && typeof(localStorage['password']) !== 'undefined') {
    cl.send(JSON.stringify(['Secret Log In', {username: localStorage['username'], password: localStorage['password']}]));
}

function recv(message) {
    msg = eval(message)
    
    if (msg[0] === 'Log In Results') {
        hideLoadingOverlay()
        if (msg[2] === 'Success') {
            localStorage['username'] = msg[1]
            localStorage['password'] = msg[3]
            form('/computer-log-into-server/', {'username': localStorage['username'], 'password': localStorage['password']}, 'post')
        }
        else if (msg[2] === 'Wrong Username')
        {
            Alert('Wrong Username')
        }
        else if (msg[2] === 'Wrong Password')
        {
            Alert('Wrong Password')
        }
    }
    else if (msg[0] === 'Create Account Results') {
        hideLoadingOverlay()
        if (msg[2] === 'Success') {
            closeLoginModal()
        }
        else if (msg[2] === 'Username Exists') {
            Alert('Username already exists')
        }
    }
}

function loginPressed() {
    let username = document.getElementById('username-input');
    let password = document.getElementById('password-input');
    
    // Check if all fields are filled
    if (username.value === '' || password.value === '') {
        // Trigger form validation by clicking the form
        let loginForm = document.getElementById('login-submit');
        loginForm.click();

        return; // Don't send Socket.IO data if validation fails
    }
    
    // Send login data to server
    cl.send(JSON.stringify(['Log In', {username: username.value, password: password.value}]));
    closeLoginModal()
    username.value = '';
    password.value = '';
    showLoadingOverlay()
}

function signUpPressed() {
    let username = document.getElementById('signup-username-input');
    let password = document.getElementById('signup-password-input');
    let firstName = document.getElementById('firstname-input');
    let lastName = document.getElementById('lastname-input');
    let email = document.getElementById('signup-email-input');
    let dob = document.getElementById('dob-input');
    let gender = document.querySelector('input[name="gender"]:checked')?.value || '';
    
    // Check if all fields are filled
    if (username.value === '' || password.value === '' || firstName.value === '' || lastName.value === '' || email.value === '' || dob.value === '' || gender === '') {
        // Trigger form validation by using reportValidity on any required field
        let signupForm = document.getElementById('signup-submit');
        signupForm.click();
        return; // Don't send Socket.IO data if validation fails
    }
    
    // Send signup data to server
    cl.send(JSON.stringify(['Create Account', {
        username: username.value,
        password: password.value,
        first_name: firstName.value,
        last_name: lastName.value,
        email: email.value,
        dob: dob.value,
        gender: gender
    }]));
    closeSignupModal()
    username.value = ''
    password.value = ''
    firstName.value = ''
    lastName.value = ''
    email.value = ''
    dob.value = ''
    showLoadingOverlay()
}


cl.on('message', recv)