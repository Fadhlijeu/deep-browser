// Deep-Browser Chrome Extension SidePanel — Compact In-Browser Co-Pilot Script

document.addEventListener('DOMContentLoaded', () => {
    // Header & State
    const connectionPill = document.getElementById('connection-pill');
    const agentStatePill = document.getElementById('agent-state-pill');
    const sessionDisplay = document.getElementById('session-display');
    const modelSelect = document.getElementById('model-select');

    // Context & Active Tab
    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const btnSendToWorkspace = document.getElementById('btn-send-to-workspace');

    // Challenge Banner
    const challengeBanner = document.getElementById('challenge-banner');
    const challengeText = document.getElementById('challenge-text');
    const btnFocusTab = document.getElementById('btn-focus-tab');

    // Timeline & Feed
    const feed = document.getElementById('sidepanel-feed');
    const btnClearTimeline = document.getElementById('btn-clear-timeline');

    // Composer & Controls
    const goalInput = document.getElementById('sidepanel-goal');
    const submitGoalBtn = document.getElementById('submit-goal-btn');
    const btnPauseAgent = document.getElementById('btn-pause-agent');
    const btnResumeAgent = document.getElementById('btn-resume-agent');
    const btnStopAgent = document.getElementById('btn-stop-agent');

    // Safe Mode Modal
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalActionText = document.getElementById('modal-action-text');
    const modalTargetText = document.getElementById('modal-target-text');
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnRejectAction = document.getElementById('btn-reject-action');

    let currentTab = null;
    let activeExtSessionId = `EXT-${Math.floor(100 + Math.random() * 900)}`;
    let activeTaskId = null;
    let ws = null;
    let isConnected = false;

    if (sessionDisplay) {
        sessionDisplay.textContent = `${activeExtSessionId} · Current Tab`;
    }

    // --- 1. Active Tab Resolution ---
    function updateActiveTab() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    currentTab = tabs[0];
                    if (tabTitle) tabTitle.textContent = currentTab.title || 'Untitled Tab';
                    if (tabUrl) tabUrl.textContent = currentTab.url || 'about:blank';
                }
            });
        } else {
            if (tabTitle) tabTitle.textContent = 'Chrome Tab (Active)';
            if (tabUrl) tabUrl.textContent = 'http://localhost';
        }
    }

    updateActiveTab();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated.addListener(updateActiveTab);
        chrome.tabs.onUpdated.addListener(updateActiveTab);
    }

    if (btnFocusTab) {
        btnFocusTab.addEventListener('click', () => {
            if (currentTab && typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.update(currentTab.id, { active: true });
            }
        });
    }

    // --- 2. WebSocket & Health Connection ---
    function setConnectionStatus(online) {
        isConnected = online;
        if (online) {
            connectionPill.textContent = 'ONLINE';
            connectionPill.className = 'pill status-online';
        } else {
            connectionPill.textContent = 'OFFLINE';
            connectionPill.className = 'pill status-offline';
            setAgentState('IDLE');
        }
    }

    function setAgentState(state) {
        agentStatePill.textContent = state;
        const normalized = state.toLowerCase();
        agentStatePill.className = `pill state-${normalized}`;

        const isRunning = (state === 'RUNNING' || state === 'THINKING' || state === 'EXECUTING');
        const isPaused = (state === 'PAUSED');

        btnPauseAgent.disabled = !isRunning;
        btnStopAgent.disabled = !(isRunning || isPaused);

        if (isPaused) {
            btnPauseAgent.classList.add('hidden');
            btnResumeAgent.classList.remove('hidden');
        } else {
            btnPauseAgent.classList.remove('hidden');
            btnResumeAgent.classList.add('hidden');
        }
    }

    function connectWebSocket() {
        if (ws) {
            try { ws.close(); } catch (e) {}
        }

        try {
            ws = new WebSocket('ws://127.0.0.1:8765/ws/timeline');
            ws.onopen = () => {
                setConnectionStatus(true);
            };
            ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    // Filter: only process events for our session or extension
                    if (data.owner === 'WORKSPACE') return;
                    handleAgentEvent(data);
                } catch (e) {
                    console.error('Error parsing WS message:', e);
                }
            };
            ws.onclose = () => {
                setConnectionStatus(false);
                setTimeout(connectWebSocket, 3000);
            };
            ws.onerror = () => {
                setConnectionStatus(false);
            };
        } catch (e) {
            setConnectionStatus(false);
            setTimeout(connectWebSocket, 3000);
        }
    }

    connectWebSocket();

    // --- 3. Event Stream & Action Card Rendering ---
    function formatTime() {
        const d = new Date();
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    }

    function removeEmptyState() {
        const empty = feed.querySelector('.empty-state');
        if (empty) empty.remove();
    }

    function appendEventCard({ type = 'event-card', tag, icon, body, targetCode, isError = false }) {
        removeEmptyState();

        const card = document.createElement('div');
        card.className = `event-card ${type} ${isError ? 'error' : ''}`;

        const header = document.createElement('div');
        header.className = 'event-card-header';

        const tagSpan = document.createElement('span');
        tagSpan.className = 'event-tag';
        tagSpan.innerHTML = `${icon} ${tag}`;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'event-time';
        timeSpan.textContent = formatTime();

        header.appendChild(tagSpan);
        header.appendChild(timeSpan);

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'event-card-body';
        bodyDiv.textContent = body;

        if (targetCode) {
            const codeSpan = document.createElement('span');
            codeSpan.className = 'target-code';
            codeSpan.textContent = targetCode;
            bodyDiv.appendChild(document.createTextNode(' '));
            bodyDiv.appendChild(codeSpan);
        }

        card.appendChild(header);
        card.appendChild(bodyDiv);
        feed.appendChild(card);
        feed.scrollTop = feed.scrollHeight;
    }

    function handleAgentEvent(evt) {
        const eventType = evt.event_type;
        const msg = evt.message || '';
        const data = evt.data || {};

        if (eventType === 'CONFIRMATION_REQUIRED') {
            setAgentState('PAUSED');
            showConfirmationModal(data);
            appendEventCard({
                type: 'thinking',
                tag: 'SAFE MODE',
                icon: '🛡️',
                body: `Confirmation required: ${data.action || 'Execute action'}`,
                targetCode: data.target || '',
            });
        } else if (eventType === 'ACTION_CONFIRMED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendEventCard({
                type: 'verified',
                tag: 'APPROVED',
                icon: '✓',
                body: 'Action confirmed. Resuming execution.',
            });
        } else if (eventType === 'ACTION_REJECTED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendEventCard({
                type: 'error',
                tag: 'REJECTED',
                icon: '✗',
                body: 'Action rejected by user.',
                isError: true,
            });
        } else if (eventType === 'CHALLENGE_REQUIRED' || eventType === 'BLOCKED') {
            setAgentState('BLOCKED');
            challengeBanner.classList.remove('hidden');
            challengeText.textContent = msg || 'Cloudflare verification detected.';
            appendEventCard({
                type: 'thinking',
                tag: 'VERIFICATION REQUIRED',
                icon: '🛡️',
                body: msg || 'Cloudflare challenge detected. Waiting for user interaction.',
            });
        } else if (eventType === 'CHALLENGE_RESOLVED') {
            setAgentState('RUNNING');
            challengeBanner.classList.add('hidden');
            appendEventCard({
                type: 'verified',
                tag: 'RESOLVED',
                icon: '✅',
                body: 'Verification resolved on current tab. Resuming task...',
            });
        } else if (eventType === 'CHALLENGE_TIMEOUT' || eventType === 'WATCHDOG_TIMEOUT') {
            setAgentState('FAILED');
            challengeBanner.classList.add('hidden');
            appendEventCard({
                type: 'error',
                tag: 'TIMED OUT',
                icon: '⏱️',
                body: msg || 'Challenge verification timed out.',
                isError: true,
            });
        } else if (eventType === 'CONTEXT_ATTACHED') {
            setAgentState('THINKING');
            if (data.url && tabUrl) tabUrl.textContent = data.url;
            if (data.title && tabTitle) tabTitle.textContent = data.title;
            appendEventCard({
                type: 'action',
                tag: 'OBSERVE',
                icon: '👁',
                body: 'Current tab detected and attached',
                targetCode: data.url || '',
            });
        } else if (eventType === 'THINKING_STATUS') {
            setAgentState('THINKING');
            appendEventCard({
                type: 'thinking',
                tag: 'THINKING',
                icon: '🧠',
                body: msg || data.thinking || 'Analyzing page...',
            });
        } else if (eventType === 'OBSERVATION') {
            setAgentState('THINKING');
            if (data.url && tabUrl) tabUrl.textContent = data.url;
            if (data.title && tabTitle) tabTitle.textContent = data.title;
            if (data.thought) {
                appendEventCard({
                    type: 'thinking',
                    tag: 'OBSERVING',
                    icon: '👁',
                    body: data.thought,
                });
            }
        } else if (eventType === 'NAVIGATE') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action',
                tag: 'NAVIGATE',
                icon: '🌐',
                body: 'Navigate to',
                targetCode: evt.target || data.url || msg,
            });
        } else if (eventType === 'CLICK') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action',
                tag: 'CLICK',
                icon: '🖱',
                body: 'Clicking element',
                targetCode: evt.target || msg,
            });
        } else if (eventType === 'TYPE') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action',
                tag: 'TYPE',
                icon: '⌨',
                body: 'Type',
                targetCode: `"${evt.target || data.text || ''}"`,
            });
        } else if (eventType === 'PRESS_KEY') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action',
                tag: 'KEY PRESS',
                icon: '⌨',
                body: `Press key "${evt.target || data.key || ''}"`,
            });
        } else if (eventType === 'SCROLL') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action',
                tag: 'SCROLL',
                icon: '📜',
                body: 'Scroll page',
                targetCode: evt.target || '',
            });
        } else if (eventType === 'WAIT') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'thinking',
                tag: 'WAIT',
                icon: '⏳',
                body: `Wait ${evt.target || ''}`,
            });
        } else if (eventType === 'VERIFICATION') {
            appendEventCard({
                type: 'verified',
                tag: 'VERIFIED',
                icon: '✅',
                body: msg || 'Verified',
            });
        } else if (eventType === 'PAUSED') {
            setAgentState('PAUSED');
        } else if (eventType === 'RESUMED' || eventType === 'RESUMING') {
            setAgentState('RUNNING');
        } else if (eventType === 'STOPPED') {
            setAgentState('IDLE');
            hideConfirmationModal();
            challengeBanner.classList.add('hidden');
        } else if (eventType === 'COMPLETED') {
            setAgentState('COMPLETED');
            hideConfirmationModal();
            challengeBanner.classList.add('hidden');
            appendEventCard({
                type: 'verified',
                tag: 'COMPLETED',
                icon: '✅',
                body: data.result || msg || 'Task completed.',
            });
        } else if (eventType === 'FAILED') {
            setAgentState('FAILED');
            hideConfirmationModal();
            challengeBanner.classList.add('hidden');
            appendEventCard({
                type: 'error',
                tag: 'FAILED',
                icon: '❌',
                body: msg || 'Task failed.',
                isError: true,
            });
        }
    }

    // --- 4. Submit Task Flow ---
    submitGoalBtn.addEventListener('click', async () => {
        const goal = goalInput.value.trim();
        if (!goal) return;

        // Render user prompt card in timeline
        appendEventCard({
            type: 'user',
            tag: 'YOU',
            icon: '👤',
            body: goal,
        });

        goalInput.value = '';
        setAgentState('THINKING');
        challengeBanner.classList.add('hidden');

        const selectedModel = modelSelect ? modelSelect.value : 'gemini-3.5-flash-lite';

        try {
            const res = await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: goal,
                    session_id: activeExtSessionId,
                    session_type: 'EXTENSION',
                    owner: 'EXTENSION',
                    browser_mode: 'ATTACHED',
                    browser_type: 'edge',
                    browser_id: 'edge_9222',
                    tab_id: currentTab ? currentTab.id : undefined,
                    window_id: currentTab ? currentTab.windowId : undefined,
                    url: currentTab ? currentTab.url : undefined,
                    title: currentTab ? currentTab.title : undefined,
                    model_provider: 'gemini',
                    model_name: selectedModel,
                    safe_mode: true,
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || `Server returned ${res.status}`);
            }

            const data = await res.json();
            activeTaskId = data.task_id;
            if (data.session_id) {
                activeExtSessionId = data.session_id;
                if (sessionDisplay) sessionDisplay.textContent = `${activeExtSessionId} · Current Tab`;
            }
        } catch (e) {
            appendEventCard({
                type: 'error',
                tag: 'ERROR',
                icon: '❌',
                body: `${e.message}`,
                isError: true,
            });
            setAgentState('FAILED');
        }
    });

    goalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitGoalBtn.click();
        }
    });

    // --- 5. Handoff to Workspace ---
    if (btnSendToWorkspace) {
        btnSendToWorkspace.addEventListener('click', async () => {
            btnSendToWorkspace.disabled = true;
            btnSendToWorkspace.textContent = '⏳ Sending...';

            try {
                const res = await fetch('http://127.0.0.1:8765/api/handoff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: activeExtSessionId,
                        to_owner: 'WORKSPACE',
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Server returned ${res.status}`);
                }

                btnSendToWorkspace.textContent = '✅ Sent to Workspace';
                btnSendToWorkspace.classList.add('sent');

                appendEventCard({
                    type: 'verified',
                    tag: 'HANDOFF',
                    icon: '🚀',
                    body: 'Session sent to Desktop Workspace with [EXT] tag.',
                });
            } catch (e) {
                btnSendToWorkspace.disabled = false;
                btnSendToWorkspace.textContent = '🚀 Send to Workspace';
                appendEventCard({
                    type: 'error',
                    tag: 'HANDOFF ERROR',
                    icon: '❌',
                    body: `Handoff failed: ${e.message}`,
                    isError: true,
                });
            }
        });
    }

    // --- 6. Agent Controls ---
    btnPauseAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/pause', { method: 'POST' });
            setAgentState('PAUSED');
        } catch (e) {
            console.error('Pause failed:', e);
        }
    });

    btnResumeAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/resume', { method: 'POST' });
            setAgentState('RUNNING');
        } catch (e) {
            console.error('Resume failed:', e);
        }
    });

    btnStopAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/stop', { method: 'POST' });
            setAgentState('IDLE');
        } catch (e) {
            console.error('Stop failed:', e);
        }
    });

    btnClearTimeline.addEventListener('click', () => {
        feed.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🤖</span>
                <span class="empty-title">Deep-Browser Ready</span>
                <span class="empty-desc">Ask anything on the current active tab.</span>
            </div>
        `;
    });

    function showConfirmationModal(data) {
        modalActionText.textContent = data.action || 'Execute action';
        modalTargetText.textContent = data.target || '-';
        confirmationModal.classList.remove('hidden');
    }

    function hideConfirmationModal() {
        confirmationModal.classList.add('hidden');
    }

    btnConfirmAction.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: 'CONFIRM' }),
            });
            hideConfirmationModal();
        } catch (e) {
            console.error('Confirm failed:', e);
        }
    });

    btnRejectAction.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: 'REJECT' }),
            });
            hideConfirmationModal();
        } catch (e) {
            console.error('Reject failed:', e);
        }
    });
});
