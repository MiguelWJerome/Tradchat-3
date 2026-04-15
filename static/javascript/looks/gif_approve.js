// UI/Display layer for GIF Admin Portal
// Handles all visual elements and user interactions

(function() {
    let currentGiphyId = null;
    let currentGifUrl = null;
    let keywordCount = 1;
    let selectedKeyword = null; // Currently selected keyword

    /**
     * Initialize the GIF Admin page
     */
    function init() {
        bindTabEvents();
        bindSearchEvents();
        bindModalEvents();
        bindSocketEvents();
        bindKeywordAutocomplete();
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
            
            // Load keywords when switching to edit tab
            if (tab === 'edit') {
                showInitialKeywords();
                // Reset keyword selection when switching to edit tab
                clearKeywordSelection();
            }
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
    }

    /**
     * Load matching keywords from server for autocomplete
     */
    function loadMatchingKeywords(query = '') {
        const username = GifApproveNetwork.getUsername();
        const password = localStorage.getItem('password');
        if (username && password) {
            GifApproveNetwork.emitGetMatchingKeywords(username, password, query);
        }
    }

    /**
     * Bind keyword autocomplete events
     */
    function bindKeywordAutocomplete() {
        const $input = $('#keyword-autocomplete-input');
        const $suggestions = $('#keyword-suggestions');
        const $clearBtn = $('#clear-keyword-btn');

        // Input typing - request matching keywords from server
        $input.on('input', function() {
            const query = $(this).val().trim();
            loadMatchingKeywords(query);
            
            if (query.length > 0) {
                $clearBtn.show();
            } else {
                $clearBtn.hide();
            }
        });

        // Focus - show all keywords if empty
        $input.on('focus', function() {
            const query = $(this).val().trim();
            loadMatchingKeywords(query);
        });

        // Clear button
        $clearBtn.on('click', function() {
            clearKeywordSelection();
        });

        // Click outside to close suggestions
        $(document).on('click', function(e) {
            if (!$(e.target).closest('.keyword-search-container').length) {
                $suggestions.empty();
            }
        });
    }

    /**
     * Show initial keywords
     */
    function showInitialKeywords() {
        loadMatchingKeywords('');
    }

    /**
     * Render keyword suggestion buttons
     */
    function renderKeywordSuggestions(keywords) {
        const $suggestions = $('#keyword-suggestions');
        $suggestions.empty();

        if (keywords.length === 0) {
            $suggestions.html('<div class="no-keywords">No matching keywords found</div>');
            return;
        }

        keywords.forEach(keyword => {
            const $btn = $('<button class="keyword-suggestion-btn"></button>').text(keyword);
            $btn.on('click', function() {
                selectKeyword(keyword);
            });
            $suggestions.append($btn);
        });
    }

    /**
     * Select a keyword and search for GIFs
     */
    function selectKeyword(keyword) {
        selectedKeyword = keyword;
        
        // Hide input and suggestions, show selected keyword display
        $('#keyword-suggestions').empty();
        $('#keyword-autocomplete-input').hide();
        $('#clear-keyword-btn').show();
        
        // Show selected keyword as glowing blue badge
        const $display = $('#selected-keyword-display');
        $display.find('.selected-keyword-badge').text(keyword);
        $display.show();

        // Search for GIFs with this keyword using stored credentials
        const username = GifApproveNetwork.getUsername();
        const password = localStorage.getItem('password');
        
        const $container = $('#edit-results');
        $container.html('<p>Loading GIFs...</p>');
        
        GifApproveNetwork.emitGifSearch(username, password, keyword);
    }

    /**
     * Clear keyword selection and reset UI
     */
    function clearKeywordSelection() {
        selectedKeyword = null;
        
        $('#keyword-autocomplete-input').val('').show().focus();
        $('#keyword-suggestions').empty();
        $('#clear-keyword-btn').hide();
        $('#selected-keyword-display').hide();
        $('#edit-results').empty();
        
        showInitialKeywords();
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
            const $label = $('<div class="add-label"><i class="fa-solid fa-pen-to-square"></i> Edit / Delete</div>');

            $item.append($img, $label);
            $item.on('click', () => openEditGifModal(giphyId, mediaUrl));
            $container.append($item);
        });
    }

    /**
     * Open modal to edit whitelisted GIF keywords or delete it
     */
    function openEditGifModal(giphyId, gifUrl) {
        currentGiphyId = giphyId;
        currentGifUrl = gifUrl;
        keywordCount = 0;

        // Create modal with loading state
        $('.keyword-modal-overlay').remove();
        const modalHtml = `
            <div class="keyword-modal-overlay">
                <div class="keyword-modal">
                    <h3>Edit GIF Keywords</h3>
                    <div class="gif-preview">
                        <img src="${gifUrl}" />
                    </div>
                    <div id="edit-keywords-loading" class="modal-loading">
                        <i class="fa-solid fa-circle-notch fa-spin"></i> Loading keywords...
                    </div>
                    <div class="keyword-inputs-container" style="display: none;">
                        <!-- Initial rows will be added after keywords load -->
                    </div>
                    <button class="add-more-btn" id="add-more-keywords" style="display: none;">
                        <i class="fa-solid fa-plus"></i> Add another keyword
                    </button>
                    <div class="modal-actions" style="display: none;">
                        <button class="cancel-btn" id="keyword-cancel">Cancel</button>
                        <button class="submit-btn" id="edit-keyword-save">Save Changes</button>
                    </div>
                    <div class="modal-danger-zone" style="display: none;">
                        <hr>
                        <button class="delete-btn-modal" id="edit-keyword-delete">
                            <i class="fa-solid fa-trash"></i> Delete GIF from Whitelist
                        </button>
                    </div>
                </div>
            </div>
        `;

        $('body').append(modalHtml);

        // Fetch current keywords
        const username = GifApproveNetwork.getUsername();
        const password = localStorage.getItem('password');
        GifApproveNetwork.emitGetGifKeywords(username, password, giphyId);
    }

    /**
     * Confirm and delete whitelisted GIF
     */
    function confirmDeleteGif(giphyId) {
        if (!confirm(`Are you sure you want to delete GIF ${giphyId} from the whitelist?`)) return;

        const password = localStorage.getItem('password');
        if (!password) {
            showStatus('Session expired. Please log in again.', 'error');
            return;
        }

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

        $(document).on('click', '#edit-keyword-save', handleUpdateGif);

        $(document).on('click', '#edit-keyword-delete', function() {
            if (currentGiphyId) {
                confirmDeleteGif(currentGiphyId);
            }
        });

        $(document).on('click', '.keyword-modal-overlay', function(e) {
            if (e.target === this) $('.keyword-modal-overlay').remove();
        });
    }

    /**
     * Handle GIF keyword update
     */
    function handleUpdateGif() {
        const keywords = [];
        $('.keyword-inputs-container .keyword-input').each(function() {
            const val = $(this).val().trim();
            if (val) keywords.push(val);
        });

        if (keywords.length < 1) {
            $('.keyword-inputs-container .keyword-input').first().addClass('invalid').focus();
            return;
        }

        const password = localStorage.getItem('password');
        if (!password) {
            showModalError('Session expired. Please log in again.');
            return;
        }

        $('#edit-keyword-save').prop('disabled', true).text('Updating...');
        clearModalError();

        const username = GifApproveNetwork.getUsername();
        GifApproveNetwork.emitUpdateGifKeywords(username, password, currentGiphyId, keywords);
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

        const password = localStorage.getItem('password'); // Use stored password
        if (!password) {
            showModalError('Session expired. Please log in again.');
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
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} removed from whitelist.`, 'success');
                // Refresh search with current keyword if one is selected
                if (selectedKeyword) {
                    const username = GifApproveNetwork.getUsername();
                    const password = localStorage.getItem('password');
                    GifApproveNetwork.emitGifSearch(username, password, selectedKeyword);
                }
            } else {
                showStatus(result.message || 'Failed to delete GIF', 'error');
            }
        });

        GifApproveNetwork.onMatchingKeywordsResult(function(result) {
            if (result.status === 'success') {
                renderKeywordSuggestions(result.keywords || []);
            }
        });

        GifApproveNetwork.onGetGifKeywordsResult(function(result) {
            if (result.status === 'success' && currentGiphyId === result.giphy_id) {
                $('#edit-keywords-loading').hide();
                const $container = $('.keyword-inputs-container');
                $container.empty().show();
                $('#add-more-keywords').show();
                $('.modal-actions').show();
                $('.modal-danger-zone').show();

                if (result.keywords.length === 0) {
                    keywordCount = 1;
                    $container.append(buildKeywordRow(1));
                } else {
                    result.keywords.forEach((kw, i) => {
                        keywordCount = i + 1;
                        const $row = $(buildKeywordRow(keywordCount));
                        $row.find('input').val(kw);
                        $container.append($row);
                    });
                }
            } else if (result.status === 'error') {
                showModalError(result.message || 'Failed to load keywords');
            }
        });

        GifApproveNetwork.onUpdateGifKeywordsResult(function(result) {
            if (result.status === 'success') {
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} updated successfully!`, 'success');
                // Refresh if a keyword is selected
                if (selectedKeyword) {
                    const username = GifApproveNetwork.getUsername();
                    const password = localStorage.getItem('password');
                    GifApproveNetwork.emitGifSearch(username, password, selectedKeyword);
                }
            } else {
                showModalError(result.message || 'Failed to update keywords');
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
