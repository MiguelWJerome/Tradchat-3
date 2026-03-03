cl = io()

cl.connect('http://'+document.domain+':'+location.port)

function recv(message) {
    msg = eval(message)
    
    if (msg[0] == 'Create Account Results') {
        if (msg[2] == 'Success') {
            closeLoginModal()
        }
    }
}

function loginPressed() {
    let username = document.getElementById('username-input').value;
    let password = document.getElementById('password-input').value;
    
    // Check if all fields are filled
    if (username === '' || password === '') {
        // Trigger form validation by clicking the form
        let loginForm = document.getElementById('login-submit');
        loginForm.click();

        return; // Don't send Socket.IO data if validation fails
    }
    
    // Send login data to server
    cl.send(JSON.stringify(['Log In', {username: username, password: password}]));
    closeLoginModal()
}

function signUpPressed() {
    let username = document.getElementById('signup-username-input').value;
    let password = document.getElementById('signup-password-input').value;
    let firstName = document.getElementById('firstname-input').value;
    let lastName = document.getElementById('lastname-input').value;
    let email = document.getElementById('signup-email-input').value;
    let dob = document.getElementById('dob-input').value;
    let gender = document.querySelector('input[name="gender"]:checked')?.value || '';
    
    // Check if all fields are filled
    if (username === '' || password === '' || firstName === '' || lastName === '' || email === '' || dob === '' || gender === '') {
        // Trigger form validation by using reportValidity on any required field
        let signupForm = document.getElementById('signup-submit');
        signupForm.click();
        return; // Don't send Socket.IO data if validation fails
    }
    
    // Send signup data to server
    cl.send(JSON.stringify(['Create Account', {
        username: username,
        password: password,
        first_name: firstName,
        last_name: lastName,
        email: email,
        dob: dob,
        gender: gender
    }]));
    closeSignupModal()
}


cl.on('message', recv)