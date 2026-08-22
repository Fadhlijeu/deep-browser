// Deep-Browser Chrome Extension SidePanel
// True In-Browser Agent — chrome.debugger CDP bridge model.
// NO browser selector. NO Workspace session. NO port 9222 requirement.

document.addEventListener('DOMContentLoaded', () => {
    const connectionPill = document.getElementById('connection-pill');
    const agentStatePill = document.getElementById('agent-state-pill');
    const sessionDisplay = document.getElementById('session-display');
    const modelSelect = document.getElementById('model-select');
    const tabTitle = document.getElementById('tab-title');
    const tabUrl = document.getElementById('tab-url');
    const btnSendToWorkspace = document.getElementById('btn-send-to-workspace');
    const challengeBanner = document.getElementById('challenge-banner');
    const challengeText = document.getElementById('challenge-text');
    const feed = document.getElementById('sidepanel-feed');
    const btnClearTimeline = document.getElementById('btn-clear-timeline');
    const goalInput = document.getElementById('sidepanel-goal');
    const submitGoalBtn = document.getElementById('submit-goal-btn');
    const btnPauseAgent = document.getElementById('btn-pause-agent');
    const btnResumeAgent = document.getElementById('btn-resume-agent');
    const btnStopAgent = document.getElementById('btn-stop-agent');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalActionText = document.getElementById('modal-action-text');
    const modalTargetText = document.getElementById('modal-target-text');
    const btnConfirmAction = document.getElementById('btn-confirm-action');
    const btnRejectAction = document.getElementById('btn-reject-action');

    // --- Extension-local task state (NOT in coordinator, NOT in Workspace) ---
    let currentTab = null;
    let activeExtSessionId = `EXT-${String(Math.floor(100 + Math.random() * 900)).padStart(3, '0')}`;
    let activeTaskId = null;
    let ws = null;
    let isConnected = false;

    if (sessionDisplay) sessionDisplay.textContent = activeExtSessionId;

    // ─────────────────────────────────────────────────────────────────
    // 1. Active Tab Detection — auto-detect current tab via chrome.tabs
    //    No user selection. Tab is determined by the Extension's context.
    // ─────────────────────────────────────────────────────────────────
    function detectActiveTab() {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' }, (tab) => {
                if (tab) {
                    currentTab = tab;
                    renderTabInfo(tab);
                }
            });
        } else {
            // Dev/test fallback
            currentTab = { id: 0, windowId: 0, url: 'http://localhost', title: 'Dev Tab' };
            renderTabInfo(currentTab);
        }
    }

    function renderTabInfo(tab) {
        if (tabTitle) tabTitle.textContent = tab.title || 'Untitled Tab';
        if (tabUrl) tabUrl.textContent = tab.url || 'about:blank';
    }

    detectActiveTab();

    // Re-detect when user activates or navigates a tab
    if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.onActivated?.addListener(detectActiveTab);
        chrome.tabs.onUpdated?.addListener((tabId, changeInfo) => {
            if (changeInfo.status === 'complete') detectActiveTab();
        });
    }

    // Listen for debugger-related messages from service worker
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'DEBUGGER_READY') {
                appendEventCard({
                    type: 'action',
                    tag: 'OBSERVE',
                    icon: '👁',
                    body: `chrome.debugger connected to tab ${message.tabId}. Agent ready.`,
                });
            } else if (message.type === 'DEBUGGER_DETACHED') {
                appendEventCard({
                    type: 'error',
                    tag: 'DEBUGGER DETACHED',
                    icon: '⚠️',
                    body: `Browser debugger detached (${message.reason}). Task may be interrupted.`,
                });
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. Server Connection Health Check
    // ─────────────────────────────────────────────────────────────────
    async function checkServerHealth() {
        try {
            const res = await fetch('http://127.0.0.1:8765/health', { signal: AbortSignal.timeout(2000) });
            if (res.ok) setConnectionStatus(true);
        } catch {
            setConnectionStatus(false);
        }
    }

    function setConnectionStatus(online) {
        isConnected = online;
        if (connectionPill) {
            connectionPill.textContent = online ? 'ONLINE' : 'OFFLINE';
            connectionPill.className = `pill ${online ? 'status-online' : 'status-offline'}`;
        }
        if (!online) setAgentState('IDLE');
    }

    function setAgentState(state) {
        if (agentStatePill) {
            agentStatePill.textContent = state;
            agentStatePill.className = `pill state-${state.toLowerCase()}`;
        }
        const isRunning = ['RUNNING', 'THINKING', 'EXECUTING'].includes(state);
        const isPaused = state === 'PAUSED';
        if (btnPauseAgent) btnPauseAgent.disabled = !isRunning;
        if (btnStopAgent) btnStopAgent.disabled = !(isRunning || isPaused);
        if (isPaused) {
            btnPauseAgent?.classList.add('hidden');
            btnResumeAgent?.classList.remove('hidden');
        } else {
            btnPauseAgent?.classList.remove('hidden');
            btnResumeAgent?.classList.add('hidden');
        }
    }

    checkServerHealth();
    setInterval(checkServerHealth, 10000);

    // ─────────────────────────────────────────────────────────────────
    // 3. Extension-only WebSocket Event Stream
    //    Connects to /ws/extension — only receives owner=EXTENSION events
    // ─────────────────────────────────────────────────────────────────
    function connectWebSocket() {
        try { if (ws) ws.close(); } catch (e) {}
        try {
            ws = new WebSocket('ws://127.0.0.1:8765/ws/extension');
            ws.onopen = () => setConnectionStatus(true);
            ws.onmessage = (evt) => {
                try {
                    const data = JSON.parse(evt.data);
                    // Safety: only process Extension-owned events
                    if (data.owner && data.owner !== 'EXTENSION') return;
                    handleAgentEvent(data);
                } catch (e) { console.error('WS parse error:', e); }
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

    // ─────────────────────────────────────────────────────────────────
    // 4. Event Card Rendering
    // ─────────────────────────────────────────────────────────────────
    function formatTime() {
        const d = new Date();
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
    }

    function removeEmptyState() {
        feed?.querySelector('.empty-state')?.remove();
    }

    function appendEventCard({ type = '', tag, icon, body, targetCode, isError = false }) {
        if (!feed) return;
        removeEmptyState();
        const card = document.createElement('div');
        card.className = `event-card ${type} ${isError ? 'error' : ''}`;

        const header = document.createElement('div');
        header.className = 'event-card-header';
        const tagSpan = document.createElement('span');
        tagSpan.className = 'event-tag';
        tagSpan.textContent = `${icon} ${tag}`;
        const timeSpan = document.createElement('span');
        timeSpan.className = 'event-time';
        timeSpan.textContent = formatTime();
        header.append(tagSpan, timeSpan);

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'event-card-body';
        bodyDiv.textContent = body;
        if (targetCode) {
            const code = document.createElement('span');
            code.className = 'target-code';
            code.textContent = targetCode;
            bodyDiv.append(' ', code);
        }

        card.append(header, bodyDiv);
        feed.appendChild(card);
        feed.scrollTop = feed.scrollHeight;
    }

    function handleAgentEvent(evt) {
        const t = evt.event_type;
        const msg = evt.message || '';
        const data = evt.data || {};

        if (t === 'CONTEXT_ATTACHED') {
            setAgentState('THINKING');
            if (data.url && tabUrl) tabUrl.textContent = data.url;
            if (data.title && tabTitle) tabTitle.textContent = data.title;
            appendEventCard({ type: 'action', tag: 'OBSERVE', icon: '👁', body: `Current tab: ${data.title || data.url || 'Active Tab'}` });

        } else if (t === 'THINKING_STATUS') {
            setAgentState('THINKING');
            appendEventCard({ type: 'thinking', tag: 'THINKING', icon: '🧠', body: msg || data.thinking || 'Analyzing page...' });

        } else if (t === 'OBSERVATION') {
            setAgentState('THINKING');
            if (data.url && tabUrl) tabUrl.textContent = data.url;
            if (data.title && tabTitle) tabTitle.textContent = data.title;
            if (data.thought) appendEventCard({ type: 'thinking', tag: 'OBSERVING', icon: '👁', body: data.thought });

        } else if (t === 'NAVIGATE') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'action', tag: 'NAVIGATE', icon: '🌐', body: 'Navigate to', targetCode: evt.target || data.url || msg });

        } else if (t === 'CLICK') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'action', tag: 'CLICK', icon: '🖱', body: 'Click', targetCode: evt.target || msg });

        } else if (t === 'TYPE') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'action', tag: 'TYPE', icon: '⌨', body: 'Type', targetCode: `"${evt.target || data.text || ''}"` });

        } else if (t === 'PRESS_KEY') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'action', tag: 'KEY PRESS', icon: '⌨', body: `Press key "${evt.target || data.key || ''}"` });

        } else if (t === 'SCROLL') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'action', tag: 'SCROLL', icon: '📜', body: 'Scroll page', targetCode: evt.target || '' });

        } else if (t === 'WAIT') {
            setAgentState('RUNNING');
            appendEventCard({ type: 'thinking', tag: 'WAIT', icon: '⏳', body: `Wait ${evt.target || ''}` });

        } else if (t === 'VERIFICATION') {
            appendEventCard({ type: 'verified', tag: 'VERIFIED', icon: '✅', body: msg || 'Verified' });

        } else if (t === 'CHALLENGE_REQUIRED' || t === 'BLOCKED') {
            setAgentState('BLOCKED');
            if (challengeBanner) challengeBanner.classList.remove('hidden');
            if (challengeText) challengeText.textContent = msg || 'Verification challenge detected on current tab.';
            appendEventCard({ type: 'thinking', tag: 'VERIFICATION', icon: '🛡️', body: msg || 'Cloudflare challenge. Interact with the tab to continue.' });

        } else if (t === 'CHALLENGE_RESOLVED') {
            setAgentState('RUNNING');
            challengeBanner?.classList.add('hidden');
            appendEventCard({ type: 'verified', tag: 'RESOLVED', icon: '✅', body: 'Verification passed. Resuming...' });

        } else if (t === 'CONFIRMATION_REQUIRED') {
            setAgentState('PAUSED');
            showConfirmationModal(data);
            appendEventCard({ type: 'thinking', tag: 'SAFE MODE', icon: '🛡️', body: `Confirm: ${data.action || 'action'}`, targetCode: data.target || '' });

        } else if (t === 'ACTION_CONFIRMED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendEventCard({ type: 'verified', tag: 'APPROVED', icon: '✓', body: 'Action confirmed. Continuing...' });

        } else if (t === 'ACTION_REJECTED') {
            setAgentState('RUNNING');
            hideConfirmationModal();
            appendEventCard({ type: 'error', tag: 'REJECTED', icon: '✗', body: 'Action rejected.', isError: true });

        } else if (t === 'PAUSED') {
            setAgentState('PAUSED');
        } else if (t === 'RESUMED' || t === 'RESUMING') {
            setAgentState('RUNNING');
        } else if (t === 'STOPPED') {
            setAgentState('IDLE');
            hideConfirmationModal();
            challengeBanner?.classList.add('hidden');

        } else if (t === 'COMPLETED') {
            setAgentState('COMPLETED');
            hideConfirmationModal();
            challengeBanner?.classList.add('hidden');
            appendEventCard({ type: 'verified', tag: 'COMPLETED', icon: '✅', body: data.result || msg || 'Task completed.' });
            // Detach debugger after completion
            if (activeTaskId) {
                chrome.runtime?.sendMessage?.({ type: 'DETACH_DEBUGGER', taskId: activeTaskId });
            }

        } else if (t === 'FAILED') {
            setAgentState('FAILED');
            hideConfirmationModal();
            challengeBanner?.classList.add('hidden');
            appendEventCard({ type: 'error', tag: 'FAILED', icon: '❌', body: msg || 'Task failed.', isError: true });
            if (activeTaskId) {
                chrome.runtime?.sendMessage?.({ type: 'DETACH_DEBUGGER', taskId: activeTaskId });
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // 5. Task Submission
    // ─────────────────────────────────────────────────────────────────
    async function submitTask() {
        const goal = goalInput?.value.trim();
        if (!goal) return;

        appendEventCard({ type: 'user', tag: 'YOU', icon: '👤', body: goal });
        if (goalInput) goalInput.value = '';
        setAgentState('THINKING');
        challengeBanner?.classList.add('hidden');

        const selectedModel = modelSelect?.value || 'gemini-3.5-flash-lite';

        // Get current active tab context
        let targetTab = currentTab;
        if (!targetTab && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            targetTab = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'GET_ACTIVE_TAB' }, (tab) => resolve(tab || null));
            });
            if (targetTab) { currentTab = targetTab; renderTabInfo(targetTab); }
        }

        // Submit task — backend attaches to the SAME browser (Chrome/Edge at port 9222)
        // No chrome.debugger needed. Agent controls same browser the Extension is in.
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
                    browser_id: `ext_edge_9222`,
                    tab_id: targetTab?.id,
                    window_id: targetTab?.windowId,
                    url: targetTab?.url,
                    title: targetTab?.title,
                    model_provider: 'gemini',
                    model_name: selectedModel,
                    cdp_port: 9222,
                    safe_mode: true,
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || errData.error || `Server ${res.status}`);
            }

            const data = await res.json();
            activeTaskId = data.task_id;

            if (data.session_id) {
                activeExtSessionId = data.session_id;
                if (sessionDisplay) sessionDisplay.textContent = activeExtSessionId;
            }
        } catch (e) {
            const errMsg = e.message || 'Unknown error';
            const isConnErr = errMsg.includes('9222') || errMsg.includes('remote-debugging');
            appendEventCard({
                type: 'error',
                tag: 'ERROR',
                icon: '❌',
                body: isConnErr
                    ? `Browser not accessible on port 9222. Launch Edge with: msedge.exe --remote-debugging-port=9222`
                    : errMsg,
                isError: true,
            });
            setAgentState('FAILED');
        }
    }

    submitGoalBtn?.addEventListener('click', submitTask);
    goalInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTask(); }
    });

    // ─────────────────────────────────────────────────────────────────
    // 6. Send to Workspace Handoff
    // ─────────────────────────────────────────────────────────────────
    btnSendToWorkspace?.addEventListener('click', async () => {
        btnSendToWorkspace.disabled = true;
        btnSendToWorkspace.textContent = '⏳ Sending...';
        try {
            const res = await fetch('http://127.0.0.1:8765/api/handoff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: activeExtSessionId, to_owner: 'WORKSPACE' }),
            });
            if (!res.ok) throw new Error(`Server ${res.status}`);
            btnSendToWorkspace.textContent = '✅ Sent to Workspace';
            btnSendToWorkspace.classList.add('sent');
            appendEventCard({ type: 'verified', tag: 'HANDOFF', icon: '🚀', body: 'Session sent to Desktop Workspace with [EXT] tag.' });
        } catch (e) {
            btnSendToWorkspace.disabled = false;
            btnSendToWorkspace.textContent = '🚀 Send to Workspace';
            appendEventCard({ type: 'error', tag: 'HANDOFF ERROR', icon: '❌', body: `Handoff failed: ${e.message}`, isError: true });
        }
    });

    // ─────────────────────────────────────────────────────────────────
    // 7. Agent Controls
    // ─────────────────────────────────────────────────────────────────
    btnPauseAgent?.addEventListener('click', async () => {
        try { await fetch('http://127.0.0.1:8765/api/agent/pause', { method: 'POST' }); setAgentState('PAUSED'); } catch (e) {}
    });
    btnResumeAgent?.addEventListener('click', async () => {
        try { await fetch('http://127.0.0.1:8765/api/agent/resume', { method: 'POST' }); setAgentState('RUNNING'); } catch (e) {}
    });
    btnStopAgent?.addEventListener('click', async () => {
        try {
            await fetch('http://127.0.0.1:8765/api/agent/stop', { method: 'POST' });
            setAgentState('IDLE');
            if (activeTaskId) chrome.runtime?.sendMessage?.({ type: 'DETACH_DEBUGGER', taskId: activeTaskId });
        } catch (e) {}
    });
    btnClearTimeline?.addEventListener('click', () => {
        if (feed) feed.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🤖</span>
                <span class="empty-title">Ready to work on current tab</span>
                <span class="empty-desc">Type a task below. The agent operates directly on the open page.</span>
            </div>`;
    });

    function showConfirmationModal(data) {
        if (modalActionText) modalActionText.textContent = data.action || 'action';
        if (modalTargetText) modalTargetText.textContent = data.target || '-';
        confirmationModal?.classList.remove('hidden');
    }
    function hideConfirmationModal() {
        confirmationModal?.classList.add('hidden');
    }
    btnConfirmAction?.addEventListener('click', async () => {
        try { await fetch('http://127.0.0.1:8765/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'CONFIRM' }) }); hideConfirmationModal(); } catch (e) {}
    });
    btnRejectAction?.addEventListener('click', async () => {
        try { await fetch('http://127.0.0.1:8765/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'REJECT' }) }); hideConfirmationModal(); } catch (e) {}
    });
});
