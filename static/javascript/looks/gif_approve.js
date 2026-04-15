// UI/Display layer for GIF Admin Portal
// Handles all visual elements and user interactions

(function() {
    let currentGiphyId = null;
    let currentGifUrl = null;
    let keywordCount = 1;

    /**
     * Initialize the GIF Admin page
     */
    function init() {
        bindTabEvents();
        bindSearchEvents();
        bindModalEvents();
        bindSocketEvents();
    }

    /**
     * Bind tab switching events
     */
    function bindTabEvents() {
        $('.admin-tab-btn').on('click', function() {
            const tab = $(this).data('tab');
            
            $('.admin-tab-btn').removeClass('active');
            $(this).addClass('active');
            
            $('.tab-content').removeClass('active');
            $(`#${tab}-tab`).addClass('active');
        });
    }

    /**
     * Bind search box events
     */
    function bindSearchEvents() {
        // GIPHY Search
        $('#gif-search-btn').on('click', handleSearch);
        $('#gif-search-input').on('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
        });

        // Local DB Search
        $('#edit-search-btn').on('click', handleLocalSearch);
        $('#edit-search-input').on('keypress', function(e) {
            if (e.key === 'Enter') handleLocalSearch();
        });
    }

    /**
     * Handle GIF search
     */
    async function handleSearch() {
        const query = $('#gif-search-input').val().trim();
        if (!query) return;

        const $container = $('#gif-results');
        $container.html('<p>Searching GIPHY...</p>');

        const limit = $('#gif-limit-input').val() || 50;
        const rating = $('#gif-rating-select').val() || 'g';

        try {
            const results = await GifApproveNetwork.searchGiphy(query, limit, rating);
            renderGifResults(results);
        } catch (err) {
            $container.html(`<p style="color: var(--color-accent);">Search error: ${err.message}</p>`);
        }
    }

    /**
     * Render GIF search results
     */
    function renderGifResults(results) {
        const $container = $('#gif-results');
        $container.empty();

        if (results.length === 0) {
            $container.html('<p>No results found.</p>');
            return;
        }

        results.forEach(gif => {
            const giphyId = gif.id;
            const mediaUrl = gif.images.fixed_height.url.split('?')[0];

            const $item = $('<div class="gif-item"></div>');
            const $img = $('<img>').attr('src', mediaUrl);
            const $label = $('<div class="add-label"><i class="fa-solid fa-plus"></i> Add with Keywords</div>');

            $item.append($img, $label);
            $item.on('click', () => openKeywordModal(giphyId, mediaUrl));
            $container.append($item);
        });
    }

    /**
     * Handle local database GIF search
     */
    function handleLocalSearch() {
        const query = $('#edit-search-input').val().trim();
        if (!query) return;

        const $container = $('#edit-results');
        $container.html('<p>Searching local database...</p>');

        const password = prompt("Enter admin password to search local database:");
        if (!password) {
            $container.html('<p>Password required to search local database.</p>');
            return;
        }

        const username = GifApproveNetwork.getUsername();
        GifApproveNetwork.emitGifSearch(username, password, query);
    }

    /**
     * Render local GIF results
     */
    function renderLocalResults(results) {
        const $container = $('#edit-results');
        $container.empty();

        if (results.length === 0) {
            $container.html('<p>No whitelisted GIFs found matching that keyword.</p>');
            return;
        }

        results.forEach(gif => {
            const giphyId = gif.giphy_id;
            const mediaUrl = `https://media.giphy.com/media/${giphyId}/giphy.gif`;

            const $item = $('<div class="gif-item"></div>');
            const $img = $('<img>').attr('src', mediaUrl);
            const $label = $('<div class="add-label"><i class="fa-solid fa-trash"></i> Delete GIF</div>');

            $item.append($img, $label);
            $item.on('click', () => confirmDeleteGif(giphyId));
            $container.append($item);
        });
    }

    /**
     * Confirm and delete whitelisted GIF
     */
    function confirmDeleteGif(giphyId) {
        if (!confirm(`Are you sure you want to delete GIF ${giphyId} from the whitelist?`)) return;

        const password = prompt("Enter admin password to confirm deletion:");
        if (!password) return;

        const username = GifApproveNetwork.getUsername();
        GifApproveNetwork.emitDeleteGif(username, password, giphyId);
    }

    /**
     * Open keyword input modal
     */
    function openKeywordModal(giphyId, gifUrl) {
        currentGiphyId = giphyId;
        currentGifUrl = gifUrl;
        keywordCount = 1;

        $('.keyword-modal-overlay').remove();

        const modalHtml = `
            <div class="keyword-modal-overlay">
                <div class="keyword-modal">
                    <h3>Add Keywords</h3>
                    <p>Enter at least 1 keyword so users can find this GIF.</p>
                    <div class="gif-preview">
                        <img src="${gifUrl}" />
                    </div>
                    <div class="keyword-inputs-container">
                        ${buildKeywordRow(1)}
                    </div>
                    <button class="add-more-btn" id="add-more-keywords">
                        <i class="fa-solid fa-plus"></i> Add another keyword
                    </button>
                    <div class="password-input">
                        <input type="password" id="admin-password" placeholder="Enter your password" />
                    </div>
                    <div class="modal-actions">
                        <button class="cancel-btn" id="keyword-cancel">Cancel</button>
                        <button class="submit-btn" id="keyword-submit">Add GIF</button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);
        $('.keyword-inputs-container .keyword-input').first().focus();
    }

    /**
     * Build a keyword input row
     */
    function buildKeywordRow(index) {
        const removeBtn = index > 1
            ? '<button class="remove-btn"><i class="fa-solid fa-xmark"></i></button>'
            : '';
        return `
            <div class="keyword-input-row">
                <input type="text" class="keyword-input" placeholder="Keyword ${index}" />
                ${removeBtn}
            </div>
        `;
    }

    /**
     * Bind modal events
     */
    function bindModalEvents() {
        $(document).on('click', '#add-more-keywords', function() {
            keywordCount++;
            const $row = $(buildKeywordRow(keywordCount));
            $('.keyword-inputs-container').append($row);
            $row.find('.keyword-input').focus();
        });

        $(document).on('click', '.remove-btn', function() {
            $(this).closest('.keyword-input-row').remove();
        });

        $(document).on('click', '#keyword-cancel', function() {
            $('.keyword-modal-overlay').remove();
        });

        $(document).on('click', '#keyword-submit', handleSubmitGif);

        $(document).on('click', '.keyword-modal-overlay', function(e) {
            if (e.target === this) $('.keyword-modal-overlay').remove();
        });
    }

    /**
     * Handle GIF submission
     */
    function handleSubmitGif() {
        const keywords = [];
        $('.keyword-inputs-container .keyword-input').each(function() {
            const val = $(this).val().trim();
            if (val) keywords.push(val);
        });

        if (keywords.length < 1) {
            $('.keyword-inputs-container .keyword-input').first().addClass('invalid').focus();
            return;
        }

        const password = $('#admin-password').val().trim();
        if (!password) {
            showModalError('Password is required');
            return;
        }

        $('#keyword-submit').prop('disabled', true).text('Adding...');
        clearModalError();

        const username = GifApproveNetwork.getUsername();
        GifApproveNetwork.emitAddGif(username, password, currentGiphyId, keywords);
    }

    /**
     * Bind socket events
     */
    function bindSocketEvents() {
        GifApproveNetwork.onAddGifResult(function(result) {
            if (result.status === 'success') {
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} added successfully!`, 'success');
            } else {
                showModalError(result.message || 'Failed to add GIF');
            }
        });

        GifApproveNetwork.onGifSearchResults(function(result) {
            if (result.status === 'success') {
                renderLocalResults(result.results);
            } else {
                $('#edit-results').html(`<p style="color: var(--color-accent);">${result.message || 'Search failed'}</p>`);
            }
        });

        GifApproveNetwork.onDeleteGifResult(function(result) {
            if (result.status === 'success') {
                showStatus(`GIF ${result.giphy_id} removed from whitelist.`, 'success');
                handleLocalSearch();
            } else {
                showStatus(result.message || 'Failed to delete GIF', 'error');
            }
        });
    }

    /**
     * Status and Error Helpers
     */
    function showStatus(message, type) {
        const $status = $('#gif-status-msg');
        $status.text(message).removeClass('success error').addClass(type);
        setTimeout(() => $status.removeClass('success error'), 4000);
    }

    function showModalError(message) {
        clearModalError();
        $('.keyword-modal').prepend(`<div class="modal-error">${message}</div>`);
        $('#keyword-submit').prop('disabled', false).text('Add GIF');
    }

    function clearModalError() {
        $('.modal-error').remove();
    }

    $(document).ready(init);
})();
