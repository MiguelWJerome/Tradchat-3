/**
 * =============================================================================
 * /static/javascript/looks/home.js
 * TradChat — Home Page  |  UI / LOOKS layer
 * =============================================================================
 *
 * PURPOSE
 * -------
 * This file controls every visual interaction on the Home page.
 * It renders content into the DOM, handles user events (clicks, key presses),
 * runs animations, and bridges user actions to the network layer.
 *
 * RESPONSIBILITIES
 * ----------------
 * 1.  Render chat messages into the feed.
 * 2.  Render the sidebar conversation list.
 * 3.  Handle "Send" button click and Enter key.
 * 4.  Toggle the emoji picker popover.
 * 5.  Seed emoji picker with emoji characters.
 * 6.  Handle nav tab switching (active class).
 * 7.  Handle search bar input → delegate to HomeNetwork.
 * 8.  Mobile: Build + show/hide the bottom-nav and sidebar drawer.
 * 9.  Show/hide offline banner.
 * 10. Scroll the feed to the bottom on new messages.
 *
 * DEPENDENCIES (loaded before this file)
 * ---------------------------------------
 * - jQuery          ($ helper)
 * - TradChat        (global app config)
 * - HomeNetwork     (network/home.js — must be loaded first)
 *
 * BEGINNER NOTE
 * -------------
 * Think of this file as the "stage manager" of a play.
 * The network layer (home.js) hands it scripts (data).
 * This file decides how the actors (DOM elements) perform on stage (the page).
 * =============================================================================
 */

;(function () {
  "use strict";

  /* ---------------------------------------------------------------------------
     SECTION 1 — EMOJI DATA
     A curated list of emojis seeded into the emoji picker popover.
  --------------------------------------------------------------------------- */
  var EMOJIS = [
    "😀","😂","😍","🤔","😎","🥳","😭","🔥",
    "👍","👎","❤️","💯","🎉","🙌","🤣","😅",
    "🤩","🥺","😤","😴","🤑","👀","💪","🙏",
    "📈","📉","💰","🏆","⚡","🎯","🍺","🤝",
  ];

  /* ---------------------------------------------------------------------------
     SECTION 2 — DEMO / SEED DATA
     Sample conversations and messages shown before live data loads.
     Replace with real server data once the backend is connected.
  --------------------------------------------------------------------------- */

  /** Sample messages for the initial feed state */
  var SEED_MESSAGES = [
    { id: "1", author: "AlphaTrader",  avatar: "AT", text: "Morning! Anyone watching the oil futures today?", timestamp: "09:02", own: false },
    { id: "2", author: "BlueSky_Jane", avatar: "BJ", text: "Yeah, WTI is making a move. I'm long from 78.40.", timestamp: "09:04", own: false },
    { id: "3", author: "You",          avatar: "YO", text: "Watching the breakout above 80. Let's see if it holds.", timestamp: "09:05", own: true  },
    { id: "4", author: "DeltaHedge",   avatar: "DH", text: "Volume is confirming — this looks clean.", timestamp: "09:07", own: false },
  ];

  /** Sample sidebar conversation list */
  var SEED_CONVERSATIONS = [
    { id: "mainroom",  name: "Mainroom",      preview: "DeltaHedge: Volume is confirming…", active: true  },
    { id: "oil-desk",  name: "Oil Desk",      preview: "Long WTI from 78.40",                active: false },
    { id: "fx-lounge", name: "FX Lounge",     preview: "EUR/USD holding 1.085",              active: false },
    { id: "alice",     name: "Alice M.",       preview: "Thanks for the tip 🙏",              active: false },
    { id: "brokerage", name: "Brokerage Grp", preview: "Meeting at 2pm EST",                 active: false },
  ];

  /* ---------------------------------------------------------------------------
     SECTION 3 — DOM ELEMENT CACHE
     We grab all the elements we need ONCE on DOMContentLoaded and store them
     in variables. This avoids repeated DOM queries (better performance).
  --------------------------------------------------------------------------- */
  var $chatFeed,      // the scrollable message log
      $chatInput,     // the text input box
      $sendBtn,       // the send arrow button
      $emojiBtn,      // the smiley-face button
      $emojiPicker,   // the emoji grid popover
      $gifBtn,        // GIF button
      $uploadBtn,     // file upload button
      $sidebarList,   // the <ul> conversation list
      $searchInput,   // the search input in the sidebar
      $navTabs;       // all .nav-tab buttons

  /* ---------------------------------------------------------------------------
     SECTION 4 — INITIALISATION
     Entry point — runs once the DOM is fully loaded.
  --------------------------------------------------------------------------- */
  $(document).ready(function () {
    console.log("[looks/home] DOM ready — initialising UI.");

    // Cache DOM references
    $chatFeed    = $("#chat-feed");
    $chatInput   = $("#chat-input");
    $sendBtn     = $("#send-btn");
    $emojiBtn    = $("#emoji-btn");
    $emojiPicker = $("#emoji-picker");
    $gifBtn      = $("#gif-btn");
    $uploadBtn   = $("#upload-btn");
    $sidebarList = $("#sidebar-list");
    $searchInput = $(".search-input");
    $navTabs     = $(".nav-tab");

    // Build the emoji picker grid
    buildEmojiPicker();

    // Seed initial demo data
    renderHistory(SEED_MESSAGES);
    renderConversationList(SEED_CONVERSATIONS);

    // On mobile, inject the bottom nav + drawer elements into the DOM
    if (isMobile()) {
      buildMobileUI();
    }

    // Attach all event listeners
    attachEvents();

    console.log("[looks/home] UI ready.");
  });

  /* ---------------------------------------------------------------------------
     SECTION 5 — EMOJI PICKER
  --------------------------------------------------------------------------- */

  /**
   * buildEmojiPicker()
   * ------------------
   * Populates the #emoji-picker div with individual emoji buttons.
   * Each button, when clicked, inserts the emoji into the chat input.
   */
  function buildEmojiPicker() {
    $emojiPicker.empty(); // clear any old content

    EMOJIS.forEach(function (emoji) {
      var $btn = $("<button>")
        .addClass("emoji-btn")
        .attr("aria-label", "Insert " + emoji)
        .text(emoji)
        .on("click", function () {
          insertEmoji(emoji);
        });

      $emojiPicker.append($btn);
    });
  }

  /**
   * insertEmoji(emoji)
   * ------------------
   * Appends an emoji character to wherever the cursor is in the chat input.
   * Also closes the picker after insertion.
   *
   * @param {string} emoji — the emoji character to insert
   */
  function insertEmoji(emoji) {
    var input     = $chatInput[0];  // raw DOM element (needed for selectionStart)
    var start     = input.selectionStart;
    var end       = input.selectionEnd;
    var current   = $chatInput.val();

    // Insert emoji at cursor position
    var newVal = current.slice(0, start) + emoji + current.slice(end);
    $chatInput.val(newVal);

    // Move cursor to after the inserted emoji
    var newPos = start + emoji.length;
    input.setSelectionRange(newPos, newPos);
    $chatInput.focus();

    // Close the picker
    closeEmojiPicker();
  }

  /**
   * openEmojiPicker() / closeEmojiPicker() / toggleEmojiPicker()
   * Manage the visibility of the emoji picker using the .open CSS class.
   */
  function openEmojiPicker() {
    $emojiPicker.addClass("open").attr("aria-hidden", "false");
  }

  function closeEmojiPicker() {
    $emojiPicker.removeClass("open").attr("aria-hidden", "true");
  }

  function toggleEmojiPicker() {
    if ($emojiPicker.hasClass("open")) {
      closeEmojiPicker();
    } else {
      openEmojiPicker();
    }
  }

  /* ---------------------------------------------------------------------------
     SECTION 6 — MESSAGE RENDERING
  --------------------------------------------------------------------------- */

  /**
   * renderHistory(messages)
   * -----------------------
   * Clears the feed and renders an array of historical messages.
   * Called once on page load with the server's room history.
   *
   * @param {Array} messages — array of message objects
   */
  function renderHistory(messages) {
    $chatFeed.empty();

    messages.forEach(function (msg) {
      appendMessage(msg);
    });

    scrollToBottom();
  }

  /**
   * appendMessage(message)
   * ----------------------
   * Builds and appends a single message bubble to the feed.
   * Called both for historical messages and live incoming messages.
   *
   * @param {Object} message — { id, author, avatar, text, timestamp, own }
   */
  function appendMessage(message) {
    /*
      Message HTML structure:
      <div class="message [own]">
        <div class="message__avatar">XX</div>
        <div class="message__bubble">
          <div class="message__name">Author · 09:04</div>
          <div class="message__text">Hello!</div>
        </div>
      </div>
    */

    var $msg = $("<div>").addClass("message").attr("data-id", message.id);
    if (message.own) $msg.addClass("own");

    // Avatar circle with initials
    var $avatar = $("<div>")
      .addClass("message__avatar")
      .text(message.avatar || "?");

    // Bubble container
    var $bubble = $("<div>").addClass("message__bubble");

    // Author name + timestamp header
    var $name = $("<div>")
      .addClass("message__name")
      .text(message.own ? "You · " + message.timestamp : message.author + " · " + message.timestamp);

    // Message body
    var $text = $("<div>")
      .addClass("message__text")
      .text(message.text);  // .text() prevents XSS; use .html() only for trusted content

    $bubble.append($name, $text);
    $msg.append($avatar, $bubble);
    $chatFeed.append($msg);

    // Smooth scroll to reveal new message
    scrollToBottom();
  }

  /**
   * appendSystemMessage(text)
   * -------------------------
   * Appends a small centred system notice (e.g. "Alice joined the room.").
   *
   * @param {string} text — the notice text
   */
  function appendSystemMessage(text) {
    var $notice = $("<div>")
      .css({
        textAlign  : "center",
        fontSize   : "0.7rem",
        opacity    : "0.55",
        padding    : "4px 0",
        fontStyle  : "italic",
        userSelect : "none",
      })
      .text(text);

    $chatFeed.append($notice);
    scrollToBottom();
  }

  /**
   * scrollToBottom()
   * ----------------
   * Smoothly scrolls the chat feed to show the most recent message.
   */
  function scrollToBottom() {
    var feed = $chatFeed[0];
    if (feed) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    }
  }

  /* ---------------------------------------------------------------------------
     SECTION 7 — SIDEBAR CONVERSATION LIST
  --------------------------------------------------------------------------- */

  /**
   * renderConversationList(conversations)
   * ---------------------------------------
   * Renders the sidebar <ul> list from an array of conversation objects.
   *
   * @param {Array} conversations — [{ id, name, preview, active }]
   */
  function renderConversationList(conversations) {
    $sidebarList.empty();

    if (!conversations || conversations.length === 0) {
      $sidebarList.append(
        $("<li>").css({ padding: "12px 14px", fontSize: "0.75rem", opacity: "0.5" }).text("No conversations yet.")
      );
      return;
    }

    conversations.forEach(function (convo) {
      /*
        List item structure:
        <li class="convo-item [active]" data-room="mainroom">
          <div class="convo-item__avatar">MA</div>
          <div class="convo-item__info">
            <span class="convo-item__name">Mainroom</span>
            <span class="convo-item__preview">DeltaHedge: Volume…</span>
          </div>
        </li>
      */
      var initials = convo.name.slice(0, 2).toUpperCase();

      var $avatar = $("<div>").addClass("convo-item__avatar").text(initials);
      var $name   = $("<span>").addClass("convo-item__name").text(convo.name);
      var $preview= $("<span>").addClass("convo-item__preview").text(convo.preview || "");
      var $info   = $("<div>").addClass("convo-item__info").append($name, $preview);

      var $item = $("<li>")
        .addClass("convo-item")
        .attr("data-room", convo.id)
        .append($avatar, $info);

      if (convo.active) $item.addClass("active");

      // Clicking a conversation item switches to that room
      $item.on("click", function () {
        switchToRoom(convo.id, convo.name);
      });

      $sidebarList.append($item);
    });

    // If on mobile, also populate the drawer's list
    if (isMobile()) {
      $("#drawer-list").html($sidebarList.html());
    }
  }

  /**
   * updateSidebarPreview(roomId, author, text)
   * ------------------------------------------
   * Updates just the preview line for a specific conversation item
   * without re-rendering the entire list.
   *
   * @param {string} roomId
   * @param {string} author
   * @param {string} text
   */
  function updateSidebarPreview(roomId, author, text) {
    var preview = author + ": " + text;
    var $item   = $(".convo-item[data-room='" + roomId + "'] .convo-item__preview");

    if ($item.length) {
      $item.text(preview);
    }
  }

  /* ---------------------------------------------------------------------------
     SECTION 8 — SENDING MESSAGES
  --------------------------------------------------------------------------- */

  /**
   * handleSend()
   * ------------
   * Reads the input field, calls HomeNetwork.sendMessage(), and clears
   * the field. Also optimistically renders the user's own message immediately
   * (before server confirmation) for a snappy feel.
   */
  function handleSend() {
    var text = $chatInput.val().trim();
    if (!text) return;  // nothing to send

    // Optimistic UI — show message immediately
    appendMessage({
      id       : "local-" + Date.now(),
      author   : "You",
      avatar   : "YO",
      text     : text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      own      : true,
    });

    // Send via network layer
    HomeNetwork.sendMessage(text);

    // Clear the input
    $chatInput.val("").focus();

    // Small send-button pulse animation
    $sendBtn.addClass("sent");
    setTimeout(function () { $sendBtn.removeClass("sent"); }, 300);
  }

  /* ---------------------------------------------------------------------------
     SECTION 9 — OFFLINE BANNER
  --------------------------------------------------------------------------- */

  /**
   * showOfflineBanner(reason)
   * -------------------------
   * Injects a sticky banner at the top of the chat panel when disconnected.
   */
  function showOfflineBanner(reason) {
    if ($("#offline-banner").length) return;  // already showing

    var $banner = $("<div>")
      .attr("id", "offline-banner")
      .css({
        background : "var(--color-accent)",
        color      : "#fff",
        textAlign  : "center",
        padding    : "6px 12px",
        fontSize   : "0.75rem",
        fontWeight : "600",
        letterSpacing: "0.04em",
      })
      .text("⚠ Disconnected — reconnecting…");

    $(".chat-panel").prepend($banner);
  }

  /**
   * hideOfflineBanner()
   * -------------------
   * Removes the offline banner once the socket reconnects.
   */
  function hideOfflineBanner() {
    $("#offline-banner").remove();
  }

  /* ---------------------------------------------------------------------------
     SECTION 10 — NAV TAB SWITCHING
  --------------------------------------------------------------------------- */

  /**
   * activateTab($tab)
   * -----------------
   * Moves the .active class to the clicked nav tab.
   * NOTE: This no longer changes the room banner - banner is controlled by room selection.
   *
   * @param {jQuery} $tab — the clicked .nav-tab element
   */
  function activateTab($tab) {
    $navTabs.removeClass("active");
    $tab.addClass("active");

    var section = $tab.data("section");
    console.log("[looks/home] Tab switched to:", section);
  }

  /**
   * switchToRoom(roomId, roomName)
   * ------------------------------
   * Switches to a specific room and updates the room banner accordingly.
   * This should be called when clicking on conversation items in the sidebar.
   *
   * @param {string} roomId — the room ID (e.g., "mainroom", "oil-desk")
   * @param {string} roomName — the display name for the room (e.g., "Mainroom", "Oil Desk")
   */
  function switchToRoom(roomId, roomName) {
    // Update the room banner
    $(".room-title").text(roomName.toUpperCase());
    
    // Update sidebar active state
    $(".convo-item").removeClass("active");
    $(".convo-item[data-room='" + roomId + "']").addClass("active");
    
    // Clear current chat feed and show loading state
    $chatFeed.empty();
    $chatFeed.append(
      $("<div>").css({
        textAlign: "center",
        padding: "20px",
        opacity: "0.5",
        fontSize: "0.85rem"
      }).text("Loading " + roomName + "...")
    );
    
    // Load room history via network layer
    if (window.HomeNetwork && HomeNetwork.loadRoom) {
      HomeNetwork.loadRoom(roomId);
    }
    
    console.log("[looks/home] Switched to room:", roomId, roomName);
    
    // On mobile, close the drawer after selecting a room
    if (isMobile()) closeDrawer();
  }

  /* ---------------------------------------------------------------------------
     SECTION 11 — MOBILE UI BUILDER
     On mobile screens, we inject additional HTML for the bottom nav bar
     and the sidebar drawer.
  --------------------------------------------------------------------------- */

  /**
   * buildMobileUI()
   * ---------------
   * Creates and injects:
   *   • A bottom navigation bar (.bottom-nav) after .main-content
   *   • A drawer overlay (.drawer-overlay) + sidebar drawer (.sidebar-drawer)
   */
  function buildMobileUI() {
    // ---- Bottom Navigation Bar ----
    var $bottomNav = $("<nav>").addClass("bottom-nav").attr("aria-label", "Quick navigation");

    // Chats button — opens the sidebar drawer
    var $chatsBtn = $("<button>")
      .addClass("bottom-nav__item active")
      .attr("id", "bottom-chats")
      .attr("aria-label", "Open chats")
      .html(
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>' +
        '<span>Chats</span>'
      )
      .on("click", openDrawer);

    // Open Groups button
    var $groupsBtn = $("<button>")
      .addClass("bottom-nav__item")
      .attr("aria-label", "Open Groups")
      .html(
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/>' +
        '<path d="M3 20c0-3.3 2.7-6 6-6"/><path d="M15 14c3.3 0 6 2.7 6 6"/>' +
        '<path d="M9 14c2 0 3.8.7 5.2 1.9"/></svg>' +
        '<span>Groups</span>'
      );

    // Invite Groups button
    var $inviteBtn = $("<button>")
      .addClass("bottom-nav__item")
      .attr("aria-label", "Invite to Group")
      .html(
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<circle cx="9" cy="8" r="3"/>' +
        '<path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>' +
        '<line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>' +
        '<span>Invite</span>'
      );

    $bottomNav.append($chatsBtn, $groupsBtn, $inviteBtn);
    $(".app-shell").append($bottomNav);

    // ---- Drawer Overlay ----
    var $overlay = $("<div>")
      .addClass("drawer-overlay")
      .attr("id", "drawer-overlay")
      .on("click", closeDrawer);   // tap outside to close

    // ---- Sidebar Drawer ----
    var $drawer = $("<div>")
      .addClass("sidebar-drawer")
      .attr("id", "sidebar-drawer");

    // Drag handle
    $drawer.append($("<div>").addClass("drawer-handle").attr("aria-hidden", "true"));

    // Drawer title
    $drawer.append($("<div>").addClass("drawer-title").text("Chats"));

    // Tray icons (Messenger / Open Groups / Invite Groups) — cloned from sidebar concept
    var $tray = $("<div>").addClass("sidebar__tray");
    var trayItems = [
      { icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="14" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>', label: "Messenger" },
      { icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6"/><path d="M15 14c3.3 0 6 2.7 6 6"/><path d="M9 14c2 0 3.8.7 5.2 1.9"/></svg>', label: "Open<br/>Groups" },
      { icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>', label: "Invite<br/>Groups" },
    ];

    trayItems.forEach(function (item, i) {
      if (i > 0) $tray.append($("<div>").addClass("tray-divider"));

      $tray.append(
        $("<button>")
          .addClass("tray-item btn-sharp")
          .html(item.icon + '<span class="tray-item__label">' + item.label + "</span>")
      );
    });
    $drawer.append($tray);

    // Search bar inside drawer
    var $search = $("<div>").addClass("sidebar__search");
    var $searchClone = $("<input>")
      .attr("type", "text")
      .attr("placeholder", "Search")
      .addClass("search-input")
      .attr("id", "drawer-search")
      .on("input", function () {
        HomeNetwork.searchConversations($(this).val());
      });
    var $searchBtnClone = $("<button>").addClass("search-btn").html(
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>'
    );
    $search.append($searchClone, $searchBtnClone);
    $drawer.append($search);

    // Conversation list inside drawer
    var $drawerList = $("<ul>")
      .addClass("sidebar__list")
      .attr("id", "drawer-list");
    $drawer.append($drawerList);

    // Add everything to the body
    $("body").append($overlay, $drawer);

    // Mirror existing sidebar list into drawer
    $("#drawer-list").html($sidebarList.html());

    console.log("[looks/home] Mobile UI built.");
  }

  /**
   * openDrawer() / closeDrawer()
   * Slide the sidebar drawer into view on mobile.
   */
  function openDrawer() {
    $("#sidebar-drawer").addClass("open");
    $("#drawer-overlay").addClass("open");
    $("body").css("overflow", "hidden");  // prevent background scroll
  }

  function closeDrawer() {
    $("#sidebar-drawer").removeClass("open");
    $("#drawer-overlay").removeClass("open");
    $("body").css("overflow", "");
  }

  /* ---------------------------------------------------------------------------
     SECTION 12 — UTILITY HELPERS
  --------------------------------------------------------------------------- */

  /**
   * isMobile()
   * ----------
   * Returns true if the current viewport width is ≤ 768px.
   * We use this to conditionally build mobile-only UI elements.
   */
  function isMobile() {
    return window.innerWidth <= 768;
  }

  /* ---------------------------------------------------------------------------
     SECTION 13 — EVENT LISTENERS
     All user interactions wired up in one place for easy maintenance.
  --------------------------------------------------------------------------- */

  function attachEvents() {

    // ---- Send button click ----
    $sendBtn.on("click", handleSend);

    // ---- Enter key in input (Shift+Enter = new line, Enter alone = send) ----
    $chatInput.on("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();    // don't add a line break
        handleSend();
      }
    });

    // ---- Emoji picker toggle ----
    $emojiBtn.on("click", function (e) {
      e.stopPropagation();   // prevent the document click from immediately closing it
      toggleEmojiPicker();
    });

    // ---- Close emoji picker when clicking anywhere else ----
    $(document).on("click", function (e) {
      if (!$(e.target).closest("#emoji-picker, #emoji-btn").length) {
        closeEmojiPicker();
      }
    });

    // ---- GIF button placeholder ----
    $gifBtn.on("click", function () {
      console.log("[looks/home] GIF picker not yet implemented.");
      // TODO: open GIF picker
    });

    // ---- Upload button placeholder ----
    $uploadBtn.on("click", function () {
      console.log("[looks/home] File upload not yet implemented.");
      // TODO: trigger hidden file input
    });

    // ---- Nav tab switching ----
    $navTabs.on("click", function () {
      activateTab($(this));
    });

    // ---- Sidebar search bar ----
    $searchInput.on("input", function () {
      HomeNetwork.searchConversations($(this).val());
    });

    // ---- Window resize: rebuild mobile UI if crossing the 768px boundary ----
    $(window).on("resize", debounce(function () {
      var $drawer = $("#sidebar-drawer");
      if (isMobile() && !$drawer.length) {
        buildMobileUI();
      }
    }, 250));
  }

  /* ---------------------------------------------------------------------------
     SECTION 14 — DEBOUNCE UTILITY
     Prevents a function from firing too rapidly (e.g., on every resize event).
  --------------------------------------------------------------------------- */

  /**
   * debounce(fn, delay)
   * -------------------
   * Returns a new function that waits `delay` milliseconds after the last
   * call before executing `fn`.
   *
   * @param {Function} fn    — the function to debounce
   * @param {number}   delay — milliseconds to wait
   */
  function debounce(fn, delay) {
    var timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  /* ---------------------------------------------------------------------------
     SECTION 15 — PUBLIC API
     Expose only what network/home.js needs to call back into the UI.
  --------------------------------------------------------------------------- */

  window.HomeUI = {
    renderHistory          : renderHistory,
    appendMessage          : appendMessage,
    appendSystemMessage    : appendSystemMessage,
    renderConversationList : renderConversationList,
    updateSidebarPreview   : updateSidebarPreview,
    showOfflineBanner      : showOfflineBanner,
    hideOfflineBanner      : hideOfflineBanner,
    switchToRoom           : switchToRoom,
  };

})(); // End IIFE
