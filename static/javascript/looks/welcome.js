// UI/Animation JavaScript for welcome.html
// This file handles all animations, modal interactions, and visual effects

/**
 * showLoadingOverlay()
 * Shows the loading overlay to prevent user action while waiting for server response
 */
function showLoadingOverlay() {
  var loadingOverlay = document.getElementById("loading-overlay");
  loadingOverlay.style.display = "flex";
}

/**
 * hideLoadingOverlay()
 * Hides the loading overlay when server response is received
 */
function hideLoadingOverlay() {
  var loadingOverlay = document.getElementById("loading-overlay");
  loadingOverlay.style.display = "none";
}

/**
 * closeLoginModal()
 * Called when the user clicks the "Log In" button inside the modal.
 * Step 1: Add the "fade out" CSS class to the overlay so it fades away.
 * Step 2: Remove the "blurred" CSS class from the home page so it fades in.
 */
function closeLoginModal() {
  // Grab the modal overlay element from the page
  var modalOverlay = document.getElementById("login-modal-overlay");

  // Grab the home page element
  var homePage = document.getElementById("home-page");

  // Add a CSS class that triggers the fade-out animation on the overlay
  modalOverlay.classList.add("login-modal-overlay-hidden");

  // Remove the blurred class so the home page becomes clear and fully visible
  homePage.classList.remove("home-page-blurred");

  // After the fade-out animation finishes (0.5 seconds), fully hide the overlay
  // so it can't accidentally be clicked on anymore
  setTimeout(function() {
    modalOverlay.style.display = "none";
  }, 500); // 500 milliseconds = 0.5 seconds (matches our CSS transition)
}

/**
 * openLoginModal()
 * Called when the user clicks "Log In" in the navigation bar.
 * It reverses what closeLoginModal() did — shows the modal again.
 */
function openLoginModal() {
  // Grab the modal overlay element
  var modalOverlay = document.getElementById("login-modal-overlay");

  // Grab the home page element
  var homePage = document.getElementById("home-page");

  // Make sure the overlay is visible again (undo the display:none)
  modalOverlay.style.display = "flex";

  // Remove the "hidden" class so it fades back in
  modalOverlay.classList.remove("login-modal-overlay-hidden");

  // Add the blurred class back to the home page so it dims again
  homePage.classList.add("home-page-blurred");
}

/**
 * closeSignupModal()
 * Called when the user clicks the "Submit" button inside the signup modal.
 * Step 1: Add the "fade out" CSS class to the overlay so it fades away.
 * Step 2: Remove the "blurred" CSS class from the home page so it fades in.
 */
function closeSignupModal() {
  // Grab the signup modal overlay element from the page
  var modalOverlay = document.getElementById("signup-modal-overlay");

  // Grab the home page element
  var homePage = document.getElementById("home-page");

  // Add a CSS class that triggers the fade-out animation on the overlay
  modalOverlay.classList.add("signup-modal-overlay-hidden");

  // Remove the blurred class so the home page becomes clear and fully visible
  homePage.classList.remove("home-page-blurred");

  // After the fade-out animation finishes (0.5 seconds), fully hide the overlay
  // so it can't accidentally be clicked on anymore
  setTimeout(function() {
    modalOverlay.style.display = "none";
  }, 500); // 500 milliseconds = 0.5 seconds (matches our CSS transition)
}

/**
 * openSignupModal()
 * Called when the user clicks "Sign Up" in the navigation bar.
 * It shows the signup modal and blurs the background.
 */
function openSignupModal() {
  // Grab the signup modal overlay element
  var modalOverlay = document.getElementById("signup-modal-overlay");

  // Grab the home page element
  var homePage = document.getElementById("home-page");

  // Make sure the overlay is visible
  modalOverlay.style.display = "flex";

  // Remove the "hidden" class so it fades in
  modalOverlay.classList.remove("signup-modal-overlay-hidden");

  // Add the blurred class to the home page so it dims
  homePage.classList.add("home-page-blurred");
}

/**
 * switchToSignupModal()
 * Called when user clicks "Sign up" link in login modal.
 * Closes login modal and opens signup modal.
 */
function switchToSignupModal() {
  // Close login modal
  closeLoginModal();
  
  // Open signup modal after a short delay to ensure smooth transition
  setTimeout(function() {
    openSignupModal();
  }, 100);
}

/**
 * togglePasswordVisibility()
 * Toggles password visibility between password and text
 * @param {string} inputId - ID of the password input field
 * @param {HTMLElement} button - The toggle button element
 */
function togglePasswordVisibility(inputId, button) {
  const passwordInput = document.getElementById(inputId);
  
  if (passwordInput.type === 'password') {
    // Show password - change to text
    passwordInput.type = 'text';
    button.textContent = '👁'; // Eye icon
  } else {
    // Hide password - change to password
    passwordInput.type = 'password';
    button.textContent = '👁'; // Eye with slash icon
  }
}
