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
    var selectedView = $(this).find('.tray-item__label').text().replace(/\s+/g, '').toLowerCase();

    /* Placeholder for toggling content:
       Here you can add logic to filter your #sidebar-list 
       or fetch different data based on 'selectedView' 
    */
    if (selectedView === 'messenger') {
      // Show DMs
    } else if (selectedView === 'publicrooms') {
      // Show Public Rooms
    } else if (selectedView === 'privaterooms') {
      // Show Private Rooms
    }
  });
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
      if (unread) {
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
        $(".convo-item[data-room='" + selectedRoomId + "']").removeClass("active");
      }

      // Update the selected room ID
      selectedRoomId = roomId;

      // Select the new room if roomId is provided
      if (roomId) {
        $(".convo-item[data-room='" + roomId + "']").addClass("active");
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

      // Header Display: "Mon 10:30 PM" (No year here per your request)
      var headerStamp = dayShort + " " + timeStr;

      // --- 2. Big Centered Date Stamp and User Grouping Logic ---
      var isSameUser, $targetMsgGroup;
      var currentTimestamp = msgDate.getTime();
      var fiveMinutesMs = 5 * 60 * 1000; // 5 minutes in milliseconds

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

          // Grouping logic: Same user, same date, and the existing message is NEWER (timeDiff >= 0)
          isSameUser = (firstUser === (myself ? "You" : username)) &&
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
        isSameUser = (lastUser === (myself ? "You" : username)) && (lastDateAttr === fullDateStr) && (timeDiffMs < fiveMinutesMs);
        $targetMsgGroup = $lastMsg;
      }

      if (isSameUser && $targetMsgGroup.length) {
        // Grouped bubble - add to existing message group

        // Grouped bubble with message actions and data stamps
        var $newBubble = $("<div>").addClass("message__bubble").attr("aria-index", currentIdx)
          .attr("aria-username", username)
          .attr("data-message-text", message)

        // Add message actions hover menu
        var $actions = $("<div>").addClass("message-actions");
        $actions.html(
          '<div class="action-item reaction-btn" title="React">😊</div>' +
          '<div class="action-divider"></div>' +
          '<div class="action-item delete-btn" title="Delete">🗑️</div>' +
          '<div class="action-divider"></div>' +
          '<div class="action-item reply-btn" title="Reply">↩️</div>'
        );
        $newBubble.append($actions);

        var $newText = $("<div>").addClass("message__text").text(message);

        // If this is a reply, add reply indicator before the text
        if (replyIndex !== -1) {
          var $replyIndicator = createReplyIndicator(replyIndex, currentIdx);
          $newText.prepend($replyIndicator);
        }

        $newBubble.append($newText);

        if (overhead) {
          // Prepend bubble to the existing group's content (before the first bubble)
          $targetMsgGroup.find(".message__content .message__bubble").first().before($newBubble);
        } else {
          $targetMsgGroup.find(".message__content").append($newBubble);
        }

        // Add reply button click handler
        $newBubble.find('.reply-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          showReplyPreview(index);
        });

        // Add reaction button click handler
        $newBubble.find('.reaction-btn').on('click', function(e) {
          e.stopPropagation();
          const target = this;
          const index = $(this).closest('.message__bubble').attr('aria-index');
          if (typeof emojiPicker !== 'undefined' && emojiPicker.re_attach) {
            const selector = `.message__bubble[aria-index="${index}"] .reaction-btn`;
            emojiPicker.re_attach(selector, function(selectedEmoji) {
              if (typeof broadcast_added_reaction === 'function') {
                broadcast_added_reaction(index, selectedEmoji);
              }
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker) {
                picker.showing = false;
                picker.style.opacity = '0';
                setTimeout(function(){
                  picker.style.top = '-9999px';
                  picker.style.opacity = '1';
                  picker.style.transform = 'scale(0.85)';
                }, 100);
              }
              emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
            });
            emojiPicker.show_picker(target);
            
            const restorePicker = function(evt) {
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
        if (myself) {
          $timestampLabel.css({ "margin-left": "0", "margin-right": "8px" });
          $nameWrapper.append($timestampLabel, $nameBox);
        } else {
          $nameWrapper.append($nameBox, $timestampLabel);
        }

        var $bubble = $("<div>").addClass("message__bubble").attr("aria-index", currentIdx)
          .attr("aria-username", username)
          .attr("data-message-text", message)

        // Add message actions hover menu
        var $actions = $("<div>").addClass("message-actions");
        $actions.html(
          '<div class="action-item reaction-btn" title="React">😊</div>' +
          '<div class="action-divider"></div>' +
          '<div class="action-item delete-btn" title="Delete">🗑️</div>' +
          '<div class="action-divider"></div>' +
          '<div class="action-item reply-btn" title="Reply">↩️</div>'
        );
        $bubble.append($actions);

        // If this is a reply, add reply indicator
        if (replyIndex !== -1) {
          var $replyIndicator = createReplyIndicator(replyIndex, currentIdx);
          $bubble.append($replyIndicator);
        }

        var $text = $("<div>").addClass("message__text").css({ "color": "black" }).text(message); // Always black text

        // Style bubble background based on sender
        if (!myself) {
          $bubble.css({ "background": "white", "border": "1px solid black" }); // White background for others
        }

        $bubble.append($text);
        $content.append($nameWrapper, $bubble);
        $msg.append($avatar, $content);

        if (overhead) {
          $messageContainer.prepend($msg);
        } else {
          $messageContainer.append($msg);
        }

        // Add reply button click handler
        $bubble.find('.reply-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          showReplyPreview(index);
        });

        // Add delete button click handler
        $bubble.find('.delete-btn').on('click', function (e) {
          e.stopPropagation();
          const index = $(this).closest('.message__bubble').attr('aria-index');
          if (confirm("Delete this message?")) {
            broadcast_delete_message(index);
          }
        });

        // Add reaction button click handler
        $bubble.find('.reaction-btn').on('click', function(e) {
          e.stopPropagation();
          const target = this;
          const index = $(this).closest('.message__bubble').attr('aria-index');
          if (typeof emojiPicker !== 'undefined' && emojiPicker.re_attach) {
            const selector = `.message__bubble[aria-index="${index}"] .reaction-btn`;
            emojiPicker.re_attach(selector, function(selectedEmoji) {
              if (typeof broadcast_added_reaction === 'function') {
                broadcast_added_reaction(index, selectedEmoji);
              }
              let picker = document.querySelector("#lc-emoji-picker");
              if (picker) {
                picker.showing = false;
                picker.style.opacity = '0';
                setTimeout(function(){
                  picker.style.top = '-9999px';
                  picker.style.opacity = '1';
                  picker.style.transform = 'scale(0.85)';
                }, 100);
              }
              emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji; });
            });
            emojiPicker.show_picker(target);
            
            const restorePicker = function(evt) {
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
      }

      if (!data['overhead'] && !data['underhead']) {
        // For realtime messages when attached to bottom, just scroll (counter handled elsewhere)
        if (data['realtime'] && attached_to_bottom) {
          if (scrollData['scrollToBottom']) {
            scrollToBottom();
          }
          return;
        }

        // Check if user is at the bottom (within 100px tolerance)
        var feed = document.getElementById('chat-feed');
        var isAtBottom = false;
        if (feed) {
          var scrollPosition = feed.scrollTop + feed.clientHeight;
          var scrollHeight = feed.scrollHeight;
          isAtBottom = scrollHeight - scrollPosition <= 100;
        }

        // Always scroll to bottom for user's own messages, or if already at bottom
        if (isAtBottom || data['myself']) {
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

      // Create the reply container
      const $container = $(`
        <div class="reply-container">
            <div class="reply-curve"></div>
            <div class="reply-content">
                <img src="${avatarSrc}" class="reply-avatar">
                <div class="reply-text-stack">
                    <span class="reply-username">${originalUser}</span>
                    <span class="reply-preview-text">${originalText}</span>
                </div>
            </div>
        </div>
    `);

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

      // Injecting the Goal-style HTML with the X button
      $bar.html(`
      <div class="reply-preview-container">
        <div class="reply-preview-hook"></div>
        <div class="reply-preview-content">
          <img src="${avatar}" class="reply-preview-avatar" onerror="this.src='/static/graphics/defaultMale.png'">
          <div class="preview-text-stack">
            <span class="preview-user">${user}</span>
            <span class="preview-msg">${text}</span>
          </div>
        </div>
        <div class="reply-preview-close" onclick="cancelReply()">&times;</div>
      </div>
    `).show();
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
     * MOBILE ENHANCEMENTS
     * Mobile-specific functionality for better mobile experience
     * =========================================================================
     */

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

    /**
     * handleMobileSubmit()
     * --------------------
     * Handles form submission on mobile to ensure textarea works properly
     */
    function handleMobileSubmit() {
      $(document).on("keydown", "#chat-input", function (e) {
        // Send message on Enter (without Shift) on mobile
        if (e.key === "Enter" && !e.shiftKey && isMobile()) {
          e.preventDefault();

          // Trigger send button click or existing send logic
          $("#send-btn").click();
        }
      });
    }

    // Initialize mobile enhancements when DOM is ready
    $(document).ready(function () {
      if (isMobile()) {
        convertInputToTextarea();
        handleMobileSubmit();
      }

      // Handle window resize (e.g., device rotation or browser resize)
      $(window).on("resize", function () {
        var $chatInput = $("#chat-input");

        if (isMobile()) {
          // Convert to textarea if currently input and on mobile
          if ($chatInput.length && $chatInput.prop("tagName") === "INPUT") {
            convertInputToTextarea();
          }
        } else {
          // Convert back to input if currently textarea and on desktop
          if ($chatInput.length && $chatInput.prop("tagName") === "TEXTAREA") {
            convertTextareaToInput();
          }
        }
      });

      // Add click handler for new messages button
      $('#new-messages-btn').on('click', function () {
        var feed = document.getElementById('chat-feed');
        var isAtBottom = false;
        if (feed) {
          var scrollPosition = feed.scrollTop + feed.clientHeight;
          var scrollHeight = feed.scrollHeight;
          isAtBottom = scrollHeight - scrollPosition <= 100;
        }

        if (attached_to_bottom || isAtBottom) {
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
          attached_to_bottom = true;
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

          // Update attached_to_bottom based on actual scroll position
          if (isAtBottom) {
            attached_to_bottom = true;
          } else if (scrollTop < scrollHeight - clientHeight - 100) {
            // User has scrolled up more than 100px from bottom - detach
            attached_to_bottom = false;
          }

          if (isAtBottom) {
            // Check if we're not attached to bottom (need to fetch newer messages)
            if (!attached_to_bottom) {
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
        // Reset form when showing
        resetRoomModal();
      } else if (action === 'hide') {
        $modal.css('display', 'none').attr('aria-hidden', 'true');
        // Reattach emoji picker back to chat input
        if (typeof emojiPicker !== 'undefined' && emojiPicker.re_attach) {
          emojiPicker.re_attach('#emoji-btn', function (emoji) { document.querySelector('#chat-input').value += emoji });
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
      $("#selected-emoji").html('<i class="fa-solid fa-xmark"></i>');
      $("#open-room").prop('checked', true);
      $("#invite-room").prop('checked', false);
      $("#send-invitations-btn").prop('disabled', true);
      $("#invitations-dropdown").hide();
      selectedInvitees = [];
    }

    // Track selected invitees
    var selectedInvitees = [];

    /**
     * loadInviteList()
     * ---------------
     * Loads the list of users available to invite.
     * Populates the invitations dropdown.
     */
    function loadInviteList() {
      var $inviteList = $("#invite-list");
      $inviteList.empty();

      // Sample users - replace with actual user list from your backend
      var users = [
        { id: 1, name: "Alice Johnson" },
        { id: 2, name: "Bob Smith" },
        { id: 3, name: "Charlie Brown" },
        { id: 4, name: "Diana Prince" },
        { id: 5, name: "Eve Davis" }
      ];

      users.forEach(function (user) {
        var $item = $("<li>").addClass("invite-list-item");
        var $checkbox = $("<input>")
          .attr("type", "checkbox")
          .attr("id", "invite-" + user.id)
          .attr("value", user.id)
          .on("change", function () {
            if ($(this).is(":checked")) {
              selectedInvitees.push(user.id);
            } else {
              selectedInvitees = selectedInvitees.filter(function (id) {
                return id !== user.id;
              });
            }
          });

        var $label = $("<label>")
          .attr("for", "invite-" + user.id)
          .text(user.name);

        $item.append($checkbox, $label);
        $inviteList.append($item);
      });
    }

    /**
     * submitRoomCreation()
     * ------------------
     * Handles form submission for creating a new room.
     */
    function submitRoomCreation() {
      var roomName = $("#room-name").val().trim();
      var roomDescription = $("#room-description").val().trim();
      var roomEmoji = $("#selected-emoji").text().trim() || $("#selected-emoji i").length ? '❌' : $("#selected-emoji").text();
      var roomStatus = $("input[name='room-status']:checked").val();

      if (!roomName) {
        console.log("Please enter a room name.");
        return;
      }

      var roomData = {
        name: roomName,
        description: roomDescription,
        emoji: roomEmoji === '❌' ? '📢' : roomEmoji, // Default emoji if X
        status: roomStatus,
        invitees: roomStatus === 'invite' ? selectedInvitees : []
      };

      console.log("Creating room:", roomData);

      // TODO: Send to backend
      // $.ajax({
      //   url: '/api/create-room',
      //   method: 'POST',
      //   data: JSON.stringify(roomData),
      //   contentType: 'application/json',
      //   success: function(response) {
      //     console.log("Room created:", response);
      //     roomModal('hide');
      //   },
      //   error: function(xhr, status, error) {
      //     console.error("Error creating room:", error);
      //     console.log("Failed to create room. Please try again.");
      //   }
      // });

      // For now, just close the modal
      roomModal('hide');
    }

    // Document ready handlers for modal
    $(document).ready(function () {
      // Close modal when clicking the X button
      $("#modal-close-x").on("click", function () {
        roomModal('hide');
      });

      // Close modal when clicking outside the container
      $("#create-room-modal").on("click", function (e) {
        if ($(e.target).is("#create-room-modal")) {
          roomModal('hide');
        }
      });

      // Handle room status radio button changes
      $("input[name='room-status']").on("change", function () {
        var isInviteRoom = $("#invite-room").is(":checked");
        var $sendBtn = $("#send-invitations-btn");

        if (isInviteRoom) {
          $sendBtn.prop('disabled', false);
        } else {
          $sendBtn.prop('disabled', true);
          $("#invitations-dropdown").hide();
        }
      });

      // Handle Send Invitations button click
      $("#send-invitations-btn").on("click", function () {
        if ($(this).prop('disabled')) return;

        var $dropdown = $("#invitations-dropdown");

        if ($dropdown.is(":visible")) {
          $dropdown.hide();
        } else {
          loadInviteList();
          $dropdown.show();
        }
      });

      // Handle Submit button
      $("#create-room-submit").on("click", function () {
        submitRoomCreation();
      });
    });

  })(); // End IIFE
