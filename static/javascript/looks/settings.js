document.addEventListener('DOMContentLoaded', () => {
  // Tab switching logic
  const tabItems = document.querySelectorAll('.tab-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const switchTab = (tabName, updateUrl = true) => {
    const tab = document.querySelector(`.tab-item[data-tab="${tabName}"]`);
    const pane = document.getElementById(`pane-${tabName}`);

    if (tab && pane) {
      // Remove active from all tabs and panes
      tabItems.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      // Add active to clicked tab and pane
      tab.classList.add('active');
      pane.classList.add('active');

      // Update URL without reload
      if (updateUrl) {
        window.history.replaceState({ tab: tabName }, '', `?tab=${tabName}`);
      }
    }
  };

  tabItems.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Handle initial tab from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab');
  if (initialTab) {
    switchTab(initialTab, false);
  }

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

  // Avatar click and upload logic
  const fileInput = document.getElementById('profile-pic-upload');
  const cropperModal = document.getElementById('cropper-modal');
  const cropperImage = document.getElementById('cropper-image');
  const cropperCancel = document.getElementById('cropper-cancel');
  const cropperSave = document.getElementById('cropper-save');
  let cropperInstance = null;

  if (avatarCircle && fileInput) {
    avatarCircle.addEventListener('click', () => {
      if (window.isEditingProfile) {
        fileInput.click();
      } else if (lockBtn) {
        // Shake logic: if avatar clicked while locked
        lockBtn.classList.add('shake');
        setTimeout(() => {
          lockBtn.classList.remove('shake');
        }, 400);
      }
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 50 * 1024 * 1024) {
          Alert(`"${file.name}" is too large. The maximum file size is 50MB.`);
          fileInput.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          cropperImage.src = e.target.result;
          cropperModal.classList.add('visible');
          
          if (cropperInstance) {
            cropperInstance.destroy();
          }
          cropperInstance = new Cropper(cropperImage, {
            aspectRatio: 1,
            viewMode: 1,
            autoCropArea: 1,
          });
        };
        reader.readAsDataURL(file);
      }
      fileInput.value = ''; // Reset input so same file can be chosen again
    });
  }

  if (cropperCancel) {
    cropperCancel.addEventListener('click', () => {
      cropperModal.classList.remove('visible');
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
    });
  }

  if (cropperSave) {
    cropperSave.addEventListener('click', () => {
      if (cropperInstance) {
        try {
          const canvas = cropperInstance.getCroppedCanvas({ width: 800, height: 800 });
          if (!canvas) {
            Alert('Could not crop the image. Please try selecting it again.');
            return;
          }
          const base64Image = canvas.toDataURL('image/png');

          // Store pending image - only apply to avatar after server confirms success
          window.pendingProfilePicture = base64Image;

          // Send to server
          if (typeof cl !== 'undefined') {
            console.log('[DEBUG] Sending Update Profile Picture to server...');
            cl.send(JSON.stringify(['Update Profile Picture', {
              username: initialProfileData.username,
              password: initialProfileData.password,
              image: base64Image
            }]));
          } else {
            console.error('[DEBUG] cl is undefined — socket not connected');
            Alert('Connection error. Please refresh the page and try again.');
          }

          cropperModal.classList.remove('visible');
          cropperInstance.destroy();
          cropperInstance = null;
        } catch(err) {
          console.error('[DEBUG] Error in cropperSave:', err);
          Alert('An unexpected error occurred while processing the image.');
        }
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
