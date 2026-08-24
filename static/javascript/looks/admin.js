// UI/Display layer for Admin Portal
// Handles all visual elements, list rendering, tab switching, and event interactions

(function() {
    let currentGiphyId = null;
    let currentGifUrl = null;
    let keywordCount = 1;
    let selectedKeyword = null; // Currently selected keyword for whitelist search

    // --- DOMContentLoaded Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        const menuItems = document.querySelectorAll('.menu-item');
        const contentPane = document.getElementById('adminContentPane');

        const updateBadgeDot = (unseenCount) => {
            const dot = document.querySelector('[data-target="alerts"] .badge-dot');
            if (dot) {
                dot.style.display = unseenCount > 0 ? 'inline-block' : 'none';
            }
        };

        const loadAlerts = () => {
            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="alerts-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i> Loading alerts...
                    </div>
                </div>
            `;
            AdminNetwork.fetchAlerts()
                .then(data => {
                    if (data.status === 'success') {
                        updateBadgeDot(data.unseen_count);
                        renderAlertsList(data.alerts);
                    } else {
                        contentPane.innerHTML = `
                            <div class="tab-view active">
                                <div class="error-view">
                                    <i class="fa-solid fa-triangle-exclamation"></i>
                                    <h3>Error Loading Alerts</h3>
                                    <p>${data.message || 'Unknown error occurred.'}</p>
                                </div>
                            </div>
                        `;
                    }
                })
                .catch(err => {
                    contentPane.innerHTML = `
                        <div class="tab-view active">
                            <div class="error-view">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                                <h3>Error Loading Alerts</h3>
                                <p>Failed to communicate with the server.</p>
                            </div>
                        </div>
                    `;
                });
        };

        const renderAlertsList = (alerts) => {
            if (alerts.length === 0) {
                contentPane.innerHTML = `
                    <div class="tab-view active">
                        <div class="placeholder-view">
                            <i class="fa-solid fa-bell-slash"></i>
                            <h3>All Quiet</h3>
                            <p>No system alerts at this time.</p>
                        </div>
                    </div>
                `;
                return;
            }

            let alertsHtml = alerts.map(alert => {
                const isRead = alert.seen === 1 || alert.seen === true;
                const readClass = isRead ? 'read' : '';
                const buttonLabel = isRead ? 'Mark as Unread' : 'Mark as Read';
                return `
                    <div class="alert-box ${readClass}" id="alert-box-${alert.id}">
                        <div class="alert-content-wrapper">
                            <div class="alert-icon-container">
                                <i class="fa-solid fa-triangle-exclamation warning-icon"></i>
                            </div>
                            <div class="alert-text">${alert.text}</div>
                        </div>
                        <div class="alert-actions">
                            <button class="btn-soft alert-btn mark-read-btn" onclick="markAsRead(${alert.id})">${buttonLabel}</button>
                            <button class="btn-soft alert-btn resolve-btn" onclick="resolveAlert(${alert.id})">Resolve</button>
                        </div>
                    </div>
                `;
            }).join('');

            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="alerts-header">
                        <h3>System Alerts</h3>
                        <span class="alerts-count">${alerts.length} Active</span>
                    </div>
                    <div class="alerts-list">
                        ${alertsHtml}
                    </div>
                </div>
            `;
        };

        window.markAsRead = (alertId) => {
            AdminNetwork.markAlertAsRead(alertId)
                .then(data => {
                    if (data.status === 'success') {
                        updateBadgeDot(data.unseen_count);
                        loadAlerts();
                    } else {
                        alert('Failed to mark alert as read: ' + data.message);
                    }
                });
        };

        window.resolveAlert = (alertId) => {
            const box = document.getElementById(`alert-box-${alertId}`);
            if (box) {
                box.classList.add('resolving');
            }
            AdminNetwork.resolveAlert(alertId)
                .then(data => {
                    if (data.status === 'success') {
                        updateBadgeDot(data.unseen_count);
                        setTimeout(() => {
                            loadAlerts();
                        }, 300);
                    } else {
                        if (box) box.classList.remove('resolving');
                        alert('Failed to resolve alert: ' + data.message);
                    }
                })
                .catch(err => {
                    if (box) box.classList.remove('resolving');
                    alert('Failed to connect to the server');
                });
        };

        const updateReportsBadgeDot = (unseenCount) => {
            const dot = document.querySelector('[data-target="reports"] .badge-dot');
            if (dot) {
                dot.style.display = unseenCount > 0 ? 'inline-block' : 'none';
            }
        };

        const loadReports = () => {
            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="alerts-loading">
                        <i class="fa-solid fa-spinner fa-spin"></i> Loading reports...
                    </div>
                </div>
            `;
            AdminNetwork.fetchReports()
                .then(data => {
                    if (data.status === 'success') {
                        updateReportsBadgeDot(data.unseen_count);
                        renderReportsList(data.reports);
                    } else {
                        contentPane.innerHTML = `
                            <div class="tab-view active">
                                <div class="error-view">
                                    <i class="fa-solid fa-triangle-exclamation"></i>
                                    <h3>Error Loading Reports</h3>
                                    <p>${data.message || 'Unknown error occurred.'}</p>
                                </div>
                            </div>
                        `;
                    }
                })
                .catch(err => {
                    contentPane.innerHTML = `
                        <div class="tab-view active">
                            <div class="error-view">
                                <i class="fa-solid fa-triangle-exclamation"></i>
                                <h3>Error Loading Reports</h3>
                                <p>Failed to communicate with the server.</p>
                            </div>
                        </div>
                    `;
                });
        };

        const renderReportsList = (reports) => {
            if (reports.length === 0) {
                contentPane.innerHTML = `
                    <div class="tab-view active">
                        <div class="placeholder-view">
                            <i class="fa-solid fa-bell-slash"></i>
                            <h3>All Clear</h3>
                            <p>No user reports at this time.</p>
                        </div>
                    </div>
                `;
                return;
            }

            let reportsHtml = reports.map(report => {
                const isRead = report.seen === 1 || report.seen === true;
                const readClass = isRead ? 'read' : '';
                const buttonLabel = isRead ? 'Mark as Unread' : 'Mark as Read';
                return `
                    <div class="alert-box ${readClass}" id="report-box-${report.id}">
                        <div class="alert-content-wrapper">
                            <div class="alert-icon-container">
                                <i class="fa-solid fa-circle-exclamation warning-icon"></i>
                            </div>
                            <div class="alert-text">
                                <strong>Reporter:</strong> ${report.reporter}<br/>
                                <div style="margin-top: 5px; white-space: pre-wrap;">${report.text}</div>
                            </div>
                        </div>
                        <div class="alert-actions">
                            <button class="btn-soft alert-btn mark-read-btn" onclick="markReportAsRead(${report.id})">${buttonLabel}</button>
                            <button class="btn-soft alert-btn resolve-btn" onclick="resolveReport(${report.id})">Resolve</button>
                        </div>
                    </div>
                `;
            }).join('');

            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="alerts-header">
                        <h3>User Reports</h3>
                        <span class="alerts-count">${reports.length} Active</span>
                    </div>
                    <div class="alerts-list">
                        ${reportsHtml}
                    </div>
                </div>
            `;
        };

        window.markReportAsRead = (reportId) => {
            AdminNetwork.markReportAsRead(reportId)
                .then(data => {
                    if (data.status === 'success') {
                        updateReportsBadgeDot(data.unseen_count);
                        loadReports();
                    } else {
                        alert('Failed to mark report as read: ' + data.message);
                    }
                });
        };

        window.resolveReport = (reportId) => {
            const box = document.getElementById(`report-box-${reportId}`);
            if (box) {
                box.classList.add('resolving');
            }
            AdminNetwork.resolveReport(reportId)
                .then(data => {
                    if (data.status === 'success') {
                        updateReportsBadgeDot(data.unseen_count);
                        setTimeout(() => {
                            loadReports();
                        }, 300);
                    } else {
                        if (box) box.classList.remove('resolving');
                        alert('Failed to resolve report: ' + data.message);
                    }
                })
                .catch(err => {
                    if (box) box.classList.remove('resolving');
                    alert('Failed to connect to the server');
                });
        };

        const loadActionZone = () => {
            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="action-zone-view">
                        <!-- Header Title -->
                        <div class="az-header">
                            <div class="az-title-grp">
                                <h2>ACTION ZONE</h2>
                            </div>
                        </div>

                        <!-- Section 1: User Specific Actions -->
                        <div class="az-section">
                            <div class="az-section-header">
                                <i class="fa-solid fa-user-gear"></i>
                                <h3>1. ADMIN ACTIONS (USER-SPECIFIC)</h3>
                            </div>
                            
                            <div class="az-target-panel">
                                <div class="az-select-grp">
                                    <label>SELECT TARGET USER</label>
                                    <button type="button" class="az-btn btn-primary" id="az-choose-user-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                        <i class="fa-solid fa-magnifying-glass"></i> Choose User
                                    </button>
                                </div>

                                <div class="az-active-target-card">
                                    <div class="az-card-label">ACTIVE TARGET</div>
                                    <div class="az-card-body">
                                        <div class="az-target-info">
                                            <img id="az-target-pfp" src="/static/graphics/defaultMale.png" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';" class="az-target-pfp" />
                                            <h4 id="az-target-name">None</h4>
                                        </div>
                                        <span class="az-status-badge status-inactive" id="az-target-status">Inactive</span>
                                    </div>
                                </div>
                            </div>

                            <!-- 2 Column Actions Grid -->
                            <div class="az-actions-grid">
                                <!-- Send Pop-Up Message -->
                                <div class="az-action-card">
                                    <div class="card-title">
                                        <i class="fa-solid fa-comment-dots"></i>
                                        SEND POP-UP MESSAGE
                                    </div>
                                    <div class="card-body">
                                        <textarea id="popup-message-text" placeholder="Enter alert message text..." rows="2" class="az-textarea"></textarea>
                                        <button class="btn-primary az-btn" onclick="dispatchMessage()">DISPATCH MESSAGE</button>
                                    </div>
                                </div>

                                <!-- Freeze Account -->
                                <div class="az-action-card">
                                    <div class="card-title">
                                        <i class="fa-solid fa-user-lock"></i>
                                        FREEZE ACCOUNT
                                    </div>
                                    <div class="card-body card-body-flex">
                                        <button class="btn-warning az-btn" onclick="freezeAccount()" id="freeze-btn">FREEZE</button>
                                    </div>
                                </div>

                                <!-- Force Redirect / Reload -->
                                <div class="az-action-card">
                                    <div class="card-title">
                                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                                        FORCE REDIRECT / RELOAD
                                    </div>
                                    <div class="card-body">
                                        <div class="az-input-action-grp">
                                            <input type="text" id="redirect-url" value="/home/" class="az-input" placeholder="Redirect URL...">
                                            <button class="btn-icon" onclick="reloadUserRedirect()" title="Reset default redirect URL">
                                                <i class="fa-solid fa-rotate-left"></i>
                                            </button>
                                        </div>
                                        <button class="btn-primary az-btn" onclick="redirectUser()">REDIRECT USER</button>
                                    </div>
                                </div>

                                <!-- Delete Account -->
                                <div class="az-action-card">
                                    <div class="card-title">
                                        <i class="fa-solid fa-user-slash"></i>
                                        DELETE ACCOUNT
                                    </div>
                                    <div class="card-body card-body-flex">
                                        <button class="btn-danger az-btn" onclick="purgeAccount()">DELETE ACCOUNT</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Pending Approval Queue -->
                        <div class="az-section">
                            <div class="az-section-header">
                                <div class="header-title-left">
                                    <h3>PENDING ADMIN REQUESTS</h3>
                                </div>
                            </div>

                            <div class="table-responsive">
                                <table class="az-table">
                                    <thead>
                                        <tr>
                                            <th>REQUESTER</th>
                                            <th>TARGET USER</th>
                                            <th>PROPOSED ACTION</th>
                                            <th>VOTE PROGRESS</th>
                                            <th>DECIDE</th>
                                        </tr>
                                    </thead>
                                    <tbody id="az-queue-body">
                                        <!-- Empty Queue -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Set up choose user button click
            const chooseUserBtn = document.getElementById('az-choose-user-btn');
            if (chooseUserBtn) {
                chooseUserBtn.addEventListener('click', () => {
                    if (typeof choose_usernames === 'function') {
                        choose_usernames(false, (usernames) => {
                            if (usernames && usernames.length > 0) {
                                const username = usernames[0];
                                document.az_active_username = username;
                                AdminNetwork.emitGetTargetAdminData(username);
                            }
                        });
                    } else {
                        alert('User search function is loading or not available.');
                    }
                });
            }
            AdminNetwork.emitGetAdminRequests();
        };

        window.dispatchMessage = () => {
            const msg = document.getElementById('popup-message-text').value.trim();
            const user = document.az_active_username;
            if (!user || user === 'None') {
                alert('Please select a target user first.');
                return;
            }
            if (!msg) {
                alert('Please enter a message text before dispatching.');
                return;
            }
            const command = `Alert(${JSON.stringify(msg)});`;
            if (typeof AdminNetwork !== 'undefined' && typeof AdminNetwork.emitDispatchCommand === 'function') {
                AdminNetwork.emitDispatchCommand(user, command);
            }
            alert(`Message dispatched to ${user}: "${msg}"`);
            document.getElementById('popup-message-text').value = '';
        };

        window.freezeAccount = () => {
            const user = document.az_active_username;
            if (!user || user === 'None') {
                alert('Please select a target user first.');
                return;
            }
            const statusBadge = document.getElementById('az-target-status');
            const isCurrentlyFrozen = statusBadge.classList.contains('status-inactive');
            const actionType = isCurrentlyFrozen ? 'unfreeze' : 'freeze';

            const confirmMsg = `Are you sure you want to propose to ${actionType} account ${user}? This requires 2 admins to approve.`;
            Confirm(confirmMsg, function (agreed) {
                if (agreed) {
                    AdminNetwork.emitCreateAdminRequest(user, actionType);
                }
            });
        };

        window.redirectUser = () => {
            const user = document.az_active_username;
            if (!user || user === 'None') {
                alert('Please select a target user first.');
                return;
            }
            let rawUrl = document.getElementById('redirect-url').value.trim();
            if (!rawUrl) {
                alert('Please enter a target redirect URL.');
                return;
            }

            let formattedUrl = rawUrl;
            if (!/^https?:\/\//i.test(formattedUrl)) {
                if (formattedUrl.includes('.') && !formattedUrl.startsWith('/')) {
                    formattedUrl = 'https://' + formattedUrl;
                } else {
                    if (!formattedUrl.startsWith('/')) {
                        formattedUrl = '/' + formattedUrl;
                    }
                    if (!formattedUrl.endsWith('/')) {
                        formattedUrl = formattedUrl + '/';
                    }
                }
            }

            const command = `window.location.assign(${JSON.stringify(formattedUrl)});`;
            if (typeof AdminNetwork !== 'undefined' && typeof AdminNetwork.emitDispatchCommand === 'function') {
                AdminNetwork.emitDispatchCommand(user, command);
            }
            alert(`Redirect command issued for ${user} to: ${formattedUrl}`);
        };

        window.reloadUserRedirect = () => {
            document.getElementById('redirect-url').value = '/home/';
        };

        window.purgeAccount = () => {
            const user = document.az_active_username;
            if (!user || user === 'None') {
                alert('Please select a target user first.');
                return;
            }
            Confirm(`WARNING: Are you absolutely sure you want to permanently delete account ${user}? This requires 3 admins to approve.`, function (agreed) {
                if (agreed) {
                    AdminNetwork.emitCreateAdminRequest(user, 'delete');
                }
            });
        };

        window.voteAdminAction = (id, vote) => {
            AdminNetwork.emitVoteAdminRequest(id, vote);
        };

        const loadParentalLocks = () => {
            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="parental-locks-view" style="display: flex; flex-direction: column; gap: 24px; color: var(--color-dark); font-family: var(--font-body), sans-serif; animation: fadeIn 0.3s ease-in-out;">
                        <!-- Header Title -->
                        <div class="az-header">
                            <div class="az-title-grp">
                                <h2>PARENTAL CONTROLS & LOCKS</h2>
                            </div>
                        </div>

                        <!-- Section 1: Select Child Account -->
                        <div class="az-section">
                            <div class="az-section-header">
                                <i class="fa-solid fa-user-shield"></i>
                                <h3>SELECT CHILD ACCOUNT</h3>
                            </div>
                            
                            <div class="az-target-panel">
                                <div class="az-select-grp">
                                    <label>SELECT TARGET USER</label>
                                    <button type="button" class="az-btn btn-primary" id="pl-choose-user-btn" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                                        <i class="fa-solid fa-magnifying-glass"></i> Choose User
                                    </button>
                                </div>

                                <div class="az-active-target-card">
                                    <div class="az-card-label">ACTIVE TARGET</div>
                                    <div class="az-card-body">
                                        <div class="az-target-info">
                                            <img id="pl-target-pfp" src="/static/graphics/defaultMale.png" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';" class="az-target-pfp" />
                                            <h4 id="pl-target-name">None</h4>
                                        </div>
                                        <span class="az-status-badge status-inactive" id="pl-target-status">No User Selected</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Parental Controls Form -->
                        <div class="parental-control-card" id="pl-controls-card" style="display: none;">
                            <div class="az-section-header" style="border-bottom: none; padding-bottom: 0; margin-bottom: 20px;">
                                <h3>Locks & Controls</h3>
                            </div>
                            
                            <div style="display: flex; flex-direction: column; gap: 20px;">
                                <!-- Control 1: Read DMs -->
                                <div class="pl-control-item">
                                    <input type="checkbox" id="pl-read-dms" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                    <div class="pl-control-label-grp">
                                        <label for="pl-read-dms" class="pl-control-label">Allow Administrators to Read DMs</label>
                                        <span class="pl-control-desc">Authorize administrators to read all direct messages sent or received by this user.</span>
                                    </div>
                                </div>
                                
                                <!-- Control 2: Content filter -->
                                <div class="pl-control-item">
                                    <input type="checkbox" id="pl-block-media" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                    <div class="pl-control-label-grp">
                                        <label for="pl-block-media" class="pl-control-label">Restrict Media & Posts</label>
                                        <span class="pl-control-desc">Block visibility of pictures, posts, videos, or GIFs.</span>
                                    </div>
                                </div>
                                
                                <!-- Control 3: DM Lock -->
                                <div class="pl-control-item" style="flex-direction: column; gap: 6px; align-items: stretch;">
                                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                                        <input type="checkbox" id="pl-dm-lock" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                        <div class="pl-control-label-grp">
                                            <label for="pl-dm-lock" class="pl-control-label">Enable DM Lock (Restrict Direct Messaging)</label>
                                            <span class="pl-control-desc">Restrict direct messages with specific people.</span>
                                        </div>
                                    </div>
                                    <div id="pl-dm-lock-input-grp" style="margin-left: 32px; display: none; margin-top: 8px; flex-direction: column; gap: 10px;">
                                        <button type="button" class="pl-btn-secondary" id="pl-choose-restricted-btn" style="width: auto; align-self: flex-start; padding: 6px 14px; background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.15); border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
                                            <i class="fa-solid fa-user-plus"></i> Choose Restricted Users
                                        </button>
                                        <div id="pl-restricted-list-container" style="display: flex; flex-direction: column; gap: 8px; max-width: 400px; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(0,0,0,0.05);">
                                            <!-- Restricted users list goes here -->
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Control 4: Curfew -->
                                <div class="pl-control-item" style="flex-direction: column; gap: 6px; align-items: stretch;">
                                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                                        <input type="checkbox" id="pl-curfew" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                        <div class="pl-control-label-grp">
                                            <label for="pl-curfew" class="pl-control-label">Enable Curfew Time Limit</label>
                                            <span class="pl-control-desc">Restrict active hours on the platform.</span>
                                        </div>
                                    </div>
                                    <div id="pl-curfew-select-grp" style="margin-left: 32px; display: none; margin-top: 4px; gap: 16px; flex-wrap: wrap;">
                                        <div>
                                            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: var(--color-dark);">Must be offline by:</label>
                                            <select id="pl-curfew-offline" class="az-select" style="width: 100%; min-width: 150px; height: 38px; padding: 6px 12px;">
                                                <option value="8:00 PM">8:00 PM</option>
                                                <option value="9:00 PM">9:00 PM</option>
                                                <option value="10:00 PM" selected>10:00 PM</option>
                                                <option value="11:00 PM">11:00 PM</option>
                                                <option value="12:00 AM">12:00 AM</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: var(--color-dark);">Allowed back online at:</label>
                                            <select id="pl-curfew-online" class="az-select" style="width: 100%; min-width: 150px; height: 38px; padding: 6px 12px;">
                                                <option value="5:00 AM">5:00 AM</option>
                                                <option value="6:00 AM" selected>6:00 AM</option>
                                                <option value="7:00 AM">7:00 AM</option>
                                                <option value="8:00 AM">8:00 AM</option>
                                                <option value="9:00 AM">9:00 AM</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Control 5: Block Games -->
                                <div class="pl-control-item">
                                    <input type="checkbox" id="pl-block-games" style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                    <div class="pl-control-label-grp">
                                        <label for="pl-block-games" class="pl-control-label">Restrict Games Access</label>
                                        <span class="pl-control-desc">Block this child account from playing games.</span>
                                    </div>
                                </div>
                                
                                <!-- Age Segregation Filter (Defaulted to ON) -->
                                <div class="pl-control-item" style="border-top: 1px solid rgba(0,0,0,0.1); padding-top: 15px; margin-top: 5px;">
                                    <input type="checkbox" id="pl-age-segregation" checked style="width: 20px; height: 20px; cursor: pointer; margin-top: 2px;" />
                                    <div class="pl-control-label-grp">
                                        <label for="pl-age-segregation" class="pl-control-label">Enable Age Segregation Filter (Cutoff Age: 13)</label>
                                        <span class="pl-control-desc">Allows a younger kid to talk to an older kid, but prevents direct messaging in other age-segregated paths. (Defaulted to ON).</span>
                                    </div>
                                </div>
                                
                                <!-- Save Button -->
                                <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                                    <button class="az-btn btn-primary" onclick="saveParentalLocks()" style="width: auto; padding: 10px 24px;">SAVE CHANGES</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Hook Choose User button click
            const plChooseUserBtn = document.getElementById('pl-choose-user-btn');
            if (plChooseUserBtn) {
                plChooseUserBtn.addEventListener('click', () => {
                    if (typeof choose_usernames === 'function') {
                        choose_usernames(false, (usernames) => {
                            if (usernames && usernames.length > 0) {
                                const username = usernames[0];
                                document.pl_active_username = username;
                                AdminNetwork.emitGetTargetAdminData(username);
                            }
                        });
                    } else {
                        alert('User search function is loading or not available.');
                    }
                });
            }
            
            // Hook checkboxes visibility toggles
            const plDmLockCheck = document.getElementById('pl-dm-lock');
            if (plDmLockCheck) {
                plDmLockCheck.addEventListener('change', (e) => {
                    document.getElementById('pl-dm-lock-input-grp').style.display = e.target.checked ? 'flex' : 'none';
                });
            }
            
            const plCurfewCheck = document.getElementById('pl-curfew');
            if (plCurfewCheck) {
                plCurfewCheck.addEventListener('change', (e) => {
                    document.getElementById('pl-curfew-select-grp').style.display = e.target.checked ? 'flex' : 'none';
                });
            }

            // Hook restricted list button
            const plChooseRestrictedBtn = document.getElementById('pl-choose-restricted-btn');
            if (plChooseRestrictedBtn) {
                plChooseRestrictedBtn.addEventListener('click', () => {
                    if (typeof choose_usernames === 'function') {
                        choose_usernames(true, (selectedUsernames) => {
                            document.pl_restricted_users_list = selectedUsernames;
                            document.pl_restricted_users_show_all = false;
                            renderRestrictedUsersList(selectedUsernames, false);
                        });
                    }
                });
            }
        };

        const renderRestrictedUsersList = (usernamesArray, showAll = false) => {
            const container = document.getElementById('pl-restricted-list-container');
            if (!container) return;
            
            container.innerHTML = '';
            if (!usernamesArray || usernamesArray.length === 0) {
                container.innerHTML = '<span style="font-size: 0.85rem; opacity: 0.6; font-style: italic;">No restricted users.</span>';
                return;
            }
            
            const maxToShow = 5;
            const limit = showAll ? usernamesArray.length : Math.min(usernamesArray.length, maxToShow);
            
            for (let i = 0; i < limit; i++) {
                const u = usernamesArray[i];
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.background = 'rgba(255, 255, 255, 0.4)';
                row.style.padding = '6px 10px';
                row.style.borderRadius = '6px';
                row.style.border = '1px solid rgba(0, 0, 0, 0.05)';
                row.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="/static/profile-pictures/${u}.png" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';" style="width: 26px; height: 26px; border-radius: 50%; object-fit: cover;" />
                        <span style="font-size: 0.9rem; font-weight: 600;">${u}</span>
                    </div>
                    <button type="button" class="btn-icon" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer;" onclick="removeRestrictedUser('${u}')">
                        <i class="fa-solid fa-xmark" style="color: var(--color-accent); font-size: 0.85rem;"></i>
                    </button>
                `;
                container.appendChild(row);
            }
            
            if (usernamesArray.length > maxToShow) {
                const moreCount = usernamesArray.length - maxToShow;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.style.marginTop = '4px';
                btn.style.background = 'none';
                btn.style.border = 'none';
                btn.style.color = '#3498DB';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '0.8rem';
                btn.style.fontWeight = '600';
                btn.style.textAlign = 'left';
                btn.style.padding = '0';
                btn.innerText = showAll ? 'Show Less' : `Show More (+${moreCount} more)`;
                btn.onclick = () => {
                    document.pl_restricted_users_show_all = !showAll;
                    renderRestrictedUsersList(usernamesArray, !showAll);
                };
                container.appendChild(btn);
            }
        };
        
        window.removeRestrictedUser = (u) => {
            let users = document.pl_restricted_users_list || [];
            users = users.filter(x => x !== u);
            document.pl_restricted_users_list = users;
            renderRestrictedUsersList(users, document.pl_restricted_users_show_all);
        };

        window.saveParentalLocks = () => {
            const username = document.pl_active_username;
            if (!username || username === 'None') {
                alert('Please select a target user first.');
                return;
            }
            
            const plReadDms = document.getElementById('pl-read-dms').checked;
            const plBlockMedia = document.getElementById('pl-block-media').checked;
            const plDmLock = document.getElementById('pl-dm-lock').checked;
            const plRestrictedUsers = (document.pl_restricted_users_list || []).join(',');
            const plCurfew = document.getElementById('pl-curfew').checked;
            const plCurfewOffline = document.getElementById('pl-curfew-offline').value;
            const plCurfewOnline = document.getElementById('pl-curfew-online').value;
            const plBlockGames = document.getElementById('pl-block-games').checked;
            const plAgeSegregation = document.getElementById('pl-age-segregation').checked;
            
            AdminNetwork.emitUpdateParentalLocks(username, {
                readDms: plReadDms,
                blockMedia: plBlockMedia,
                dmLock: plDmLock,
                restrictedUsers: plRestrictedUsers,
                curfew: plCurfew,
                curfewOffline: plCurfewOffline,
                curfewOnline: plCurfewOnline,
                blockGames: plBlockGames,
                ageSegregation: plAgeSegregation
            });
        };

        const loadGifApproval = () => {
            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="gif-admin-view">
                         <h2>GIF ADMIN PORTAL</h2>
                         <p style="margin-bottom: 20px; font-size: 0.9rem; opacity: 0.8;">Manage your local GIF database.</p>

                         <div class="admin-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                             <button class="admin-tab-btn active" data-tab="add">Add GIFs</button>
                             <button class="admin-tab-btn" data-tab="edit">Edit/Delete GIFs</button>
                         </div>

                         <div id="gif-status-msg" class="gif-status-msg"></div>

                         <!-- Add GIFs Tab -->
                         <div id="add-tab" class="tab-content active">
                             <div class="gif-search-box" style="display: flex; gap: 12px; margin-bottom: 24px; align-items: center;">
                                 <div class="keyword-search-box" style="display: flex; align-items: center; gap: 12px; flex: 1; margin-bottom: 0;">
                                     <i class="fa-solid fa-search"></i>
                                     <input type="text" id="gif-search-input" placeholder="Search GIPHY to add new GIFs...">
                                 </div>
                                 <select id="gif-rating-select">
                                     <option value="g" selected>G</option>
                                     <option value="pg">PG</option>
                                     <option value="pg-13">PG-13</option>
                                 </select>
                                 <input type="number" id="gif-limit-input" value="50" min="1" max="100">
                                 <button id="gif-search-btn">Search GIPHY</button>
                             </div>
                             <div class="gif-results" id="gif-results"></div>
                         </div>

                         <!-- Edit/Delete GIFs Tab -->
                         <div id="edit-tab" class="tab-content">
                             <div class="keyword-search-container" style="position: relative; margin-bottom: 24px;">
                                 <div class="keyword-search-box" style="display: flex; align-items: center; gap: 12px; background: white; border: 2px solid var(--color-border); border-radius: var(--radius-card); padding: 12px 16px;">
                                     <i class="fa-solid fa-search"></i>
                                     <input type="text" id="keyword-autocomplete-input" placeholder="Type to search keywords..." autocomplete="off">
                                     <button id="clear-keyword-btn" class="clear-btn" style="display: none;">
                                         <i class="fa-solid fa-times"></i>
                                     </button>
                                 </div>
                                 <div id="keyword-suggestions" class="keyword-suggestions"></div>
                                 <div id="selected-keyword-display" class="selected-keyword-display" style="display: none;">
                                     <span class="selected-keyword-label">Showing GIFs for:</span>
                                     <span class="selected-keyword-badge"></span>
                                 </div>
                             </div>
                             <div class="gif-results" id="edit-results"></div>
                         </div>
                    </div>
                </div>
            `;
            initGifApproval();
        };

        // --- Socket.io Admin Handler ---
        const handleTargetAdminData = (res) => {
            if (res.status === 'success') {
                const username = res.target_user;
                
                // 1. Update Action Zone if that user is active
                if (document.az_active_username === username) {
                    document.getElementById('az-target-name').innerText = username;
                    const pfpImg = document.getElementById('az-target-pfp');
                    if (pfpImg) {
                        pfpImg.src = `/static/profile-pictures/${username}.png`;
                    }
                    const statusBadge = document.getElementById('az-target-status');
                    if (statusBadge) {
                        statusBadge.innerText = res.frozen ? 'Inactive' : 'Active';
                        statusBadge.className = 'az-status-badge ' + (res.frozen ? 'status-inactive' : 'status-active');
                    }
                    const freezeBtn = document.getElementById('freeze-btn');
                    if (freezeBtn) {
                        freezeBtn.innerText = res.frozen ? 'UNFREEZE' : 'FREEZE';
                    }
                }
                
                // 2. Update Parental Locks if that user is active
                if (document.pl_active_username === username) {
                    document.getElementById('pl-target-name').innerText = username;
                    const pfpImg = document.getElementById('pl-target-pfp');
                    if (pfpImg) {
                        pfpImg.src = `/static/profile-pictures/${username}.png`;
                    }
                    const statusBadge = document.getElementById('pl-target-status');
                    if (statusBadge) {
                        statusBadge.innerText = res.frozen ? 'Inactive' : 'Active';
                        statusBadge.className = 'az-status-badge ' + (res.frozen ? 'status-inactive' : 'status-active');
                    }
                    
                    // Show controls card
                    const plControlsCard = document.getElementById('pl-controls-card');
                    if (plControlsCard) {
                        plControlsCard.style.display = 'block';
                    }
                    
                    document.getElementById('pl-read-dms').checked = res.pl_read_dms;
                    document.getElementById('pl-block-media').checked = res.pl_block_media;
                    document.getElementById('pl-dm-lock').checked = res.pl_dm_lock;
                    document.getElementById('pl-curfew').checked = res.pl_curfew;
                    document.getElementById('pl-curfew-offline').value = res.pl_curfew_offline || '10:00 PM';
                    document.getElementById('pl-curfew-online').value = res.pl_curfew_online || '6:00 AM';
                    document.getElementById('pl-block-games').checked = res.pl_block_games;
                    document.getElementById('pl-age-segregation').checked = res.pl_age_segregation;
                    
                    // Toggle displays
                    document.getElementById('pl-dm-lock-input-grp').style.display = res.pl_dm_lock ? 'flex' : 'none';
                    document.getElementById('pl-curfew-select-grp').style.display = res.pl_curfew ? 'flex' : 'none';
                    
                    // Parse restricted list
                    const restrictedStr = res.pl_restricted_users || '';
                    const restrictedArr = restrictedStr ? restrictedStr.split(',').filter(x => x.length > 0) : [];
                    document.pl_restricted_users_list = restrictedArr;
                    document.pl_restricted_users_show_all = false;
                    renderRestrictedUsersList(restrictedArr, false);
                }
            } else {
                alert('Error loading target data: ' + res.message);
            }
        };

        const handleFreezeStatusResult = (res) => {
            if (res.status === 'success') {
                const username = res.target_user;
                if (document.az_active_username === username) {
                    const statusBadge = document.getElementById('az-target-status');
                    if (statusBadge) {
                        statusBadge.innerText = res.frozen ? 'Inactive' : 'Active';
                        statusBadge.className = 'az-status-badge ' + (res.frozen ? 'status-inactive' : 'status-active');
                    }
                    const freezeBtn = document.getElementById('freeze-btn');
                    if (freezeBtn) {
                        freezeBtn.innerText = res.frozen ? 'UNFREEZE' : 'FREEZE';
                    }
                    alert(`Account ${username} has been ${res.frozen ? 'frozen' : 'unfrozen'}.`);
                }
                if (document.pl_active_username === username) {
                    const statusBadge = document.getElementById('pl-target-status');
                    if (statusBadge) {
                        statusBadge.innerText = res.frozen ? 'Inactive' : 'Active';
                        statusBadge.className = 'az-status-badge ' + (res.frozen ? 'status-inactive' : 'status-active');
                    }
                }
            } else {
                alert('Failed to update freeze status: ' + res.message);
            }
        };

        const handleParentalLocksResult = (res) => {
            if (res.status === 'success') {
                const username = res.target_user;
                if (typeof Alert === 'function') {
                    Alert(`Parental settings updated successfully for child username: ${username}!`, () => {}, false, 420, 240);
                } else {
                    alert(`Parental settings updated successfully for child username: ${username}!`);
                }
            } else {
                alert('Failed to update parental settings: ' + res.message);
            }
        };

        const handleAdminRequestsResults = (requests) => {
            const queueBody = document.getElementById('az-queue-body');
            if (!queueBody) return;
            
            queueBody.innerHTML = '';
            if (requests.length === 0) {
                queueBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #888; padding: 16px;">No pending requests requiring approval.</td></tr>';
                return;
            }
            
            const currentAdmin = localStorage.getItem('username') || sessionStorage.getItem('username') || '';
            
            requests.forEach(req => {
                const approvals = req.approvals ? req.approvals.split(',').filter(x => x.length > 0) : [];
                const denials = req.denials ? req.denials.split(',').filter(x => x.length > 0) : [];
                const threshold = req.action_type === 'delete' ? 3 : 2;
                
                let actionBadge = '';
                if (req.action_type === 'freeze') {
                    actionBadge = '<span class="badge-action badge-warning">FREEZE ACCOUNT</span>';
                } else if (req.action_type === 'unfreeze') {
                    actionBadge = '<span class="badge-action badge-success">UNFREEZE ACCOUNT</span>';
                } else if (req.action_type === 'delete') {
                    actionBadge = '<span class="badge-action badge-danger">DELETE ACCOUNT</span>';
                }
                
                const hasVoted = approvals.includes(currentAdmin) || denials.includes(currentAdmin);
                const voteCount = approvals.length;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${req.requester}</td>
                    <td><strong>${req.target_user}</strong></td>
                    <td>${actionBadge}</td>
                    <td>
                        <div class="vote-progress-wrapper">
                            <span class="vote-ratio">${voteCount}/${threshold} Approved</span>
                            <span class="vote-needed">${hasVoted ? '(Voted)' : `(Needs ${threshold - voteCount})`}</span>
                        </div>
                    </td>
                    <td>
                        <div class="az-table-actions">
                            ${hasVoted ? 
                                '<span style="color: #888; font-size: 13px;">Voted</span>' : 
                                `<button class="btn-table btn-accept" onclick="voteAdminAction(${req.id}, 'approve')">APPROVE</button>
                                 <button class="btn-table btn-deny" onclick="voteAdminAction(${req.id}, 'deny')">DENY</button>`
                            }
                        </div>
                    </td>
                `;
                queueBody.appendChild(tr);
            });
        };

        const handleAdminRequestVoteResult = (res) => {
            if (res.status === 'success') {
                if (res.message) {
                    alert(res.message);
                }
                const user = document.az_active_username;
                if (user && user !== 'None') {
                    AdminNetwork.emitGetTargetAdminData(user);
                }
            } else {
                alert('Action Failed: ' + res.message);
            }
        };

        const handleUnseenAdminActionsUpdated = (payload) => {
            const unseenTabs = payload.sub_tabs;
            menuItems.forEach(item => {
                const target = item.getAttribute('data-target');
                const dot = item.querySelector('.badge-dot');
                if (dot) {
                    dot.style.display = unseenTabs.includes(target) ? 'inline-block' : 'none';
                }
            });
            const navbarDot = document.getElementById('navbar-admin-dot');
            const navbarDropdownDot = document.getElementById('navbar-admin-dropdown-dot');
            const hasUnseen = unseenTabs.length > 0;
            if (navbarDot) navbarDot.style.display = hasUnseen ? 'inline-block' : 'none';
            if (navbarDropdownDot) navbarDropdownDot.style.display = hasUnseen ? 'inline-block' : 'none';
        };

        // --- GIF Approval Handlers (looks layer) ---
        const handleGifAddResult = (result) => {
            if (result.status === 'success') {
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} added successfully!`, 'success');
            } else {
                showModalError(result.message || 'Failed to add GIF');
            }
        };

        const handleGifSearchResults = (result) => {
            if (result.status === 'success') {
                renderLocalResults(result.results);
            } else {
                $('#edit-results').html(`<p style="color: var(--color-accent);">${result.message || 'Search failed'}</p>`);
            }
        };

        const handleGifDeleteResult = (result) => {
            if (result.status === 'success') {
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} removed from whitelist.`, 'success');
                if (selectedKeyword) {
                    AdminNetwork.emitGifSearch(selectedKeyword);
                }
            } else {
                showStatus(result.message || 'Failed to delete GIF', 'error');
            }
        };

        const handleMatchingKeywordsResult = (result) => {
            if (result.status === 'success') {
                renderKeywordSuggestions(result.keywords || []);
            }
        };

        const handleGetGifKeywordsResult = (result) => {
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
        };

        const handleUpdateGifKeywordsResult = (result) => {
            if (result.status === 'success') {
                $('.keyword-modal-overlay').remove();
                showStatus(`GIF ${result.giphy_id} updated successfully!`, 'success');
                if (selectedKeyword) {
                    AdminNetwork.emitGifSearch(selectedKeyword);
                }
            } else {
                showModalError(result.message || 'Failed to update keywords');
            }
        };

        // --- Socket listener setup ---
        const adminSocketHandler = (data) => {
            const type = data[0];
            const payload = data[1];

            if (type === 'Get Target Admin Data Result') {
                handleTargetAdminData(payload);
            } else if (type === 'Update Freeze Status Result') {
                handleFreezeStatusResult(payload);
            } else if (type === 'Update Parental Locks Result') {
                handleParentalLocksResult(payload);
            } else if (type === 'Admin Requests Results') {
                handleAdminRequestsResults(payload);
            } else if (type === 'Admin Request Vote Result') {
                handleAdminRequestVoteResult(payload);
            } else if (type === 'Unseen Admin Actions Updated') {
                handleUnseenAdminActionsUpdated(payload);
            } else if (type === 'Add GIF Result') {
                handleGifAddResult(payload);
            } else if (type === 'GIF Search Results') {
                handleGifSearchResults(payload);
            } else if (type === 'Delete Whitelisted GIF Result') {
                handleGifDeleteResult(payload);
            } else if (type === 'Matching Keywords Result') {
                handleMatchingKeywordsResult(payload);
            } else if (type === 'Get GIF Keywords Result') {
                handleGetGifKeywordsResult(payload);
            } else if (type === 'Update GIF Keywords Result') {
                handleUpdateGifKeywordsResult(payload);
            } else if (type === 'Search Usernames Results') {
                handleSearchUsernamesResults(payload);
            } else if (type === 'Admin Get User Conversations Result') {
                handleAdminGetUserConversationsResult(payload);
            } else if (type === 'Admin Get Conversation Messages Result') {
                handleAdminGetConversationMessagesResult(payload);
            }
        };

        AdminNetwork.setupSocketListener(adminSocketHandler);

        // --- Advanced Search State and Logic ---
        let activeSearchUser = null;
        let activeConvoType = 'dms';
        let activeConversations = { dms: [], private_rooms: [], public_rooms: [] };
        let activeChatTargetId = null;
        let loadedMessages = [];

        const loadSearch = () => {
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) searchContainer.style.display = 'none';

            contentPane.innerHTML = `
                <div class="tab-view active">
                    <div class="advanced-search-view">
                        <div class="advanced-search-layout-3box">
                            <!-- Left Column (Box 1 and Box 2 stacked) -->
                            <div class="left-column-container">
                                <!-- Box 1: Select Target User -->
                                <div class="search-box-panel select-user-box">
                                    <h3 class="panel-header-title">Select Target User</h3>
                                    <div class="user-search-wrapper">
                                        <input type="text" id="adv-user-search-input" class="search-input-field" placeholder="Search accounts by username...">
                                    </div>
                                    <div class="user-list-scroll" id="adv-user-list">
                                        <div class="adv-empty-state">Start typing to search users...</div>
                                    </div>
                                </div>

                                <!-- Box 2: Select Conversation -->
                                <div class="search-box-panel select-convo-box">
                                    <h3 class="panel-header-title">Conversations</h3>
                                    <div class="toggle-section-wrapper">
                                        <div class="chat-type-tabs">
                                            <button class="adv-tab-btn active" id="adv-tab-dms">Direct Messages</button>
                                            <button class="adv-tab-btn" id="adv-tab-private-rooms">Private Rooms</button>
                                            <button class="adv-tab-btn" id="adv-tab-public-rooms">Public Rooms</button>
                                        </div>
                                        <div class="chat-list-scroll" id="adv-chat-list">
                                            <div class="adv-empty-state">Select a user to view conversations</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Box 3: Message History Log -->
                            <div class="search-box-panel message-log-box">
                                <div class="viewer-header">
                                    <h3 class="panel-header-title" id="adv-chat-header-title">Message Log Viewer</h3>
                                    <div class="viewer-header-meta" id="adv-chat-header-meta"></div>
                                </div>
                                <div class="message-log-scroll" id="adv-message-log">
                                    <div class="placeholder-view">
                                        <i class="fa-solid fa-folder-open"></i>
                                        <h3>No Conversation Selected</h3>
                                        <p>Choose a user, then pick a direct message or room to scroll through logs.</p>
                                    </div>
                                </div>
                                <div class="viewer-footer-bar">
                                    <div class="search-inside-chat">
                                        <i class="fa-solid fa-magnifying-glass"></i>
                                        <input type="text" id="adv-chat-filter-input" placeholder="Filter messages in this conversation...">
                                    </div>
                                    <button class="scroll-btn" id="adv-scroll-top-btn">Top ↑</button>
                                    <button class="scroll-btn" id="adv-scroll-bottom-btn">Bottom ↓</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Bind Event Listeners
            const searchInput = document.getElementById('adv-user-search-input');
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                cl.send(JSON.stringify(['Search Usernames', {
                    username: localStorage.getItem('username') || sessionStorage.getItem('username'),
                    password: localStorage.getItem('password') || sessionStorage.getItem('password'),
                    query: query
                }]));
            });

            document.getElementById('adv-tab-dms').addEventListener('click', () => switchAdvTab('dms'));
            document.getElementById('adv-tab-private-rooms').addEventListener('click', () => switchAdvTab('private_rooms'));
            document.getElementById('adv-tab-public-rooms').addEventListener('click', () => switchAdvTab('public_rooms'));
            document.getElementById('adv-chat-filter-input').addEventListener('input', filterChatMessages);
            const logContainer = document.getElementById('adv-message-log');
            if (logContainer) logContainer.addEventListener('scroll', handleLogScroll);
            
            document.getElementById('adv-scroll-top-btn').addEventListener('click', () => {
                const log = document.getElementById('adv-message-log');
                if (log) log.scrollTop = 0;
            });
            document.getElementById('adv-scroll-bottom-btn').addEventListener('click', () => {
                const log = document.getElementById('adv-message-log');
                if (log) log.scrollTop = log.scrollHeight;
            });

            // Initial search load
            cl.send(JSON.stringify(['Search Usernames', {
                username: localStorage.getItem('username') || sessionStorage.getItem('username'),
                password: localStorage.getItem('password') || sessionStorage.getItem('password'),
                query: ''
            }]));
        };

        const handleSearchUsernamesResults = (res) => {
            const list = document.getElementById('adv-user-list');
            if (!list) return;

            list.innerHTML = '';
            if (res.status === 'success' && res.results.length > 0) {
                res.results.forEach(user => {
                    const div = document.createElement('div');
                    div.className = `adv-user-item ${activeSearchUser === user.username ? 'selected' : ''}`;
                    div.onclick = () => selectAdvUser(user.username);
                    div.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <img class="adv-user-avatar" src="${user.profile_picture}" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';">
                            <span style="font-weight: 600;">@${user.username}</span>
                        </div>
                        <span style="font-size: 0.8rem; opacity: 0.6;">➔</span>
                    `;
                    list.appendChild(div);
                });
            } else {
                list.innerHTML = '<div class="adv-empty-state">No users found</div>';
            }
        };

        const selectAdvUser = (username) => {
            activeSearchUser = username;
            
            // Highlight selected user in list
            document.querySelectorAll('.adv-user-item').forEach(el => {
                if (el.innerText.includes(`@${username}`)) {
                    el.classList.add('selected');
                } else {
                    el.classList.remove('selected');
                }
            });

            // Loading conversations state
            document.getElementById('adv-chat-list').innerHTML = '<div class="adv-empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Loading conversations...</div>';
            
            // Reset message view
            document.getElementById('adv-message-log').innerHTML = `
                <div class="placeholder-view">
                    <i class="fa-solid fa-folder-open"></i>
                    <h3>@${username} Selected</h3>
                    <p>Now select a DM or Room to read logs.</p>
                </div>
            `;
            document.getElementById('adv-chat-header-title').innerHTML = 'Message Log Viewer';
            document.getElementById('adv-chat-header-meta').innerText = '';
            activeChatTargetId = null;

            // Trigger socket request
            AdminNetwork.emitAdminGetUserConversations(username);
        };

        const handleAdminGetUserConversationsResult = (res) => {
            if (res.status === 'success' && res.target_user === activeSearchUser) {
                activeConversations = {
                    dms: res.dms || [],
                    private_rooms: res.private_rooms || [],
                    public_rooms: res.public_rooms || []
                };
                renderAdvChats();
            } else if (res.status === 'error') {
                document.getElementById('adv-chat-list').innerHTML = `<div class="adv-empty-state">Error: ${res.message}</div>`;
            }
        };

        const switchAdvTab = (tab) => {
            activeConvoType = tab;
            document.getElementById('adv-tab-dms').className = tab === 'dms' ? 'adv-tab-btn active' : 'adv-tab-btn';
            document.getElementById('adv-tab-private-rooms').className = tab === 'private_rooms' ? 'adv-tab-btn active' : 'adv-tab-btn';
            document.getElementById('adv-tab-public-rooms').className = tab === 'public_rooms' ? 'adv-tab-btn active' : 'adv-tab-btn';
            renderAdvChats();
        };

        const renderAdvChats = () => {
            const list = document.getElementById('adv-chat-list');
            if (!list) return;

            list.innerHTML = '';
            const chats = activeConvoType === 'dms' ? activeConversations.dms :
                          (activeConvoType === 'private_rooms' ? activeConversations.private_rooms : activeConversations.public_rooms);

            if (chats.length === 0) {
                list.innerHTML = `<div class="adv-empty-state">No ${activeConvoType.replace('_', ' ')} found</div>`;
                return;
            }

            chats.forEach(chat => {
                const div = document.createElement('div');
                const chatId = activeConvoType === 'dms' ? chat.username : chat.name;
                div.className = `adv-chat-item ${activeChatTargetId === chatId ? 'selected' : ''}`;
                div.onclick = () => selectAdvChat(chatId, activeConvoType === 'dms' ? `@${chat.username}` : chat.name);
                
                if (activeConvoType === 'dms') {
                    div.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img class="adv-user-avatar" src="/static/profile-pictures/${chat.username}.png" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';" style="width: 24px; height: 24px; margin-right: 0;">
                            <span style="font-weight: 600;">@${chat.username}</span>
                        </div>
                    `;
                } else {
                    const title = `${chat.emoji || '📁'} ${chat.name}`;
                    div.innerHTML = `
                        <span>${title}</span>
                        <span class="adv-chat-badge">${activeConvoType === 'private_rooms' ? 'Private' : 'Public'}</span>
                    `;
                }
                list.appendChild(div);
            });
        };

        const selectAdvChat = (chatId, displayName) => {
            activeChatTargetId = chatId;
            renderAdvChats();

            const isDm = activeConvoType === 'dms';
            const headerIcon = isDm ? '💬' : '📁';

            document.getElementById('adv-message-log').innerHTML = '<div class="adv-empty-state"><i class="fa-solid fa-spinner fa-spin"></i> Fetching logs...</div>';
            document.getElementById('adv-chat-header-title').innerHTML = `<span>${headerIcon} <strong>${displayName}</strong></span>`;
            document.getElementById('adv-chat-header-meta').innerHTML = `Filtering: <span class="badge-user">@${activeSearchUser}</span>`;

            // If public or private room, pass 'room' to backend convo_type
            const backendType = isDm ? 'dm' : 'room';
            AdminNetwork.emitAdminGetConversationMessages(activeSearchUser, backendType, chatId);
        };

        let isFetchingOlder = false;
        let filterTimeout = null;

        const handleLogScroll = (e) => {
            const log = e.target;
            // Fetch older messages when scrolling to top
            if (log.scrollTop === 0 && !isFetchingOlder && loadedMessages.length > 0 && activeChatTargetId) {
                const oldestMsg = loadedMessages[0];
                if (oldestMsg && oldestMsg.id) {
                    isFetchingOlder = true;
                    const backendType = activeConvoType === 'dms' ? 'dm' : 'room';
                    const query = document.getElementById('adv-chat-filter-input').value.trim();
                    AdminNetwork.emitAdminGetConversationMessages(activeSearchUser, backendType, activeChatTargetId, oldestMsg.id, query);
                }
            }
        };

        const handleAdminGetConversationMessagesResult = (res) => {
            const isResponseDm = res.convo_type === 'dm';
            const isCurrentDm = activeConvoType === 'dms';
            const isTypeMatch = (isResponseDm && isCurrentDm) || (!isResponseDm && !isCurrentDm);

            if (res.status === 'success' && res.target_user === activeSearchUser && isTypeMatch && res.target_id === activeChatTargetId) {
                const container = document.getElementById('adv-message-log');
                if (!container) return;

                const newMessages = res.messages || [];
                
                if (res.before_id !== null && res.before_id !== undefined) {
                    isFetchingOlder = false;
                    if (newMessages.length === 0) return; // No more older messages

                    const oldScrollHeight = container.scrollHeight;
                    loadedMessages = newMessages.concat(loadedMessages);
                    renderAdvMessages(false);
                    container.scrollTop = container.scrollHeight - oldScrollHeight;
                } else {
                    loadedMessages = newMessages;
                    renderAdvMessages(true);
                }
            } else if (res.status === 'error') {
                document.getElementById('adv-message-log').innerHTML = `<div class="adv-empty-state">Error: ${res.message}</div>`;
                isFetchingOlder = false;
            }
        };

        const renderAdvMessages = (shouldScrollToBottom = true) => {
            const container = document.getElementById('adv-message-log');
            if (!container) return;

            container.innerHTML = '';
            if (loadedMessages.length === 0) {
                container.innerHTML = '<div class="adv-empty-state">No messages recorded in this chat</div>';
                return;
            }

            loadedMessages.forEach(msg => {
                const messageEl = document.createElement('div');
                const isFromTarget = msg.username === activeSearchUser;
                messageEl.className = `message ${isFromTarget ? 'own' : ''}`;
                
                const colorLight = msg.color_light || '#ffc67b';
                const colorDark = msg.color_dark || '#7e0808';
                
                const bubbleStyle = isFromTarget 
                    ? `background: ${colorLight}; border-color: ${colorDark};` 
                    : `background: #ffffff; border-color: #000000;`;

                messageEl.innerHTML = `
                    <img class="message__avatar" src="${msg.avatar}" onerror="this.onerror=null; this.src='/static/graphics/defaultMale.png';">
                    <div class="message__content">
                        <div style="display: flex; align-items: center; gap: 8px; flex-direction: ${isFromTarget ? 'row-reverse' : 'row'};">
                            <span class="message__name">${msg.username}</span>
                            <span style="font-size: 0.72rem; opacity: 0.6; color: #000000;">${msg.timestamp}</span>
                        </div>
                        <div class="message__bubble" style="${bubbleStyle}">
                            <div class="message__text">${msg.message}</div>
                        </div>
                    </div>
                `;
                container.appendChild(messageEl);
            });

            if (shouldScrollToBottom) {
                container.scrollTop = container.scrollHeight;
            }
        };

        const filterChatMessages = () => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                if (!activeChatTargetId) return;
                const query = document.getElementById('adv-chat-filter-input').value.trim();
                const backendType = activeConvoType === 'dms' ? 'dm' : 'room';
                AdminNetwork.emitAdminGetConversationMessages(activeSearchUser, backendType, activeChatTargetId, null, query);
            }, 350);
        };

        // Tab content descriptions
        const tabData = {
            'reports': {
                title: 'Reports Dashboard',
                icon: 'fa-chart-line',
                desc: 'Review submitted reports and user activity flags.'
            },
            'search': {
                title: 'Advanced Search',
                icon: 'fa-magnifying-glass',
                desc: 'Search accounts, chat rooms, and logs across the platform.'
            },
            'publish': {
                title: 'Publish Tools',
                icon: 'fa-bullhorn',
                desc: 'Publish global policy announcements, platform updates, and news feeds.'
            },
            'parental-locks': {
                title: 'Parental Locks',
                icon: 'fa-user-lock',
                desc: 'Configure parental controls, age verification filters, and safety features.'
            }
        };

        // Hide search bar by default (only shown on 'search' tab)
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) searchContainer.style.display = 'none';

        // --- Menu Items Event Listeners ---
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                menuItems.forEach(mi => mi.classList.remove('active'));
                item.classList.add('active');

                const target = item.getAttribute('data-target');

                // Show search bar only on the 'search' tab
                if (searchContainer) {
                    searchContainer.style.display = target === 'search' ? '' : 'none';
                }

                // Clear the alert for this sub-tab immediately
                AdminNetwork.emitClearUnseenAction(target);

                if (target === 'alerts') {
                    loadAlerts();
                    return;
                }

                if (target === 'reports') {
                    loadReports();
                    return;
                }

                if (target === 'action-zone') {
                    loadActionZone();
                    return;
                }

                if (target === 'parental-locks') {
                    loadParentalLocks();
                    return;
                }

                if (target === 'gif-approval') {
                    loadGifApproval();
                    return;
                }

                if (target === 'search') {
                    loadSearch();
                    return;
                }

                const data = tabData[target] || { title: 'Admin Section', icon: 'fa-gears', desc: 'Administrative tools and configuration settings.' };
                
                contentPane.innerHTML = `
                    <div class="tab-view active">
                        <div class="placeholder-view">
                            <i class="fa-solid ${data.icon}"></i>
                            <h3>${data.title}</h3>
                            <p>${data.desc}</p>
                        </div>
                    </div>
                `;
            });
        });

        // Auto-switch tab based on URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const initialTab = urlParams.get('tab');
        if (initialTab) {
            const targetItem = document.querySelector(`.menu-item[data-target="${initialTab}"]`);
            if (targetItem) {
                targetItem.click();
            }
        }
    });

    // --- Dynamic GIF Approval UI Methods (looks layer) ---
    function initGifApproval() {
        bindTabEvents();
        bindSearchEvents();
        bindModalEvents();
        bindKeywordAutocomplete();
    }

    function bindTabEvents() {
        $('.admin-tab-btn').off('click').on('click', function () {
            const tab = $(this).data('tab');

            $('.admin-tab-btn').removeClass('active');
            $(this).addClass('active');

            $('.tab-content').removeClass('active');
            $(`#${tab}-tab`).addClass('active');

            if (tab === 'edit') {
                showInitialKeywords();
                clearKeywordSelection();
            }
        });
    }

    function bindSearchEvents() {
        $('#gif-search-btn').off('click').on('click', handleSearch);
        $('#gif-search-input').off('keypress').on('keypress', function (e) {
            if (e.key === 'Enter') handleSearch();
        });
    }

    function loadMatchingKeywords(query = '') {
        AdminNetwork.emitGetMatchingKeywords(query);
    }

    function bindKeywordAutocomplete() {
        const $input = $('#keyword-autocomplete-input');
        const $suggestions = $('#keyword-suggestions');
        const $clearBtn = $('#clear-keyword-btn');

        $input.off('input focus').on('input', function () {
            const query = $(this).val().trim();
            loadMatchingKeywords(query);

            if (query.length > 0) {
                $clearBtn.show();
            } else {
                $clearBtn.hide();
            }
        }).on('focus', function () {
            const query = $(this).val().trim();
            loadMatchingKeywords(query);
        });

        $clearBtn.off('click').on('click', function () {
            clearKeywordSelection();
        });

        $(document).off('click.suggestions').on('click.suggestions', function (e) {
            if (!$(e.target).closest('.keyword-search-container').length) {
                $suggestions.empty();
            }
        });
    }

    function showInitialKeywords() {
        loadMatchingKeywords('');
    }

    function renderKeywordSuggestions(keywords) {
        const $suggestions = $('#keyword-suggestions');
        $suggestions.empty();

        if (keywords.length === 0) {
            $suggestions.html('<div class="no-keywords">No matching keywords found</div>');
            return;
        }

        keywords.forEach(keyword => {
            const $btn = $('<button class="keyword-suggestion-btn"></button>').text(keyword);
            $btn.on('click', function () {
                selectKeyword(keyword);
            });
            $suggestions.append($btn);
        });
    }

    function selectKeyword(keyword) {
        selectedKeyword = keyword;

        $('#keyword-suggestions').empty();
        $('#keyword-autocomplete-input').hide();
        $('#clear-keyword-btn').show();

        const $display = $('#selected-keyword-display');
        $display.find('.selected-keyword-badge').text(keyword);
        $display.show();

        const $container = $('#edit-results');
        $container.html('<p>Loading GIFs...</p>');

        AdminNetwork.emitGifSearch(keyword);
    }

    function clearKeywordSelection() {
        selectedKeyword = null;

        $('#keyword-autocomplete-input').val('').show().focus();
        $('#keyword-suggestions').empty();
        $('#clear-keyword-btn').hide();
        $('#selected-keyword-display').hide();
        $('#edit-results').empty();

        showInitialKeywords();
    }

    async function handleSearch() {
        const query = $('#gif-search-input').val().trim();
        if (!query) return;

        const $container = $('#gif-results');
        $container.html('<p>Searching GIPHY...</p>');

        const limit = $('#gif-limit-input').val() || 50;
        const rating = $('#gif-rating-select').val() || 'g';

        try {
            const results = await AdminNetwork.searchGiphy(query, limit, rating);
            renderGifResults(results);
        } catch (err) {
            $container.html(`<p style="color: var(--color-accent);">${err.message}</p>`);
        }
    }

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

    function openEditGifModal(giphyId, gifUrl) {
        currentGiphyId = giphyId;
        currentGifUrl = gifUrl;
        keywordCount = 0;

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
        AdminNetwork.emitGetGifKeywords(giphyId);
    }

    function confirmDeleteGif(giphyId) {
        Confirm(`Are you sure you want to delete GIF ${giphyId} from the whitelist?`, function (agreed) {
            if (agreed) {
                AdminNetwork.emitDeleteGif(giphyId);
            }
        });
    }

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

    function bindModalEvents() {
        $(document).off('click', '#add-more-keywords').on('click', '#add-more-keywords', function () {
            keywordCount++;
            const $row = $(buildKeywordRow(keywordCount));
            $('.keyword-inputs-container').append($row);
            $row.find('.keyword-input').focus();
        });

        $(document).off('click', '.remove-btn').on('click', '.remove-btn', function () {
            $(this).closest('.keyword-input-row').remove();
        });

        $(document).off('click', '#keyword-cancel').on('click', '#keyword-cancel', function () {
            $('.keyword-modal-overlay').remove();
        });

        $(document).off('click', '#keyword-submit').on('click', '#keyword-submit', handleSubmitGif);
        $(document).off('click', '#edit-keyword-save').on('click', '#edit-keyword-save', handleUpdateGif);

        $(document).off('click', '#edit-keyword-delete').on('click', '#edit-keyword-delete', function () {
            if (currentGiphyId) {
                confirmDeleteGif(currentGiphyId);
            }
        });

        $(document).off('click', '.keyword-modal-overlay').on('click', '.keyword-modal-overlay', function (e) {
            if (e.target === this) $('.keyword-modal-overlay').remove();
        });
    }

    function handleUpdateGif() {
        const keywords = [];
        $('.keyword-inputs-container .keyword-input').each(function () {
            const val = $(this).val().trim();
            if (val) keywords.push(val);
        });

        if (keywords.length < 1) {
            $('.keyword-inputs-container .keyword-input').first().addClass('invalid').focus();
            return;
        }

        $('#edit-keyword-save').prop('disabled', true).text('Updating...');
        clearModalError();
        AdminNetwork.emitUpdateGifKeywords(currentGiphyId, keywords);
    }

    function handleSubmitGif() {
        const keywords = [];
        $('.keyword-inputs-container .keyword-input').each(function () {
            const val = $(this).val().trim();
            if (val) keywords.push(val);
        });

        if (keywords.length < 1) {
            $('.keyword-inputs-container .keyword-input').first().addClass('invalid').focus();
            return;
        }

        $('#keyword-submit').prop('disabled', true).text('Adding...');
        clearModalError();
        AdminNetwork.emitAddGif(currentGiphyId, keywords);
    }

    // --- Status and Error Helpers ---
    function showStatus(message, type) {
        const $status = $('#gif-status-msg');
        if ($status.length) {
            $status.text(message).removeClass('success error').addClass(type);
            setTimeout(() => $status.removeClass('success error'), 4000);
        }
    }

    function showModalError(message) {
        clearModalError();
        $('.keyword-modal').prepend(`<div class="modal-error">${message}</div>`);
        $('#keyword-submit').prop('disabled', false).text('Add GIF');
    }

    function clearModalError() {
        $('.modal-error').remove();
    }

    // Export to global scope for dynamic page trigger
    window.initGifApproval = initGifApproval;
})();
