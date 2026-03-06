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
  window.appendMessage = function (username, timestamp, message, myself) {
    if (!$chatFeed.length) {
      console.error("[home.js] Chat feed not found. Make sure DOM is ready.");
      return;
    }

    /*
      Message HTML structure:
      <div class="message [own]">
        <div class="message__avatar">UN</div>
        <div class="message__content">
          <div class="message__name">Username · 09:04</div>
          <div class="message__bubble">
            <div class="message__text">Message content</div>
          </div>
        </div>
      </div>
    */

    // Generate unique ID for this message
    var messageId = "msg-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);

    // Create message container
    var $msg = $("<div>")
      .addClass("message")
      .attr("data-id", messageId);

    // Determine if this is the user's own message
    if (myself === true) {
      $msg.addClass("own");
      username = "You";  // Normalize display name
    }

    // Create avatar with initials (first 2 letters of username)
    var initials = username.slice(0, 2).toUpperCase();
    var $avatar = $("<div>")
      .addClass("message__avatar")
      .text(initials);

    // Create content wrapper
    var $content = $("<div>").addClass("message__content");

    // Create name + timestamp header
    var $name = $("<div>")
      .addClass("message__name")
      .text(username + " · " + (timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));

    // Create message bubble
    var $bubble = $("<div>").addClass("message__bubble");

    // Create message text (using .text() for XSS protection)
    var $text = $("<div>")
      .addClass("message__text")
      .text(message);

    // Assemble the message
    $bubble.append($text);
    $content.append($name, $bubble);
    $msg.append($avatar, $content);
    $chatFeed.append($msg);

    // Scroll to bottom to show new message
    scrollToBottom();

    console.log("[home.js] Appended message from:", username, "at:", timestamp);
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

})(); // End IIFE
