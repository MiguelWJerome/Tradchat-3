/**
 * =============================================================================
 * /static/javascript/looks/home.js
 * TradChat — Home Page  |  UI / LOOKS layer
 * =============================================================================
 *
 * PURPOSE
 * -------
 * This file contains two essential functions for the TradChat interface:
 * 1. createChatRoomOption - Creates and adds a chat room option to the sidebar
 * 2. appendMessage - Appends a message to the chat feed
 *
 * DEPENDENCIES
 * ------------
 * - jQuery ($ helper)
 * =============================================================================
 */

;(function () {
  "use strict";

  // DOM element cache
  var $sidebarList, $chatFeed;

  // Initialize DOM references
  $(document).ready(function () {
    $sidebarList = $("#sidebar-list");
    $chatFeed = $("#chat-feed");
  });

  /**
   * createChatRoomOption(name, emoji, description)
   * --------------------------------------------
   * Creates a chat room option in the sidebar with the provided parameters.
   * Uses emoji as the avatar display and shows description as preview.
   *
   * @param {string} name - The name of the chat room
   * @param {string} emoji - The emoji to use as profile picture/avatar
   * @param {string} description - Description/preview text for the room
   */
  window.createChatRoomOption = function (name, emoji, description) {
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

    // Create avatar with emoji
    var $avatar = $("<div>")
      .addClass("convo-item__avatar")
      .text(emoji || "📊");  // Default emoji if none provided

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

    // Create list item with room ID (lowercase, no spaces)
    var roomId = name.toLowerCase().replace(/\s+/g, '-');
    var $item = $("<li>")
      .addClass("convo-item")
      .attr("data-room", roomId)
      .append($avatar, $info);

    // Add click handler to switch to this room
    $item.on("click", function () {
      switchToRoom(roomId, name);
    });

    // Append to sidebar list
    $sidebarList.append($item);

    console.log("[home.js] Created chat room:", name, "with emoji:", emoji);
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
  window.appendMessage = function (username, timestamp, message, id, myself) {
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
    
    console.log("[home.js] Switched to room:", roomId, roomName);
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

    console.log("[home.js] Converted input to textarea for mobile");
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

    console.log("[home.js] Converted textarea back to input for desktop");
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
