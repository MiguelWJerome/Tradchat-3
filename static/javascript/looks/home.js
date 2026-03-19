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

// Initialize sidebar tray functionality when document is ready
$(document).ready(function() {
    // 1. Set 'Public Rooms' as active by default on load
    $('.tray-item:eq(1)').addClass('active');

    // 2. Handle Tray Item Clicks
    $('.tray-item').on('click', function() {
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

;(function () {
  "use strict";

  // DOM element cache
  var $sidebarList, $chatFeed;

  // Initialize DOM references
  $(document).ready(function () {
    $sidebarList = $("#sidebar-list");
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
  window.createChatRoomOption = function (id, name, description, action=null, picture=null, unread=false, emoji=null, active=false) {
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
        .on("error", function() {
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
  window.change_banner_picture = function (emoji, picture=false) {
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
        .on("error", function() {
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

  /**
   * appendMessage(username, timestamp, message, myself)
   * -----------------------------------------
   * Appends a message to the chat feed with the provided parameters.
   * Creates proper message structure with avatar, name, and bubble.
   *
   * @param {string} username - The username of the message sender
   * @param {string} timestamp - The timestamp for the message
   * @param {string} message - The message content
   * @param {boolean} myself - Set to true if this is your own message (appears on right)
   */
  window.appendMessage = function (id, username, message, timestamp, myself) {
    if (!$chatFeed.length) return;

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

    // --- 2. Big Centered Date Stamp ---
    var $lastMsg = $chatFeed.find(".message").last();
    var lastDateAttr = $lastMsg.attr("data-date"); 

    if (lastDateAttr !== fullDateStr) {
        $chatFeed.append($("<div>")
            .addClass("chat-date-separator")
            .css({ "text-align": "center", "margin": "30px 0 15px", "font-size": "0.85rem", "color": "#888", "font-weight": "bold" })
            .text(fullDateStr));
    }

    // --- 3. Construction ---
    var displayUser = myself ? "You" : username;
    var lastUser = $lastMsg.attr("data-user");
    var isSameUser = (lastUser === displayUser) && (lastDateAttr === fullDateStr);

    if (isSameUser) {
        // Grouped bubble
        var $newBubble = $("<div>").addClass("message__bubble");
        var $newText = $("<div>").addClass("message__text").text(message);
        // Small side stamp
        var $sideTime = $("<span>").css({ "font-size": "0.7rem", "color": "#999", "margin-left": "8px" }).text(timeStr);
        
        $newBubble.append($newText, $sideTime);
        $lastMsg.find(".message__content").append($newBubble);
    } else {
        // New Message Group
        var $msg = $("<div>").addClass("message").attr("data-user", displayUser).attr("data-date", fullDateStr);
        $msg.attr("id", id);
        if (myself) $msg.addClass("own");

        var $avatar = $("<img>").addClass("message__avatar").attr("src", "/static/profile-pictures/" + username + ".png")
            .css({ "border": "2px solid black" })  // Always black outline
            .on("error", function() { $(this).attr("src", "/static/graphics/defaultMale.png"); });

        var $content = $("<div>").addClass("message__content");

        // UI FIX: Separate the Name Box from the Timestamp
        var $nameWrapper = $("<div>").css({ "display": "flex", "align-items": "center", "margin-bottom": "4px" });
        
        var $nameBox = $("<span>")
            .addClass("message__name")
            .css({ "padding": "2px 8px", "border-radius": "4px", "font-weight": "bold", "font-size": "1.2rem" }) // Bigger and bold
            .text(displayUser);

        var $timestampLabel = $("<span>")
            .css({ "margin-left": "8px", "font-size": "0.8rem", "color": "#777" })
            .text(" " + headerStamp); // No dot before date

        $nameWrapper.append($nameBox, $timestampLabel);

        var $bubble = $("<div>").addClass("message__bubble");
        var $text = $("<div>").addClass("message__text").css({ "color": "black" }).text(message); // Always black text

        // Style bubble background based on sender
        if (!myself) {
            $bubble.css({ "background": "white", "border": "1px solid black" }); // White background for others
        }
        
        $bubble.append($text);
        $content.append($nameWrapper, $bubble);
        $msg.append($avatar, $content);
        $chatFeed.append($msg);
    }

    scrollToBottom();
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
    $chatFeed.empty();
  }

  /**
   * scrollToBottom()
   * ----------------
   * Smoothly scrolls chat feed to show the most recent message.
   */
  function scrollToBottom() {
    if ($chatFeed.length) {
      var feed = $chatFeed[0];
      feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    }
  }

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
    $textarea.on("input", function() {
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
    $(document).on("keydown", "#chat-input", function(e) {
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
    $(window).on("resize", function() {
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
  });

})(); // End IIFE
