function Alert(message, callback=function(){}, shouldFlyUp=false, width=380, height=300, border=5) 
{
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
    
    // Add to DOM
    document.body.appendChild(alertOverlay);
    document.body.appendChild(alertContent);
    
    // Function to close the alert
    function closeAlert() {
        alertContent.style.bottom = '-3600px';
        alertOverlay.classList.remove('visible');
        setTimeout(function() {
            document.body.removeChild(alertContent);
            document.body.removeChild(alertOverlay);
            callback();
        }, 0);
    }
    
    // Add event listeners
    closeButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the content click from firing
        closeAlert();
    });
    
    // No animation - show immediately (via class)
    alertOverlay.classList.add('visible');
}

const True = true
const False = false


function form(url, dic, method='post')
{
    newForm = document.createElement('form')
    newForm.action = url
    newForm.method = method
    for (var key in dic)
    {
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
        if (!plural) return;
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
                }
            };
            
            resultsList.appendChild(row);
        });
    }
    
    const searchHandler = function(msg) {
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