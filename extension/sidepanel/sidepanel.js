// Deep-Browser SidePanel Script with Safe Mode Confirmation Gateways

document.addEventListener('DOMContentLoaded', () => {
    const connectionPill = document.getElementById('connection-pill');
    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const handoffBtn = document.getElementById('handoff-btn');
    const goalInput = document.getElementById('sidepanel-goal');
    const submitGoalBtn = document.getElementById('submit-goal-btn');
    const feed = document.getElementById('sidepanel-feed');

    // Safe Mode Modal Elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalActionText = document.getElementById('modal-action-text');
    const modalTargetText = document.getElementById('modal-target-text');
    const modalReasonText = document.getElementById('modal-reason-text');
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnRejectAction = document.getElementById('btn-reject-action');

    let currentTab = null;
    let activeConfirmation = null;

    // Load active tab
    function updateActiveTab() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    currentTab = tabs[0];
                    tabTitle.textContent = currentTab.title || 'Untitled';
                    tabUrl.textContent = currentTab.url || 'about:blank';
                }
            });
        }
    }

    updateActiveTab();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated.addListener(updateActiveTab);
        chrome.tabs.onUpdated.addListener(updateActiveTab);
    }

    // Direct WebSocket connection to Deep-Browser Companion Server
    let ws = null;
    function connectWs() {
        try {
            ws = new WebSocket('ws://127.0.0.1:8765/ws');
            ws.onopen = () => {
                connectionPill.textContent = 'ONLINE';
                connectionPill.className = 'pill status-online';
            };
            ws.onclose = () => {
                connectionPill.textContent = 'OFFLINE';
                connectionPill.className = 'pill status-offline';
                setTimeout(connectWs, 3000);
            };
            ws.onerror = () => {
                connectionPill.textContent = 'OFFLINE';
                connectionPill.className = 'pill status-offline';
            };
            ws.onmessage = (event) => {
                try {
                    const evt = JSON.parse(event.data);
                    handleAgentEvent(evt);
                } catch (e) {
                    console.error('Error parsing event:', e);
                }
            };
        } catch (err) {
            connectionPill.textContent = 'OFFLINE';
            connectionPill.className = 'pill status-offline';
            setTimeout(connectWs, 3000);
        }
    }
    connectWs();

    function handleAgentEvent(evt) {
        const { event_type, message, data } = evt;

        if (event_type === 'CONFIRMATION_REQUIRED') {
            showConfirmationModal(data);
            appendFeed(`⚠️ [SAFE MODE] ${message || 'Sensitive action requires confirmation'}`, false, 'warning');
        } else if (event_type === 'ACTION_CONFIRMED') {
            hideConfirmationModal();
            appendFeed(`✓ [CONFIRMED] User approved action.`);
        } else if (event_type === 'ACTION_REJECTED') {
            hideConfirmationModal();
            appendFeed(`✗ [REJECTED] User rejected action.`, true);
        } else if (event_type === 'ACTION_TIMED_OUT') {
            hideConfirmationModal();
            appendFeed(`⏱️ [TIMED OUT] Safe Mode confirmation expired. Action cancelled.`, true);
        } else if (event_type === 'TASK_CREATED' || event_type === 'TASK_STARTED') {
            appendFeed(`🚀 [${event_type}] ${message || 'Task initiated'}`);
        } else if (event_type === 'VERIFICATION') {
            appendFeed(`✓ [VERIFIED] ${message || JSON.stringify(data)}`);
        } else if (event_type === 'COMPLETED') {
            hideConfirmationModal();
            appendFeed(`🎉 [COMPLETED] ${message || 'Success'}`);
        } else if (event_type === 'FAILED') {
            hideConfirmationModal();
            appendFeed(`❌ [FAILED] ${message || 'Task encountered error'}`, true);
        } else {
            appendFeed(`• [${event_type}] ${message || ''}`);
        }
    }

    function showConfirmationModal(data) {
        if (!data) return;
        activeConfirmation = data;
        modalActionText.textContent = data.action || 'Unknown Action';
        modalTargetText.textContent = data.target || 'Page element';
        modalReasonText.textContent = data.reason || 'Critical operation requested';
        confirmationModal.classList.remove('hidden');
    }

    function hideConfirmationModal() {
        activeConfirmation = null;
        confirmationModal.classList.add('hidden');
    }

    async function sendDecision(decision) {
        if (!activeConfirmation) return;
        const confId = activeConfirmation.confirmation_id;
        const payload = {
            type: 'CONFIRMATION_DECISION',
            confirmation_id: confId,
            task_id: activeConfirmation.task_id,
            decision: decision
        };

        // Try WebSocket first
        let sentWs = false;
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(payload));
                sentWs = true;
            } catch (e) {
                console.error('Failed to send decision over WS:', e);
            }
        }

        // Fallback REST call
        if (!sentWs) {
            try {
                await fetch(`http://127.0.0.1:8765/api/confirmations/${confId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decision: decision })
                });
            } catch (err) {
                console.error('Failed to send decision over REST:', err);
            }
        }

        hideConfirmationModal();
    }

    btnConfirmAction.addEventListener('click', () => sendDecision('CONFIRM'));
    btnRejectAction.addEventListener('click', () => sendDecision('REJECT'));

    function appendFeed(text, isError = false, extraClass = '') {
        if (feed.querySelector('.empty-hint')) {
            feed.innerHTML = '';
        }
        const item = document.createElement('div');
        let cls = 'feed-item';
        if (isError) cls += ' failed';
        if (extraClass) cls += ` ${extraClass}`;
        item.className = cls;
        item.textContent = text;
        feed.appendChild(item);
        feed.scrollTop = feed.scrollHeight;
    }

    // Submit quick task
    submitGoalBtn.addEventListener('click', async () => {
        const goal = goalInput.value.trim();
        if (!goal) return;

        try {
            const res = await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: goal,
                    attached_mode: true,
                    safe_mode: true
                })
            });
            const data = await res.json();
            goalInput.value = '';
            appendFeed(`🚀 Task started: ${goal} (ID: ${data.task_id})`);
        } catch (err) {
            appendFeed(`Failed to start task: ${err.message}`, true);
        }
    });

    handoffBtn.addEventListener('click', async () => {
        if (!currentTab || !currentTab.url) return;
        const goal = `Interact with active tab: ${currentTab.url}`;
        try {
            const res = await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: goal,
                    attached_mode: true,
                    safe_mode: true
                })
            });
            const data = await res.json();
            appendFeed(`⚡ Handoff tab to agent (Task ID: ${data.task_id})`);
        } catch (err) {
            appendFeed(`Failed to handoff tab: ${err.message}`, true);
        }
    });
});
