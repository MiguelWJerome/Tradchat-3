/**
 * =========================================================================
 * ChatEmptyState Component
 * Reusable conversation starter header for TradChat 3.
 *
 * Supported Variants:
 *  - "room": "This is the start of {roomName}."
 *            "Created by @{creatorUsername} • {formattedDate}"
 *  - "dm":   "All friendships start somewhere."
 *            "Conversation with {recipientName} • Started {formattedDate}"
 * =========================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChatEmptyState = factory();
    root.createChatEmptyState = root.ChatEmptyState.render;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Helper: Escape HTML characters to prevent XSS injection.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Helper: Format any date/timestamp into readable long format (e.g. "November 12, 2026").
   */
  function formatDate(dateInput) {
    if (!dateInput) {
      dateInput = new Date();
    }

    let dateObj;
    if (dateInput instanceof Date) {
      dateObj = dateInput;
    } else if (typeof dateInput === 'number') {
      dateObj = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
      // Check for YYYY-MM-DD to avoid local timezone offset shifting the day backwards
      const ymdMatch = dateInput.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymdMatch) {
        dateObj = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
      } else {
        dateObj = new Date(dateInput);
      }
    } else {
      dateObj = new Date();
    }

    if (isNaN(dateObj.getTime())) {
      return String(dateInput);
    }

    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      return formatter.format(dateObj);
    } catch (e) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
    }
  }

  /**
   * Generate data model from props
   */
  function buildModel(props) {
    props = props || {};
    const type = (props.type || 'room').toLowerCase();
    const align = props.align === 'center' ? 'center' : 'left';
    const formattedDate = formatDate(props.date || props.startedDate || props.createdAt);

    let header = '';
    let subtextHtml = '';
    let iconHtml = '';

    if (type === 'dm') {
      const recipient = props.recipientName || props.recipient || 'friend';
      header = 'All friendships start somewhere.';
      subtextHtml = `Conversation with <span class="chat-empty-state__highlight">${escapeHtml(recipient)}</span><span class="chat-empty-state__bullet">•</span>Started ${escapeHtml(formattedDate)}`;
      
      if (props.showIcon !== false) {
        const iconContent = props.iconHtml || '<i class="fa-solid fa-user-group chat-empty-state__icon"></i>';
        iconHtml = `<div class="chat-empty-state__icon-wrap">${iconContent}</div>`;
      }
    } else {
      // Default: "room"
      const roomName = props.roomName || props.room || 'this room';
      const creator = props.creatorUsername || props.creator || 'admin';
      header = `This is the start of ${escapeHtml(roomName)}.`;
      subtextHtml = `Created by <span class="chat-empty-state__highlight">@${escapeHtml(creator)}</span><span class="chat-empty-state__bullet">•</span>${escapeHtml(formattedDate)}`;
      
      if (props.showIcon !== false) {
        const iconContent = props.iconHtml || '<i class="fa-solid fa-comments chat-empty-state__icon"></i>';
        iconHtml = `<div class="chat-empty-state__icon-wrap">${iconContent}</div>`;
      }
    }

    return {
      type,
      align,
      header,
      subtextHtml,
      iconHtml,
      divider: props.showDivider !== false
    };
  }

  /**
   * Return HTML string representation
   */
  function html(props) {
    const model = buildModel(props);
    const alignClass = `chat-empty-state--${model.align}`;
    const dividerHtml = model.divider ? '<hr class="chat-empty-state__divider" aria-hidden="true" />' : '';

    return `
      <div class="chat-empty-state ${alignClass}" role="region" aria-label="Conversation Beginning">
        ${model.iconHtml}
        <div class="chat-empty-state__content">
          <h2 class="chat-empty-state__header">${model.header}</h2>
          <p class="chat-empty-state__subtext">${model.subtextHtml}</p>
        </div>
        ${dividerHtml}
      </div>
    `.trim();
  }

  /**
   * Return DOM Element
   */
  function render(props) {
    const temp = document.createElement('div');
    temp.innerHTML = html(props);
    return temp.firstElementChild;
  }

  /**
   * Convenience helper: Prepend component to target container
   */
  function prependTo(target, props) {
    const el = render(props);
    let container = target;
    if (typeof target === 'string') {
      container = document.querySelector(target);
    } else if (window.jQuery && target instanceof window.jQuery) {
      container = target[0];
    }
    if (container) {
      if (container.firstChild) {
        container.insertBefore(el, container.firstChild);
      } else {
        container.appendChild(el);
      }
    }
    return el;
  }

  const ChatEmptyState = {
    render: render,
    html: html,
    prependTo: prependTo,
    formatDate: formatDate
  };

  // Optional jQuery plugin support
  if (typeof window !== 'undefined' && window.jQuery) {
    window.jQuery.fn.chatEmptyState = function (props) {
      return this.each(function () {
        ChatEmptyState.prependTo(this, props);
      });
    };
  }

  return ChatEmptyState;
});
