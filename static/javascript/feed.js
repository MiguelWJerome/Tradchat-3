/* ==============================================================================
 * 🔮 FUTURE INFINITE SCROLL & FEED RANKING ALGORITHM PLACEHOLDER
 * ==============================================================================
 * CURRENT IMPLEMENTATION:
 * - Simple threshold-based scroll listener (window.scrollY + window.innerHeight)
 * - Two-tier server-side ranking (Friends-First -> Other community members)
 * - Cursor offset-based pagination via /api/feed/posts?offset=...&limit=...
 *
 * 🛑 CRITICAL ARCHITECTURAL DIRECTIVE FROM MICHAEL (CREATOR OF TRADCHAT):
 * ATTENTION FUTURE AI AGENT OR DEVELOPER WORKING ON THIS CODEBASE:
 * THIS IS MICHAEL, THE WEBSITE CREATOR. I AM WRITING THIS HERE TO WARN YOU
 * IN THE FUTURE: DO NOT, UNDER ANY CIRCUMSTANCES, SUBJECT USER POST QUERIES
 * (WHEN ?user=... IS IN THE URL) TO ANY ALGORITHM!
 * WHEN VIEWING A SPECIFIC USER'S POSTS, IT IS STRICTLY A PURE, UNALTERED
 * CHRONOLOGICAL LIST (NEWEST AT TOP) OF ALL OF THAT USER'S POSTS.
 * WE ARE ONLY REUSING THE FEED PAGE TEMPLATE SO WE DO NOT HAVE TO CODE A SEPARATE
 * USER POSTS PAGE. IT IS NOT A "FEED". DO NOT SUBJECT IT TO RECOMMENDATION
 * ALGORITHMS. ANY FUTURE ALGORITHM MUST ONLY EVER RUN ON THE GENERAL FEED!
 *
 * FUTURE ALGORITHM SPECIFICATION (FOR GENERAL FEED ONLY):
 * When scaling the feed, replace this baseline with a streaming ranking engine:
 * 1. Client-side DOM node recycling (virtualized scroll lists for 60fps mobile)
 * 2. Real-time WebSocket prepend (live friend status broadcast without polling)
 * 3. Machine-learning engagement weights (love velocity, discussion depth)
 * 4. Cursor-based tokens to eliminate pagination drift during concurrent posts
 * ============================================================================== */

// Global Feed State
let activePostId = null;
let currentReplyParentId = null;
let attachedFiles = [];
let isCommentsPanelOpen = true; // Open by default on desktop, syncs with active post
let isFetchingNextPage = false;
let currentFeedOffset = 0;
let hasMoreFeedPosts = true;

const postsMap = new Map();

// In-memory JavaScript Map to hold comments per post (lives in runtime memory, zero network lag)
const feedCommentsMemoryCache = new Map();
const preloadingPostIds = new Set();
let scrollRafId = null;

document.addEventListener('DOMContentLoaded', () => {
  // Read embedded initial posts data from JSON script tag
  const initialDataElem = document.getElementById('initial-posts-data');
  let initialPosts = [];
  if (initialDataElem) {
    try {
      initialPosts = JSON.parse(initialDataElem.textContent);
    } catch (e) {
      console.error('Error parsing initial posts data:', e);
    }
  }

  currentFeedOffset = initialPosts.length;
  initialPosts.forEach(p => {
    postsMap.set(p.id, p);
    // Preload initial posts' comments into runtime JavaScript memory cache
    feedCommentsMemoryCache.set(p.id, p.comments || []);
  });

  // 1. Initialize Active Post & Comments Panel
  const firstCard = findPostInMainView() || document.querySelector('.feed-post-card');
  if (firstCard) {
    const firstId = parseInt(firstCard.getAttribute('data-post-id'), 10);
    setActivePost(firstId, false);
    alignCommentsPanelWithCard(firstCard);
    // Preload upcoming comments for the next 10 posts in memory ahead of time
    preloadUpcomingComments(firstId);
  } else if (initialPosts.length > 0) {
    setActivePost(initialPosts[0].id, false);
    preloadUpcomingComments(initialPosts[0].id);
  } else {
    const commentsPanel = document.getElementById('feedCommentsPanel');
    if (commentsPanel) commentsPanel.classList.add('hidden');
  }

  // 2. Set up smooth scroll auto-sync, card alignment & dual capture listeners
  setupScrollListeners();

  // 3. Set up Composer File Input listener (if present)
  const fileInput = document.getElementById('composerFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleComposerFilesSelected);
  }
});

/* -------------------------------------------------------------
 * 1:1 Media Carousel Navigation
 * ------------------------------------------------------------- */
function navigateCarousel(postId, direction) {
  const container = document.getElementById(`carousel-container-${postId}`);
  if (!container) return;

  const totalSlides = parseInt(container.getAttribute('data-total-slides'), 10);
  let currentIndex = parseInt(container.getAttribute('data-current-index'), 10);
  const newIndex = currentIndex + direction;

  if (newIndex < 0 || newIndex >= totalSlides) return;
  goToCarouselSlide(postId, newIndex);
}

function goToCarouselSlide(postId, targetIndex) {
  const container = document.getElementById(`carousel-container-${postId}`);
  if (!container) return;

  const totalSlides = parseInt(container.getAttribute('data-total-slides'), 10);
  if (targetIndex < 0 || targetIndex >= totalSlides) return;

  // Update slides visibility
  const slides = container.querySelectorAll('.carousel-slide');
  slides.forEach((slide, idx) => {
    if (idx === targetIndex) {
      slide.classList.add('active');
    } else {
      slide.classList.remove('active');
    }
  });

  // Update dots
  const dotsRow = document.getElementById(`carousel-dots-${postId}`);
  if (dotsRow) {
    const dots = dotsRow.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
      if (idx === targetIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // Update arrows disabled state per Julianne's rule
  const leftArrow = container.querySelector('.carousel-arrow.arrow-left');
  const rightArrow = container.querySelector('.carousel-arrow.arrow-right');
  if (leftArrow) {
    if (targetIndex === 0) leftArrow.classList.add('disabled');
    else leftArrow.classList.remove('disabled');
  }
  if (rightArrow) {
    if (targetIndex === totalSlides - 1) rightArrow.classList.add('disabled');
    else rightArrow.classList.remove('disabled');
  }

  container.setAttribute('data-current-index', targetIndex);
}

/* -------------------------------------------------------------
 * Fullscreen Lightbox Expansion
 * ------------------------------------------------------------- */
function expandCurrentMedia(postId) {
  const container = document.getElementById(`carousel-container-${postId}`);
  if (!container) return;
  const activeSlide = container.querySelector('.carousel-slide.active');
  if (!activeSlide) return;

  const mediaType = activeSlide.getAttribute('data-media-type');
  const mediaUrl = activeSlide.getAttribute('data-media-url');
  openLightbox(mediaUrl, mediaType);
}

function openLightbox(mediaUrl, mediaType) {
  const lightbox = document.getElementById('feedLightbox');
  const content = document.getElementById('feedLightboxContent');
  if (!lightbox || !content) return;

  content.innerHTML = '';
  if (mediaType === 'video' || (mediaUrl && mediaUrl.match(/\.(mp4|webm|mov)$/i))) {
    const video = document.createElement('video');
    video.src = mediaUrl;
    video.controls = true;
    video.autoplay = true;
    video.className = 'lightbox-video';
    content.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = mediaUrl;
    img.alt = 'Expanded photo';
    img.className = 'lightbox-img';
    content.appendChild(img);
  }

  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
  if (event && event.target && event.target.closest('#feedLightboxContent')) {
    return; // Don't close if clicking inside media content
  }
  const lightbox = document.getElementById('feedLightbox');
  if (!lightbox) return;
  lightbox.classList.remove('open');
  document.getElementById('feedLightboxContent').innerHTML = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

/* -------------------------------------------------------------
 * Caption Expand/Collapse (...See More)
 * ------------------------------------------------------------- */
function toggleCaption(postId) {
  const textElem = document.getElementById(`caption-text-${postId}`);
  if (!textElem) return;
  const btn = textElem.nextElementSibling;
  if (textElem.classList.contains('collapsed')) {
    textElem.classList.remove('collapsed');
    if (btn) btn.textContent = '...See Less';
  } else {
    textElem.classList.add('collapsed');
    if (btn) btn.textContent = '...See More';
  }
}

/* -------------------------------------------------------------
 * Focal Viewport Calculation & Contextual Comments Panel
 * ------------------------------------------------------------- */

/**
 * Accurately determines which post card is in the main focal area of the viewport.
 * Uses a combination of visible viewport height and proximity of the post's header
 * to the comfortable reading line (160px from top below navbar).
 */
function findPostInMainView() {
  const cards = Array.from(document.querySelectorAll('.feed-post-card'));
  if (!cards.length) return null;

  const navbarHeight = 80;
  const viewportHeight = window.innerHeight;
  const readingLine = navbarHeight + 80; // 160px from top

  let bestCard = null;
  let maxScore = -Infinity;

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const visibleTop = Math.max(navbarHeight, rect.top);
    const visibleBottom = Math.min(viewportHeight, rect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    if (visibleHeight <= 0) continue;

    // Score based on visible height + bonus for header approaching reading line
    const distToReadingLine = Math.abs(rect.top - readingLine);
    const headerBonus = Math.max(0, (viewportHeight * 0.6) - distToReadingLine);
    const score = visibleHeight + headerBonus * 1.5;

    if (score > maxScore) {
      maxScore = score;
      bestCard = card;
    }
  }

  return bestCard || cards[0];
}

/**
 * Dynamically aligns the comments panel vertically with the active post card.
 * Uses hardware-accelerated GPU transform for smooth gliding.
 */
function alignCommentsPanelWithCard(card) {
  const panel = document.getElementById('feedCommentsPanel');
  if (!panel || !card || !isCommentsPanelOpen) return;

  // On narrow screens <= 960px, CSS media query handles fixed bottom drawer
  if (window.innerWidth <= 960) {
    panel.style.transform = '';
    return;
  }

  const rect = card.getBoundingClientRect();
  const minTop = 96; // 80px navbar + 16px padding
  const maxTop = Math.max(minTop, window.innerHeight - 380);
  const targetTop = Math.max(minTop, Math.min(Math.round(rect.top), maxTop));
  // GPU accelerated glide transition relative to sticky top: 96px
  const offsetY = Math.max(0, targetTop - 96);

  panel.style.transform = `translateY(${offsetY}px)`;
  panel.style.maxHeight = `calc(100vh - ${targetTop + 24}px)`;
}

/**
 * Universal toggle for comments:
 * - If comments are open and user clicks the active post's comments -> closes universally.
 * - If comments are open and user clicks another post -> focuses that post and keeps comments open.
 * - If comments are closed -> opens universally and focuses the clicked post.
 */
function togglePostComments(postId) {
  if (isCommentsPanelOpen) {
    if (activePostId === postId) {
      closeCommentsPanel();
    } else {
      setActivePost(postId, true);
    }
  } else {
    openCommentsPanel();
    setActivePost(postId, true);
  }
}

// Backward compatibility alias
function activatePostComments(postId) {
  togglePostComments(postId);
}

function openCommentsPanel() {
  const panel = document.getElementById('feedCommentsPanel');
  if (!panel) return;
  isCommentsPanelOpen = true;
  panel.classList.remove('hidden');
}

function closeCommentsPanel() {
  const panel = document.getElementById('feedCommentsPanel');
  if (panel) {
    panel.classList.add('hidden');
  }
  isCommentsPanelOpen = false;

  // Remove comments-active visual highlight from all action buttons
  document.querySelectorAll('.post-action-btn.comments-active').forEach(btn => {
    btn.classList.remove('comments-active');
  });
}

/**
 * Sets the active focused post, aligns the comments panel, and renders comments from memory.
 */
function setActivePost(postId, shouldScroll = false) {
  const post = postsMap.get(postId);
  if (!post) return;

  activePostId = postId;
  currentReplyParentId = null;
  cancelReplyTarget();

  // Highlight active post card
  document.querySelectorAll('.feed-post-card').forEach(card => {
    card.classList.remove('active-focused-post');
  });
  const activeCard = document.getElementById(`post-card-${postId}`);
  if (activeCard) {
    activeCard.classList.add('active-focused-post');
    if (shouldScroll) {
      activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (isCommentsPanelOpen) {
      alignCommentsPanelWithCard(activeCard);
    }
  }

  // Update active comments button styling
  document.querySelectorAll('.post-action-btn.comments-active').forEach(btn => {
    btn.classList.remove('comments-active');
  });
  if (isCommentsPanelOpen) {
    const activeBtn = document.getElementById(`post-comments-toggle-btn-${postId}`);
    if (activeBtn) activeBtn.classList.add('comments-active');
  }

  // Update comments panel
  const panel = document.getElementById('feedCommentsPanel');
  if (panel && isCommentsPanelOpen) {
    panel.classList.remove('hidden');
    const title = document.getElementById('commentsPanelTitle');
    if (title) title.textContent = `Replies to ${post.author.name}`;
    renderCommentsForActivePost(postId, post.author.name);
  }
}

/**
 * Renders comments for the active post. Checks runtime in-memory JavaScript cache first
 * for instant 0ms rendering without user wait time.
 */
async function renderCommentsForActivePost(postId, authorName) {
  const body = document.getElementById('commentsPanelBody');
  if (!body) return;

  // 1. Instant check in runtime JavaScript memory cache
  let comments = feedCommentsMemoryCache.get(postId);

  if (comments === undefined) {
    // Show smooth skeleton only if not yet in cache
    body.innerHTML = `
      <div style="text-align: center; color: #888; padding: 36px 10px;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.4rem; color: var(--color-medium); margin-bottom: 8px;"></i>
        <p style="font-size: 0.88rem;">Loading replies...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/feed/posts/${postId}/comments/`);
      const data = await res.json();
      if (data.status === 'success') {
        comments = data.comments || [];
        feedCommentsMemoryCache.set(postId, comments);
        const p = postsMap.get(postId);
        if (p) p.comments = comments;
      } else {
        comments = [];
      }
    } catch (e) {
      console.error('Error fetching comments for post:', e);
      comments = [];
    }
  }

  // Ensure active post hasn't switched while awaiting async fetch
  if (activePostId !== postId) return;

  if (!comments || comments.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; color: #888; padding: 40px 10px;">
        <p style="font-size: 0.95rem; margin-bottom: 6px;">No replies yet.</p>
        <span style="font-size: 0.82rem;">Be the first to share your thoughts with ${escapeHtml(authorName)}!</span>
      </div>
    `;
  } else {
    body.innerHTML = comments.map(c => renderCommentItemHtml(c)).join('');
  }

  // Trigger smooth glide-in animation for comments
  body.classList.remove('gliding');
  void body.offsetWidth; // Force CSS reflow to restart animation
  body.classList.add('gliding');
}

/**
 * Preloads comments for the next 10 upcoming posts into runtime JavaScript memory ahead of time.
 */
async function preloadUpcomingComments(currentPostId) {
  const cards = Array.from(document.querySelectorAll('.feed-post-card'));
  const currentIdx = cards.findIndex(c => parseInt(c.getAttribute('data-post-id'), 10) === currentPostId);
  const startIdx = currentIdx >= 0 ? currentIdx + 1 : 0;
  const upcomingCards = cards.slice(startIdx, startIdx + 10);

  for (const card of upcomingCards) {
    const pid = parseInt(card.getAttribute('data-post-id'), 10);
    if (!pid || feedCommentsMemoryCache.has(pid) || preloadingPostIds.has(pid)) continue;

    preloadingPostIds.add(pid);
    try {
      const res = await fetch(`/api/feed/posts/${pid}/comments/`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          feedCommentsMemoryCache.set(pid, data.comments || []);
          const post = postsMap.get(pid);
          if (post) post.comments = data.comments || [];
        }
      }
    } catch (e) {
      // Silently catch background preloading error
    } finally {
      preloadingPostIds.delete(pid);
    }
  }
}

function renderCommentItemHtml(comment) {
  const lovesCount = comment.loves_count || 0;
  const isLoved = comment.user_reaction === 'love';
  const hasReplies = comment.replies && comment.replies.length > 0;

  return `
    <div class="comment-item" id="comment-node-${comment.id}">
      <div class="comment-main-row">
        <img src="${comment.author.pfp}" alt="${escapeHtml(comment.author.name)}" class="comment-avatar" onerror="this.src='/static/graphics/defaultMale.png'">
        <div class="comment-bubble">
          <div class="comment-bubble-header">
            <span class="comment-author-name">${escapeHtml(comment.author.name)}</span>
            ${comment.author.is_friend ? '<span class="friend-badge">Friend</span>' : ''}
          </div>
          <div class="comment-text">${escapeHtml(comment.content)}</div>
        </div>
      </div>

      <!-- Action links row (Reply & Heart) -->
      <div class="comment-actions-row">
        <button type="button" class="comment-action-link" onclick="setReplyTarget(${comment.id}, '${escapeHtml(comment.author.name)}');">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 14 4 9 9 4"></polyline>
            <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
          </svg>
          Reply
        </button>

        <button type="button" class="comment-action-link comment-heart-btn ${isLoved ? 'loved' : ''}" id="comment-love-btn-${comment.id}" onclick="toggleCommentLove(${comment.id});">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span id="comment-love-count-${comment.id}">${lovesCount > 0 ? lovesCount : ''}</span>
        </button>
      </div>

      <!-- Nested replies & show/hide toggle -->
      ${hasReplies ? `
        <button type="button" class="comment-replies-toggle-btn" id="replies-toggle-btn-${comment.id}" onclick="toggleRepliesCollapsible(${comment.id});">
          Hide replies ▲
        </button>
        <div class="comment-replies-thread" id="replies-thread-${comment.id}">
          ${comment.replies.map(r => renderCommentItemHtml(r)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function toggleRepliesCollapsible(commentId) {
  const thread = document.getElementById(`replies-thread-${commentId}`);
  const btn = document.getElementById(`replies-toggle-btn-${commentId}`);
  if (!thread || !btn) return;

  if (thread.style.display === 'none') {
    thread.style.display = 'flex';
    btn.textContent = 'Hide replies ▲';
  } else {
    thread.style.display = 'none';
    btn.textContent = 'Show replies ▼';
  }
}

function setReplyTarget(commentId, authorName) {
  currentReplyParentId = commentId;
  const chip = document.getElementById('replyingTargetChip');
  const chipText = document.getElementById('replyingTargetText');
  const input = document.getElementById('commentInputField');
  if (chip && chipText && input) {
    chipText.textContent = `Replying to @${authorName}`;
    chip.style.display = 'inline-flex';
    input.placeholder = `Write a reply to ${authorName}...`;
    input.focus();
  }
}

function cancelReplyTarget() {
  currentReplyParentId = null;
  const chip = document.getElementById('replyingTargetChip');
  const input = document.getElementById('commentInputField');
  if (chip) chip.style.display = 'none';
  if (input) input.placeholder = 'Write a reply...';
}

/* -------------------------------------------------------------
 * Reactions (Post Love, Post Dislike & Comment Love)
 * ------------------------------------------------------------- */
async function togglePostLove(postId) {
  await togglePostReaction(postId, 'love');
}

async function togglePostDislike(postId) {
  await togglePostReaction(postId, 'dislike');
}

async function togglePostReaction(postId, reactionType) {
  try {
    const loveBtn = document.getElementById(`post-love-btn-${postId}`);
    const loveCount = document.getElementById(`post-love-count-${postId}`);
    const dislikeBtn = document.getElementById(`post-dislike-btn-${postId}`);
    const dislikeCount = document.getElementById(`post-dislike-count-${postId}`);

    const res = await fetch(`/api/feed/posts/${postId}/react/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: reactionType })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const rxn = data.reaction_data;

      // Update Love button state & count
      if (loveBtn) {
        if (rxn.user_reaction === 'love') {
          loveBtn.classList.add('loved');
        } else {
          loveBtn.classList.remove('loved');
        }
      }
      if (loveCount) loveCount.textContent = rxn.loves_count;

      // Update Dislike button state & count
      if (dislikeBtn) {
        if (rxn.user_reaction === 'dislike') {
          dislikeBtn.classList.add('disliked');
        } else {
          dislikeBtn.classList.remove('disliked');
        }
      }
      if (dislikeCount) dislikeCount.textContent = rxn.dislikes_count;

      // Update in-memory database map
      const post = postsMap.get(postId);
      if (post) {
        post.loves_count = rxn.loves_count;
        post.dislikes_count = rxn.dislikes_count;
        post.user_reaction = rxn.user_reaction;
      }
    }
  } catch (err) {
    console.error('Error toggling reaction:', err);
  }
}

async function toggleCommentLove(commentId) {
  try {
    const btn = document.getElementById(`comment-love-btn-${commentId}`);
    const countSpan = document.getElementById(`comment-love-count-${commentId}`);
    const res = await fetch(`/api/feed/comments/${commentId}/react/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: 'love' })
    });
    const data = await res.json();
    if (data.status === 'success') {
      const rxn = data.reaction_data;
      if (rxn.user_reaction === 'love') {
        btn.classList.add('loved');
      } else {
        btn.classList.remove('loved');
      }
      countSpan.textContent = rxn.loves_count > 0 ? rxn.loves_count : '';
    }
  } catch (err) {
    console.error('Error toggling comment love:', err);
  }
}

/* -------------------------------------------------------------
 * Submitting a Comment or Nested Reply
 * ------------------------------------------------------------- */
async function submitActiveComment() {
  if (!activePostId) return;
  const input = document.getElementById('commentInputField');
  const content = input.value.trim();
  if (!content) return;

  try {
    const payload = {
      content: content,
      parent_comment_id: currentReplyParentId
    };

    const res = await fetch(`/api/feed/posts/${activePostId}/comments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.status === 'success') {
      input.value = '';
      cancelReplyTarget();

      // Refresh post comments in local database & in-memory runtime cache
      const post = postsMap.get(activePostId);
      if (post) {
        if (!post.comments) post.comments = [];
        if (payload.parent_comment_id) {
          attachReplyToParent(post.comments, payload.parent_comment_id, data.comment);
        } else {
          post.comments.push(data.comment);
        }
        post.comments_count = (post.comments_count || 0) + 1;
        feedCommentsMemoryCache.set(activePostId, post.comments);
        const countElem = document.getElementById(`post-comments-count-${activePostId}`);
        if (countElem) countElem.textContent = post.comments_count;
        renderCommentsForActivePost(activePostId, post.author.name);
      }
    } else {
      alert(data.message || 'Failed to post reply.');
    }
  } catch (err) {
    console.error('Error submitting reply:', err);
  }
}

function attachReplyToParent(commentsList, parentId, newReply) {
  for (const c of commentsList) {
    if (c.id === parentId) {
      if (!c.replies) c.replies = [];
      c.replies.push(newReply);
      return true;
    }
    if (c.replies && c.replies.length > 0) {
      if (attachReplyToParent(c.replies, parentId, newReply)) return true;
    }
  }
  return false;
}

/* -------------------------------------------------------------
 * Composer: Attach Media & Publish New Post
 * ------------------------------------------------------------- */
const FEED_ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'webm', 'mov']);

function handleComposerFilesSelected(e) {
  const files = Array.from(e.target.files);
  const validFiles = [];
  const rejectedFiles = [];

  files.forEach(file => {
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
    const isAllowedExt = FEED_ALLOWED_EXTENSIONS.has(ext);
    const isAllowedMime = !file.type || file.type.startsWith('image/') || file.type.startsWith('video/');

    if (isAllowedExt && isAllowedMime) {
      validFiles.push(file);
    } else {
      rejectedFiles.push(file.name || 'unnamed file');
    }
  });

  if (rejectedFiles.length > 0) {
    alert(`Only pictures (PNG, JPG, GIF, WEBP) and videos (MP4, WEBM, MOV) are allowed.\n\nThe following file(s) were rejected:\n- ${rejectedFiles.join('\n- ')}`);
    e.target.value = '';
  }

  if (validFiles.length > 0) {
    attachedFiles = attachedFiles.concat(validFiles);
    renderComposerPreviews();
  }
}

function renderComposerPreviews() {
  const container = document.getElementById('composerPreviews');
  if (!container) return;

  if (attachedFiles.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = '';

  attachedFiles.forEach((file, idx) => {
    const item = document.createElement('div');
    item.className = 'composer-preview-item';

    if (file.type.startsWith('video/')) {
      const vid = document.createElement('video');
      vid.src = URL.createObjectURL(file);
      item.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      item.appendChild(img);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'composer-preview-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
      attachedFiles.splice(idx, 1);
      renderComposerPreviews();
    };
    item.appendChild(removeBtn);

    container.appendChild(item);
  });
}

async function publishPost() {
  const textElem = document.getElementById('composerText');
  const content = textElem.value.trim();
  const publishBtn = document.getElementById('composerPublishBtn');

  if (!content && attachedFiles.length === 0) {
    alert('Please enter a caption or attach media.');
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = 'Posting...';

  try {
    const formData = new FormData();
    formData.append('content', content);
    attachedFiles.forEach(file => {
      formData.append('files', file);
    });

    const res = await fetch('/api/feed/posts/', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.status === 'success') {
      textElem.value = '';
      attachedFiles = [];
      renderComposerPreviews();
      // Reload feed to fetch updated friends-first post stream
      window.location.reload();
    } else {
      alert(data.message || 'Failed to publish post.');
      publishBtn.disabled = false;
      publishBtn.textContent = 'Post';
    }
  } catch (err) {
    console.error('Error publishing post:', err);
    publishBtn.disabled = false;
    publishBtn.textContent = 'Post';
  }
}

/* -------------------------------------------------------------
 * Infinite Scroll & Dynamic Alignment Event Listeners
 * ------------------------------------------------------------- */
let feedIntersectionObserver = null;

function setupScrollListeners() {
  const handler = () => {
    if (scrollRafId) return;
    scrollRafId = requestAnimationFrame(() => {
      scrollRafId = null;
      handleWindowScroll();
    });
  };

  // Capture on window, document, and document.body
  ['scroll', 'wheel', 'touchmove'].forEach(evt => {
    window.addEventListener(evt, handler, { passive: true, capture: true });
    document.addEventListener(evt, handler, { passive: true, capture: true });
    if (document.body) {
      document.body.addEventListener(evt, handler, { passive: true, capture: true });
    }
  });

  window.addEventListener('resize', () => {
    const activeCard = activePostId ? document.getElementById(`post-card-${activePostId}`) : findPostInMainView();
    if (activeCard) {
      alignCommentsPanelWithCard(activeCard);
    }
  }, { passive: true });

  // Secondary dual trigger: IntersectionObserver guarantees post change detection
  if ('IntersectionObserver' in window) {
    feedIntersectionObserver = new IntersectionObserver((entries) => {
      handleWindowScroll();
    }, {
      root: null,
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });

    document.querySelectorAll('.feed-post-card').forEach(card => {
      feedIntersectionObserver.observe(card);
    });
  }
}

function handleWindowScroll() {
  updateInViewPostAndComments();

  if (isFetchingNextPage || !hasMoreFeedPosts) return;

  const currentScrollY = window.scrollY || document.documentElement.scrollTop || (document.body ? document.body.scrollTop : 0);
  const scrollPos = window.innerHeight + currentScrollY;
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0
  );
  const threshold = docHeight - 500;

  if (scrollPos >= threshold) {
    fetchNextFeedPage();
  }
}

let scrollSettleTimer = null;

function updateInViewPostAndComments() {
  const mainCard = findPostInMainView();
  if (!mainCard) return;

  const postId = parseInt(mainCard.getAttribute('data-post-id'), 10);
  if (!postId) return;

  if (isCommentsPanelOpen) {
    if (postId !== activePostId) {
      // Switched to a new post: immediately glide panel and update comments
      setActivePost(postId, false);
      preloadUpcomingComments(postId);
      alignCommentsPanelWithCard(mainCard);
    } else {
      // Within the same active post: smoothly settle alignment when scrolling pauses
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(() => {
        const currentCard = findPostInMainView();
        if (currentCard) alignCommentsPanelWithCard(currentCard);
      }, 70);
    }
  }
}

async function fetchNextFeedPage() {
  isFetchingNextPage = true;
  const loader = document.getElementById('infiniteScrollTrigger');
  if (loader) loader.style.display = 'flex';

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const filterUser = urlParams.get('user') || urlParams.get('author');
    let fetchUrl = `/api/feed/posts/?limit=10&offset=${currentFeedOffset}`;
    if (filterUser) {
      fetchUrl += `&user=${encodeURIComponent(filterUser)}`;
    }

    const res = await fetch(fetchUrl);
    const data = await res.json();

    if (data.status === 'success' && data.posts && data.posts.length > 0) {
      currentFeedOffset += data.posts.length;
      data.posts.forEach(p => {
        if (!postsMap.has(p.id)) {
          postsMap.set(p.id, p);
          // Preload newly fetched posts into in-memory comments cache
          feedCommentsMemoryCache.set(p.id, p.comments || []);
          appendPostCardToFeed(p);
        }
      });
      // Preload the upcoming comments in background
      if (activePostId) {
        preloadUpcomingComments(activePostId);
      }
    } else {
      hasMoreFeedPosts = false;
      if (loader) loader.innerHTML = '<span>You have reached the end of the feed.</span>';
    }
  } catch (err) {
    console.error('Error loading next feed page:', err);
  } finally {
    isFetchingNextPage = false;
    if (loader && hasMoreFeedPosts) loader.style.display = 'none';
  }
}

function appendPostCardToFeed(post) {
  const stream = document.getElementById('feedPostsStream');
  if (!stream) return;

  const card = document.createElement('article');
  card.className = 'feed-post-card';
  card.id = `post-card-${post.id}`;
  card.setAttribute('data-post-id', post.id);
  card.setAttribute('data-author-name', post.author.name);

  const hasMultipleMedia = post.media && post.media.length > 1;
  const mediaHtml = post.media && post.media.length > 0 ? `
    <div class="feed-media-container" id="carousel-container-${post.id}" data-current-index="0" data-total-slides="${post.media.length}">
      ${post.media.map((m, idx) => `
        <div class="carousel-slide ${idx === 0 ? 'active' : ''}" data-slide-index="${idx}" data-media-type="${m.type}" data-media-url="${m.url}">
          ${m.type === 'video' ? `
            <video class="carousel-media-element" controls playsinline preload="metadata">
              <source src="${m.url}">
            </video>
          ` : `
            <img src="${m.url}" alt="Post attachment" class="carousel-media-element" onclick="openLightbox('${m.url}', 'image');">
          `}
        </div>
      `).join('')}

      <button type="button" class="media-expand-btn" title="Expand media" onclick="expandCurrentMedia(${post.id});">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </button>

      ${hasMultipleMedia ? `
        <button type="button" class="carousel-arrow arrow-left disabled" onclick="navigateCarousel(${post.id}, -1);">&#10216;</button>
        <button type="button" class="carousel-arrow arrow-right" onclick="navigateCarousel(${post.id}, 1);">&#10217;</button>
      ` : ''}
    </div>

    ${hasMultipleMedia ? `
      <div class="carousel-dots-row" id="carousel-dots-${post.id}">
        ${post.media.map((m, idx) => `
          <span class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="goToCarouselSlide(${post.id}, ${idx});"></span>
        `).join('')}
      </div>
    ` : ''}
  ` : '';

  card.innerHTML = `
    <div class="post-header-row">
      <div class="post-author-block">
        <img src="${post.author.pfp}" alt="${escapeHtml(post.author.name)}" class="post-avatar" onerror="this.src='/static/graphics/defaultMale.png'">
        <div class="post-author-meta">
          <div class="post-author-name-wrap">
            <span class="post-author-name">${escapeHtml(post.author.name)}</span>
            ${post.author.is_friend ? '<span class="friend-badge">Friend</span>' : ''}
          </div>
          <span class="post-timestamp">${post.created_at}</span>
        </div>
      </div>
    </div>

    ${post.content ? `
      <div class="post-caption-wrap">
        <span class="post-caption-text ${post.content.length > 180 ? 'collapsed' : ''}" id="caption-text-${post.id}">
          ${escapeHtml(post.content)}
        </span>
        ${post.content.length > 180 ? `<button type="button" class="post-see-more-btn" onclick="toggleCaption(${post.id});">...See More</button>` : ''}
      </div>
    ` : ''}

    ${mediaHtml}

    <div class="post-actions-bar">
      <button type="button" class="post-action-btn ${post.user_reaction === 'love' ? 'loved' : ''}" id="post-love-btn-${post.id}" onclick="togglePostLove(${post.id});" title="Love">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span id="post-love-count-${post.id}">${post.loves_count}</span>
      </button>

      <button type="button" class="post-action-btn ${post.user_reaction === 'dislike' ? 'disliked' : ''}" id="post-dislike-btn-${post.id}" onclick="togglePostDislike(${post.id});" title="Dislike">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
        </svg>
        <span id="post-dislike-count-${post.id}">${post.dislikes_count || 0}</span>
      </button>

      <button type="button" class="post-action-btn" id="post-comments-toggle-btn-${post.id}" onclick="togglePostComments(${post.id});" title="Comments">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span id="post-comments-count-${post.id}">${post.comments_count}</span>
      </button>
    </div>
  `;

  const loader = document.getElementById('infiniteScrollTrigger');
  stream.insertBefore(card, loader);
  if (feedIntersectionObserver) {
    feedIntersectionObserver.observe(card);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
