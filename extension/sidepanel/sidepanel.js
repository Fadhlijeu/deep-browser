// Deep-Browser SidePanel Script

document.addEventListener('DOMContentLoaded', () => {
    const connectionPill = document.getElementById('connection-pill');
    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const handoffBtn = document.getElementById('handoff-btn');
    const goalInput = document.getElementById('sidepanel-goal');
    const submitGoalBtn = document.getElementById('submit-goal-btn');
    const feed = document.getElementById('sidepanel-feed');

    let currentTab = null;

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
        if (event_type === 'TASK_CREATED' || event_type === 'TASK_STARTED') {
            appendFeed(`🚀 [${event_type}] ${message || 'Task initiated'}`);
        } else if (event_type === 'VERIFICATION') {
            appendFeed(`✓ [VERIFIED] ${message || JSON.stringify(data)}`);
        } else if (event_type === 'COMPLETED') {
            appendFeed(`🎉 [COMPLETED] ${message || 'Success'}`);
        } else if (event_type === 'FAILED') {
            appendFeed(`❌ [FAILED] ${message || 'Task encountered error'}`, true);
        } else {
            appendFeed(`• [${event_type}] ${message || ''}`);
        }
    }

    function appendFeed(text, isError = false) {
        if (feed.querySelector('.empty-hint')) {
            feed.innerHTML = '';
        }
        const item = document.createElement('div');
        item.className = `feed-item ${isError ? 'failed' : ''}`;
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
});
