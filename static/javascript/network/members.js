/* =========================================================================
   MEMBERS PAGE: WEBSOCKET NETWORK CONTROLLER
   ========================================================================= */

// Connect to Socket.IO using absolute URL parameters matching current domain
const cl = io();
cl.connect('http://' + document.domain + ':' + document.port);

// Extract credentials from injected global window variable
const username = window.USER_CREDENTIALS.username;
const password = window.USER_CREDENTIALS.password;

// Fetch member list based on search term, filters, and active tab
window.fetchMembers = function () {
  // Determine active tab
  let tab = 'all';
  if ($('#tab-friends').hasClass('active')) {
    tab = 'friends';
  }

  // Get search term
  const search_query = $('#members-search-input').val() || '';

  // Compile filters from collapsible drawer
  const min_age = $('#filter-age-min').val();
  const max_age = $('#filter-age-max').val();
  
  const gender = [];
  if ($('#filter-gender-boys').is(':checked')) gender.push('male');
  if ($('#filter-gender-girls').is(':checked')) gender.push('female');
  if ($('#filter-gender-bots').is(':checked')) gender.push('chatbot');
  
  const location = $('#filter-location').val() || '';
  const sort_by = $('input[name="filter-sort"]:checked').val() || 'last_name';

  const payload = {
    username: username,
    password: password,
    tab: tab,
    search_query: search_query,
    sort_by: sort_by,
    filters: {
      min_age: min_age,
      max_age: max_age,
      gender: gender,
      location: location
    }
  };

  // Send request over socket
  cl.send(JSON.stringify(['Get Members', payload]));
};

// Add Friend request
window.addFriend = function (friendId, friendUsername) {
  const payload = {
    username: username,
    password: password,
    friend_id: friendId,
    friend_username: friendUsername
  };
  cl.send(JSON.stringify(['Add Friend', payload]));
};

// Remove Friend request
window.removeFriend = function (friendId, friendUsername) {
  const payload = {
    username: username,
    password: password,
    friend_id: friendId,
    friend_username: friendUsername
  };
  cl.send(JSON.stringify(['Remove Friend', payload]));
};

// Receive and process incoming socket messages from server
function Recv(message) {
  let msg;
  try {
    msg = eval(message); // Maintain evaluation parsing style matching settings.js
  } catch (e) {
    console.error("Failed to parse message: ", e);
    return;
  }

  if (msg[0] === 'Get Members Results') {
    const data = msg[1];
    if (data.status === 'success') {
      window.renderMembers(data.results);
    } else {
      Alert("Error fetching directory: " + data.message);
    }
  } else if (msg[0] === 'Add Friend Result') {
    const data = msg[1];
    if (data.status === 'success') {
      // Re-fetch members to update UI state and stars smoothly
      window.fetchMembers();
    } else {
      Alert("Failed to add friend: " + data.message);
      // Re-enable clicked buttons in case of server failure
      $(`.member-action-btn[data-id="${data.friend_id}"]`).prop('disabled', false);
    }
  } else if (msg[0] === 'Remove Friend Result') {
    const data = msg[1];
    if (data.status === 'success') {
      // Re-fetch members to update list smoothly
      window.fetchMembers();
    } else {
      Alert("Failed to remove friend: " + data.message);
      // Re-enable clicked buttons
      $(`.member-action-btn[data-id="${data.friend_id}"]`).prop('disabled', false);
    }
  }
}

// Bind socket message listener
cl.on('message', Recv);

// Trigger initial members load once socket finishes connection handshake
cl.on('connect', function () {
  window.fetchMembers();
});
