/**
 * =============================================================================
 * /static/javascript/network/home.js
 * TradChat — Home Page  |  NETWORK layer
 * =============================================================================
 *
 * PURPOSE
 * -------
 * This file handles all DATA and REAL-TIME communication for the Home page.
 * It sits between the server (via Socket.IO) and the UI (looks/home.js).
 *
 * RESPONSIBILITIES
 * ----------------
 * 1. Connect to the "mainroom" socket channel.
 * 2. Receive incoming messages and forward them to the UI layer.
 * 3. Send outgoing messages typed by the user.
 * 4. Fetch initial conversation history on page load.
 * 5. Update the sidebar conversation list when new messages arrive.
 *
 * DEPENDENCIES (loaded before this file in the HTML)
 * ---------------------------------------------------
 * - /static/javascript/socketio.js  → provides the global `io` object
 * - /static/javascript/jquery.js    → provides `$` helper
 * - /static/javascript/tradchat.js  → provides `TradChat` global app config
 *
 * HOW TO READ THIS FILE (for beginners)
 * ----------------------------------------
 * Think of this file like a telephone switchboard.
 * It listens for calls from the server ("new message!") and dials the UI
 * ("hey, display this message now"). It also picks up calls from the UI
 * ("user pressed Send") and forwards them to the server.
 * =============================================================================
 */

;(function () {
  "use strict";

  /* ---------------------------------------------------------------------------
     SECTION 1 — SOCKET CONNECTION
     Connect to the "mainroom" namespace (or whatever channel TradChat uses).
  --------------------------------------------------------------------------- */

  /**
   * `socket` — the live Socket.IO connection to the server.
   *
   * `TradChat.socketURL` is set in tradchat.js and points to the server.
   * The second argument `{ transports: ['websocket'] }` forces WebSocket
   * (faster than the long-polling fallback).
   *
   * NOTE: If `TradChat` or `io` are not yet defined, this will throw an error.
   *       Make sure the script tags in home.html are in the correct order.
   */
  var socket = io(TradChat.socketURL, {
    transports: ["websocket"],
    reconnectionAttempts: 5,       // retry 5 times before giving up
    reconnectionDelay: 2000,       // wait 2 s between retries
  });

  /* ---------------------------------------------------------------------------
     SECTION 2 — CONNECTION LIFECYCLE EVENTS
     These fire automatically when the socket connects / disconnects.
  --------------------------------------------------------------------------- */

  /**
   * on('connect') — fires once the WebSocket handshake succeeds.
   * We immediately join the "mainroom" channel so we start receiving messages.
   */
  socket.on("connect", function () {
    console.log("[network/home] Socket connected. ID:", socket.id);

    // Tell the server which room we want to join.
    // The server will reply with a 'room:history' event (see below).
    socket.emit("room:join", { room: "mainroom" });
  });

  /**
   * on('disconnect') — fires when the socket loses connection.
   * We notify the UI layer so it can show an offline banner.
   */
  socket.on("disconnect", function (reason) {
    console.warn("[network/home] Socket disconnected:", reason);

    // Tell the UI to show a "reconnecting…" indicator
    if (typeof HomeUI !== "undefined") {
      HomeUI.showOfflineBanner(reason);
    }
  });

  /**
   * on('reconnect') — fires after a successful automatic reconnect.
   */
  socket.on("reconnect", function () {
    console.log("[network/home] Reconnected. Rejoining mainroom.");
    socket.emit("room:join", { room: "mainroom" });

    if (typeof HomeUI !== "undefined") {
      HomeUI.hideOfflineBanner();
    }
  });

  /* ---------------------------------------------------------------------------
     SECTION 3 — INCOMING EVENTS FROM THE SERVER
     These are messages the server sends TO us.
  --------------------------------------------------------------------------- */

  /**
   * on('room:history') — server sends a batch of past messages when we join.
   *
   * Expected payload shape:
   *   {
   *     room: "mainroom",
   *     messages: [
   *       { id, author, avatar, text, timestamp, own },
   *       ...
   *     ]
   *   }
   */
  socket.on("room:history", function (payload) {
    console.log("[network/home] Received room history:", payload.messages.length, "messages");

    // Pass the messages array to the UI layer for rendering
    if (typeof HomeUI !== "undefined") {
      HomeUI.renderHistory(payload.messages);
    }
  });

  /**
   * on('room:message') — a new chat message just arrived from another user.
   *
   * Expected payload shape:
   *   { id, author, avatar, text, timestamp, own: false }
   */
  socket.on("room:message", function (message) {
    console.log("[network/home] New message from:", message.author);

    // Append message to the chat feed
    if (typeof HomeUI !== "undefined") {
      HomeUI.appendMessage(message);
    }

    // Also update the sidebar conversation list preview
    HomeNetwork.updateConvoPreview("mainroom", message.author, message.text);
  });

  /**
   * on('room:userJoined') — a new user joined the room.
   * We show a subtle system notice in the feed.
   */
  socket.on("room:userJoined", function (data) {
    console.log("[network/home] User joined:", data.username);

    if (typeof HomeUI !== "undefined") {
      HomeUI.appendSystemMessage(data.username + " joined the room.");
    }
  });

  /**
   * on('room:userLeft') — a user left the room.
   */
  socket.on("room:userLeft", function (data) {
    console.log("[network/home] User left:", data.username);

    if (typeof HomeUI !== "undefined") {
      HomeUI.appendSystemMessage(data.username + " left the room.");
    }
  });

  /**
   * on('error') — the server sent us an error.
   */
  socket.on("error", function (err) {
    console.error("[network/home] Server error:", err);
  });

  /* ---------------------------------------------------------------------------
     SECTION 4 — OUTGOING MESSAGES (user → server)
     These functions are called by looks/home.js when the user does something.
  --------------------------------------------------------------------------- */

  /**
   * sendMessage(text)
   * -----------------
   * Emits a 'room:send' event to the server with the user's message.
   *
   * @param {string} text — the message string to send
   */
  function sendMessage(text) {
    // Basic validation — don't send empty strings
    if (!text || text.trim() === "") {
      console.warn("[network/home] sendMessage called with empty text, ignoring.");
      return;
    }

    var payload = {
      room     : "mainroom",          // which room to post to
      text     : text.trim(),         // the sanitised message body
      timestamp: new Date().toISOString(),  // ISO-8601 timestamp
    };

    socket.emit("room:send", payload);
    console.log("[network/home] Message sent:", payload.text);
  }

  /* ---------------------------------------------------------------------------
     SECTION 5 — SIDEBAR CONVERSATION LIST
     Manages the list of conversations shown in the left sidebar.
  --------------------------------------------------------------------------- */

  /**
   * fetchConversations()
   * --------------------
   * HTTP GET request to load the user's conversation list.
   * This populates the sidebar list on page load.
   *
   * Uses jQuery's $.ajax (loaded via jquery.js).
   */
  function fetchConversations() {
    $.ajax({
      url    : TradChat.apiBase + "/conversations",   // e.g. /api/conversations
      method : "GET",
      success: function (data) {
        console.log("[network/home] Conversations loaded:", data.length);

        if (typeof HomeUI !== "undefined") {
          HomeUI.renderConversationList(data);
        }
      },
      error: function (xhr, status, err) {
        console.error("[network/home] Failed to load conversations:", status, err);
      },
    });
  }

  /**
   * updateConvoPreview(roomId, author, text)
   * ----------------------------------------
   * Updates the sidebar preview text for a given conversation room
   * whenever a new message arrives.
   *
   * @param {string} roomId  — e.g. "mainroom"
   * @param {string} author  — who sent the last message
   * @param {string} text    — message preview (truncated by UI)
   */
  function updateConvoPreview(roomId, author, text) {
    // Delegate to UI layer for DOM update
    if (typeof HomeUI !== "undefined") {
      HomeUI.updateSidebarPreview(roomId, author, text);
    }
  }

  /**
   * searchConversations(query)
   * --------------------------
   * Filters the conversation list based on the search input.
   * Called by looks/home.js when the user types in the search bar.
   *
   * @param {string} query — the search string
   */
  function searchConversations(query) {
    if (!query || query.trim() === "") {
      // Empty query — reload the full list
      fetchConversations();
      return;
    }

    $.ajax({
      url    : TradChat.apiBase + "/conversations/search",
      method : "GET",
      data   : { q: query.trim() },
      success: function (data) {
        if (typeof HomeUI !== "undefined") {
          HomeUI.renderConversationList(data);
        }
      },
      error: function (xhr, status, err) {
        console.error("[network/home] Search failed:", err);
      },
    });
  }

  /* ---------------------------------------------------------------------------
     SECTION 6 — PUBLIC API
     Expose only what looks/home.js (and other modules) need.
     Everything else stays private inside this IIFE.
  --------------------------------------------------------------------------- */

  /**
   * `HomeNetwork` is the public interface for this module.
   * Attach it to `window` so other scripts can call it.
   */
  window.HomeNetwork = {
    sendMessage          : sendMessage,
    fetchConversations   : fetchConversations,
    searchConversations  : searchConversations,
    updateConvoPreview   : updateConvoPreview,
  };

  /* ---------------------------------------------------------------------------
     SECTION 7 — INITIALISE ON DOM READY
     Kick off the conversation list fetch as soon as the page is ready.
  --------------------------------------------------------------------------- */
  $(document).ready(function () {
    console.log("[network/home] DOM ready — fetching initial data.");
    fetchConversations();
  });

})(); // End IIFE
