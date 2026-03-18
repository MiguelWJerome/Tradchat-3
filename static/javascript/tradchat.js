function Alert(message, callback=function(){}, shouldFlyUp=false, width=380, height=300, border=5) 
{
    // Determine if device is mobile
    const isOnPhone = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    // Get window dimensions for responsive sizing
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    // Create the dark overlay background
    const alertOverlay = document.createElement('div');
    alertOverlay.style.position = 'fixed';
    alertOverlay.style.top = '0';
    alertOverlay.style.left = '0';
    alertOverlay.style.width = '100%';
    alertOverlay.style.height = '100%';
    alertOverlay.style.backgroundColor = 'black';
    alertOverlay.style.opacity = '0%';
    alertOverlay.style.zIndex = '9998';
    alertOverlay.style.transition = 'none';
    
    // Create the alert content container
    const alertContent = document.createElement('div');
    alertContent.style.position = 'fixed';
    alertContent.style.backgroundColor = '#ffffff';
    alertContent.style.borderRadius = '22.8px';
    alertContent.style.boxShadow = '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)';
    alertContent.style.border = '1px solid rgba(0,0,0,0.1)';
    alertContent.style.zIndex = '9999';
    alertContent.style.transition = 'none';
    alertContent.style.cursor = 'default';
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
    closeButton.innerHTML = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '8px';
    closeButton.style.right = '8px';
    closeButton.style.width = '32px';
    closeButton.style.height = '32px';
    closeButton.style.borderRadius = '50%';
    closeButton.style.border = 'none';
    closeButton.style.backgroundColor = '#f8f9fa';
    closeButton.style.fontSize = '20px';
    closeButton.style.fontWeight = 'normal';
    closeButton.style.color = '#6c757d';
    closeButton.style.cursor = 'pointer';
    closeButton.style.zIndex = '10000';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.title = 'Close alert';
    closeButton.style.transition = 'background-color 0.2s ease, color 0.2s ease';
    
    // Create gray message container
    const messageContainer = document.createElement('div');
    messageContainer.style.backgroundColor = '#e9ecef';
    messageContainer.style.borderRadius = '21.66px'; // Reduced border radius (0.5x)
    messageContainer.style.padding = '20px';
    messageContainer.style.marginTop = '40px'; // Position below X button
    messageContainer.style.marginLeft = 'auto';
    messageContainer.style.marginRight = 'auto';
    messageContainer.style.maxWidth = '85%';
    messageContainer.style.display = 'flex';
    messageContainer.style.alignItems = 'center';
    messageContainer.style.justifyContent = 'center';

    // Create message text element
    const messageElement = document.createElement('p');
    messageElement.id = 'alert-message-text';
    messageElement.style.fontWeight = '500';
    messageElement.style.color = '#212529';
    messageElement.style.textAlign = 'center';
    messageElement.style.margin = '0';
    messageElement.style.lineHeight = '1.5';
    
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
        alertOverlay.style.opacity = '0%';
        setTimeout(function() {
            document.body.removeChild(alertContent);
            document.body.removeChild(alertOverlay);
            callback();
        }, 0);
    }
    
    // Add hover effect for close button
    closeButton.addEventListener('mouseenter', function() {
        closeButton.style.backgroundColor = '#e9ecef';
        closeButton.style.color = '#495057';
    });
    
    closeButton.addEventListener('mouseleave', function() {
        closeButton.style.backgroundColor = '#f8f9fa';
        closeButton.style.color = '#6c757d';
    });
    
    // Add event listeners
    closeButton.addEventListener('click', function(e) {
        e.stopPropagation(); // Prevent the content click from firing
        closeAlert();
    });
    
    // No animation - show immediately
    alertOverlay.style.opacity = '0.9';
}


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