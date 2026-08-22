// Deep-Browser Chrome Extension SidePanel — Compact DeepDOM-Style Co-Pilot Script

document.addEventListener('DOMContentLoaded', () => {
    // Header & State
    const connectionPill = document.getElementById('connection-pill');
    const agentStatePill = document.getElementById('agent-state-pill');
    const sessionSelect = document.getElementById('session-select');
    const modelSelect = document.getElementById('model-select');

    // Context & Active Tab
    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const handoffBtn = document.getElementById('handoff-btn');

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
    const modalReasonText = document.getElementById('modal-reason-text');
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnRejectAction = document.getElementById('btn-reject-action');

    let currentTab = null;
    let activeConfirmation = null;
    let activeTaskId = null;
    let ws = null;
    let isConnected = false;

    // --- 1. Active Tab Resolution ---
    function updateActiveTab() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs && tabs[0]) {
                    currentTab = tabs[0];
                    tabTitle.textContent = currentTab.title || 'Untitled Tab';
                    tabUrl.textContent = currentTab.url || 'about:blank';
                }
            });
        } else {
            tabTitle.textContent = 'Chrome Tab (Active)';
            tabUrl.textContent = 'http://localhost';
        }
    }

    updateActiveTab();
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated.addListener(updateActiveTab);
        chrome.tabs.onUpdated.addListener(updateActiveTab);
    }

    handoffBtn.addEventListener('click', () => {
        const url = tabUrl.textContent;
        const title = tabTitle.textContent;
        goalInput.value = `Navigate to ${url} and summarize the page content.`;
        goalInput.focus();
    });

    btnFocusTab.addEventListener('click', () => {
        if (currentTab && typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.update(currentTab.id, { active: true });
        }
    });

    const btnSendToWorkspace = document.getElementById('btn-send-to-workspace');
    if (btnSendToWorkspace) {
        btnSendToWorkspace.addEventListener('click', async () => {
            const sid = activeTaskId || sessionSelect.value;
            btnSendToWorkspace.disabled = true;
            btnSendToWorkspace.textContent = '⏳ Sending...';

            try {
                const res = await fetch('http://127.0.0.1:8765/api/handoff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sid,
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
                    body: 'Session successfully sent to Desktop Workspace with [EXT] tag.',
                });
            } catch (e) {
                btnSendToWorkspace.disabled = false;
                btnSendToWorkspace.textContent = '🚀 Send to Workspace';
                appendEventCard({
                    type: 'error',
                    tag: 'HANDOFF ERROR',
                    icon: '❌',
                    body: `Could not hand off session: ${e.message}`,
                    isError: true,
                });
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
            btnResumeAgent.disabled = false;
        } else {
            btnPauseAgent.classList.remove('hidden');
            btnResumeAgent.classList.add('hidden');
        }
    }

    function connectWs() {
        try {
            ws = new WebSocket('ws://127.0.0.1:8765/ws/extension');
            ws.onopen = () => {
                setConnectionStatus(true);
                fetchSessions();
            };
            ws.onclose = () => {
                setConnectionStatus(false);
                setTimeout(connectWs, 3000);
            };
            ws.onerror = () => {
                setConnectionStatus(false);
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
            setConnectionStatus(false);
            setTimeout(connectWs, 3000);
        }
    }
    connectWs();

    // --- 3. Session Fetching ---
    async function fetchSessions() {
        try {
            const res = await fetch('http://127.0.0.1:8765/api/sessions');
            if (!res.ok) return;
            const data = await res.json();
            renderSessionSelect(data.sessions || [], data.active_session_id);
        } catch (e) {
            console.debug('Could not fetch sessions:', e);
        }
    }

    function renderSessionSelect(sessions, activeId) {
        const savedVal = sessionSelect.value || 'attached_edge';
        sessionSelect.innerHTML = '';
        
        const defaultOptions = [
            { value: 'attached_edge', label: '🌊 Edge (Attached)' },
            { value: 'attached_chrome', label: '⚡ Chrome (Attached)' },
            { value: 'attached_brave', label: '🦁 Brave (Attached)' },
            { value: 'managed_bundled', label: '🌐 Bundled Chromium' },
        ];

        defaultOptions.forEach((opt) => {
            const el = document.createElement('option');
            el.value = opt.value;
            el.textContent = opt.label;
            if (opt.value === savedVal) el.selected = true;
            sessionSelect.appendChild(el);
        });

        sessions.forEach((s) => {
            if (defaultOptions.some(d => d.value === s.id)) return;
            const opt = document.createElement('option');
            opt.value = s.id;
            const mode = s.mode === 'attached' ? '[Attached]' : '[Managed]';
            opt.textContent = `${s.name || s.id} ${mode}`;
            if (s.id === savedVal) opt.selected = true;
            sessionSelect.appendChild(opt);
        });
    }

    // --- 4. Event Stream & Action Card Rendering ---
    function formatTime() {
        const d = new Date();
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    }

    function removeEmptyState() {
        const empty = feed.querySelector('.empty-state');
        if (empty) empty.remove();
    }

    function appendEventCard({ type, tag, icon, body, targetCode, isError = false }) {
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
                body: 'User approved action. Resuming execution.',
            });
        } else if (eventType === 'ACTION_REJECTED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendEventCard({
                type: 'error',
                tag: 'REJECTED',
                icon: '✗',
                body: 'User rejected action.',
                isError: true,
            });
        } else if (eventType === 'CHALLENGE_REQUIRED' || eventType === 'BLOCKED') {
            setAgentState('BLOCKED');
            challengeBanner.classList.remove('hidden');
            challengeText.textContent = msg || 'Cloudflare is asking for browser verification.';
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
                tag: 'CHALLENGE RESOLVED',
                icon: '✅',
                body: 'Verification detected. Resuming task execution...',
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
            if (data.url) tabUrl.textContent = data.url;
            if (data.title) tabTitle.textContent = data.title;
            appendEventCard({
                type: 'thinking',
                tag: 'CONTEXT ATTACHED',
                icon: '👁️',
                body: msg || `Attached directly to tab: ${data.title || data.url || 'Active Tab'}`,
                targetCode: data.url || '',
            });
        } else if (eventType === 'THINKING_STATUS') {
            setAgentState('THINKING');
            appendEventCard({
                type: 'thinking',
                tag: 'ANALYZING',
                icon: '🧠',
                body: msg || data.thinking || 'Analyzing page context...',
            });
        } else if (eventType === 'OBSERVATION') {
            setAgentState('THINKING');
            if (data.url) tabUrl.textContent = data.url;
            if (data.title) tabTitle.textContent = data.title;
            if (data.thought) {
                appendEventCard({
                    type: 'thinking',
                    tag: 'OBSERVING',
                    icon: '👁️',
                    body: data.thought,
                });
            }
        } else if (eventType === 'NAVIGATE') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-navigate',
                tag: 'NAVIGATE',
                icon: '🌐',
                body: 'Navigating to',
                targetCode: evt.target || data.url || msg,
            });
        } else if (eventType === 'CLICK') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-click',
                tag: 'CLICK',
                icon: '🖱️',
                body: 'Clicking element',
                targetCode: evt.target || msg,
            });
        } else if (eventType === 'TYPE') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-type',
                tag: 'TYPE',
                icon: '⌨️',
                body: 'Entering text',
                targetCode: `"${evt.target || data.text || ''}"`,
            });
        } else if (eventType === 'PRESS_KEY') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-type',
                tag: 'PRESS KEY',
                icon: '⌨️',
                body: `Pressing key "${evt.target || data.key || ''}"`,
            });
        } else if (eventType === 'SCROLL') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-scroll',
                tag: 'SCROLL',
                icon: '📜',
                body: 'Scrolling page',
                targetCode: evt.target || '',
            });
        } else if (eventType === 'WAIT') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'thinking',
                tag: 'WAIT',
                icon: '⏳',
                body: `Waiting ${evt.target || ''}`,
            });
        } else if (eventType === 'TAB_SWITCH') {
            setAgentState('RUNNING');
            appendEventCard({
                type: 'action-navigate',
                tag: 'TAB SWITCH',
                icon: '📑',
                body: 'Switching tab context',
                targetCode: evt.target || '',
            });
        } else if (eventType === 'VERIFICATION') {
            appendEventCard({
                type: 'verified',
                tag: 'VERIFIED',
                icon: '✅',
                body: msg || 'DOM state verified successfully.',
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
                icon: '🎉',
                body: data.result || msg || 'Task completed successfully.',
            });
        } else if (eventType === 'FAILED') {
            setAgentState('FAILED');
            hideConfirmationModal();
            challengeBanner.classList.add('hidden');
            appendEventCard({
                type: 'error',
                tag: 'FAILED',
                icon: '❌',
                body: msg || 'Task encountered an error.',
                isError: true,
            });
        } else if (eventType && eventType.startsWith('SESSION_')) {
            fetchSessions();
        }
    }

    // --- 5. Submit Task Flow ---
    submitGoalBtn.addEventListener('click', async () => {
        const goal = goalInput.value.trim();
        if (!goal) return;

        if (!isConnected) {
            appendEventCard({
                type: 'error',
                tag: 'RUNTIME OFFLINE',
                icon: '❌',
                body: 'Deep-Browser runtime is offline. Start the desktop app or runtime server.',
                isError: true,
            });
            return;
        }

        // Add user prompt to feed
        appendEventCard({
            type: 'user-prompt',
            tag: 'TASK',
            icon: '👤',
            body: goal,
        });

        goalInput.value = '';
        setAgentState('RUNNING');
        challengeBanner.classList.add('hidden');

        const selVal = sessionSelect.value || 'attached_edge';
        let bMode = 'ATTACHED';
        let bType = 'edge';
        let selectedSid = undefined;

        if (selVal === 'attached_edge') {
            bMode = 'ATTACHED';
            bType = 'edge';
        } else if (selVal === 'attached_chrome') {
            bMode = 'ATTACHED';
            bType = 'chrome';
        } else if (selVal === 'attached_brave') {
            bMode = 'ATTACHED';
            bType = 'brave';
        } else if (selVal === 'managed_bundled') {
            bMode = 'MANAGED';
            bType = 'bundled';
        } else {
            selectedSid = selVal;
        }

        const selectedModel = modelSelect.value;

        try {
            const res = await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: goal,
                    session_id: selectedSid,
                    session_type: 'EXTENSION',
                    owner: 'EXTENSION',
                    browser_mode: bMode,
                    browser_type: bType,
                    browser_id: `${bType}_9222`,
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
                throw new Error(errData.detail || `Server returned ${res.status}`);
            }

            const data = await res.json();
            activeTaskId = data.task_id;
        } catch (e) {
            appendEventCard({
                type: 'error',
                tag: 'SUBMISSION ERROR',
                icon: '❌',
                body: `Could not start task: ${e.message}`,
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
                <span class="empty-desc">Ask a task below to drive your current Chrome browser.</span>
            </div>
        `;
    });

    // --- 7. Safe Mode Modal ---
    function showConfirmationModal(data) {
        activeConfirmation = data;
        modalActionText.textContent = data.action || 'Execute action';
        modalTargetText.textContent = data.target || 'Target element';
        modalReasonText.textContent = data.reason || 'Protected action category';
        confirmationModal.classList.remove('hidden');
    }

    function hideConfirmationModal() {
        confirmationModal.classList.add('hidden');
        activeConfirmation = null;
    }

    async function sendDecision(decision) {
        if (!activeConfirmation || !activeConfirmation.confirmation_id) {
            hideConfirmationModal();
            return;
        }

        const confId = activeConfirmation.confirmation_id;
        hideConfirmationModal();

        try {
            await fetch(`http://127.0.0.1:8765/api/confirmations/${confId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: decision }),
            });
        } catch (e) {
            console.error('Failed to submit decision:', e);
        }
    }

    btnConfirmAction.addEventListener('click', () => sendDecision('CONFIRM'));
    btnRejectAction.addEventListener('click', () => sendDecision('REJECT'));
});
