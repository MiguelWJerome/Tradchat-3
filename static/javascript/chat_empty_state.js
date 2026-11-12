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
 *
 * Features:
 *  - Supports both Vanilla JS and jQuery environments
 *  - Safe HTML escaping for user-supplied data (room name, creator, recipient)
 *  - Formats any date / ISO string / Unix timestamp into long readable format (e.g. "November 12, 2026")
 *  - Configurable alignment: 'left' (standard chat feed) or 'center'
 *  - Responsive & accessible typography for light and dark modes
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
      // Handle Unix timestamp in seconds vs milliseconds
      dateObj = new Date(dateInput < 10000000000 ? dateInput * 1000 : dateInput);
    } else if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      // Match YYYY-MM-DD or YYYY-MM-DD HH:MM:SS to avoid timezone skew
      const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
      if (ymdMatch) {
        if (ymdMatch[4] !== undefined) {
          dateObj = new Date(
            parseInt(ymdMatch[1], 10),
            parseInt(ymdMatch[2], 10) - 1,
            parseInt(ymdMatch[3], 10),
            parseInt(ymdMatch[4], 10),
            parseInt(ymdMatch[5], 10),
            parseInt(ymdMatch[6], 10)
          );
        } else {
          dateObj = new Date(
            parseInt(ymdMatch[1], 10),
            parseInt(ymdMatch[2], 10) - 1,
            parseInt(ymdMatch[3], 10)
          );
        }
      } else {
        dateObj = new Date(trimmed);
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
   *
   * @param {Object} props
   * @param {('room'|'dm')} [props.type='room'] - Variant selector
   * @param {string} [props.roomName] - Room name (for 'room' variant)
   * @param {string} [props.creatorUsername] - Room creator username
   * @param {string} [props.recipientName] - DM recipient name (for 'dm' variant)
   * @param {string|Date|number} [props.date] - Date or timestamp
   * @param {('left'|'center')} [props.align='left'] - Text alignment
   * @param {boolean} [props.showDivider=true] - Whether to render divider line
   * @param {boolean} [props.showIcon=true] - Whether to render icon/badge
   * @param {string} [props.iconHtml] - Custom icon HTML override
   */
  function buildModel(props) {
    props = props || {};
    const type = (props.type || 'room').toLowerCase();
    const align = props.align === 'center' ? 'center' : 'left';
    const formattedDate = formatDate(props.date || props.startedDate || props.createdAt);

    let header = '';
    let subtextHtml = '';
    let plainSubtext = '';
    let iconHtml = '';

    if (type === 'dm') {
      const recipient = props.recipientName || props.recipient || 'friend';
      header = 'All friendships start somewhere.';
      subtextHtml = `Conversation with <span class="chat-empty-state__highlight">${escapeHtml(recipient)}</span> <span class="chat-empty-state__bullet" aria-hidden="true">•</span> Started ${escapeHtml(formattedDate)}`;
      plainSubtext = `Conversation with ${recipient} • Started ${formattedDate}`;

      if (props.showIcon !== false) {
        const iconContent = props.iconHtml || '<i class="fa-solid fa-user-group chat-empty-state__icon"></i>';
        iconHtml = `<div class="chat-empty-state__icon-wrap">${iconContent}</div>`;
      }
    } else {
      // Default: "room"
      const roomName = props.roomName || props.room || 'this room';
      const rawCreator = props.creatorUsername || props.creator || 'admin';
      const cleanCreator = String(rawCreator).replace(/^@+/, '');

      header = `This is the start of ${escapeHtml(roomName)}.`;
      subtextHtml = `Created by <span class="chat-empty-state__highlight">@${escapeHtml(cleanCreator)}</span> <span class="chat-empty-state__bullet" aria-hidden="true">•</span> ${escapeHtml(formattedDate)}`;
      plainSubtext = `Created by @${cleanCreator} • ${formattedDate}`;

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
      plainSubtext,
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
   *
   * @param {string|HTMLElement|jQuery} target - Target container or selector
   * @param {Object} props - Component properties
   * @returns {HTMLElement} The created DOM element
   */
  function prependTo(target, props) {
    const el = render(props);
    let container = target;
    if (typeof target === 'string') {
      container = document.querySelector(target);
    } else if (typeof window !== 'undefined' && window.jQuery && target instanceof window.jQuery) {
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
    formatDate: formatDate,
    buildModel: buildModel
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
