cl = io()
cl.connect('http://' + document.domain + ':' + document.port)


function Recv(message) {
  msg = eval(message)
  console.log(msg)

  if (msg[0] === 'Update Profile Result') {
    if (msg[1].status === 'success') {
      if (msg[1].username_changed) {
        // Log out as requested if username changed
        window.location.href = '/logout/';
      } else {
        // Update local initial data
        if (typeof initialProfileData !== 'undefined') {
          initialProfileData.first_name = document.getElementById('prof-first').value;
          initialProfileData.last_name = document.getElementById('prof-last').value;
          initialProfileData.password = document.getElementById('prof-password').value;
        }
        if (typeof window.toggleEditMode === 'function') {
          window.toggleEditMode(false);
        }

        const saveBtn = document.getElementById('save-profile-btn');
        if (saveBtn) {
          const originalText = saveBtn.textContent;
          saveBtn.textContent = 'Saved!';
          setTimeout(() => { saveBtn.textContent = originalText; }, 2000);
        }
      }
    } else {
      alert("Error saving profile: " + msg[1].message);
    }
  }
}

cl.on('message', Recv)

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const u = document.getElementById('prof-username');
      const p = document.getElementById('prof-password');
      const f = document.getElementById('prof-first');
      const l = document.getElementById('prof-last');

      const data = {
        username: initialProfileData.username,
        password: initialProfileData.password,
        new_username: u.value,
        new_password: p.value,
        new_first_name: f.value,
        new_last_name: l.value
      };

      cl.send(JSON.stringify(['Update Profile', data]));
    });
  }
});