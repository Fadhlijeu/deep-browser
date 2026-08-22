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
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0]) {
                currentTab = tabs[0];
                tabTitle.textContent = currentTab.title || 'Untitled';
                tabUrl.textContent = currentTab.url || 'about:blank';
            }
        });
    }

    updateActiveTab();
    chrome.tabs.onActivated.addListener(updateActiveTab);
    chrome.tabs.onUpdated.addListener(updateActiveTab);

    // Check WS status from background
    chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }, (res) => {
        if (res && res.isConnected) {
            connectionPill.textContent = 'ONLINE';
            connectionPill.className = 'pill status-online';
        }
    });

    // Listen for events from background worker
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'WS_STATUS') {
            const isOnline = message.status === 'connected';
            connectionPill.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
            connectionPill.className = `pill ${isOnline ? 'status-online' : 'status-offline'}`;
        } else if (message.type === 'AGENT_EVENT') {
            handleAgentEvent(message.payload);
        }
    });

    function handleAgentEvent(payload) {
        const { event, data } = payload;
        if (event === 'STEP_PLANNED') {
            appendFeed(`[Step ${data.step}] ${data.action.tool}: ${data.thought}`);
        } else if (event === 'ACTION_RECEIPT') {
            const status = data.receipt.verification.status;
            appendFeed(`✓ Verification: [${status}] ${data.receipt.verification.actual_state}`, status === 'FAILED');
        } else if (event === 'TASK_COMPLETED') {
            appendFeed(`🎉 COMPLETED: ${data.task.result_summary}`);
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

    // Handoff active tab
    handoffBtn.addEventListener('click', async () => {
        if (!currentTab) return;
        handoffBtn.disabled = true;
        handoffBtn.textContent = 'HANDING OFF...';

        try {
            const res = await fetch('http://127.0.0.1:8765/api/extension/handoff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tab_id: currentTab.id,
                    url: currentTab.url,
                    title: currentTab.title
                })
            });
            const data = await res.json();
            appendFeed(`⚡ Attached to tab: ${currentTab.title}`);
        } catch (err) {
            appendFeed(`Error connecting to companion server: ${err.message}`, true);
        } finally {
            handoffBtn.disabled = false;
            handoffBtn.textContent = '⚡ HANDOFF TAB TO AGENT';
        }
    });

    // Submit quick task
    submitGoalBtn.addEventListener('click', async () => {
        const goal = goalInput.value.trim();
        if (!goal) return;

        try {
            await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, browser_mode: 'attached' })
            });
            goalInput.value = '';
            appendFeed(`🚀 Task started: ${goal}`);
        } catch (err) {
            appendFeed(`Failed to start task: ${err.message}`, true);
        }
    });
});
