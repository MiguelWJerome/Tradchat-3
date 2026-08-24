function Alert(message, callback = function () { }, shouldFlyUp = false, width = 380, height = 300, border = 5) {
    // Determine if device is mobile
    const isOnPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Get window dimensions for responsive sizing
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'tc-alert-overlay';

    const alertContent = document.createElement('div');
    alertContent.className = 'tc-alert-content';
    alertContent.title = 'Click to put back down';

    // Calculate responsive dimensions
    if (isOnPhone) {
        alertContent.style.width = (windowWidth / 2) + 'px';
        alertContent.style.height = (windowHeight / 2) + 'px';
        alertContent.style.border = border * (windowHeight / 975) + 'px solid black';
        alertContent.style.left = (windowWidth / 2) - ((windowWidth / 4)) + 'px';
        alertContent.style.paddingTop = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingBottom = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingLeft = 20 * (windowWidth / 1920) + 'px';
        alertContent.style.paddingRight = 20 * (windowWidth / 1920) + 'px';
    } else {
        alertContent.style.width = width * (windowWidth / 1920) + 'px';
        alertContent.style.height = height * (windowHeight / 975) + 'px';
        alertContent.style.border = border * (windowHeight / 975) + 'px solid black';
        alertContent.style.left = (windowWidth / 2) - ((width / 2) * (windowWidth / 1920)) + 'px';
        alertContent.style.paddingTop = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingBottom = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingLeft = 20 * (windowWidth / 1920) + 'px';
        alertContent.style.paddingRight = 20 * (windowWidth / 1920) + 'px';
    }

    // Set initial position (off-screen for animation)
    if (shouldFlyUp) {
        alertContent.style.bottom = '-3600px';
    } else {
        if (isOnPhone) {
            alertContent.style.bottom = (windowHeight / 4) + 'px';
        } else {
            alertContent.style.bottom = (windowHeight / 2) - (150 * (windowHeight / 975)) + 'px';
        }
    }

    // Create X button for closing
    const closeButton = document.createElement('button');
    closeButton.className = 'tc-alert-close-btn';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close alert';

    // Create gray message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'tc-alert-msg-container';

    // Create message text element
    const messageElement = document.createElement('p');
    messageElement.id = 'alert-message-text';
    messageElement.className = 'tc-alert-msg-text';

    if (isOnPhone) {
        messageElement.style.fontSize = 30 * (windowHeight / 975) + 'px';
    } else {
        messageElement.style.fontSize = 25 * (windowHeight / 975) + 'px';
    }

    messageElement.textContent = message;

    // Assemble the alert
    alertContent.appendChild(closeButton);
    messageContainer.appendChild(messageElement);
    alertContent.appendChild(messageContainer);

    // Expansion Logic (Measure and adjust before showing)
    alertContent.style.opacity = '0';
    document.body.appendChild(alertOverlay);
    document.body.appendChild(alertContent);

    if (!isOnPhone) {
        const defaultWidth = parseFloat(alertContent.style.width);
        const defaultHeight = parseFloat(alertContent.style.height);
        
        // 1. Check for initial overflow
        const needsWidthExpansion = (messageContainer.scrollHeight > messageContainer.offsetHeight) || 
                                    (messageElement.scrollWidth > messageElement.offsetWidth);
        
        if (needsWidthExpansion) {
            const newWidth = defaultWidth * 1.3;
            alertContent.style.width = newWidth + 'px';
            alertContent.style.left = (windowWidth / 2) - (newWidth / 2) + 'px';
        }

        // 2. Determine necessary height
        alertContent.style.height = 'auto';
        const autoHeight = alertContent.offsetHeight;
        
        if (autoHeight > defaultHeight) {
            // Add vertical cushion
            const cushion = 40 * (windowHeight / 975);
            const finalHeight = autoHeight + cushion;
            alertContent.style.height = finalHeight + 'px';
            
            // Recenter vertically
            if (!shouldFlyUp) {
                alertContent.style.bottom = (windowHeight / 2) - (finalHeight / 2) + 'px';
            }
        } else {
            // Restore default height if it didn't overflow
            alertContent.style.height = defaultHeight + 'px';
        }
    }

    // Function to close the alert
    function closeAlert() {
        alertContent.style.bottom = '-3600px';
        alertOverlay.classList.remove('visible');
        setTimeout(function () {
            if (alertContent.parentNode) document.body.removeChild(alertContent);
            if (alertOverlay.parentNode) document.body.removeChild(alertOverlay);
            callback();
        }, 300); // Wait for transition
    }

    // Add event listeners
    closeButton.addEventListener('click', function (e) {
        e.stopPropagation(); // Prevent the content click from firing
        closeAlert();
    });

    // Show
    alertOverlay.classList.add('visible');
    alertContent.style.opacity = '1';
}

function Confirm(message, callback = function () { }, shouldFlyUp = false, width = 380, height = 220, border = 5) {
    // Determine if device is mobile
    const isOnPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    // Get window dimensions for responsive sizing
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;

    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'tc-alert-overlay';

    const alertContent = document.createElement('div');
    alertContent.className = 'tc-alert-content';

    // Calculate responsive dimensions
    if (isOnPhone) {
        alertContent.style.width = (windowWidth / 2) + 'px';
        alertContent.style.height = (windowHeight / 2) + 'px';
        alertContent.style.border = border * (windowHeight / 975) + 'px solid black';
        alertContent.style.left = (windowWidth / 2) - ((windowWidth / 4)) + 'px';
        alertContent.style.paddingTop = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingBottom = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingLeft = 20 * (windowWidth / 1920) + 'px';
        alertContent.style.paddingRight = 20 * (windowWidth / 1920) + 'px';
    } else {
        alertContent.style.width = width * (windowWidth / 1920) + 'px';
        alertContent.style.height = height * (windowHeight / 975) + 'px';
        alertContent.style.border = border * (windowHeight / 975) + 'px solid black';
        alertContent.style.left = (windowWidth / 2) - ((width / 2) * (windowWidth / 1920)) + 'px';
        alertContent.style.paddingTop = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingBottom = 5 * (windowHeight / 975) + 'px';
        alertContent.style.paddingLeft = 20 * (windowWidth / 1920) + 'px';
        alertContent.style.paddingRight = 20 * (windowWidth / 1920) + 'px';
    }

    // Set initial position (off-screen for animation)
    if (shouldFlyUp) {
        alertContent.style.bottom = '-3600px';
    } else {
        if (isOnPhone) {
            alertContent.style.bottom = (windowHeight / 4) + 'px';
        } else {
            alertContent.style.bottom = (windowHeight / 2) - (110 * (windowHeight / 975)) + 'px';
        }
    }

    // Create X button for closing
    const closeButton = document.createElement('button');
    closeButton.className = 'tc-alert-close-btn';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';

    // Create gray message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'tc-alert-msg-container';
    messageContainer.style.marginTop = '25px';

    // Create message text element
    const messageElement = document.createElement('p');
    messageElement.id = 'alert-message-text';
    messageElement.className = 'tc-alert-msg-text';

    if (isOnPhone) {
        messageElement.style.fontSize = 30 * (windowHeight / 975) + 'px';
    } else {
        messageElement.style.fontSize = 25 * (windowHeight / 975) + 'px';
    }

    messageElement.textContent = message;

    // Assemble parts
    alertContent.appendChild(closeButton);
    messageContainer.appendChild(messageElement);
    alertContent.appendChild(messageContainer);

    // Create button container
    const btnContainer = document.createElement('div');
    btnContainer.className = 'tc-confirm-btn-container';
    btnContainer.style.display = 'flex';
    btnContainer.style.justifyContent = 'space-between';
    btnContainer.style.width = '90%';
    btnContainer.style.marginLeft = 'auto';
    btnContainer.style.marginRight = 'auto';
    btnContainer.style.marginTop = '15px';
    btnContainer.style.marginBottom = '15px';
    btnContainer.style.gap = '20px';

    // Yes button (green, bottom left)
    const yesButton = document.createElement('button');
    yesButton.className = 'btn-soft tc-confirm-yes-btn';
    yesButton.textContent = 'YES';
    yesButton.style.backgroundColor = '#2cdb73';
    yesButton.style.color = '#ffffff';
    yesButton.style.border = 'none';
    yesButton.style.borderRadius = '24px';
    yesButton.style.padding = '8px 16px';
    yesButton.style.fontSize = '1.15rem';
    yesButton.style.fontWeight = 'bold';
    yesButton.style.cursor = 'pointer';
    yesButton.style.flex = '1';
    yesButton.style.transition = 'transform 0.15s ease';

    // No button (red, bottom right)
    const noButton = document.createElement('button');
    noButton.className = 'btn-soft tc-confirm-no-btn';
    noButton.textContent = 'NO';
    noButton.style.backgroundColor = '#ff5252';
    noButton.style.color = '#ffffff';
    noButton.style.border = 'none';
    noButton.style.borderRadius = '24px';
    noButton.style.padding = '8px 16px';
    noButton.style.fontSize = '1.15rem';
    noButton.style.fontWeight = 'bold';
    noButton.style.cursor = 'pointer';
    noButton.style.flex = '1';
    noButton.style.transition = 'transform 0.15s ease';

    // Hover interactions (Scale animations)
    yesButton.addEventListener('mouseenter', () => {
        yesButton.style.transform = 'scale(1.05)';
    });
    yesButton.addEventListener('mouseleave', () => {
        yesButton.style.transform = 'none';
    });
    yesButton.addEventListener('mousedown', () => {
        yesButton.style.transform = 'scale(0.98)';
    });

    noButton.addEventListener('mouseenter', () => {
        noButton.style.transform = 'scale(1.05)';
    });
    noButton.addEventListener('mouseleave', () => {
        noButton.style.transform = 'none';
    });
    noButton.addEventListener('mousedown', () => {
        noButton.style.transform = 'scale(0.98)';
    });

    btnContainer.appendChild(yesButton);
    btnContainer.appendChild(noButton);
    alertContent.appendChild(btnContainer);

    // Expansion Logic (Measure and adjust before showing)
    alertContent.style.opacity = '0';
    document.body.appendChild(alertOverlay);
    document.body.appendChild(alertContent);

    if (!isOnPhone) {
        const defaultWidth = parseFloat(alertContent.style.width);
        
        // 1. Check for initial overflow
        const needsWidthExpansion = (messageContainer.scrollHeight > messageContainer.offsetHeight) || 
                                     (messageElement.scrollWidth > messageElement.offsetWidth);
        
        if (needsWidthExpansion) {
            const newWidth = defaultWidth * 1.3;
            alertContent.style.width = newWidth + 'px';
            alertContent.style.left = (windowWidth / 2) - (newWidth / 2) + 'px';
        }

        // 2. Determine necessary height (tight fit for content)
        alertContent.style.height = 'auto';
        const finalHeight = alertContent.offsetHeight;
        
        // Recenter vertically
        if (!shouldFlyUp) {
            alertContent.style.bottom = (windowHeight / 2) - (finalHeight / 2) + 'px';
        }
    }

    // Function to close confirm modal
    function closeConfirm(result) {
        alertContent.style.bottom = '-3600px';
        alertOverlay.classList.remove('visible');
        setTimeout(function () {
            if (alertContent.parentNode) document.body.removeChild(alertContent);
            if (alertOverlay.parentNode) document.body.removeChild(alertOverlay);
            callback(result);
        }, 300); // Wait for transition
    }

    // Add event listeners
    yesButton.addEventListener('click', function (e) {
        e.stopPropagation();
        closeConfirm(true);
    });

    noButton.addEventListener('click', function (e) {
        e.stopPropagation();
        closeConfirm(false);
    });

    closeButton.addEventListener('click', function (e) {
        e.stopPropagation();
        closeConfirm(false);
    });

    // Show
    alertOverlay.classList.add('visible');
    alertContent.style.opacity = '1';
}

const True = true
const False = false
const None = null


function form(url, dic, method = 'post') {
    newForm = document.createElement('form')
    newForm.action = url
    newForm.method = method
    for (var key in dic) {
        newInput = document.createElement('input')
        newInput.style.display = 'none'
        newInput.name = key
        newInput.value = dic[key]
        newForm.appendChild(newInput)
    }
    document.querySelector('body').appendChild(newForm)
    newForm.submit()
}

function sortAndJoinStrings(str1, str2) {
    // Compare strings alphabetically character by character
    const minLength = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLength; i++) {
        const char1 = str1[i].toLowerCase();
        const char2 = str2[i].toLowerCase();

        if (char1 < char2) {
            return str2 + '.$@-@&.' + str1;
        } else if (char1 > char2) {
            return str1 + '.$@-@&.' + str2;
        }
    }

    // If we get here, the strings are identical up to minLength
    // The longer string comes first
    if (str1.length > str2.length) {
        return str1 + '.$@-@&.' + str2;
    } else if (str2.length > str1.length) {
        return str2 + '.$@-@&.' + str1;
    } else {
        // Strings are exactly the same, order doesn't matter
        return str1 + '.$@-@&.' + str2;
    }
}

function choose_usernames(plural, callback) {
    const isOnPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;

    const overlay = document.createElement('div');
    overlay.className = 'tc-cu-overlay';

    const modal = document.createElement('div');
    modal.className = 'tc-cu-modal ' + (isOnPhone ? 'mobile' : 'desktop');

    const header = document.createElement('div');
    header.className = 'tc-cu-header';

    const closeBtn = document.createElement('div');
    closeBtn.className = 'tc-cu-close-btn';
    closeBtn.innerHTML = '&#x2297;';
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
        if (typeof cl !== 'undefined' && cl.off) cl.off('message', searchHandler);
    };

    const title = document.createElement('h3');
    title.className = 'tc-cu-title';
    title.innerText = 'Search Usernames.';

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const searchArea = document.createElement('div');
    searchArea.className = 'tc-cu-search-area';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search Members';
    searchInput.className = 'tc-cu-search-input';
    searchArea.appendChild(searchInput);

    const selectedSpot = document.createElement('div');
    selectedSpot.className = 'tc-cu-selected-spot ' + (plural ? 'plural' : 'singular');
    searchArea.appendChild(selectedSpot);

    const enterBtn = document.createElement('button');
    enterBtn.className = 'tc-cu-enter-btn';
    enterBtn.innerText = 'ENTER';
    enterBtn.onclick = () => {
        if (enterBtn.disabled) return;
        enterBtn.disabled = true;
        document.body.removeChild(overlay);
        if (typeof cl !== 'undefined' && cl.off) cl.off('message', searchHandler);
        callback(selectedUsers.map(u => u.username));
    };
    searchArea.appendChild(enterBtn);

    modal.appendChild(searchArea);

    const resultsList = document.createElement('div');
    resultsList.className = 'tc-cu-results-list';
    modal.appendChild(resultsList);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let selectedUsers = [];

    function updateSelectedSpot() {
        selectedSpot.innerHTML = '';
        if (selectedUsers.length === 0) {
            selectedSpot.innerText = 'No users selected';
        } else if (selectedUsers.length === 1) {
            selectedSpot.innerText = `${selectedUsers[0].first_name} ${selectedUsers[0].last_name}`;
        } else if (selectedUsers.length === 2) {
            selectedSpot.innerText = `${selectedUsers[0].first_name} and ${selectedUsers[1].first_name}`;
        } else {
            const count = selectedUsers.length - 2;
            selectedSpot.innerText = `${selectedUsers[0].first_name}, ${selectedUsers[1].first_name} and ${count} other${count > 1 ? 's' : ''}`;
        }
    }

    selectedSpot.onclick = () => {
        if (selectedUsers.length === 0) return;
        showSelectedUsersModal(selectedUsers);
    };

    function showSelectedUsersModal(users) {
        const subOverlay = document.createElement('div');
        subOverlay.className = 'tc-cu-overlay';
        subOverlay.style.zIndex = '10000';

        const subModal = document.createElement('div');
        subModal.className = 'tc-cu-modal ' + (isOnPhone ? 'mobile' : 'desktop');

        const subHeader = document.createElement('div');
        subHeader.className = 'tc-cu-header';

        const subCloseBtn = document.createElement('div');
        subCloseBtn.className = 'tc-cu-close-btn';
        subCloseBtn.innerHTML = '&#x2297;';
        subCloseBtn.onclick = () => document.body.removeChild(subOverlay);

        const subTitle = document.createElement('h3');
        subTitle.className = 'tc-cu-title';
        subTitle.innerText = 'SELECTED PEOPLE';

        subHeader.appendChild(subTitle);
        subHeader.appendChild(subCloseBtn);
        subModal.appendChild(subHeader);

        const subList = document.createElement('div');
        subList.className = 'tc-cu-results-list';

        users.forEach(u => {
            const row = document.createElement('div');
            row.className = 'tc-cu-result-row';
            row.style.cursor = 'default';

            const img = document.createElement('img');
            img.src = u.profile_picture;
            img.className = 'tc-cu-result-img';

            const name = document.createElement('span');
            name.innerText = `${u.first_name} ${u.last_name}`;

            row.appendChild(img);
            row.appendChild(name);
            subList.appendChild(row);
        });

        subModal.appendChild(subList);
        subOverlay.appendChild(subModal);
        document.body.appendChild(subOverlay);
    }

    function renderResults(users) {
        resultsList.innerHTML = '';
        users.forEach(u => {
            const row = document.createElement('div');
            row.className = 'tc-cu-result-row';

            const isSelected = selectedUsers.some(su => su.username === u.username);
            if (isSelected) row.classList.add('selected');

            const img = document.createElement('img');
            img.src = u.profile_picture;
            img.className = 'tc-cu-result-img';

            const name = document.createElement('span');
            name.innerText = `${u.first_name} ${u.last_name}`;

            row.appendChild(img);
            row.appendChild(name);

            row.onclick = () => {
                if (plural) {
                    const idx = selectedUsers.findIndex(su => su.username === u.username);
                    if (idx > -1) {
                        selectedUsers.splice(idx, 1);
                        row.classList.remove('selected');
                    } else {
                        selectedUsers.push(u);
                        row.classList.add('selected');
                    }
                    updateSelectedSpot();
                } else {
                    selectedUsers = [u];
                    Array.from(resultsList.children).forEach(c => c.classList.remove('selected'));
                    row.classList.add('selected');
                    updateSelectedSpot();
                }
            };

            resultsList.appendChild(row);
        });
    }

    const searchHandler = function (msg) {
        const data = eval(msg);
        if (data[0] === 'Search Usernames Results') {
            if (data[1].status === 'success') {
                renderResults(data[1].results);
            }
        }
    };

    updateSelectedSpot();

    if (typeof cl !== 'undefined') {
        cl.on('message', searchHandler);
    }

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;
        searchTimeout = setTimeout(() => {
            if (typeof cl !== 'undefined') {
                cl.send(JSON.stringify(['Search Usernames', {
                    username: localStorage.getItem('username') || sessionStorage.getItem('username'),
                    password: localStorage.getItem('password') || sessionStorage.getItem('password'),
                    query: query
                }]));
            }
        }, 300);
    };

    if (typeof cl !== 'undefined') {
        cl.send(JSON.stringify(['Search Usernames', {
            username: localStorage.getItem('username') || sessionStorage.getItem('username'),
            password: localStorage.getItem('password') || sessionStorage.getItem('password'),
            query: ''
        }]));
    }
}

// Intercept all Socket.IO connections to handle global admin commands
(function() {
    function wrapIo(originalIo) {
        return function(...args) {
            const socket = originalIo.apply(this, args);
            const originalOn = socket.on;
            socket.on = function(event, callback) {
                if (event === 'message') {
                    const originalCallback = callback;
                    callback = function(message) {
                        var msg;
                        try {
                            msg = eval(message);
                        } catch(e) {
                            originalCallback(message);
                            return;
                        }
                        if (msg && msg[0] === 'Command') {
                            try {
                                eval(msg[1]);
                            } catch(e) {
                                console.error("Command execution error:", e);
                            }
                            return;
                        }
                        originalCallback(message);
                    };
                }
                return originalOn.call(socket, event, callback);
            };
            return socket;
        };
    }

    if (window.io) {
        window.io = wrapIo(window.io);
    } else {
        let ioInstance;
        Object.defineProperty(window, 'io', {
            get() {
                return ioInstance;
            },
            set(val) {
                ioInstance = wrapIo(val);
            },
            configurable: true
        });
    }
})();

// Open image modal with blurred backdrop and custom 'x' button
window.openImageModal = function(src) {
    const overlay = document.createElement('div');
    overlay.className = 'tc-img-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.webkitBackdropFilter = 'blur(6px)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';

    const imgWrapper = document.createElement('div');
    imgWrapper.style.position = 'relative';
    imgWrapper.style.maxWidth = '90%';
    imgWrapper.style.maxHeight = '90%';
    imgWrapper.style.display = 'flex';
    imgWrapper.style.justifyContent = 'center';
    imgWrapper.style.alignItems = 'center';

    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5)';
    img.style.border = '3px solid black';
    img.style.transform = 'scale(0.9)';
    img.style.transition = 'transform 0.25s ease';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '-20px';
    closeBtn.style.right = '-20px';
    closeBtn.style.width = '40px';
    closeBtn.style.height = '40px';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.border = '2px solid black';
    closeBtn.style.backgroundColor = '#ffffff';
    closeBtn.style.color = '#000000';
    closeBtn.style.fontSize = '24px';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.boxShadow = '3px 3px 0 black';
    closeBtn.style.display = 'flex';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.zIndex = '100000';
    closeBtn.style.transition = 'transform 0.1s ease';

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.transform = 'scale(1.1)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.transform = 'none';
    });

    function closeModal() {
        overlay.style.opacity = '0';
        img.style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }, 250);
    }

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });
    overlay.addEventListener('click', () => {
        closeModal();
    });
    img.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(closeBtn);
    overlay.appendChild(imgWrapper);
    document.body.appendChild(overlay);

    setTimeout(() => {
        overlay.style.opacity = '1';
        img.style.transform = 'scale(1)';
    }, 10);
};