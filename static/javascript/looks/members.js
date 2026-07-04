/* =========================================================================
   MEMBERS PAGE: LOOKS & INTERACTION CONTROLLER (jQuery)
   ========================================================================= */

$(document).ready(function () {
  // Toggle filter drawer sliding animation
  $('#filter-toggle-btn').click(function () {
    $(this).toggleClass('active');
    $('#filter-drawer').toggleClass('open');
  });

  // Handle active states for Friends / All tabs
  $('.tab-btn').click(function () {
    if ($(this).hasClass('active')) return;
    
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    // Reset filters and search on tab switch for a clean state
    clearAllFilters();

    // Trigger loading state and request members fetch
    showLoading();
    if (typeof window.fetchMembers === 'function') {
      window.fetchMembers();
    }
  });

  // Apply filters button
  $('#filter-apply-btn').click(function () {
    showLoading();
    if (typeof window.fetchMembers === 'function') {
      window.fetchMembers();
    }
  });

  // Clear filters button
  $('#filter-clear-btn').click(function () {
    clearAllFilters();
    showLoading();
    if (typeof window.fetchMembers === 'function') {
      window.fetchMembers();
    }
  });

  // Search input triggers
  $('#members-search-input').on('keypress', function (e) {
    if (e.which === 13) { // Enter key
      showLoading();
      if (typeof window.fetchMembers === 'function') {
        window.fetchMembers();
      }
    }
  }).on('change', function () {
    showLoading();
    if (typeof window.fetchMembers === 'function') {
      window.fetchMembers();
    }
  });

  $('#members-search-btn').click(function () {
    showLoading();
    if (typeof window.fetchMembers === 'function') {
      window.fetchMembers();
    }
  });

  // Clear filters helper function
  function clearAllFilters() {
    $('#filter-age-min').val('');
    $('#filter-age-max').val('');
    $('#filter-gender-boys').prop('checked', true);
    $('#filter-gender-girls').prop('checked', true);
    $('#filter-gender-bots').prop('checked', true);
    $('#filter-location').val('');
    $('input[name="filter-sort"][value="last_name"]').prop('checked', true);
    $('#members-search-input').val('');
  }

  // Show loading indicator in the grid
  function showLoading() {
    $('#members-grid').html(`
      <div class="members-status-msg">
        <i class="fa-solid fa-circle-notch fa-spin status-icon"></i>
        <span>Filtering directory...</span>
      </div>
    `);
  }
});

// Render the user list dynamically into the HTML grid container
window.renderMembers = function (members) {
  const $grid = $('#members-grid');
  $grid.empty();

  if (!members || members.length === 0) {
    $grid.html(`
      <div class="members-status-msg">
        <i class="fa-solid fa-users-slash status-icon"></i>
        <span>No members found matching your criteria.</span>
      </div>
    `);
    return;
  }

  members.forEach(function (member) {
    const isFriend = member.is_friend;
    const colorMain = member.color_main;

    // Build the detail row markup. Hide location fields completely if show_location is false
    let locationMarkup = '';
    if (member.show_location && member.location) {
      locationMarkup = `
        <div class="detail-row" title="Location">
          <i class="fa-solid fa-earth-americas"></i>
          <span class="detail-value">${member.country || 'United States'}</span>
        </div>
        <div class="detail-row" title="State/Province">
          <i class="fa-solid fa-map-pin"></i>
          <span class="detail-value">${member.state || member.location}</span>
        </div>
      `;
    }

    // Build friend star badge markup if they are a friend
    const friendBadge = isFriend 
      ? `<div class="friend-badge" title="Friend!"><i class="fa-solid fa-star"></i></div>` 
      : '';

    // Build Friend button
    let buttonClass = 'member-action-btn';
    let buttonHtml = '';
    if (isFriend) {
      buttonClass += ' is-friend';
      buttonHtml = `<i class="fa-solid fa-user-check"></i> <span>Friends</span>`;
    } else {
      buttonHtml = `<i class="fa-solid fa-user-plus"></i> <span>Add Friend</span>`;
    }

    // Create avatar initials placeholder in case image load fails
    const nameInitials = ((member.first_name[0] || '') + (member.last_name[0] || '')).toUpperCase();

    const cardHtml = `
      <div class="member-card" id="member-card-${member.id}">
        <!-- Top color band themed to member's account theme color -->
        <div class="member-card-banner" style="background-color: ${colorMain}"></div>
        
        <!-- Avatar Section with optional gold star badge -->
        <div class="member-avatar-wrap">
          <img src="/static/profile-pictures/${member.username}.png" 
               class="member-avatar" 
               alt="${member.first_name}'s avatar"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="member-avatar-placeholder" style="display: none; background-color: ${colorMain}">
            ${nameInitials}
          </div>
          ${friendBadge}
        </div>

        <div class="member-card-body">
          <!-- Full Name -->
          <div class="member-name" title="${member.first_name} ${member.last_name}">
            ${member.first_name} ${member.last_name}
          </div>
          
          <!-- Username themed to user theme colors -->
          <div class="member-username" style="color: ${colorMain}">
            @${member.username}
          </div>

          <!-- Demographic details -->
          <div class="member-details">
            <div class="detail-row" title="Age">
              <i class="fa-solid fa-calendar-days"></i>
              <span class="detail-value">${member.age} years old</span>
            </div>
            ${locationMarkup}
            <div class="detail-row" title="Last Activity">
              <i class="fa-solid fa-clock"></i>
              <span class="detail-value">${member.last_seen}</span>
            </div>
          </div>

          <!-- Add / Remove Friend Action Button -->
          <button class="${buttonClass}" data-id="${member.id}" data-username="${member.username}">
            ${buttonHtml}
          </button>
        </div>
      </div>
    `;

    const $card = $(cardHtml);
    
    // Friend button hover effects
    $card.find('.member-action-btn.is-friend').hover(
      function() {
        $(this).html(`<i class="fa-solid fa-user-minus"></i> <span>Remove</span>`);
      },
      function() {
        $(this).html(`<i class="fa-solid fa-user-check"></i> <span>Friends</span>`);
      }
    );

    // Friend button click handler
    $card.find('.member-action-btn').click(function() {
      const targetId = $(this).attr('data-id');
      const targetUsername = $(this).attr('data-username');
      $(this).prop('disabled', true); // Prevent double clicks
      
      if ($(this).hasClass('is-friend')) {
        if (typeof window.removeFriend === 'function') {
          window.removeFriend(targetId, targetUsername);
        }
      } else {
        if (typeof window.addFriend === 'function') {
          window.addFriend(targetId, targetUsername);
        }
      }
    });

    $grid.append($card);
  });
};
