/**
 * =============================================================================
 * /static/javascript/looks/home.js
 * TradChat — Home Page  |  UI / LOOKS layer
 * =============================================================================
 *
 * PURPOSE
 * -------
 * This file contains essential functions for the TradChat interface:
 * 1. createChatRoomOption - Creates and adds a chat room option to the sidebar
 *    Args: (id, name, description, action=null, picture=null, unread=false, emoji=null, active=false)
 *    - id: unique string ID for the room
 *    - active: if true, marks this option as selected on creation
 * 2. appendMessage - Appends a message to the chat feed
 * 3. clearAllChatRoomOptions - Clears all chat room options from the sidebar
 * 4. changeSelectedRoomOption - Changes which room option is visually selected
 *    Args: (roomId) - pass null to deselect all
 * 5. change_banner_picture - Changes the banner picture/emoji in the chat panel header
 *    Args: (emoji, picture=false) - if picture=true, emoji is treated as a URL
 *
 * STATE TRACKING
 * --------------
 * - selectedRoomId: stores the currently selected room ID (string, null if none)
 *
 * DEPENDENCIES
 * ------------
 * - jQuery ($ helper)
 * =============================================================================
 */

// jQuery reference - ensure jQuery is loaded
if (typeof $ === 'undefined') {
  // If jQuery is not loaded, create a simple reference
  // This assumes jQuery is already loaded via the HTML
  console.error('[home.js] jQuery not found');
}

// Global flag to prevent multiple simultaneous overhead fetches
var FetchingMessages = true;
var we_are_currently_appending_messages_rn = false
// Initialize sidebar tray functionality when document is ready
$(document).ready(function () {
  // 2. Handle Tray Item Clicks
  $('.tray-item').on('click', function () {
    // Remove active class from all items
    $('.tray-item').removeClass('active');

    // Add active class to the clicked item
    $(this).addClass('active');

    // Get the label to determine what to show
    var label = $(this).find('.tray-item__label').text().replace(/\s+/g, '').toLowerCase();
    
    // Update the search placeholder
    updateSearchPlaceholder(label);

    // Clear search input when switching views
    $('.sidebar__search .search-input').val('').trigger('input');
  });

  // Handle Sidebar Search Filtering
  $(document).ready(function() {
    $('.sidebar__search .search-input').on('input', function() {
      const term = $(this).val().toLowerCase().trim();
      $('.sidebar__list .convo-item').each(function() {
        const roomName = $(this).find('.convo-item__name').text().toLowerCase();
        const roomDesc = $(this).find('.convo-item__preview').text().toLowerCase();
        
        if (roomName.includes(term) || roomDesc.includes(term)) {
          $(this).show();
        } else {
          $(this).hide();
        }
      });
    });
  });

  // Function to update the sidebar search input placeholder
  window.updateSearchPlaceholder = function(view) {
    const $searchInput = $('.sidebar__search .search-input');
    if (!$searchInput.length) return;

    if (view === 'messenger') {
      $searchInput.attr('placeholder', 'Search Chats');
    } else if (view === 'publicrooms' || view === 'privaterooms') {
      $searchInput.attr('placeholder', 'Search Rooms');
    } else {
      $searchInput.attr('placeholder', 'Search');
    }
  };

  // Initial placeholder update based on active tray item
  const activeLabel = $('.tray-item.active .tray-item__label').text().replace(/\s+/g, '').toLowerCase();
  if (activeLabel) {
    updateSearchPlaceholder(activeLabel);
  }
});
var overhead_spinner = document.querySelector('#overhead-spinner');
let specialElement_queue = [];
let highlited_messages_to_unhighlight = [];
let there_be_highlited_messages_to_unhighlight = false
var btn_queue = [];

document.body.onclick = function () {
  if (!there_be_highlited_messages_to_unhighlight) { return }
  setTimeout(function () {
    for (var i in highlited_messages_to_unhighlight) {
      highlited_message = highlited_messages_to_unhighlight[i]
      highlited_message.classList.remove('message-highlight');
    }
    there_be_highlited_messages_to_unhighlight = false
  }, 100)
}


  ; (function () {
    "use strict";

    // DOM element cache
    var $sidebarList, $messageContainer, $chatFeed;

    // Initialize DOM references
    $(document).ready(function () {
      $sidebarList = $("#sidebar-list");
      $messageContainer = $("#message-container");
      $chatFeed = $("#chat-feed");
    });

    // Track the currently selected room ID (string)
    var selectedRoomId = null;

    // Room Details View State Tracker
    window.isRoomDetailsOpen = false;

    /**
     * _closeRoomDetailsUI()
     * Internal: hides the room details panel and restores the chat view.
     * Only has effect if the panel is currently open.
     */
    function _closeRoomDetailsUI() {
      if (!window.isRoomDetailsOpen) return;
      $('#room-details-view').hide();
      $('#chat-feed').show();
      $('#chat-panel-inputbar').show();
      window.isRoomDetailsOpen = false;

      // Re-show new-messages button if user was not at the bottom
      var feed = document.getElementById('chat-feed');
      if (feed) {
        var isAtBottom = (feed.scrollHeight - (feed.scrollTop + feed.clientHeight)) <= 100;
        if (!isAtBottom) {
          $('#new-messages-btn').show();
        }
      }
    }

    /**
     * window.closeRoomDetails()
     * Public API used by network/home.js (switch_room / switch_dm)
     * to return the user to the chat view without any animation delay.
     */
    window.closeRoomDetails = _closeRoomDetailsUI;

    $(document).ready(function () {
      // Logic moved to switch functions in network layer

      $('#chat-panel-header').on('click', function () {
        // Do not allow opening room details for direct messages
        if (typeof ROOM !== 'undefined' && ROOM.includes('.$@-@&.')) {
          console.log("Room details not available for DMs.");
          return;
        }

        let header = this;
        header.style.transform = 'scale(0.95)';

        setTimeout(() => {
          header.style.transform = 'scale(1)';

          if (!window.isRoomDetailsOpen) {
            // Open details
            $('#chat-feed').hide();
            $('#chat-panel-inputbar').hide();
            $('#new-messages-btn').hide();
            $('#room-details-view').css('display', 'flex');
            window.isRoomDetailsOpen = true;

            // Update title
            const roomTitleText = $(".room-title").text();
            $("#details-room-title").text(roomTitleText);

            // Delegate fetching to the network layer via the registered hook
            if (typeof window.onOpenRoomDetails === 'function') {
              window.onOpenRoomDetails();
            }
          } else {
            // Close details
            window.closeRoomDetails();
          }
        }, 150);
      });

      // Basic setup for search filter
      $('#member-search-input').on('input', function () {
        const term = $(this).val().toLowerCase();
        $('.member-row').each(function () {
          const name = $(this).find('.member-name-col').text().toLowerCase();
          const user = $(this).find('.member-username-col').text().toLowerCase();
          if (name.includes(term) || user.includes(term)) {
            $(this).show();
          } else {
            $(this).hide();
          }
        });
      });
    });

    /**
     * renderRoomMembers(membersList, myRole)
     * Renders the members into the table.
     */
    /**
     * renderRoomMembers(membersList, myRole, roomType, callbacks)
     * callbacks: { onPromoteDemote(username, action), onRemove(username), onAdd(username) }
     * All socket communication is done via those callbacks, supplied by network/home.js.
     */
    window.renderRoomMembers = function (membersList, myRole, roomType, callbacks) {
      callbacks = callbacks || {};
      const $container = $('#members-list-container');
      $container.empty();

      // Show/hide ADD button based on role
      const canIAdd = myRole === 'Owner' || myRole === 'Manager' || myRole === 'Curator';
      if (canIAdd) {
        $('#add-member-btn').show();
      } else {
        $('#add-member-btn').hide();
      }

      // Show/hide DELETE ROOM button based on role (Owners only)
      const canIDelete = myRole === 'Owner' && typeof ROOM !== 'undefined' && ROOM.toLowerCase() !== 'mainroom';
      if (canIDelete) {
        $('#delete-room-btn').show();
      } else {
        $('#delete-room-btn').hide();
      }

      // Wire ADD button — calls choose_usernames modal
      $('#add-member-btn').off('click').on('click', function () {
        if (typeof choose_usernames === 'function') {
          choose_usernames(true, function (selectedUsernames) {
            if (selectedUsernames && selectedUsernames.length > 0) {
              selectedUsernames.forEach(user => {
                if (typeof callbacks.onAdd === 'function') {
                  callbacks.onAdd(user);
                }
              });
            }
          });
        } else {
          // Fallback if modal is not loaded
          const userToAdd = prompt("Enter the username to add:");
          if (userToAdd && userToAdd.trim() !== '' && typeof callbacks.onAdd === 'function') {
            callbacks.onAdd(userToAdd.trim());
          }
        }
      });

      // Wire DELETE button
      $('#delete-room-btn').off('click').on('click', function () {
        Confirm("Are you sure you want to PERMANENTLY DELETE this room and all its messages? This cannot be undone.", function (agreed) {
          if (agreed) {
            const confirmation = prompt(`To confirm, please type the room name exactly: ${ROOM}`);
            if (confirmation === ROOM && typeof callbacks.onDeleteRoom === 'function') {
              callbacks.onDeleteRoom();
            } else if (confirmation !== null) {
              alert("Room name did not match. Deletion cancelled.");
            }
          }
        });
      });

      membersList.forEach((member) => {
        // Can I edit this user?
        // Rules: Check progression logic.
        // Nobody can edit Owners except Owners.
        // Managers can edit below
        // Curators can edit below
        let canEdit = false;
        const isMyself = member.username === username;

        if (!isMyself) {
          if (myRole === 'Owner') canEdit = true;
          else if (myRole === 'Manager' && (member.role === 'Curator' || member.role === 'Member')) canEdit = true;
          else if (myRole === 'Curator' && member.role === 'Member') canEdit = true;
        }

        let $row = $('<div>').addClass('member-row').css({
          'display': 'grid',
          'grid-template-columns': '2fr 3fr 2fr 44px',
          'padding': '10px 0',
          'border-bottom': '1px solid rgba(44,36,22,0.08)',
          'align-items': 'center'
        });

        // Column 1: Avatar + Username
        let $col1 = $('<div>').addClass('member-username-col').css({ 'display': 'flex', 'align-items': 'center', 'gap': '10px' });
        $col1.append($('<img>').attr('src', '/static/profile-pictures/' + member.username + '.png')
          .css({ 'width': '35px', 'height': '35px', 'border-radius': '50%', 'object-fit': 'cover' })
          .on('error', function () { $(this).attr('src', '/static/graphics/defaultMale.png'); }));
        $col1.append($('<span>').text(member.username));

        // Column 2: Full Name
        let $col2 = $('<div>').addClass('member-name-col').text(member.firstName + ' ' + member.lastName);

        // Column 3: Type with SVG
        let $col3 = $('<div>').css({ 'display': 'flex', 'align-items': 'center', 'gap': '8px' });
        let svgHtml = '';
        if (member.role === 'Owner') svgHtml = $('#svg-owner').html();
        else if (member.role === 'Manager') svgHtml = $('#svg-manager').html();
        else if (member.role === 'Curator') svgHtml = $('#svg-curator').html();
        else if (member.role === 'Member') svgHtml = $('#svg-member').html();

        if (svgHtml) $col3.append(svgHtml);
        $col3.append($('<span>').text(member.role));

        // Column 4: Actions (3 dots)
        let $col4 = $('<div>').css({ 'position': 'relative', 'display': 'flex', 'justify-content': 'center' });
        let $dots = $('<i>').addClass('fa-solid fa-ellipsis-vertical').css({
          'cursor': canEdit ? 'pointer' : 'not-allowed',
          'opacity': canEdit ? '1' : '0.3',
          'padding': '5px 10px'
        });

        if (canEdit) {
          $dots.on('click', function (e) {
            e.stopPropagation();
            $('.member-dropdown-menu').remove(); // close any open menus

            let $menu = $('<div>').addClass('member-dropdown-menu').css({
              'position': 'absolute', 'right': '0', 'top': '100%', 'background': 'white', 'border': '1px solid #ccc',
              'border-radius': '4px', 'box-shadow': '0 2px 5px rgba(0,0,0,0.2)', 'z-index': '100', 'min-width': '120px'
            });

            // Linear progression rules:
            // Owner <-> Manager <-> Curator <-> Member <-> Remove
            // For public rooms: Owner <-> Manager <-> Member <-> Remove

            let possibleDemote = null;
            let possiblePromote = null;
            let canRemove = false;

            if (roomType === 'public') {
              if (member.role === 'Owner') { possibleDemote = 'Manager'; }
              else if (member.role === 'Manager') { possiblePromote = 'Owner'; possibleDemote = 'Member'; }
              else if (member.role === 'Member') { possiblePromote = 'Manager'; canRemove = true; }
            } else {
              if (member.role === 'Owner') { possibleDemote = 'Manager'; }
              else if (member.role === 'Manager') { possiblePromote = 'Owner'; possibleDemote = 'Curator'; }
              else if (member.role === 'Curator') { possiblePromote = 'Manager'; possibleDemote = 'Member'; }
              else if (member.role === 'Member') { possiblePromote = 'Curator'; canRemove = true; }
            }

            // Strict Hierarchy Rules:
            // 1. Owners can edit Other Owners and below.
            // 2. Managers can edit Curators and Members.
            // 3. Curators can edit Members.
            // 4. Managers/Curators cannot promote anyone to their own rank.

            if (myRole === 'Manager') {
              if (possiblePromote === 'Manager') possiblePromote = null;
            }
            if (myRole === 'Curator') {
              if (possiblePromote === 'Curator') possiblePromote = null;
            }
            if (myRole !== 'Owner') {
              if (possiblePromote === 'Owner') possiblePromote = null;
              if (member.role === 'Owner') possibleDemote = null;
            }

            function getIconHtml(roleObj, isLarge = false) {
              let $svg;
              if (roleObj === 'Owner') $svg = $($('#svg-owner').html());
              else if (roleObj === 'Manager') $svg = $($('#svg-manager').html());
              else if (roleObj === 'Curator') $svg = $($('#svg-curator').html());
              else if (roleObj === 'Member') $svg = $($('#svg-member').html());
              else return '';

              if (isLarge) {
                $svg.css({ 'width': '44px', 'height': '44px' });
                // Also ensure path fills match the color if they don't already
              }
              return $svg[0].outerHTML;
            }

            function getRoleColor(roleObj) {
              if (roleObj === 'Owner') return '#c6c600';
              if (roleObj === 'Manager') return '#0000bc';
              if (roleObj === 'Curator') return '#009900';
              if (roleObj === 'Member') return '#000000';
              return 'inherit';
            }

            if (possiblePromote) {
              let color = getRoleColor(possiblePromote);
              let $btn = $('<div>').css({ 'padding': '8px 12px', 'cursor': 'pointer', 'display': 'flex', 'align-items': 'center', 'gap': '12px', 'color': color })
                .html(getIconHtml(possiblePromote, true) + '<span style="font-weight: bold;">Promote to ' + possiblePromote + '</span>')
                .hover(function () { $(this).css('background', '#f5f5f5'); }, function () { $(this).css('background', 'white'); });
              $btn.on('click', function () {
                if (typeof callbacks.onPromoteDemote === 'function') callbacks.onPromoteDemote(member.username, 'promote');
                $menu.remove();
              });
              $menu.append($btn);
            }
            if (possibleDemote) {
              let color = getRoleColor(possibleDemote);
              let $btn = $('<div>').css({ 'padding': '8px 12px', 'cursor': 'pointer', 'display': 'flex', 'align-items': 'center', 'gap': '12px', 'color': color })
                .html(getIconHtml(possibleDemote, true) + '<span style="font-weight: bold;">Demote to ' + possibleDemote + '</span>')
                .hover(function () { $(this).css('background', '#f5f5f5'); }, function () { $(this).css('background', 'white'); });
              $btn.on('click', function () {
                if (typeof callbacks.onPromoteDemote === 'function') callbacks.onPromoteDemote(member.username, 'demote');
                $menu.remove();
              });
              $menu.append($btn);
            }
            if (canRemove) {
              let $btn = $('<div>').css({ 'padding': '8px 12px', 'cursor': 'pointer', 'color': 'red', 'display': 'flex', 'align-items': 'center', 'gap': '8px' })
                .html('<i class="fa-solid fa-user-minus" style="font-size: 18px; width: 22px; text-align: center;"></i><span>Remove</span>')
                .hover(function () { $(this).css('background', '#fef2f2'); }, function () { $(this).css('background', 'white'); });
              $btn.on('click', function () {
                Confirm('Are you sure you want to remove ' + member.username + '?', function (agreed) {
                  if (agreed) {
                    if (typeof callbacks.onRemove === 'function') callbacks.onRemove(member.username);
                  }
                });
                $menu.remove();
              });
              $menu.append($btn);
            }

            if ($menu.children().length > 0) {
              $col4.append($menu);
            } else {
              // Should not happen if logic is correct, but just in case
              let $noAction = $('<div>').css({ 'padding': '8px 12px', 'color': '#aaa' }).text('No actions available');
              $menu.append($noAction);
              $col4.append($menu);
            }

            // Close menu on click outside
            const closeMenuHandler = (evt) => {
              if (!$col4[0].contains(evt.target)) {
                $menu.remove();
                document.removeEventListener('click', closeMenuHandler);
              }
            };
            setTimeout(() => document.addEventListener('click', closeMenuHandler), 10);
          });
        }
        $col4.append($dots);

        $row.append($col1, $col2, $col3, $col4);
        $container.append($row);
      });
    };


    /**
     * createChatRoomOption(id, name, description, action=null, picture=null, unread=false, emoji=null, active=false)
     * ----------------------------------------------------------------------------------------------------------
     * Creates a chat room option in the sidebar with the provided parameters.
     * Uses emoji as the avatar display by default, or a picture if provided.
     * Shows description as preview. Can execute custom action when clicked.
     *
     * @param {string} id - The unique ID for this room option
     * @param {string} name - The name of the chat room
     * @param {string} description - Description/preview text for the room
     * @param {function} action - Optional function to call when clicked (overrides default behavior)
     * @param {string} picture - Optional picture URL to use instead of emoji
     * @param {boolean} unread - Whether the room has unread messages (adds blue styling)
     * @param {string} emoji - The emoji to use as profile picture/avatar (if no picture)
     * @param {boolean} active - If true, marks this option as selected
     */
    window.createChatRoomOption = function (id, name, description, action = null, picture = null, unread = false, emoji = null, active = false) {
      if (!$sidebarList.length) {
        console.error("[home.js] Sidebar list not found. Make sure DOM is ready.");
        return;
      }

      /*
        List item structure:
        <li class="convo-item" data-room="room-id">
          <div class="convo-item__avatar">📊</div>
          <div class="convo-item__info">
            <span class="convo-item__name">Room Name</span>
            <span class="convo-item__preview">Description text</span>
          </div>
        </li>
      */

      // Create avatar with picture or emoji
      var $avatar;
      if (picture && picture !== true && picture !== false) {
        $avatar = $("<img>")
          .addClass("convo-item__avatar")
          .attr("src", picture)
          .css({
            "width": "40px",
            "height": "40px",
            "border-radius": "50%",
            "object-fit": "cover"
          })
          .on("error", function () {
            // Fallback to emoji if picture fails to load
            $(this).replaceWith($("<div>")
              .addClass("convo-item__avatar")
              .text(emoji || "📊"));
          });
      } else {
        $avatar = $("<div>")
          .addClass("convo-item__avatar")
          .text(emoji || "📊");  // Default emoji if none provided
      }

      // Create room name
      var $name = $("<span>")
        .addClass("convo-item__name")
        .text(name);

      // Create description/preview
      var $preview = $("<span>")
        .addClass("convo-item__preview")
        .text(description || "");

      // Create info container
      var $info = $("<div>")
        .addClass("convo-item__info")
        .append($name, $preview);

      // Create list item with provided ID
      var roomId = id || (name && typeof name === 'string' ? name.toLowerCase().replace(/\s+/g, '-') : 'unknown-room');
      var $item = $("<li>")
        .addClass("convo-item")
        .attr("data-room", roomId)
        .append($avatar, $info);

      // Add unread styling if needed
      // UI MAGIC: Never show unread indicator for the room we are currently in
      if (unread && roomId !== ROOM) {
        $item.css({
          "background": "rgba(59, 130, 246, 0.1)" // Light blue background
        });

        // Add unread indicator circle
        var $unreadIndicator = $("<div>")
          .css({
            "width": "8px",
            "height": "8px",
            "background": "#1e40af", // Dark blue
            "border-radius": "50%",
            "position": "absolute",
            "right": "12px",
            "top": "50%",
            "transform": "translateY(-50%)"
          });

        $item.css("position", "relative").append($unreadIndicator);
      }

      // Add click handler - use custom action if provided, otherwise default behavior
      $item.on("click", function () {
        // Update selected room tracking
        changeSelectedRoomOption(roomId);

        if (action && typeof action === 'function') {
          action(name, roomId);
        } else {
          switchToRoom(roomId, name);
        }
      });

      // Append to sidebar list
      $sidebarList.append($item);

      // If active, select this room
      if (active) {
        changeSelectedRoomOption(roomId);
      }
    };

    /**
     * changeSelectedRoomOption(roomId)
     * ---------------------------------
     * Changes the selected room option by deselecting the current one
     * and selecting the new one based on the provided room ID.
     *
     * @param {string} roomId - The ID of the room to select
     */
    window.changeSelectedRoomOption = function (roomId) {
      // Deselect the current room if one exists
      if (selectedRoomId) {
        $(".convo-item").filter(function () { return $(this).attr("data-room") === selectedRoomId; }).removeClass("active");
      }

      // Update the selected room ID
      selectedRoomId = roomId;

      // Select the new room if roomId is provided
      if (roomId) {
        var $item = $(".convo-item").filter(function () { return $(this).attr("data-room") === roomId; });
        $item.addClass("active");

        // UI MAGIC: Clear unread status visually when switching to this room
        $item.css("background", ""); // Remove inline light blue background
        $item.find("div").filter(function () {
          // Match the dark blue background color of the unread indicator
          var bg = $(this).css("background-color");
          return bg === "rgb(30, 64, 175)" || bg === "#1e40af";
        }).remove();
      }
    };

    /**
     * clearAllChatRoomOptions()
     * -------------------------
     * Clears all chat room options from the sidebar list.
     * Useful for refreshing the room list or switching contexts.
     */
    window.clearAllChatRoomOptions = function () {
      if (!$sidebarList.length) {
        console.error("[home.js] Sidebar list not found. Make sure DOM is ready.");
        return;
      }

      $sidebarList.empty();
    };

    /**
     * change_banner_picture(emoji, picture=false)
     * -------------------------------------------
     * Changes the banner picture/emoji in the chat panel header.
     * If picture is true, treats emoji as a URL and creates an image avatar.
     * Otherwise, displays the emoji as text.
     *
     * @param {string} emoji - The emoji to display, or URL if picture=true
     * @param {boolean} picture - If true, creates an image avatar with emoji as src
     */
    window.change_banner_picture = function (emoji, picture = false) {
      var $bannerPicture = $("#banner-picture");
      if (!$bannerPicture.length) {
        console.error("[home.js] Banner picture element not found.");
        return;
      }

      if (picture && emoji) {
        // Create image avatar with emoji as URL
        var $img = $("<img>")
          .addClass("convo-item__avatar")
          .attr("id", "banner-picture")
          .attr("src", emoji)
          .css({
            "width": "42px",
            "height": "42px",
            "border-radius": "50%",
            "object-fit": "cover"
          })
          .on("error", function () {
            // Fallback to emoji if image fails to load
            $(this).replaceWith($("<div>")
              .addClass("convo-item__avatar")
              .attr("id", "banner-picture")
              .text("📊"));
          });
        $bannerPicture.replaceWith($img);
      } else {
        // Create or update div with emoji text
        var $div = $("<div>")
          .addClass("convo-item__avatar")
          .attr("id", "banner-picture")
          .text(emoji || "📊");
        $bannerPicture.replaceWith($div);
      }
    };

    // Global message bubble index counter

    /**
     * appendMessage(index, username, message, timestamp, myself, replyIndex=-1, overhead=false)
     * -----------------------------------------
     * Appends a message to the chat feed with the provided parameters.
     * Creates proper message structure with avatar, name, and bubble.
     * Each bubble gets an aria-index attribute for reply targeting.
     * If replyIndex is provided (not -1), shows a reply indicator that links to the original message.
     * If overhead is true, inserts the message at the TOP of the chat (for loading historical messages).
     *
     * @param {number} index - The global message ID for aria-index (server-client identifier)
     * @param {string} username - The username of the message sender
     * @param {string} message - The message content
     * @param {string} timestamp - The timestamp for the message
     * @param {boolean} myself - Set to true if this is your own message (appears on right)
     * @param {number} replyIndex - aria-index of message being replied to (-1 if not a reply)
     * @param {boolean} overhead - If true, inserts message at top for historical loading
     */

    window.appendMessage = function (data, scrollData = { 'scrollToBottom': true, 'specialScrollTo': null }) {
      we_are_currently_appending_messages_rn = true;
      let index = data['index'];
      let username = data['username'];
      let message = data['message'];
      let timestamp = data['timestamp'];
      let myself = data['myself'];
      let replyIndex = data['replyIndex'];
      let overhead = data['overhead'];

      if (!$messageContainer.length) return;

      // Use the provided index for aria-index (required parameter)
      const currentIdx = index;

      // If overhead mode, increment all existing aria-index values by 1
      if (overhead) {
        // Note: This logic is now simplified - each message keeps its actual server-provided index
        // The scroll sensor uses the topmost message's aria-index to determine what to fetch next
      }

      // Find the avatar from the wrapper (or use a default)
      // If your app passes the avatar URL into this function, use that instead.
      const avatarUrl = myself ? "/static/profile-pictures/me.png" : "/static/profile-pictures/" + username + ".png";

      // --- 1. Fix "Invalid Date" & Parse ---
      // We force the string into ISO format: yyyy-mm-ddThh:mm:ssZ
      var msgDate = timestamp ? new Date(timestamp.replace(" ", "T") + "Z") : new Date();

      // Check if parsing failed, fallback to current time
      if (isNaN(msgDate.getTime())) {
        msgDate = new Date();
      }

      var timeStr = msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
      var dayShort = msgDate.toLocaleDateString([], { weekday: 'short' });
      var fullDateStr = msgDate.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      // Header Display: hide day if it's today
      var today = new Date();
      var isToday = msgDate.getDate() === today.getDate() &&
                    msgDate.getMonth() === today.getMonth() &&
                    msgDate.getFullYear() === today.getFullYear();
      
      var headerStamp = (isToday ? "" : dayShort + " ") + timeStr;

      // --- 2. Big Centered Date Stamp and User Grouping Logic ---
      var isSameUser, $targetMsgGroup;
      var currentTimestamp = msgDate.getTime();
      var fiveMinutesMs = 5 * 60 * 1000; // 5 minutes in milliseconds
      const isDeleted = data['deleted'];

      // 1. Capture current scroll state for anchor logic
      var feed = document.getElementById('chat-feed');
      var oldScrollHeight = feed ? feed.scrollHeight : 0;
      var oldScrollTop = feed ? feed.scrollTop : 0;

      if (overhead) {
        // STEP A: Remove the current "Roof" (the topmost date divider)
        // We remove it so we can re-evaluate the grouping against the actual messages.
        var $topDivider = $messageContainer.children('.chat-date-divider').first();
        var originalRoofDate = $topDivider.attr('data-date');
        $topDivider.remove();

        // STEP B: Identify the first actual message group
        var $firstMsg = $messageContainer.children('.message').first();

        if ($firstMsg.length > 0) {
          var firstDateAttr = $firstMsg.attr("data-date");
          var firstTimestamp = parseInt($firstMsg.attr("data-timestamp") || "0");
          var firstUser = $firstMsg.attr("data-user");
          var timeDiffMs = firstTimestamp - currentTimestamp;

          // Check if the first message bubble is deleted or blocked
          var firstBubbleText = $firstMsg.find(".message__bubble").first().find(".message__text").text();
          var firstBubbleIsDeleted = firstBubbleText === "(message has been deleted)" || firstBubbleText.includes("blocked by your age-segregation");

          // Grouping logic: Not deleted, same user, same date, and the existing message is NEWER (timeDiff >= 0)
          isSameUser = !isDeleted && !firstBubbleIsDeleted &&
            (firstUser === (myself ? "You" : username)) &&
            (firstDateAttr === fullDateStr) &&
            (timeDiffMs < fiveMinutesMs) &&
            (timeDiffMs >= 0);
          $targetMsgGroup = $firstMsg;
        }
      } else {
        // Normal / Underhead logic (stays mostly same)
        var $lastMsg = $messageContainer.find(".message").last();
        var lastDateAttr = $lastMsg.attr("data-date");

        // If the date has changed since the last message (or this is the first message)
        if (lastDateAttr !== fullDateStr) {
          var $dateDivider = $("<div>")
            .addClass("chat-date-divider")
            .css({
              "display": "flex",
              "align-items": "center",
              "justify-content": "center",
              "margin": "20px 0",
              "position": "relative"
            })
            .html(`
                    <div style="position: absolute; width: 100%; height: 1px; background: rgba(0,0,0,0.1); z-index: 1;"></div>
                    <span style="background: var(--color-light); padding: 0 15px; z-index: 2; color: #777; font-size: 0.85rem; font-weight: 500;">
                        ${fullDateStr}
                    </span>
                `);
          $messageContainer.append($dateDivider);
        }

        var lastTimestamp = parseInt($lastMsg.attr("data-timestamp") || "0");
        var lastUser = $lastMsg.attr("data-user");
        var timeDiffMs = currentTimestamp - lastTimestamp;

        // Check if the last message bubble is deleted or blocked
        var lastBubbleText = $lastMsg.find(".message__bubble").last().find(".message__text").text();
        var lastBubbleIsDeleted = lastBubbleText === "(message has been deleted)" || lastBubbleText.includes("blocked by your age-segregation");

        isSameUser = !isDeleted && !lastBubbleIsDeleted && (lastUser === (myself ? "You" : username)) && (lastDateAttr === fullDateStr) && (timeDiffMs < fiveMinutesMs);
        $targetMsgGroup = $lastMsg;
      }

      var hitUnread = false;
      if (typeof scrollData === "object" && scrollData.lastTimeStamp && !window.__placed_unread_marker) {
        if (timestamp > scrollData.lastTimeStamp) {
          isSameUser = false;
          window.__placed_unread_marker = true;

          var $unreadDivider = $("<div>")
            .addClass("chat-unread-divider")
            .css({
              "display": "flex",
              "align-items": "center",
              "justify-content": "center",
              "margin": "20px 0",
              "position": "relative"
            })
            .html(`
                        <div style="position: absolute; width: 100%; height: 1px; background: red; z-index: 1;"></div>
                        <span style="background: var(--color-light); padding: 4px 15px; z-index: 2; color: red; font-size: 0.85rem; font-weight: bold; border-radius: 4px; border: 1px solid red; white-space: nowrap;">
                            NEW MESSAGES
                        </span>
                    `);
          if (overhead) {
            $messageContainer.prepend($unreadDivider);
          } else {
            $messageContainer.append($unreadDivider);
          }
        }
      }

      if (isSameUser && $targetMsgGroup.length) {
        // Grouped bubble - add to existing message group

        // Grouped bubble with message actions and data stamps
        var $newBubble = $("<div>").addClass("message__bubble").attr("aria-index", currentIdx)
          .attr("aria-username", username)
          .attr("data-message-text", message)

        // Role-based actions
        const isDM = typeof ROOM !== 'undefined' && ROOM.includes('.$@-@&.');
        const isMod = window.myRole === 'Owner' || window.myRole === 'Manager';
        const canDelete = myself || (!isDM && isMod);

        // Add message actions hover menu
        var $actions = $("<div>").addClass("message-actions");

        if (!isDeleted) {
          let actionsHtml = '<div class="action-item reaction-btn" title="React">😊</div>' +
            '<div class="action-divider"></div>';

          if (canDelete) {
            actionsHtml += '<div class="action-item delete-btn" title="Delete">🗑️</div>' +
              '<div class="action-divider"></div>';
          }

          actionsHtml += '<div class="action-item unread-btn" title="Mark Unread">💬</div>' +
            '<div class="action-divider"></div>';

          if (!myself) {
            actionsHtml += '<div class="action-item report-btn" title="Report">🚩</div>' +
              '<div class="action-divider"></div>';
          }

          actionsHtml += '<div class="action-item reply-btn" title="Reply">↩️</div>';
          $actions.html(actionsHtml);
          $newBubble.append($actions);
        }

        const hasText = message && message.trim() !== '';
        const hasUpload = data['upload'] && data['upload'].trim() !== '';

        if (!hasText && hasUpload && !window.PL_BLOCK_MEDIA) {
          $newBubble.css({ "background": "transparent", "border-color": "transparent", "box-shadow": "none" });
        }

        if (hasText || isDeleted || (hasUpload && window.PL_BLOCK_MEDIA)) {
          var textContent = message;
          if (isDeleted) {
            textContent = (message && message.includes("blocked")) ? message : "(message has been deleted)";
          } else if (!hasText && hasUpload && window.PL_BLOCK_MEDIA) {
            textContent = "(this media has been restricted by your parental settings)";
          }

          var $newText = $("<div>").addClass("message__text").text(textContent);
          if (isDeleted || (!hasText && hasUpload && window.PL_BLOCK_MEDIA)) {
            $newText.css("font-style", "italic").css("color", "#777");
          }

          // If this is a reply, add reply indicator before the text
          if (replyIndex !== -1) {
            var $replyIndicator = createReplyIndicator(replyIndex, currentIdx);
            $newText.prepend($replyIndicator);
          }

          $newBubble.append($newText);
        }

        if (overhead) {
          // Prepend bubble to the existing group's content (before the first bubble)
          $targetMsgGroup.find(".message__content .message__bubble").first().before($newBubble);
        } else {
          $targetMsgGroup.find(".message__content").append($newBubble);
        }

        // --- Handle Images for Grouped Messages ---
        if (hasUpload) {
          if (window.PL_BLOCK_MEDIA) {
            if (hasText) {
              let $warning = $("<div>")
                .css({ "font-style": "italic", "color": "#777", "margin-top": "8px", "font-size": "0.95rem" })
                .text("(this media has been restricted by your parental settings)");
              if (overhead) {
                $newBubble.after($warning);
              } else {
                $targetMsgGroup.find(".message__content").append($warning);
              }
            }
          } else {
            let imageGroup = $("<div>").addClass("chat-image-group").css({ "display": "flex", "flex-wrap": "wrap", "gap": "8px", "margin-top": "8px" });
            let uploadItems = data['upload'].split('|');
            uploadItems.forEach(item => {
              if (item.startsWith('/static/uploads/')) {
                let $img = $("<img>").attr("src", item).addClass("chat-upload-img").on('click', function () {
                  if (typeof window.openImageModal === 'function') {
                    window.openImageModal(item);
                  } else {
                    window.open(item, '_blank');
                  }
                });
                imageGroup.append($img);
              } else if (item.includes('giphy.com') || item.includes('giphy_id:')) {
                let $gif = $("<img>").attr("src", item).addClass("chat-upload-gif");
                imageGroup.append($gif);
              }
            });
            if (imageGroup.children().length > 0) {
              if (!hasText) {
                $newBubble.append(imageGroup);
              } else {
                if (overhead) {
                  $newBubble.after(imageGroup);
                } else {
                  $targetMsgGroup.find(".message__content").append(imageGroup);
                }
              }
            }
          }
        }

        // Add reply button click handler
        $newBubble.find('.reply-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          showReplyPreview(index);
        });

        // Add report button click handler
        $newBubble.find('.report-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          const sender = $(this).closest('.message__bubble').attr('aria-username');
          const text = $(this).closest('.message__bubble').attr('data-message-text');
          if (typeof window.reportMessageContent === 'function') {
            window.reportMessageContent(index, sender, text);
          }
        });

        // Add delete button click handler
        $newBubble.find('.delete-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          Confirm("Delete this message?", function (agreed) {
            if (agreed) {
              broadcast_delete_message(index);
            }
          });
        });

        // Add reaction button click handler
        $newBubble.find('.reaction-btn').on('click', function (e) {
          e.stopPropagation();
          const target = this;
          const index = $(this).closest('.message__bubble').attr('aria-index');
          if (typeof emojiPicker !== 'undefined' && emojiPicker.re_attach) {
            const selector = `.message__bubble[aria-index="${index}"] .reaction-btn`;
            emojiPicker.re_attach(selector, function (selectedEmoji) {
              if (typeof broadcast_added_reaction === 'function') {
                broadcast_added_reaction(index, selectedEmoji);
              }
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker) {
                picker.showing = false;
                picker.style.opacity = '0';
                setTimeout(function () {
                  picker.style.top = '-9999px';
                  picker.style.opacity = '1';
                  picker.style.transform = 'scale(0.85)';
                }, 100);
              }
              emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
            });
            emojiPicker.show_picker(target);

            const restorePicker = function (evt) {
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker && !picker.contains(evt.target) && evt.target !== target && !target.contains(evt.target)) {
                setTimeout(() => {
                  if (emojiPicker.attachTo === selector) {
                    emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
                  }
                }, 50);
                document.removeEventListener('click', restorePicker, true);
              } else if (picker && picker.contains(evt.target)) {
                document.removeEventListener('click', restorePicker, true);
              }
            };
            document.addEventListener('click', restorePicker, true);
          }
        });

        // Add unread button click handler
        $newBubble.find('.unread-btn').on('click', function (e) {
          e.stopPropagation();
          const $bubble = $(this).closest('.message__bubble');
          const index = $bubble.attr('aria-index');

          $('.chat-unread-divider').remove(); // remove any existing ones

          var $unreadDivider = $("<div>")
            .addClass("chat-unread-divider")
            .css({
              "display": "flex",
              "align-items": "center",
              "justify-content": "center",
              "margin": "20px 0",
              "position": "relative"
            })
            .html(`
                       <div style="position: absolute; width: 100%; height: 1px; background: red; z-index: 1;"></div>
                       <span style="background: var(--color-light); padding: 4px 15px; z-index: 2; color: red; font-size: 0.85rem; font-weight: bold; border-radius: 4px; border: 1px solid red; white-space: nowrap;">
                           NEW MESSAGES
                       </span>
                   `);

          const $msgGroup = $bubble.closest('.message');
          const $prevBubbles = $bubble.prevAll('.message__bubble');

          if ($prevBubbles.length > 0) {
            // Split the group
            const isOwn = $msgGroup.hasClass('own');
            const $newGroup = $('<div>').addClass('message').addClass(isOwn ? 'own' : '');
            const $content = $('<div>').addClass('message__content');

            // Get original avatar and name wrapper
            const $originalAvatar = $msgGroup.find('.message__avatar').first().clone();
            const $originalNameWrapper = $msgGroup.find('.message__content > div').first().clone();

            $content.append($originalNameWrapper);

            // Move current bubble and all following siblings (bubbles + images)
            const $toMove = $bubble.add($bubble.nextAll());
            $content.append($toMove);

            if ($originalAvatar.length) $newGroup.append($originalAvatar);
            $newGroup.append($content);

            $msgGroup.after($newGroup);
            $newGroup.before($unreadDivider);
          } else {
            // Already the first bubble in the group, just place divider before the group
            $msgGroup.before($unreadDivider);
          }

          if (typeof broadcast_mark_unread === 'function') {
            broadcast_mark_unread(index);
          }
        });
      } else {
        // New Message Group - create a new message container

        // New Message Group
        var $msg = $("<div>").addClass("message").attr("data-user", myself ? "You" : username).attr("data-date", fullDateStr).attr("data-timestamp", msgDate.getTime());
        if (myself) $msg.addClass("own");

        var $avatar = $("<img>").addClass("message__avatar").attr("src", "/static/profile-pictures/" + username + ".png")
          .css({ "border": "2px solid black" })  // Always black outline
          .on("error", function () { $(this).attr("src", "/static/graphics/defaultMale.png"); });

        var $content = $("<div>").addClass("message__content");

        // UI FIX: Separate the Name Box from the Timestamp
        var $nameWrapper = $("<div>").css({ "display": "flex", "align-items": "center", "margin-bottom": "4px" });

        var $nameBox = $("<span>")
          .addClass("message__name")
          .css({ "padding": "2px 8px", "border-radius": "4px", "font-weight": "bold", "font-size": "1.2rem" }) // Bigger and bold
          .text(myself ? "You" : username);

        var $timestampLabel = $("<span>")
          .css({ "margin-left": "8px", "font-size": "0.8rem", "color": "#777" })
          .text(" " + headerStamp); // No dot before date

        // For own messages (right side), put timestamp first, then name
        // For others' messages (left side), put name first, then timestamp
        if (isDeleted) {
          $nameWrapper.append($timestampLabel);
        } else {
          if (myself) {
            $timestampLabel.css({ "margin-left": "0", "margin-right": "8px" });
            $nameWrapper.append($timestampLabel, $nameBox);
          } else {
            $nameWrapper.append($nameBox, $timestampLabel);
          }
        }

        var $bubble = $("<div>").addClass("message__bubble").attr("aria-index", currentIdx)
          .attr("aria-username", username)
          .attr("data-message-text", message);

        // Add message actions hover menu
        var $actions = $("<div>").addClass("message-actions");

        // Role-based delete button visibility
        // Can delete if: 1. It's your message 2. It's a room and you are Owner/Manager
        const isDM = typeof ROOM !== 'undefined' && ROOM.includes('.$@-@&.');
        const isMod = window.myRole === 'Owner' || window.myRole === 'Manager';
        const canDelete = myself || (!isDM && isMod);

        if (!isDeleted) {
          let actionsHtml = '<div class="action-item reaction-btn" title="React">😊</div>' +
            '<div class="action-divider"></div>';

          if (canDelete) {
            actionsHtml += '<div class="action-item delete-btn" title="Delete">🗑️</div>' +
              '<div class="action-divider"></div>';
          }

          actionsHtml += '<div class="action-item unread-btn" title="Mark Unread">💬</div>' +
            '<div class="action-divider"></div>';

          if (!myself) {
            actionsHtml += '<div class="action-item report-btn" title="Report">🚩</div>' +
              '<div class="action-divider"></div>';
          }

          actionsHtml += '<div class="action-item reply-btn" title="Reply">↩️</div>';

          $actions.html(actionsHtml);
          $bubble.append($actions);
        }

        const hasText = message && message.trim() !== '';
        const hasUpload = data['upload'] && data['upload'].trim() !== '';

        if (!hasText && hasUpload && !window.PL_BLOCK_MEDIA) {
          $bubble.css({ "background": "transparent", "border-color": "transparent", "box-shadow": "none" });
        }

        if (hasText || isDeleted || (hasUpload && window.PL_BLOCK_MEDIA)) {
          var textContent = message;
          if (isDeleted) {
            textContent = (message && message.includes("blocked")) ? message : "(message has been deleted)";
          } else if (!hasText && hasUpload && window.PL_BLOCK_MEDIA) {
            textContent = "(this media has been restricted by your parental settings)";
          }

          var $text = $("<div>").addClass("message__text").css({ "color": "black" }).text(textContent);
          if (isDeleted || (!hasText && hasUpload && window.PL_BLOCK_MEDIA)) {
            $text.css("font-style", "italic").css("color", "#777");
          }

          // Style bubble background based on sender
          if (!myself) {
            $bubble.css({ "background": "white", "border": "1px solid black" }); // White background for others
          }

          $bubble.append($text);
        }

        $content.append($nameWrapper, $bubble);
        if (!isDeleted) {
          $msg.append($avatar, $content);
        } else {
          $msg.append($content);
        }

        if (overhead) {
          $messageContainer.prepend($msg);
        } else {
          $messageContainer.append($msg);
        }

        // --- Handle Images for New Message Groups ---
        if (hasUpload) {
          if (window.PL_BLOCK_MEDIA) {
            if (hasText) {
              let $warning = $("<div>")
                .css({ "font-style": "italic", "color": "#777", "margin-top": "8px", "font-size": "0.95rem" })
                .text("(this media has been restricted by your parental settings)");
              if (myself) $warning.css("text-align", "right");
              $content.append($warning);
            }
          } else {
            let imageGroup = $("<div>").addClass("chat-image-group").css({ "display": "flex", "flex-wrap": "wrap", "gap": "8px", "margin-top": "8px" });
            if (myself) imageGroup.css("justify-content", "flex-end");

            let uploadItems = data['upload'].split('|');
            uploadItems.forEach(item => {
              if (item.startsWith('/static/uploads/')) {
                let $img = $("<img>").attr("src", item).addClass("chat-upload-img").on('click', function () {
                  if (typeof window.openImageModal === 'function') {
                    window.openImageModal(item);
                  } else {
                    window.open(item, '_blank');
                  }
                });
                imageGroup.append($img);
              } else if (item.includes('giphy.com') || item.includes('giphy_id:')) {
                let $gif = $("<img>").attr("src", item).addClass("chat-upload-gif");
                imageGroup.append($gif);
              }
            });
            if (imageGroup.children().length > 0) {
              if (!hasText) {
                $bubble.append(imageGroup);
              } else {
                $content.append(imageGroup);
              }
            }
          }
        }

        // Add reply button click handler
        $bubble.find('.reply-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          showReplyPreview(index);
        });

        // Add report button click handler
        $bubble.find('.report-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          const sender = $(this).closest('.message__bubble').attr('aria-username');
          const text = $(this).closest('.message__bubble').attr('data-message-text');
          if (typeof window.reportMessageContent === 'function') {
            window.reportMessageContent(index, sender, text);
          }
        });

        // Add delete button click handler
        $bubble.find('.delete-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          Confirm("Delete this message?", function (agreed) {
            if (agreed) {
              broadcast_delete_message(index);
            }
          });
        });

        // Add reaction button click handler
        $bubble.find('.reaction-btn').on('click', function (e) {
          e.stopPropagation();
          const target = this;
          const index = $(this).closest('.message__bubble').attr('aria-index');
          if (typeof emojiPicker !== 'undefined' && emojiPicker.re_attach) {
            const selector = `.message__bubble[aria-index="${index}"] .reaction-btn`;
            emojiPicker.re_attach(selector, function (selectedEmoji) {
              if (typeof broadcast_added_reaction === 'function') {
                broadcast_added_reaction(index, selectedEmoji);
              }
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker) {
                picker.showing = false;
                picker.style.opacity = '0';
                setTimeout(function () {
                  picker.style.top = '-9999px';
                  picker.style.opacity = '1';
                  picker.style.transform = 'scale(0.85)';
                }, 100);
              }
              emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
            });
            emojiPicker.show_picker(target);

            const restorePicker = function (evt) {
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker && !picker.contains(evt.target) && evt.target !== target && !target.contains(evt.target)) {
                setTimeout(() => {
                  if (emojiPicker.attachTo === selector) {
                    emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
                  }
                }, 50);
                document.removeEventListener('click', restorePicker, true);
              } else if (picker && picker.contains(evt.target)) {
                document.removeEventListener('click', restorePicker, true);
              }
            };
            document.addEventListener('click', restorePicker, true);
          }
        });

        // Add unread button click handler
        $bubble.find('.unread-btn').on('click', function (e) {
          e.stopPropagation();
          const $clickedBubble = $(this).closest('.message__bubble');
          const index = $clickedBubble.attr('aria-index');

          $('.chat-unread-divider').remove(); // remove any existing ones

          var $unreadDivider = $("<div>")
            .addClass("chat-unread-divider")
            .css({
              "display": "flex",
              "align-items": "center",
              "justify-content": "center",
              "margin": "20px 0",
              "position": "relative"
            })
            .html(`
                       <div style="position: absolute; width: 100%; height: 1px; background: red; z-index: 1;"></div>
                       <span style="background: var(--color-light); padding: 4px 15px; z-index: 2; color: red; font-size: 0.85rem; font-weight: bold; border-radius: 4px; border: 1px solid red; white-space: nowrap;">
                           NEW MESSAGES
                       </span>
                   `);

          const $msgGroup = $clickedBubble.closest('.message');
          const $prevBubbles = $clickedBubble.prevAll('.message__bubble');

          if ($prevBubbles.length > 0) {
            // Split the group
            const isOwn = $msgGroup.hasClass('own');
            const $newGroup = $('<div>').addClass('message').addClass(isOwn ? 'own' : '');
            const $content = $('<div>').addClass('message__content');

            // Get original avatar and name wrapper
            const $originalAvatar = $msgGroup.find('.message__avatar').first().clone();
            const $originalNameWrapper = $msgGroup.find('.message__content > div').first().clone();

            $content.append($originalNameWrapper);

            // Move current bubble and all following siblings (bubbles + images)
            const $toMove = $clickedBubble.add($clickedBubble.nextAll());
            $content.append($toMove);

            if ($originalAvatar.length) $newGroup.append($originalAvatar);
            $newGroup.append($content);

            $msgGroup.after($newGroup);
            $newGroup.before($unreadDivider);
          } else {
            // Already the first bubble in the group, just place divider before the group
            $msgGroup.before($unreadDivider);
          }

          if (typeof broadcast_mark_unread === 'function') {
            broadcast_mark_unread(index);
          }
        });
      }

      if (!data['overhead'] && !data['underhead']) {
        // Always scroll to bottom for user's own messages, or if already at bottom
        if (data['myself'] || window.attached_to_bottom) {
          if (scrollData['scrollToBottom']) {
            scrollToBottom();
          }

          // Hide the new messages button when at bottom
          toggle_new_messages_btn(false);
        } else {
          // Show floating button for new messages
          toggle_new_messages_btn(true);
        }
      }

      // STEP C: Clean up and Re-apply Dividers for Overhead
      if (overhead) {
        // Helper function to create date divider
        function createDateDividerHtml(dateStr) {
          return $("<div>")
            .addClass("chat-date-divider")
            .attr("data-date", dateStr)
            .css({ "display": "flex", "align-items": "center", "justify-content": "center", "margin": "20px 0", "position": "relative" })
            .html(`
                    <div style="position: absolute; width: 100%; height: 1px; background: rgba(0,0,0,0.1); z-index: 1;"></div>
                    <span style="background: var(--color-light); padding: 0 15px; z-index: 2; color: #777; font-size: 0.85rem; font-weight: 500;">
                        ${dateStr}
                    </span>
                `);
        }

        // 1. Get the date of the message that is NOW at the very top
        var $newTopMsg = $messageContainer.children('.message').first();
        var newTopDate = $newTopMsg.attr('data-date');

        // 2. Prepend a divider for the new roof date
        // (Remove any existing divider for this date first to avoid duplicates)
        $messageContainer.children('.chat-date-divider[data-date="' + newTopDate + '"]').remove();
        $messageContainer.prepend(createDateDividerHtml(newTopDate));

        // 3. If the original roof was a different date, make sure it still has a divider
        if (originalRoofDate && originalRoofDate !== newTopDate) {
          var $firstMsgOfOldDate = $messageContainer.children('.message[data-date="' + originalRoofDate + '"]').first();
          if ($firstMsgOfOldDate.length && !$firstMsgOfOldDate.prev().hasClass('chat-date-divider')) {
            $firstMsgOfOldDate.before(createDateDividerHtml(originalRoofDate));
          }
        }

        // 2. RESTORE: The "Anti-Jump" Calculation
        // We calculate the delta (difference) and apply it instantly.
        var newScrollHeight = feed.scrollHeight;
        var heightAdded = newScrollHeight - oldScrollHeight;

        // This shifts the scrollbar down by exactly the amount of content added
        feed.scrollTop = oldScrollTop + heightAdded;
      }

      if (typeof (scrollData['specialScrollTo']) === 'number') {
        try {
          console.log('Scrolling to special element: ' + scrollData['specialScrollTo']);
          var specialElement = $('.message__bubble[aria-index="' + scrollData['specialScrollTo'] + '"]')[0];

          if (specialElement) {
            specialElement_queue.push(specialElement);
            setTimeout(function () {
              specialElement = specialElement_queue.splice(0, 1)[0];
              specialElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              specialElement.classList.add('message-highlight');
              highlited_messages_to_unhighlight.push(specialElement)
              there_be_highlited_messages_to_unhighlight = true
            }, 100);
          }
        }
        catch (e) {

        }
      }

      // Check if we should set FetchingMessages to false
      if (network_coast_clear_for_setting_fetching_messages_to_false) {
        FetchingMessages = false;
        network_coast_clear_for_setting_fetching_messages_to_false = false;
      }

      we_are_currently_appending_messages_rn = false;
    };

    /**
     * createReplyIndicator(replyIndex)
     * ---------------------------------
     * Creates a reply indicator element that shows the user and message being replied to.
     * Uses CSS classes for styling with stacked text layout.
     * If the original message is not in the feed, calls fetch_special_reply_message() 
     * and marks the indicator with aria-backtrace_reply="true".
     *
     * @param {number} replyIndex - The aria-index of the message being replied to
     * @returns {jQuery} The reply indicator jQuery element
     */
    function createReplyIndicator(targetIndex, currentIdx) {
      const $targetBubble = $(`.message__bubble[aria-index="${targetIndex}"]`);

      // Check if target message exists in the feed
      const messageExists = $targetBubble.length > 0;

      // Safety check: find data from the target
      const originalText = messageExists ? ($targetBubble.attr('data-message-text') || "...") : "...";
      const originalUser = messageExists ? $targetBubble.attr('aria-username') : "...";
      const avatarSrc = `/static/profile-pictures/${originalUser}.png`;

      // Create the reply container — use .text() for user data to prevent HTML injection
      const $container = $(`
        <div class="reply-container">
            <div class="reply-curve"></div>
            <div class="reply-content">
                <img src="" class="reply-avatar">
                <div class="reply-text-stack">
                    <span class="reply-username"></span>
                    <span class="reply-preview-text"></span>
                </div>
            </div>
        </div>
    `);
      $container.find('.reply-avatar').attr('src', avatarSrc);
      $container.find('.reply-username').text(originalUser);
      $container.find('.reply-preview-text').text(originalText);

      // If message doesn't exist in feed, mark it for backtrace and fetch it
      if (!messageExists) {
        $container.attr('aria-backtrace_reply', 'true');
        $container.attr('data-reply-index', targetIndex);

        // Call the fetch function to get the original message from server
        if (typeof fetch_special_reply_message === 'function') {
          fetch_special_reply_message(targetIndex, currentIdx);
        }
      }

      // Add click handler
      $container.on('click', function (e) {
        e.stopPropagation();
        if (this.getAttribute('aria-backtrace_reply') === 'true') {
          fetch_special_reply_messages(targetIndex);
        }
        else {
          const $target = $(`.message__bubble[aria-index="${targetIndex}"]`);
          if ($target.length) {
            $target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            $target.addClass('message-highlight');
            highlited_messages_to_unhighlight.push($target[0])
            there_be_highlited_messages_to_unhighlight = true
          }
        }

      });

      return $container;
    }

    /**
     * scrollToMessageAndHighlight(replyIndex)
     * -------------------------------------
     * Smoothly scrolls to a message bubble by aria-index and adds a highlight border.
     * Uses CSS class for highlight. The highlight is removed when user clicks anywhere.
     *
     * @param {number} replyIndex - The aria-index of the message bubble to scroll to
     */
    function scrollToMessageAndHighlight(replyIndex) {
      var $targetBubble = $(".message__bubble[aria-index='" + replyIndex + "']");
      if (!$targetBubble.length) {
        console.log("[home.js] Message bubble with aria-index " + replyIndex + " not found");
        return;
      }

      // Remove any existing highlights first
      $(".message__bubble").removeClass("message-highlight");

      // Add highlight using CSS class
      $targetBubble.addClass("message-highlight");

      highlited_messages_to_unhighlight.push($targetBubble[0])
      there_be_highlited_messages_to_unhighlight = true

      // Smooth scroll to the bubble
      $targetBubble[0].scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.scrollToMessageAndHighlight = scrollToMessageAndHighlight;

    /**
     * showReplyPreview(index)
     * Updates the global currentReplyIndex and shows the UI bar.
     */
    window.showReplyPreview = function (index) {
      currentreply_id = index; // Updates the global variable in home.js

      const $target = $(`.message__bubble[aria-index="${index}"]`);
      if (!$target.length) return;

      // Pull the stamped data we set in appendMessage
      const user = $target.attr('aria-username');
      const avatar = `/static/profile-pictures/${user}.png`;
      const text = $target.attr('data-message-text') || "...";

      const $bar = $('#reply-preview-bar');

      // Build skeleton HTML first, then set user-controlled values via .text() to prevent HTML injection
      $bar.html(`
      <div class="reply-preview-container">
        <div class="reply-preview-hook"></div>
        <div class="reply-preview-content">
          <img src="" class="reply-preview-avatar" onerror="this.src='/static/graphics/defaultMale.png'">
          <div class="preview-text-stack">
            <span class="preview-user"></span>
            <span class="preview-msg"></span>
          </div>
        </div>
        <div class="reply-preview-close" onclick="cancelReply()">&times;</div>
      </div>
    `).show();
      $bar.find('.reply-preview-avatar').attr('src', avatar);
      $bar.find('.preview-user').text(user);
      $bar.find('.preview-msg').text(text);
    };

    /**
     * cancelReply()
     * Resets the index and hides the bar.
     * Attached to window so the 'onclick' in the HTML string can find it.
     */
    window.cancelReply = function () {
      currentreply_id = -1; // Reset global variable
      $('#reply-preview-bar').hide().empty();
    };

    /**
     * add_reaction(message_bubble, reaction_emoji, user)
     * --------------------------------------------------
     * Adds a reaction to a message bubble with a count and a tooltip 
     * showing who reacted. Creates the reaction UI if it doesn't exist.
     *
     * @param {jQuery|HTMLElement} message_bubble - The message bubble element
     * @param {string} reaction_emoji - The emoji to add
     * @param {string} user - The username of the reactor
     */
    window.add_reaction = function (message_bubble, reaction_emoji, user) {
      const $bubble = $(message_bubble);
      if (!$bubble.length) return;

      // Find or create the reactions container under the bubble
      let $container = $bubble.next('.message__reactions');
      if (!$container.length) {
        $container = $('<div class="message__reactions"></div>');
        $bubble.after($container);
      }

      // Find specific badge for this emoji
      let $badge = $container.find(`.reaction-badge[data-emoji="${reaction_emoji}"]`);

      if ($badge.length) {
        // Add user to existing badge if not already there
        let users = $badge.attr('data-users').split(',').filter(Boolean);
        if (!users.includes(user)) {
          users.push(user);
          $badge.attr('data-users', users.join(','));
          $badge.find('.reaction-count').text(users.length);
          $badge.find('.reaction-tooltip').text(users.join(', '));
        }
      } else {
        // Create new badge
        $badge = $(`
        <div class="reaction-badge" data-emoji="${reaction_emoji}" data-users="${user}">
          <span class="reaction-emoji">${reaction_emoji}</span>
          <span class="reaction-count">1</span>
          <div class="reaction-tooltip">${user}</div>
        </div>
      `);
        $container.append($badge);

        // Add click handler to toggle reaction (simple local-only implementation)
        $badge.on('click', function () {
          const currentUsers = $(this).attr('data-users').split(',').filter(Boolean);
          const messageIndex = $bubble.attr('aria-index');

          if (currentUsers.includes(username)) {
            if (typeof broadcast_removed_reaction === 'function') {
              broadcast_removed_reaction(messageIndex, reaction_emoji);
            }
          } else {
            if (typeof broadcast_added_reaction === 'function') {
              broadcast_added_reaction(messageIndex, reaction_emoji);
            }
          }
        });
      }
    };

    /**
     * remove_reaction(message_bubble, reaction_emoji, user)
     * -----------------------------------------------------
     * Removes a user's reaction from a message bubble. 
     * If the count drops to zero, the badge is removed.
     */
    window.remove_reaction = function (message_bubble, reaction_emoji, user) {
      const $bubble = $(message_bubble);
      const $container = $bubble.next('.message__reactions');
      if (!$container.length) return;

      let $badge = $container.find(`.reaction-badge[data-emoji="${reaction_emoji}"]`);
      if (!$badge.length) return;

      let users = $badge.attr('data-users').split(',').filter(Boolean);
      const userIndex = users.indexOf(user);

      if (userIndex !== -1) {
        users.splice(userIndex, 1);

        if (users.length > 0) {
          $badge.attr('data-users', users.join(','));
          $badge.find('.reaction-count').text(users.length);
          $badge.find('.reaction-tooltip').text(users.join(', '));
        } else {
          // No users left, remove the badge
          $badge.remove();

          // Remove container if empty
          if ($container.children().length === 0) {
            $container.remove();
          }
        }
      }
    };

    /**
     * switchToRoom(roomId, roomName)
     * ------------------------------
     * Helper function to switch to a specific room.
     * Updates the room banner and active state.
     *
     * @param {string} roomId - The room ID
     * @param {string} roomName - The display name of the room
     */
    function switchToRoom(roomId, roomName) {
      // Update room banner
      $(".room-title").text(roomName.toUpperCase());

      // Update sidebar active state
      $(".convo-item").removeClass("active");
      $(".convo-item[data-room='" + roomId + "']").addClass("active");

      // Clear current chat feed
      $messageContainer.empty();
    }

    /**
     * scrollToBottom()
     * ----------------
     * Smoothly scrolls chat feed to show the most recent message.
     */
    function scrollToBottom() {
      // Target the parent 'chat-feed' instead of the message-container
      var feed = document.getElementById('chat-feed');

      if (feed) {
        // Use setTimeout to allow the browser to render the new message first
        setTimeout(function () {
          feed.scrollTo({
            top: feed.scrollHeight,
            behavior: "smooth"
          });
        }, 50);
      }
    };

    /**
     * =========================================================================
     * =========================================================================
     */

    $(document).ready(function () {
      // GIF Modal Logic
      $('#gif-btn').on('click', function () {
        $('#gif-modal').css('display', 'flex').attr('aria-hidden', 'false');
      });

      $('#gif-modal-close').on('click', function () {
        $('#gif-modal').hide().attr('aria-hidden', 'true');
        $('#gif-btn').focus(); // Transfer focus back to the button that opened it
      });

      $('#gif-search-btn-icon').on('click', function () {
        let query = $('#gif-search-input').val().trim();
        if (query) {
          if (typeof window.emitGifSearch === 'function') {
            $('#gif-results-container').html('<p style="grid-column: span 2; text-align: center; color: #777; margin-top: 20px;">Searching...</p>');
            window.emitGifSearch(query);
          }
        }
      });

      $('#gif-search-input').on('keypress', function (e) {
        if (e.key === 'Enter') {
          $('#gif-search-btn-icon').click();
        }
      });

      window.renderGifResults = function (results) {
        const $container = $('#gif-results-container');
        $container.empty();
        if (results.length === 0) {
          $container.html('<p style="grid-column: span 2; text-align: center; color: #777; margin-top: 20px;">No matching GIFs found.</p>');
          return;
        }

        results.forEach(gif => {
          let $img = $('<img>').attr('src', gif.url).css({
            'width': '100%',
            'height': 'auto',
            'border-radius': '8px',
            'cursor': 'pointer',
          }).on('click', function () {
            // Attach the GIF directly to the upload preview
            if (typeof window.attachGif === 'function') {
              window.attachGif(gif.url, gif.giphy_id);
              $('#gif-modal').hide().attr('aria-hidden', 'true');
              $('#gif-btn').focus();
            }
          });
          $container.append($img);
        });
      };

      /**
       * showKeywordModal(giphy_id, gifUrl)
       * Shows a modal asking the admin to enter keywords for a GIF they want to add.
       * Starts with 3 input boxes, can add more. Minimum 3 keywords required.
       */
      window.showKeywordModal = function (giphy_id, gifUrl) {
        // Remove any existing keyword modal
        $('#keyword-modal').remove();

        let keywordCount = 3;

        function buildInputRow(index) {
          return `<div class="keyword-input-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <input type="text" class="keyword-input" placeholder="Keyword ${index}" 
              style="flex:1;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;" />
            ${index > 3 ? '<button class="remove-keyword-btn" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:16px;padding:4px;"><i class="fa-solid fa-xmark"></i></button>' : ''}
          </div>`;
        }

        let modalHtml = `
        <div id="keyword-modal" class="modal-overlay" style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;">
          <div style="background:white;border-radius:12px;width:90%;max-width:440px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 4px 0;font-size:18px;color:#333;">Add Keywords</h3>
            <p style="margin:0 0 16px 0;font-size:13px;color:#777;">Enter at least 3 keywords so users can find this GIF.</p>
            <div style="margin-bottom:12px;">
              <img src="${gifUrl}" style="width:100%;max-height:140px;object-fit:contain;border-radius:8px;" />
            </div>
            <div id="keyword-inputs-container">
              ${buildInputRow(1)}
              ${buildInputRow(2)}
              ${buildInputRow(3)}
            </div>
            <button id="add-more-keywords-btn" style="background:none;border:1px dashed #ccc;color:#666;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:13px;margin-bottom:16px;width:100%;">
              <i class="fa-solid fa-plus" style="margin-right:4px;"></i> Add another keyword
            </button>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
              <button id="keyword-cancel-btn" style="padding:8px 16px;border:1px solid #ddd;border-radius:6px;background:white;cursor:pointer;font-size:14px;">Cancel</button>
              <button id="keyword-submit-btn" style="padding:8px 20px;border:none;border-radius:6px;background:#28a745;color:white;cursor:pointer;font-size:14px;font-weight:600;">Add GIF</button>
            </div>
          </div>
        </div>`;

        $('body').append(modalHtml);

        // Add more keyword inputs
        $('#add-more-keywords-btn').on('click', function () {
          keywordCount++;
          let $row = $(buildInputRow(keywordCount));
          $row.find('.remove-keyword-btn').on('click', function () {
            $row.remove();
          });
          $('#keyword-inputs-container').append($row);
          $row.find('.keyword-input').focus();
        });

        // Cancel
        $('#keyword-cancel-btn').on('click', function () {
          $('#keyword-modal').remove();
        });

        // Submit
        $('#keyword-submit-btn').on('click', function () {
          let keywords = [];
          $('#keyword-inputs-container .keyword-input').each(function () {
            let val = $(this).val().trim();
            if (val) keywords.push(val);
          });

          if (keywords.length < 3) {
            // Highlight empty required fields
            $('#keyword-inputs-container .keyword-input').each(function (i) {
              if (i < 3 && !$(this).val().trim()) {
                $(this).css('border-color', '#e53e3e');
              } else {
                $(this).css('border-color', '#ddd');
              }
            });
            return;
          }

          if (typeof window.addGif === 'function') {
            window.addGif(giphy_id, keywords);
          }
          $('#keyword-modal').remove();
        });

        // Focus first input
        $('#keyword-inputs-container .keyword-input').first().focus();
      };
    });


    // Check if we're on mobile (max-width: 768px)
    function isMobile() {
      return window.innerWidth <= 768;
    }

    /**
     * convertInputToTextarea()
     * ------------------------
     * Converts the chat input from <input> to <textarea> on mobile devices
     * for better typing experience and multi-line support.
     */
    function convertInputToTextarea() {
      if (!isMobile()) return;

      var $input = $("#chat-input");

      if (!$input.length || $input.prop("tagName") === "TEXTAREA") {
        return; // Already converted or not found
      }

      // Get current input attributes
      var currentClass = $input.attr("class");
      var currentId = $input.attr("id");
      var currentPlaceholder = $input.attr("placeholder");
      var currentAriaLabel = $input.attr("aria-label");
      var currentValue = $input.val();

      // Create textarea with same attributes
      var $textarea = $("<textarea>")
        .attr("class", currentClass)
        .attr("id", currentId)
        .attr("placeholder", currentPlaceholder)
        .attr("aria-label", currentAriaLabel)
        .val(currentValue)
        .css({
          resize: "none",
          overflowY: "auto",
          minHeight: "50px",
          maxHeight: "120px",
          lineHeight: "1.4"
        });

      // Replace input with textarea
      $input.replaceWith($textarea);

      // Auto-resize textarea based on content
      $textarea.on("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 120) + "px";
      });
    }

    /**
     * convertTextareaToInput()
     * -----------------------
     * Converts the chat input from <textarea> back to <input> on desktop
     * for consistent desktop experience.
     */
    function convertTextareaToInput() {
      if (isMobile()) return;

      var $textarea = $("#chat-input");

      if (!$textarea.length || $textarea.prop("tagName") === "INPUT") {
        return; // Already converted or not found
      }

      // Get current textarea attributes
      var currentClass = $textarea.attr("class");
      var currentId = $textarea.attr("id");
      var currentPlaceholder = $textarea.attr("placeholder");
      var currentAriaLabel = $textarea.attr("aria-label");
      var currentValue = $textarea.val();

      // Create input with same attributes
      var $input = $("<input>")
        .attr("type", "text")
        .attr("class", currentClass)
        .attr("id", currentId)
        .attr("placeholder", currentPlaceholder)
        .attr("aria-label", currentAriaLabel)
        .val(currentValue);

      // Replace textarea with input
      $textarea.replaceWith($input);
    }

    // Note: convertInputToTextarea() and convertTextareaToInput() are deprecated
    // We now always use textarea with auto-resize on all devices

    /**
     * initAutoResizeTextarea()
     * ------------------------
     * Initializes auto-resize for the chat textarea on all devices.
     * Textarea grows as user types, max 200px height.
     */
    function initAutoResizeTextarea() {
      var $textarea = $("#chat-input");
      if (!$textarea.length) return;

      $textarea.on("input", function () {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 200) + "px";
      });
    }

    // Initialize textarea enhancements when DOM is ready
    $(document).ready(function () {
      // Always use textarea now - init auto-resize
      // Enter key handling is in network/home.js
      initAutoResizeTextarea();

      // Add click handler for new messages button
      $('#new-messages-btn').on('click', function () {
        var feed = document.getElementById('chat-feed');
        var isAtBottom = false;
        if (feed) {
          var scrollPosition = feed.scrollTop + feed.clientHeight;
          var scrollHeight = feed.scrollHeight;
          isAtBottom = scrollHeight - scrollPosition <= 100;
        }

        if (window.attached_to_bottom) {
          // Already attached/near bottom - just scroll to bottom
          scrollToBottom();
        } else {
          // Not attached - fetch fresh messages (avoids underhead fetch issues)
          document.querySelector('#message-container').innerHTML = '';

          fetch_type = ROOM_TYPE === 'dm' ? 'Fetch DM Messages' : 'Fetch Room Messages';
          cl.send(JSON.stringify([fetch_type, {
            'username': username,
            'password': password,
            'room': ROOM,
            'limit': INITIAL_LIMIT,
            'offset': -1
          }]));
          window.attached_to_bottom = true;
        }

        toggle_new_messages_btn(false);
      });

      // =========================================================================
      // SCROLL TO TOP DETECTION FOR LOADING OLDER MESSAGES
      // =========================================================================

      /**
       * Detect when user scrolls to the top of the chat feed
       * and call fetch_overhead_messages() to load older messages
       */
      if ($chatFeed.length) {
        $chatFeed.on("scroll", function () {
          // Check if scrolled to top (with small threshold for tolerance)
          if ($chatFeed.scrollTop() <= 10) {
            // --- GUARD: Don't trigger overhead if already attached to bottom ---
            if (window.attached_to_bottom) {
              return;
            }
            // --- THIS IS THE CRITICAL GUARD ---
            if (FetchingMessages) {
              console.log("Scroll sensor triggered, but blocked by FetchingMessages lock.");
              return;
            }

            // Get the topmost message ID (aria-index of the first message bubble)
            var topmost_id = -1;
            var $firstBubble = $("#message-container").find(".message__bubble").first();
            if ($firstBubble.length) {
              var firstIdx = parseInt($firstBubble.attr("aria-index"));
              if (!isNaN(firstIdx)) {
                topmost_id = firstIdx;
              }
            }

            // If top message is index 1, we've reached the beginning - don't fetch
            if (topmost_id === 1) {
              console.log("Scroll sensor: Reached beginning of chat (index 1).");
              return;
            }

            console.log("Scroll sensor triggered: Loading older messages...");

            // Call the function defined in network/home.js with the topmost message ID
            if (typeof fetch_overhead_messages === "function") {
              if (topmost_id !== -1) {
                fetch_overhead_messages(topmost_id);
                console.log('Called fetch_overhead_messages with ID:', topmost_id);
              }
            }
          }

          // Check if scrolled to bottom
          var scrollHeight = $chatFeed[0].scrollHeight;
          var scrollTop = $chatFeed.scrollTop();
          var clientHeight = $chatFeed[0].clientHeight;
          var isAtBottom = scrollHeight - scrollTop - clientHeight <= 10;

          if (isAtBottom) {
            // Check if we're not attached to bottom (need to fetch newer messages)
            if (!window.attached_to_bottom && !window.reached_real_bottom) {
              // --- CRITICAL GUARD: Prevent multiple underhead fetches ---
              if (FetchingMessages) {
                console.log("Underhead scroll sensor triggered, but blocked by FetchingMessages lock.");
                return;
              }

              // Get the bottommost message ID
              var bottommost_id = -1;
              var $lastBubble = $("#message-container").find(".message__bubble").last();
              if ($lastBubble.length) {
                var lastIdx = parseInt($lastBubble.attr("aria-index"));
                if (!isNaN(lastIdx)) {
                  bottommost_id = lastIdx;
                }
              }

              if (bottommost_id !== -1 && typeof fetch_underhead_messages === "function") {
                fetch_underhead_messages(bottommost_id);
                console.log('Called fetch_underhead_messages with ID:', bottommost_id);
              }
            }

            window.attached_to_bottom = true;
            toggle_new_messages_btn(false);
          } else if (scrollTop < scrollHeight - clientHeight - 100) {
            // User has scrolled up more than 100px from bottom - detach
            window.attached_to_bottom = false;
          }
        });
      }
    });

    // =========================================================================
    // OVERHEAD LOADING SPINNER
    // =========================================================================

    /**
     * toggle_overhead_animation(toggle)
     * ---------------------------------
     * Shows or hides the overhead loading spinner with a fade effect.
     * The spinner HTML is in home.html and CSS is in home.css.
     *
     * @param {boolean} toggle - true to show, false to hide
     */
    window.toggle_overhead_animation = function (toggle) {
      if (toggle === true) {
        overhead_spinner.style.width = '70px'
        overhead_spinner.style.height = '70px'
        overhead_spinner.style.animation = 'spin 1s linear infinite'
        overhead_spinner.style.borderRadius = '50%'
        overhead_spinner.style.border = '5px solid var(--color-medium)'
        overhead_spinner.style.borderTop = '5px solid var(--color-dark)'
        overhead_spinner.style.background = 'var(--color-light)'
        overhead_spinner.style.display = 'block'
        overhead_spinner.style.opacity = '1'
        overhead_spinner.style.top = '90px'
      }
      else {
        setTimeout(function () {
          overhead_spinner.style.width = ''
          overhead_spinner.style.height = ''
          overhead_spinner.style.borderRadius = ''
          overhead_spinner.style.border = ''
          overhead_spinner.style.borderTop = ''
          overhead_spinner.style.opacity = ''
          overhead_spinner.style.animation = ''
          overhead_spinner.style.top = '5px'
        }, OVERHEAD_LOADER_DELAY)
      }
    };

    /**
     * toggle_new_messages_btn(toggle)
     * ---------------------------------
     * Shows or hides the new messages floating button.
     * Tracks count of new messages for display.
     *
     * @param {boolean} toggle - true to show, false to hide
     */
    var newMessageCount = 0;

    window.toggle_new_messages_btn = function (toggle) {
      var btn = document.getElementById('new-messages-btn');
      if (!btn) return;

      if (toggle === true) {
        // Don't show the button if the user is in edit mode (room members panel open)
        var detailsView = document.getElementById('room-details-view');
        if (detailsView && detailsView.style.display !== 'none') return;
        // Only increment if button is not already visible (prevents batch increments)
        if (btn.style.display === 'none' || btn.style.display === '') {
          newMessageCount = 1;
        } else {
          newMessageCount++;
        }
        var textSpan = btn.querySelector('span');
        if (textSpan) {
          var messageText = newMessageCount === 1 ? 'New Message' : 'New Messages';
          textSpan.textContent = newMessageCount + ' ' + messageText;
        }
        btn.style.display = 'flex'
        btn_queue.push(btn)
        setTimeout(function () {
          btn = btn_queue.splice(0, 1)[0]
          btn.style.opacity = '1';
          btn.style.bottom = '105px';
        }, 200)
      } else {
        newMessageCount = 0;
        btn.style.opacity = '0';
        btn.style.bottom = '20px';
        btn_queue.push(btn)
        setTimeout(function () {
          btn = btn_queue.splice(0, 1)[0]
          btn.style.display = 'none'
        }, 200)
      }
    };
    setTimeout(function () {
      toggle_new_messages_btn(false)
    }, 800)

    /**
     * =========================================================================
     * CREATE ROOM MODAL FUNCTIONALITY
     * roomModal() and related functions for the Create Room modal
     * =========================================================================
     */

    /**
     * State toggle to track if an emoji has been explicitly selected for the new room
     */
    window.isRoomEmojiSelected = false;

    /**
     * roomModal(action)
     * ---------------
     * Controls the visibility of the Create Room modal.
     * 
     * @param {string} action - 'show' to display the modal, 'hide' to hide it
     */
    window.roomModal = function (action) {
      var $modal = $("#create-room-modal");

      if (action === 'show') {
        $modal.css('display', 'flex').attr('aria-hidden', 'false');
        // Reset state and toggle
        window.isRoomEmojiSelected = false;
        resetRoomModal();
        // Attach emoji picker to the modal selector
        if (typeof window.emojiPicker !== 'undefined' && window.emojiPicker.re_attach) {
          // Clear invalid styles as soon as they click to pick an emoji
          $("#selected-emoji").off('click.validation').on('click.validation', function () {
            $(this).removeClass('invalid');
            $("#room-emoji-selector").removeClass('invalid');
          });

          window.emojiPicker.re_attach('#selected-emoji', function (emoji) {
            $("#selected-emoji").html(emoji).removeClass('invalid');
            $("#room-emoji-selector").removeClass('invalid');
            $("#room-emoji").val(emoji);
            window.isRoomEmojiSelected = true;
          });
        }
      } else if (action === 'hide') {
        $modal.css('display', 'none').attr('aria-hidden', 'true');
        window.isRoomEmojiSelected = false;
        // Reattach emoji picker back to chat input
        if (typeof window.emojiPicker !== 'undefined' && window.emojiPicker.re_attach) {
          window.emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji });
        }
      }
    };

    /**
     * resetRoomModal()
     * ---------------
     * Resets the modal form to default state.
     */
    function resetRoomModal() {
      $("#room-name").val('');
      $("#room-description").val('');
      $("#selected-emoji").html('<i class="fa-solid fa-xmark"></i>').removeClass('invalid');
      $("#room-emoji-selector").removeClass('invalid');
      $("#room-emoji").val('');
      window.isRoomEmojiSelected = false;
      $("#open-room").prop('checked', true);
      $("#invite-room").prop('checked', false);
      $("#send-invitations-btn").prop('disabled', true);
      $("#invitations-dropdown").hide();
      window.selectedInvitees = [];
    }

    /**
     * submitRoomCreation()
     * ------------------
     * Handles form submission for creating a new room.
     */
    function submitRoomCreation(e) {
      if (e) e.preventDefault();

      var roomName = $("#room-name").val().trim();
      var roomDescription = $("#room-description").val().trim();
      var roomEmojiText = $("#selected-emoji").text().trim();
      var roomEmoji = (roomEmojiText && roomEmojiText.indexOf('xmark') === -1 && roomEmojiText !== '❌') ? roomEmojiText : '💬';
      var roomStatus = $("input[name='roomtype']:checked").val() || 'public';

      if (!roomName || !roomDescription) {
        alert("Please enter both a room name and description.");
        return;
      }

      var roomData = {
        name: roomName,
        description: roomDescription,
        emoji: roomEmoji,
        type: roomStatus
      };

      console.log("Creating room:", roomData);

      // Delegate the socket call to the network layer
      if (typeof window.emitCreateRoom === 'function') {
        window.emitCreateRoom(roomData.name, roomData.description, roomData.emoji, roomData.type);
      } else {
        console.error("emitCreateRoom not found in network layer.");
      }

      roomModal('hide');
    }

    /**
     * =========================================================================
     * GOOGLE CHAT STYLE EMOJI TYPEAHEAD
     * =========================================================================
     */
    function initEmojiTypeahead() {
      var emojiSearchState = {
        active: false,
        keyword: "",
        selectedIndex: -1,
        results: []
      };

      var $container = $("#emoji-typeahead-container");
      console.log("[EMOJI] initEmojiTypeahead() called. Container found:", $container.length, $container[0]);

      // ── Fetch emoji data independently ────────────────────────────────────
      var typeaheadEmojiData = null;
      fetch("/static/emoji.json")
        .then(function(r) { return r.json(); })
        .then(function(data) {
          typeaheadEmojiData = data;
          console.log("[EMOJI] emoji.json loaded independently. Categories:", Object.keys(data).length);
        })
        .catch(function(err) {
          console.error("[EMOJI] Failed to fetch emoji.json:", err);
        });

      function searchEmoji(keyword) {
        if (!typeaheadEmojiData) return [];
        keyword = keyword ? keyword.toLowerCase() : "";
        var results = [];
        for (var category in typeaheadEmojiData) {
          if (!typeaheadEmojiData.hasOwnProperty(category)) continue;
          var items = typeaheadEmojiData[category];
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var matched = !keyword
              || item.description.toLowerCase().includes(keyword)
              || (item.keywords && item.keywords.some(function(k) { return k.toLowerCase().includes(keyword); }));
            if (matched) {
              results.push(item);
              if (results.length >= 20) return results;
            }
          }
        }
        return results;
      }

      function showTypeahead() {
        console.log("[EMOJI] showTypeahead() — setting display:flex on", $container[0]);
        $container[0].style.display = "flex";
        $container[0].style.flexDirection = "column";
        console.log("[EMOJI] After showTypeahead, computed display:", window.getComputedStyle($container[0]).display);
      }

      function hideTypeahead() {
        console.log("[EMOJI] hideTypeahead() called");
        emojiSearchState.active = false;
        window.emojiTypeaheadActive = false;
        emojiSearchState.results = [];
        emojiSearchState.selectedIndex = -1;
        $container[0].style.display = "none";
        $container.empty();
      }

      function renderTypeahead($input) {
        console.log("[EMOJI] renderTypeahead() called. Container length:", $container.length, "Results:", emojiSearchState.results.length);
        if (!$container.length) {
          console.warn("[EMOJI] renderTypeahead: container not found in DOM!");
          return;
        }

        $container.empty();

        if (emojiSearchState.results.length === 0) {
          console.log("[EMOJI] renderTypeahead: no results, hiding silently");
          $container[0].style.display = "none";
          return;
        }

        emojiSearchState.results.forEach(function(item, index) {
          var $item = $("<div>").addClass("emoji-typeahead-item");
          if (index === emojiSearchState.selectedIndex) {
            $item.addClass("selected");
          }

          var $emoji = $("<span>").addClass("emoji").text(item.emoji);
          var $name  = $("<span>").addClass("emoji-name").text(item.description.toLowerCase());

          $item.append($emoji).append($name);

          $item.on("mousedown", function(e) {
            e.preventDefault();
            console.log("[EMOJI] Item mousedown — inserting:", item.emoji);
            insertEmoji($input, item.emoji);
          });

          $container.append($item);
        });

        showTypeahead();

        if (emojiSearchState.selectedIndex >= 0) {
          var selectedEl = $container.children().eq(emojiSearchState.selectedIndex)[0];
          if (selectedEl) selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }

      function insertEmoji($input, emoji) {
        console.log("[EMOJI] insertEmoji() called with:", emoji);
        var val        = $input.val();
        var cursor     = $input[0].selectionStart;
        var textBefore = val.substring(0, cursor);
        var textAfter  = val.substring(cursor);

        var lastColonIdx = textBefore.lastIndexOf(":");
        if (lastColonIdx !== -1) {
          textBefore = textBefore.substring(0, lastColonIdx) + emoji + " ";
        }

        $input.val(textBefore + textAfter);
        $input[0].setSelectionRange(textBefore.length, textBefore.length);
        $input.focus();
        hideTypeahead();
      }

      // ── INPUT ──────────────────────────────────────────────────────────────
      $(document).on("input", "#chat-input", function() {
        var $input     = $(this);
        var val        = $input.val();
        var cursor     = $input[0].selectionStart;
        var textBefore = val.substring(0, cursor);

        var match = textBefore.match(/(?:^|\s):([^\s]*)$/);
        console.log("[EMOJI] input event. textBefore:", JSON.stringify(textBefore), "match:", match);

        if (match) {
          var keyword = match[1];
          console.log("[EMOJI] Regex matched! Keyword:", JSON.stringify(keyword));
          emojiSearchState.active        = true;
          window.emojiTypeaheadActive    = true;
          emojiSearchState.keyword       = keyword;
          emojiSearchState.selectedIndex = -1;

          emojiSearchState.results = searchEmoji(keyword);
          console.log("[EMOJI] searchEmoji returned", emojiSearchState.results.length, "results. typeaheadEmojiData loaded:", typeaheadEmojiData !== null);
          renderTypeahead($input);
        }
      });

      // ── KEYDOWN ────────────────────────────────────────────────────────────
      $(document).on("keydown", "#chat-input", function(e) {
        if (!emojiSearchState.active || emojiSearchState.results.length === 0) return;
        var $input = $(this);

        if (e.key === "ArrowDown") {
          e.preventDefault();
          emojiSearchState.selectedIndex = (emojiSearchState.selectedIndex + 1) % emojiSearchState.results.length;
          renderTypeahead($input);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          emojiSearchState.selectedIndex = (emojiSearchState.selectedIndex - 1 + emojiSearchState.results.length) % emojiSearchState.results.length;
          renderTypeahead($input);
        } else if (e.key === "Enter" && emojiSearchState.selectedIndex >= 0) {
          e.preventDefault();
          insertEmoji($input, emojiSearchState.results[emojiSearchState.selectedIndex].emoji);
        }
      });

      // ── CLICK OUTSIDE ──────────────────────────────────────────────────────
      $(document).on("mousedown", function(e) {
        if (!emojiSearchState.active) return;
        if (!$(e.target).closest("#emoji-typeahead-container, #chat-input").length) {
          console.log("[EMOJI] Clicked outside — hiding");
          hideTypeahead();
        }
      });
    }


    // Document ready handlers for modal
    $(document).ready(function () {
      initEmojiTypeahead();
      
      // Connect Create button from sidebar - Handled in network/home.js to support DM selection


      // Close modal when clicking the X button
      $("#modal-close-x").on("click", function (e) {
        e.preventDefault();
        roomModal('hide');
      });

      // Close modal when clicking outside the container
      $("#create-room-modal").on("click", function (e) {
        if ($(e.target).is("#create-room-modal")) {
          roomModal('hide');
        }
      });

      // Handle Submit button or Enter form submission
      $("#create-room-form").on("submit", submitRoomCreation);
    });

    window.updateInputBarStateForFreeze = function (roomName) {
      let $frozenMsg = $('#frozen-message-banner');
      if ($frozenMsg.length === 0) {
        $frozenMsg = $('<div id="frozen-message-banner" style="display: none; width: 100%; text-align: center; color: #ff3333; font-weight: 700; font-size: 1.1rem; padding: 16px; font-family: var(--font-body), sans-serif; border: 2px solid rgba(255, 51, 51, 0.3); background: rgba(255, 51, 51, 0.08); border-radius: 8px; text-transform: uppercase;">YOUR ACCOUNT IS FROZEN, MESSAGE ADMIN TO GET IT FIXED</div>');
        $('#chat-panel-inputbar').prepend($frozenMsg);
      }

      if (window.IS_FROZEN) {
        let isDmWithAdmin = false;
        let currentUsername = typeof username !== 'undefined' ? username : (localStorage.getItem('username') || '');
        if (roomName && roomName.includes('.$@-@&.')) {
          let parts = roomName.split('.$@-@&.');
          let otherUser = parts[0] === currentUsername ? parts[1] : parts[0];
          if (otherUser && otherUser.toLowerCase() === 'admin') {
            isDmWithAdmin = true;
          }
        }

        if (isDmWithAdmin) {
          $frozenMsg.hide();
          $('#chat-input-box').show();
          $('#send-btn').show();
          $('#gif-btn').hide(); // Disable GIF sending
        } else {
          $('#chat-input-box').hide();
          $('#send-btn').hide();
          $frozenMsg.show();
        }
      } else {
        $frozenMsg.hide();
        $('#chat-input-box').show();
        $('#send-btn').show();
        $('#gif-btn').show();
      }
    };

  })(); // End IIFE
