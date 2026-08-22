// Deep-Browser SidePanel Script with Full Session and Agent Controls

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const connectionPill = document.getElementById('connection-pill');
    const agentStatePill = document.getElementById('agent-state-pill');
    const sessionSelect = document.getElementById('session-select');
    const btnAttachChrome = document.getElementById('btn-attach-chrome');
    const btnNewManaged = document.getElementById('btn-new-managed');

    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const tabCountBadge = document.getElementById('tab-count-badge');
    const handoffBtn = document.getElementById('handoff-btn');

    const goalInput = document.getElementById('sidepanel-goal');
    const submitGoalBtn = document.getElementById('submit-goal-btn');
    const btnPauseAgent = document.getElementById('btn-pause-agent');
    const btnResumeAgent = document.getElementById('btn-resume-agent');
    const btnStopAgent = document.getElementById('btn-stop-agent');

    const actionInspector = document.getElementById('action-inspector');
    const inspTool = document.getElementById('insp-tool');
    const inspTarget = document.getElementById('insp-target');
    const inspVerif = document.getElementById('insp-verif');
    const inspectorStatus = document.getElementById('inspector-status');

    // Safe Mode Modal Elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalActionText = document.getElementById('modal-action-text');
    const modalTargetText = document.getElementById('modal-target-text');
    const modalReasonText = document.getElementById('modal-reason-text');
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnRejectAction = document.getElementById('btn-reject-action');

    const feed = document.getElementById('sidepanel-feed');

    let currentTab = null;
    let activeConfirmation = null;
    let activeTaskId = null;
    let isAgentRunning = false;

    // Load active tab from Chrome extension API if available
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
            ws = new WebSocket('ws://127.0.0.1:8765/ws/extension');
            ws.onopen = () => {
                connectionPill.textContent = 'ONLINE';
                connectionPill.className = 'pill status-online';
                fetchSessions();
                fetchBrowserState();
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

    // Session Management
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
        sessionSelect.innerHTML = '';
        if (sessions.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No sessions (click Attach or New)';
            sessionSelect.appendChild(opt);
            return;
        }

        sessions.forEach((s) => {
            const opt = document.createElement('option');
            opt.value = s.id;
            const indicator = s.status === 'connected' ? '●' : '○';
            const mode = s.mode === 'attached' ? '[Attached]' : '[Managed]';
            opt.textContent = `${indicator} ${s.name} ${mode}`;
            if (s.id === activeId || s.is_active) {
                opt.selected = true;
                if (s.tab_count) {
                    tabCountBadge.textContent = `${s.tab_count} tab${s.tab_count > 1 ? 's' : ''}`;
                }
            }
            sessionSelect.appendChild(opt);
        });
    }

    sessionSelect.addEventListener('change', async () => {
        const targetSid = sessionSelect.value;
        if (!targetSid) return;
        try {
            await fetch(`http://127.0.0.1:8765/api/sessions/${targetSid}/switch`, { method: 'POST' });
            appendFeed(`🔄 Switched to session: ${targetSid}`);
            fetchBrowserState();
        } catch (e) {
            appendFeed(`❌ Error switching session: ${e.message}`, true);
        }
    });

    btnAttachChrome.addEventListener('click', async () => {
        appendFeed('⚡ Attaching to user Chrome on port 9222...');
        try {
            const res = await fetch('http://127.0.0.1:8765/api/sessions/attach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Current Chrome', cdp_port: 9222 })
            });
            const data = await res.json();
            if (data.status === 'connected') {
                appendFeed(`✓ Successfully attached to Chrome (Session: ${data.id})`);
            } else {
                appendFeed(`⚠️ Attached session created with status: ${data.status} (${data.error_message || 'Verify Chrome is running with --remote-debugging-port=9222'})`, false, 'warning');
            }
            fetchSessions();
        } catch (e) {
            appendFeed(`❌ Attach failed: ${e.message}`, true);
        }
    });

    btnNewManaged.addEventListener('click', async () => {
        appendFeed('➕ Launching new managed Chromium session...');
        try {
            const res = await fetch('http://127.0.0.1:8765/api/sessions/managed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Managed Session', headless: false })
            });
            const data = await res.json();
            appendFeed(`✓ Managed session created: ${data.name}`);
            fetchSessions();
        } catch (e) {
            appendFeed(`❌ Launch failed: ${e.message}`, true);
        }
    });

    async function fetchBrowserState() {
        try {
            const res = await fetch('http://127.0.0.1:8765/api/browser/state');
            if (!res.ok) return;
            const state = await res.json();
            if (state.connected) {
                if (state.title) tabTitle.textContent = state.title;
                if (state.url) tabUrl.textContent = state.url;
                if (state.tab_count) tabCountBadge.textContent = `${state.tab_count} tab${state.tab_count > 1 ? 's' : ''}`;
            }
        } catch (e) {}
    }

    // Agent Controls
    function setAgentState(state) {
        agentStatePill.textContent = state;
        agentStatePill.className = `pill state-${state.toLowerCase()}`;

        if (state === 'RUNNING' || state === 'THINKING' || state === 'EXECUTING') {
            isAgentRunning = true;
            submitGoalBtn.disabled = true;
            btnPauseAgent.disabled = false;
            btnPauseAgent.classList.remove('hidden');
            btnResumeAgent.classList.add('hidden');
            btnStopAgent.disabled = false;
        } else if (state === 'PAUSED' || state === 'PAUSED_FOR_CONFIRMATION') {
            isAgentRunning = true;
            btnPauseAgent.classList.add('hidden');
            btnResumeAgent.classList.remove('hidden');
            btnResumeAgent.disabled = false;
            btnStopAgent.disabled = false;
        } else {
            isAgentRunning = false;
            submitGoalBtn.disabled = false;
            btnPauseAgent.disabled = true;
            btnPauseAgent.classList.remove('hidden');
            btnResumeAgent.classList.add('hidden');
            btnStopAgent.disabled = true;
        }
    }

    btnPauseAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/pause', { method: 'POST' });
            setAgentState('PAUSED');
            appendFeed('⏸️ Agent paused by user.');
        } catch (e) {
            appendFeed(`❌ Pause failed: ${e.message}`, true);
        }
    });

    btnResumeAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/resume', { method: 'POST' });
            setAgentState('RUNNING');
            appendFeed('▶️ Resuming agent execution...');
        } catch (e) {
            appendFeed(`❌ Resume failed: ${e.message}`, true);
        }
    });

    btnStopAgent.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/stop', { method: 'POST' });
            setAgentState('STOPPED');
            appendFeed('🛑 Agent stopped by user.');
        } catch (e) {
            appendFeed(`❌ Stop failed: ${e.message}`, true);
        }
    });

    // Event Handler
    function handleAgentEvent(evt) {
        const { event_type, message, data } = evt;

        if (event_type === 'CONFIRMATION_REQUIRED') {
            setAgentState('PAUSED_FOR_CONFIRMATION');
            showConfirmationModal(data);
            appendFeed(`⚠️ [SAFE MODE] ${message || 'Sensitive action requires confirmation'}`, false, 'warning');
        } else if (event_type === 'ACTION_CONFIRMED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendFeed(`✓ [CONFIRMED] User approved action.`);
        } else if (event_type === 'ACTION_REJECTED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendFeed(`✗ [REJECTED] User rejected action.`, true);
        } else if (event_type === 'ACTION_TIMED_OUT') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendFeed(`⏱️ [TIMED OUT] Safe Mode confirmation expired. Action cancelled.`, true);
        } else if (event_type === 'TASK_CREATED') {
            setAgentState('RUNNING');
            activeTaskId = evt.task_id;
            appendFeed(`🚀 [TASK] ${message || 'Task initiated'}`);
        } else if (event_type === 'TASK_STARTED') {
            setAgentState('RUNNING');
            appendFeed(`⚙️ [AGENT] ${message || 'Reasoning loop started'}`);
        } else if (event_type === 'OBSERVATION') {
            setAgentState('THINKING');
            if (data && data.url) tabUrl.textContent = data.url;
            if (data && data.title) tabTitle.textContent = data.title;
            if (data && data.thought) {
                appendFeed(`💡 [THOUGHT] ${data.thought}`);
            }
        } else if (event_type === 'ACTION_REQUESTED') {
            setAgentState('EXECUTING');
            showActionInspector(data);
            appendFeed(`▶ [ACTION] ${message || JSON.stringify(data)}`);
        } else if (event_type === 'VERIFICATION') {
            appendFeed(`✓ [VERIFIED] ${message || JSON.stringify(data)}`);
        } else if (event_type === 'PAUSED') {
            setAgentState('PAUSED');
        } else if (event_type === 'RESUMED' || event_type === 'RESUMING') {
            setAgentState('RUNNING');
        } else if (event_type === 'STOPPED') {
            setAgentState('STOPPED');
            hideConfirmationModal();
        } else if (event_type === 'COMPLETED') {
            setAgentState('COMPLETED');
            hideConfirmationModal();
            appendFeed(`🎉 [COMPLETED] ${message || 'Success'}`);
        } else if (event_type === 'FAILED') {
            setAgentState('FAILED');
            hideConfirmationModal();
            appendFeed(`❌ [FAILED] ${message || 'Task encountered error'}`, true);
        } else if (event_type.startsWith('SESSION_')) {
            fetchSessions();
        }
    }

    function showActionInspector(data) {
        if (!data) return;
        actionInspector.classList.remove('hidden');
        inspTool.textContent = data.tool || data.action_name || 'browser_use.Tools';
        inspTarget.textContent = data.target || data.element_text || (data.params ? JSON.stringify(data.params) : '-');
        inspVerif.textContent = 'PENDING';
        inspVerif.className = 'val warning';
    }

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

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'CONFIRMATION_DECISION',
                confirmation_id: confId,
                decision: decision,
            }));
        } else {
            try {
                await fetch(`http://127.0.0.1:8765/api/confirmations/${confId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ decision: decision })
                });
            } catch (e) {
                console.error('Error submitting decision via REST:', e);
            }
        }
    }

    btnConfirmAction.addEventListener('click', () => sendDecision('CONFIRM'));
    btnRejectAction.addEventListener('click', () => sendDecision('REJECT'));

    function appendFeed(text, isError = false, type = '') {
        const item = document.createElement('div');
        item.className = 'feed-item' + (isError ? ' error' : type ? ` ${type}` : '');
        item.textContent = text;

        const emptyHint = feed.querySelector('.empty-hint');
        if (emptyHint) emptyHint.remove();

        feed.appendChild(item);
        feed.scrollTop = feed.scrollHeight;
    }

    // Submit Task
    submitGoalBtn.addEventListener('click', async () => {
        const goal = goalInput.value.trim();
        if (!goal) return;

        if (connectionPill.textContent === 'OFFLINE') {
            appendFeed(`❌ Current browser runtime is unavailable. Ensure Deep-Browser Desktop is running.`, true);
            setAgentState('FAILED');
            return;
        }

        appendFeed(`🚀 Starting in Current Chrome: ${goal}`);
        setAgentState('RUNNING');

        const selectedSid = sessionSelect.value || undefined;

        try {
            const res = await fetch('http://127.0.0.1:8765/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task: goal,
                    session_id: selectedSid,
                    browser_mode: 'ATTACHED',
                    browser_id: 'chrome_9222',
                    tab_id: currentTab ? currentTab.id : undefined,
                    safe_mode: true,
                })
            });
            const data = await res.json();
            activeTaskId = data.task_id;
            appendFeed(`⚡ Attached to Current Chrome tab: ${currentTab ? (currentTab.title || currentTab.url) : 'active'}`);
        } catch (e) {
            appendFeed(`❌ Error: ${e.message}`, true);
            setAgentState('FAILED');
        }
    });

    handoffBtn.addEventListener('click', () => {
        const url = tabUrl.textContent;
        const title = tabTitle.textContent;
        goalInput.value = `Navigate to ${url} and summarize page content for "${title}".`;
        goalInput.focus();
    });
});
