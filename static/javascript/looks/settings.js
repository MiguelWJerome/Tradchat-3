document.addEventListener('DOMContentLoaded', () => {
  // Tab switching logic
  const tabItems = document.querySelectorAll('.tab-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs and panes
      tabItems.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      // Add active to clicked tab
      tab.classList.add('active');

      // Show corresponding pane
      const targetId = `pane-${tab.getAttribute('data-tab')}`;
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // Profile Edit Logic
  const lockBtn = document.getElementById('edit-profile-btn');
  const formActions = document.getElementById('profile-form-actions');
  const profileInputs = document.querySelectorAll('.profile-form input');
  const cancelBtn = document.getElementById('cancel-profile-btn');
  const avatarCircle = document.querySelector('.avatar-circle');
  
  window.isEditingProfile = false;

  window.toggleEditMode = (edit) => {
    window.isEditingProfile = edit;
    
    // Toggle input read-only state
    profileInputs.forEach(input => {
      if (edit) {
        input.removeAttribute('readonly');
      } else {
        input.setAttribute('readonly', 'true');
      }
    });

    // Toggle avatar interactivity
    if (avatarCircle) {
      if (edit) {
        avatarCircle.classList.add('editable');
      } else {
        avatarCircle.classList.remove('editable');
      }
    }

    // Update Lock Icon
    if (lockBtn) {
      const icon = lockBtn.querySelector('i');
      if (edit) {
        lockBtn.classList.add('unlocked');
        icon.classList.remove('fa-unlock');
        icon.classList.add('fa-lock');
        if (formActions) formActions.style.display = 'flex';
      } else {
        lockBtn.classList.remove('unlocked');
        icon.classList.remove('fa-lock');
        icon.classList.add('fa-unlock');
        if (formActions) formActions.style.display = 'none';
      }
    }
  };

  if (lockBtn) {
    lockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.toggleEditMode(!window.isEditingProfile);
    });
  }

  // Shake logic: if input clicked while locked
  profileInputs.forEach(input => {
    input.addEventListener('mousedown', () => {
      if (!window.isEditingProfile && lockBtn) {
        lockBtn.classList.add('shake');
        setTimeout(() => {
          lockBtn.classList.remove('shake');
        }, 400);
      }
    });
  });

  // Avatar click: placeholder for future upload logic
  if (avatarCircle) {
    avatarCircle.addEventListener('click', () => {
      if (window.isEditingProfile) {
        console.log("Avatar click! (Upload logic can go here)");
        // Trigger hidden file input if one existed
      } else if (lockBtn) {
        // Shake logic: if avatar clicked while locked
        lockBtn.classList.add('shake');
        setTimeout(() => {
          lockBtn.classList.remove('shake');
        }, 400);
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      // Revert to initial data
      if (typeof initialProfileData !== 'undefined') {
        const u = document.getElementById('prof-username');
        const p = document.getElementById('prof-password');
        const f = document.getElementById('prof-first');
        const l = document.getElementById('prof-last');
        
        if(u) u.value = initialProfileData.username;
        if(p) {
          p.value = initialProfileData.password;
          p.type = 'password'; // Reset to hidden
          const toggleIcon = document.querySelector('#toggle-password-visibility i');
          if (toggleIcon) {
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
          }
        }
        if(f) f.value = initialProfileData.first_name;
        if(l) l.value = initialProfileData.last_name;
      }
      window.toggleEditMode(false);
    });
  }

  // Password Visibility Toggle
  const passwordToggle = document.getElementById('toggle-password-visibility');
  const passwordInput = document.getElementById('prof-password');
  
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      
      const icon = passwordToggle.querySelector('i');
      if (icon) {
        if (type === 'text') {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    });
  }
});
