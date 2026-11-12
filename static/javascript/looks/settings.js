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

      // Hide or show the edit profile lock button
      const editProfileBtn = document.getElementById('edit-profile-btn');
      if (editProfileBtn) {
        if (tabName === 'profile') {
          editProfileBtn.style.display = 'flex';
        } else {
          editProfileBtn.style.display = 'none';
        }
      }

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
  const initialTab = urlParams.get('tab') || 'profile';
  switchTab(initialTab, false);

  // Profile Edit Logic
  const lockBtn = document.getElementById('edit-profile-btn');
  const formActions = document.getElementById('profile-form-actions');
  const profileInputs = document.querySelectorAll('.profile-form input, .profile-business-card input');
  const cancelBtn = document.getElementById('cancel-profile-btn');
  const avatarCircle = document.querySelector('.avatar-circle');
  const locationToggle = document.getElementById('toggle-location-visibility');
  
  window.isEditingProfile = false;

  window.toggleEditMode = (edit) => {
    window.isEditingProfile = edit;
    
    // Toggle input read-only state
    profileInputs.forEach(input => {
      if (edit) {
        if (!input.classList.contains('permanent-readonly')) {
          input.removeAttribute('readonly');
        }
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
        if (locationToggle) locationToggle.style.display = 'block';
      } else {
        lockBtn.classList.remove('unlocked');
        icon.classList.remove('fa-lock');
        icon.classList.add('fa-unlock');
        if (formActions) formActions.style.display = 'none';
        if (locationToggle) locationToggle.style.display = 'none';
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
        const e = document.getElementById('prof-email');
        const d = document.getElementById('prof-dob');
        const loc = document.getElementById('prof-location');
        const locToggle = document.getElementById('toggle-location-visibility');
        
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
        if(e) e.value = initialProfileData.email;
        if(d) d.value = initialProfileData.dob;
        if(loc) loc.value = initialProfileData.location;
        if(locToggle) {
          if (initialProfileData.show_location) {
            locToggle.classList.add('active');
          } else {
            locToggle.classList.remove('active');
          }
        }
      }
      window.toggleEditMode(false);
    });
  }

  // Location Visibility Toggle
  if (locationToggle) {
    locationToggle.addEventListener('click', () => {
      if (window.isEditingProfile) {
        locationToggle.classList.toggle('active');
      }
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

  // Logout Warning Interaction
  const logoutWarning = document.querySelector('.logout-warning');
  if (logoutWarning) {
    logoutWarning.addEventListener('click', () => {
      Alert("⚠️ Warning: Changing your username has consequences:\n\n1. You will be automatically logged out.\n2. You will need to log back in with your new username.\n3. Your current room state and active DMs will be reset.");
    });
  }
});

/**
 * ==========================================================================================
 * 🚨 ATTENTION FUTURE AI ASSISTANTS 🚨
 * ==========================================================================================
 * WHEN YOU IMPLEMENT THE "POSTS" FEATURE IN THE FUTURE, YOU MUST REMEMBER THIS FUNCTION:
 * 
 * Function: togglePostsDot(show)
 * Purpose: Controls the red notification dot on the "Posts" tab in the settings sidebar.
 * 
 * USAGE:
 * togglePostsDot(true);  // To show the red dot (e.g., when there are new posts)
 * togglePostsDot(false); // To hide the red dot
 * 
 * DO NOT OVERWRITE OR DELETE THIS FUNCTION. INTEGRATE IT INTO THE POSTS LOADING LOGIC.
 * ==========================================================================================
 */
window.togglePostsDot = function(show) {
  const dot = document.getElementById('posts-notification-dot');
  if (dot) {
    dot.style.display = show ? 'block' : 'none';
  }
};

/**
 * ==========================================================================================
 * ADOBE AFTER EFFECTS / MOZILLA STYLE SOLID COLOR THEME PICKER
 * ==========================================================================================
 */
(function() {
  let currentHue = 0;       // 0 - 360
  let currentSat = 1;       // 0 - 1
  let currentVal = 1;       // 0 - 1
  let currentHex = '#FF0000';
  let initialTheme = '';
  let initialIsSolid = false;
  let isDraggingCanvas = false;

  const CURATED_PALETTE = [
    '#7E0808', '#0A192F', '#1B3B2B', '#E8DEC8', '#1E1E1E',
    '#4A154B', '#DAA520', '#007ACC', '#475569', '#C0392B',
    '#2A9D8F', '#3B1E54', '#2D241E', '#E76F51'
  ];

  // --- Color Conversion Utilities ---
  function hexToRgb(hex) {
    let clean = hex.replace(/^#/, '');
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHex(r, g, b) {
    const toHex = c => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, v };
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;

    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else if (h >= 300 && h <= 360) { r1 = c; g1 = 0; b1 = x; }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;

    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else if (h >= 300 && h <= 360) { r1 = c; g1 = 0; b1 = x; }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function generateDerivedPalette(hex) {
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    // Light tint (L: 90%, S: max 35%)
    const lightRgb = hslToRgb(hsl.h, Math.min(hsl.s, 35), 90);
    // Dark tone (L: 15%, S: max 50%)
    const darkRgb = hslToRgb(hsl.h, Math.min(hsl.s, 50), 15);

    return {
      light: rgbToHex(lightRgb.r, lightRgb.g, lightRgb.b),
      medium: hex.toUpperCase(),
      dark: rgbToHex(darkRgb.r, darkRgb.g, darkRgb.b)
    };
  }

  // --- 2D Canvas Drawing ---
  function renderCanvas() {
    const canvas = document.getElementById('color-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. Fill base hue
    ctx.fillStyle = `hsl(${currentHue}, 100%, 50%)`;
    ctx.fillRect(0, 0, width, height);

    // 2. Horizontal white gradient (saturation)
    const whiteGrad = ctx.createLinearGradient(0, 0, width, 0);
    whiteGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    whiteGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Vertical black gradient (value/brightness)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, height);
    blackGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    blackGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, width, height);

    // Update handle position
    const handle = document.getElementById('canvas-handle');
    if (handle) {
      handle.style.left = `${currentSat * width}px`;
      handle.style.top = `${(1 - currentVal) * height}px`;
    }
  }

  function updateControls(source) {
    const rgb = hsvToRgb(currentHue, currentSat, currentVal);
    currentHex = rgbToHex(rgb.r, rgb.g, rgb.b);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Update Hex
    const hexInput = document.getElementById('picker-hex');
    if (hexInput && source !== 'hex') {
      hexInput.value = currentHex.replace('#', '');
    }

    // Update RGB
    if (source !== 'rgb') {
      const rIn = document.getElementById('picker-r');
      const gIn = document.getElementById('picker-g');
      const bIn = document.getElementById('picker-b');
      if (rIn) rIn.value = rgb.r;
      if (gIn) gIn.value = rgb.g;
      if (bIn) bIn.value = rgb.b;
    }

    // Update HSL
    if (source !== 'hsl') {
      const hIn = document.getElementById('picker-h');
      const sIn = document.getElementById('picker-s');
      const lIn = document.getElementById('picker-l');
      if (hIn) hIn.value = hsl.h;
      if (sIn) sIn.value = hsl.s;
      if (lIn) lIn.value = hsl.l;
    }

    // Update Sliders
    if (source !== 'hue') {
      const hueSlider = document.getElementById('picker-hue');
      if (hueSlider) hueSlider.value = Math.round(currentHue);
    }
    const hueDisplay = document.getElementById('hue-val-display');
    if (hueDisplay) hueDisplay.textContent = `${Math.round(currentHue)}°`;

    if (source !== 'lightness') {
      const lightSlider = document.getElementById('picker-lightness');
      if (lightSlider) lightSlider.value = hsl.l;
    }
    const lightDisplay = document.getElementById('lightness-val-display');
    if (lightDisplay) lightDisplay.textContent = `${hsl.l}%`;

    // Update Lightness track gradient to reflect current hue
    const lightSlider = document.getElementById('picker-lightness');
    if (lightSlider) {
      lightSlider.style.background = `linear-gradient(to right, #000000, hsl(${currentHue}, 100%, 50%), #ffffff)`;
    }

    // Update New Color Swatch
    const newSwatch = document.getElementById('new-swatch');
    if (newSwatch) {
      newSwatch.style.backgroundColor = currentHex;
    }

    // Render Canvas
    renderCanvas();

    // Live Preview
    const liveCheckbox = document.getElementById('live-preview-checkbox');
    if (liveCheckbox && liveCheckbox.checked) {
      applyLivePreview(currentHex);
    }
  }

  function applyLivePreview(hex) {
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = hex;

    const palette = generateDerivedPalette(hex);
    document.documentElement.style.setProperty('--color-light', palette.light);
    document.documentElement.style.setProperty('--color-medium', palette.medium);
    document.documentElement.style.setProperty('--color-dark', palette.dark);
  }

  function revertLivePreview() {
    if (initialIsSolid || (initialTheme && initialTheme.startsWith('#'))) {
      applyLivePreview(initialTheme);
    } else {
      document.body.style.backgroundColor = '';
      document.body.style.backgroundImage = `url('/static/themes/${initialTheme}/background.jpg')`;
    }
  }

  function setColorFromHex(hex, source = 'external') {
    if (!hex.startsWith('#')) hex = '#' + hex;
    const rgb = hexToRgb(hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    currentHue = hsv.h;
    currentSat = hsv.s;
    currentVal = hsv.v;
    updateControls(source);
  }

  function saveRecentColor(hex) {
    try {
      let recents = JSON.parse(localStorage.getItem('tc_recent_colors') || '[]');
      recents = recents.filter(c => c.toUpperCase() !== hex.toUpperCase());
      recents.unshift(hex.toUpperCase());
      if (recents.length > 14) recents.pop();
      localStorage.setItem('tc_recent_colors', JSON.stringify(recents));
      renderRecentSwatches();
    } catch(e) {
      console.warn('Could not save recent color:', e);
    }
  }

  function renderCuratedSwatches() {
    const container = document.getElementById('curated-swatches');
    if (!container) return;
    container.innerHTML = '';
    CURATED_PALETTE.forEach(color => {
      const circle = document.createElement('div');
      circle.className = 'swatch-circle';
      circle.style.backgroundColor = color;
      circle.title = color;
      circle.addEventListener('click', () => setColorFromHex(color, 'preset'));
      container.appendChild(circle);
    });
  }

  function renderRecentSwatches() {
    const container = document.getElementById('recent-swatches');
    if (!container) return;
    container.innerHTML = '';
    try {
      const recents = JSON.parse(localStorage.getItem('tc_recent_colors') || '[]');
      if (recents.length === 0) {
        container.innerHTML = '<span style="font-size:0.75rem; color:#999;">No recent colors</span>';
        return;
      }
      recents.forEach(color => {
        const circle = document.createElement('div');
        circle.className = 'swatch-circle';
        circle.style.backgroundColor = color;
        circle.title = color;
        circle.addEventListener('click', () => setColorFromHex(color, 'recent'));
        container.appendChild(circle);
      });
    } catch(e) {
      container.innerHTML = '';
    }
  }

  // --- Canvas Pointer Dragging ---
  function handleCanvasPoint(e) {
    const canvas = document.getElementById('color-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let x = clientX - rect.left;
    let y = clientY - rect.top;
    x = Math.max(0, Math.min(rect.width, x));
    y = Math.max(0, Math.min(rect.height, y));

    currentSat = x / rect.width;
    currentVal = 1 - (y / rect.height);
    updateControls('canvas');
  }

  // --- Public Modal Opener ---
  window.openSolidColorModal = function() {
    const modal = document.getElementById('solid-color-modal');
    if (!modal) return;

    initialTheme = (window.initialProfileData && window.initialProfileData.currentTheme) || 'classic';
    initialIsSolid = (window.initialProfileData && window.initialProfileData.isSolidColor) || initialTheme.startsWith('#');

    // Default color to active custom color or #7E0808
    let startingHex = '#7E0808';
    if (initialIsSolid && initialTheme.startsWith('#')) {
      startingHex = initialTheme;
    }

    // Set initial split swatches
    const prevSwatch = document.getElementById('prev-swatch');
    if (prevSwatch) {
      prevSwatch.style.backgroundColor = initialIsSolid ? initialTheme : '#888888';
      prevSwatch.title = initialIsSolid ? `Active Color: ${initialTheme}` : `Directory Theme: ${initialTheme}`;
    }

    setColorFromHex(startingHex, 'init');
    renderCuratedSwatches();
    renderRecentSwatches();

    modal.classList.add('visible');
  };

  // --- DOM Listeners Setup on Ready ---
  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('solid-color-modal');
    const closeBtn = document.getElementById('solid-modal-close');
    const cancelBtn = document.getElementById('solid-modal-cancel');
    const resetBtn = document.getElementById('solid-modal-reset');
    const applyBtn = document.getElementById('solid-modal-apply');
    const canvasWrap = document.getElementById('color-canvas-wrap');
    const hueSlider = document.getElementById('picker-hue');
    const lightSlider = document.getElementById('picker-lightness');
    const hexInput = document.getElementById('picker-hex');
    const copyBtn = document.getElementById('copy-hex-btn');
    const eyedropperBtn = document.getElementById('eyedropper-btn');

    // Delegated click on Theme Grid for Choose Solid Color
    const themeGrid = document.getElementById('theme-grid-container');
    if (themeGrid) {
      themeGrid.addEventListener('click', (e) => {
        const solidCard = e.target.closest('#choose-solid-color-card, .solid-color-card');
        if (solidCard) {
          window.openSolidColorModal();
        }
      });
    }

    // Direct binding if already in DOM
    const initialSolidCard = document.getElementById('choose-solid-color-card');
    if (initialSolidCard) {
      initialSolidCard.addEventListener('click', () => {
        window.openSolidColorModal();
      });
    }

    // Close / Cancel logic
    function closeModal() {
      if (modal) modal.classList.remove('visible');
      revertLivePreview();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Reset logic
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        let startingHex = (initialIsSolid && initialTheme.startsWith('#')) ? initialTheme : '#7E0808';
        setColorFromHex(startingHex, 'reset');
      });
    }

    // Apply logic
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (modal) modal.classList.remove('visible');

        // Apply permanently to page
        applyLivePreview(currentHex);

        // Update active class on cards
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        const solidCard = document.getElementById('choose-solid-color-card');
        if (solidCard) solidCard.classList.add('active');

        // Update state
        if (window.initialProfileData) {
          window.initialProfileData.currentTheme = currentHex;
          window.initialProfileData.isSolidColor = true;
        }

        // Save recent swatch
        saveRecentColor(currentHex);

        // Send to server via Socket.IO
        if (typeof cl !== 'undefined') {
          cl.send(JSON.stringify(['Update Theme', {
            username: initialProfileData.username,
            password: initialProfileData.password,
            theme: currentHex,
            is_solid_color: true
          }]));
        }
      });
    }

    // Canvas Mouse/Touch Dragging
    if (canvasWrap) {
      canvasWrap.addEventListener('mousedown', (e) => {
        isDraggingCanvas = true;
        handleCanvasPoint(e);
      });
      window.addEventListener('mousemove', (e) => {
        if (isDraggingCanvas) handleCanvasPoint(e);
      });
      window.addEventListener('mouseup', () => {
        isDraggingCanvas = false;
      });

      // Touch events
      canvasWrap.addEventListener('touchstart', (e) => {
        isDraggingCanvas = true;
        handleCanvasPoint(e);
        e.preventDefault();
      }, { passive: false });
      window.addEventListener('touchmove', (e) => {
        if (isDraggingCanvas) {
          handleCanvasPoint(e);
          e.preventDefault();
        }
      }, { passive: false });
      window.addEventListener('touchend', () => {
        isDraggingCanvas = false;
      });
    }

    // Hue Slider
    if (hueSlider) {
      hueSlider.addEventListener('input', (e) => {
        currentHue = parseFloat(e.target.value);
        updateControls('hue');
      });
    }

    // Lightness Slider
    if (lightSlider) {
      lightSlider.addEventListener('input', (e) => {
        const targetL = parseFloat(e.target.value);
        const rgb = hsvToRgb(currentHue, currentSat, currentVal);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const newRgb = hslToRgb(hsl.h, hsl.s, targetL);
        const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
        currentSat = newHsv.s;
        currentVal = newHsv.v;
        updateControls('lightness');
      });
    }

    // HEX Input
    if (hexInput) {
      hexInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
        if (val.length === 6) {
          setColorFromHex('#' + val, 'hex');
        }
      });
    }

    // Copy HEX
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(currentHex).then(() => {
          const icon = copyBtn.querySelector('i');
          if (icon) {
            icon.className = 'fa-solid fa-check';
            setTimeout(() => { icon.className = 'fa-regular fa-copy'; }, 1500);
          }
        });
      });
    }

    // RGB Inputs
    ['picker-r', 'picker-g', 'picker-b'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => {
          const r = parseInt(document.getElementById('picker-r').value || 0, 10);
          const g = parseInt(document.getElementById('picker-g').value || 0, 10);
          const b = parseInt(document.getElementById('picker-b').value || 0, 10);
          const hsv = rgbToHsv(r, g, b);
          currentHue = hsv.h;
          currentSat = hsv.s;
          currentVal = hsv.v;
          updateControls('rgb');
        });
      }
    });

    // HSL Inputs
    ['picker-h', 'picker-s', 'picker-l'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => {
          const h = parseInt(document.getElementById('picker-h').value || 0, 10);
          const s = parseInt(document.getElementById('picker-s').value || 0, 10);
          const l = parseInt(document.getElementById('picker-l').value || 0, 10);
          const rgb = hslToRgb(h, s, l);
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          currentHue = hsv.h;
          currentSat = hsv.s;
          currentVal = hsv.v;
          updateControls('hsl');
        });
      }
    });

    // Eyedropper API
    if (eyedropperBtn) {
      if (!window.EyeDropper) {
        eyedropperBtn.style.opacity = '0.5';
        eyedropperBtn.title = 'EyeDropper API not supported by this browser';
      }
      eyedropperBtn.addEventListener('click', () => {
        if (window.EyeDropper) {
          const dropper = new window.EyeDropper();
          dropper.open().then(result => {
            if (result && result.sRGBHex) {
              setColorFromHex(result.sRGBHex, 'eyedropper');
            }
          }).catch(err => {
            // User cancelled eyedropper
          });
        } else {
          Alert('Screen Pipette is not supported in this browser. You can manually enter any HEX or RGB code.');
        }
      });
    }
  });
})();

