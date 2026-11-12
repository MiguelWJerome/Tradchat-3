cl = io()
cl.connect('http://' + document.domain + ':' + document.port)


function Recv(message) {
  msg = eval(message)
  console.log(msg)

  if (msg[0] === 'Update Profile Result') {
    if (msg[1].status === 'success') {
      if (msg[1].username_changed) {
        Alert("Username changed successfully! You will now be logged out. Please log in with your new credentials.", () => {
          window.location.href = '/logout/';
        });
      } else {
        // Update local initial data
        if (typeof initialProfileData !== 'undefined') {
          initialProfileData.first_name = document.getElementById('prof-first').value;
          initialProfileData.last_name = document.getElementById('prof-last').value;
          initialProfileData.password = document.getElementById('prof-password').value;
          initialProfileData.location = document.getElementById('prof-location').value;
          initialProfileData.email = document.getElementById('prof-email').value;
          initialProfileData.dob = document.getElementById('prof-dob').value;
          initialProfileData.show_location = document.getElementById('toggle-location-visibility').classList.contains('active') ? 1 : 0;
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
      Alert("Error saving profile: " + msg[1].message);
    }
  } else if (msg[0] === 'Update Profile Picture Result') {
    if (msg[1].status === 'success') {
      // Now that server confirmed, apply the image to the avatar
      if (window.pendingProfilePicture) {
        const avatarImg = document.querySelector('.avatar-img');
        if (avatarImg) {
          avatarImg.src = window.pendingProfilePicture;
          avatarImg.style.display = 'block';
          const placeholder = document.querySelector('.placeholder-x');
          if (placeholder) placeholder.style.display = 'none';
        }
        window.pendingProfilePicture = null;
      }
      Alert(msg[1].message);
    } else {
      window.pendingProfilePicture = null;
      Alert("Error updating profile picture: " + msg[1].message);
    }
  } else if (msg[0] === 'Themes List') {
    const themes = msg[1];
    const container = document.getElementById('theme-grid-container');
    if (container) {
      // Find or create "Choose Solid Color" card
      let solidCard = document.getElementById('choose-solid-color-card');
      if (!solidCard) {
        solidCard = document.createElement('div');
        solidCard.className = 'theme-card solid-color-card';
        solidCard.id = 'choose-solid-color-card';
        solidCard.innerHTML = `
          <div class="theme-preview" style="background: linear-gradient(to right, red, purple);"></div>
          <div class="theme-info">
            <div class="theme-name">Choose Solid Color</div>
            <div class="theme-colors solid-rainbow-bar">
              <div class="theme-color-swatch" style="background-color: #ff0000;"></div>
              <div class="theme-color-swatch" style="background-color: #ff7f00;"></div>
              <div class="theme-color-swatch" style="background-color: #ffff00;"></div>
              <div class="theme-color-swatch" style="background-color: #00ff00;"></div>
              <div class="theme-color-swatch" style="background-color: #0000ff;"></div>
              <div class="theme-color-swatch" style="background-color: #8b00ff;"></div>
            </div>
          </div>
        `;
        container.prepend(solidCard);
      }

      const isSolidActive = window.initialProfileData && (
        window.initialProfileData.isSolidColor ||
        (window.initialProfileData.currentTheme && window.initialProfileData.currentTheme.startsWith('#'))
      );
      if (isSolidActive) {
        solidCard.classList.add('active');
      } else {
        solidCard.classList.remove('active');
      }

      solidCard.onclick = () => {
        if (typeof window.openSolidColorModal === 'function') {
          window.openSolidColorModal();
        }
      };

      // Remove existing directory theme cards so we don't duplicate on re-render
      const oldThemeCards = container.querySelectorAll('.theme-card:not(#choose-solid-color-card)');
      oldThemeCards.forEach(card => card.remove());

      // 2. Directory themes
      themes.forEach(theme => {
        const card = document.createElement('div');
        card.className = 'theme-card';
        
        const currentBg = document.body.style.backgroundImage;
        if (!isSolidActive && currentBg.includes(theme.name)) {
          card.classList.add('active');
        }

        card.innerHTML = `
          <div class="theme-preview" style="background-image: url('/static/themes/${theme.name}/background.jpg')"></div>
          <div class="theme-info">
            <div class="theme-name">${theme.name}</div>
            <div class="theme-colors">
              <div class="theme-color-swatch" style="background-color: ${theme.colors.color_light}"></div>
              <div class="theme-color-swatch" style="background-color: ${theme.colors.color_medium}"></div>
              <div class="theme-color-swatch" style="background-color: ${theme.colors.color_dark}"></div>
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          // Update active state on cards
          document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');

          // Instantly update CSS variables
          document.documentElement.style.setProperty('--color-light', theme.colors.color_light);
          document.documentElement.style.setProperty('--color-medium', theme.colors.color_medium);
          document.documentElement.style.setProperty('--color-dark', theme.colors.color_dark);
          
          // Instantly update background
          document.body.style.backgroundColor = '';
          document.body.style.backgroundImage = `url('/static/themes/${theme.name}/background.jpg')`;

          if (window.initialProfileData) {
            window.initialProfileData.currentTheme = theme.name;
            window.initialProfileData.isSolidColor = false;
          }

          // Send update to server (no save needed)
          cl.send(JSON.stringify(['Update Theme', {
            username: initialProfileData.username,
            password: initialProfileData.password,
            theme: theme.name,
            is_solid_color: false
          }]));
        });

        container.appendChild(card);
      });
    }
  }
}

cl.on('message', Recv);

function fetchThemes() {
  if (typeof cl !== 'undefined' && cl.send) {
    cl.send(JSON.stringify(['Get Themes']));
  }
}

cl.on('connect', () => {
  fetchThemes();
});

document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const u = document.getElementById('prof-username');
      const p = document.getElementById('prof-password');
      const f = document.getElementById('prof-first');
      const l = document.getElementById('prof-last');
      const loc = document.getElementById('prof-location');
      const email = document.getElementById('prof-email');
      const showLoc = document.getElementById('toggle-location-visibility').classList.contains('active') ? 1 : 0;

      const data = {
        username: initialProfileData.username,
        password: initialProfileData.password,
        new_username: u.value,
        new_password: p.value,
        new_first_name: f.value,
        new_last_name: l.value,
        new_location: loc.value,
        new_email: email.value,
        new_show_location: showLoc
      };

      cl.send(JSON.stringify(['Update Profile', data]));
    });
  }

  // Bind click directly to Choose Solid Color card if pre-rendered
  const solidCard = document.getElementById('choose-solid-color-card');
  if (solidCard) {
    solidCard.onclick = () => {
      if (typeof window.openSolidColorModal === 'function') {
        window.openSolidColorModal();
      }
    };
  }

  // Fetch themes for the themes tab
  fetchThemes();
});