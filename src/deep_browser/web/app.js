// Deep-Browser Workstation Agent IDE Frontend Application

class DeepBrowserWorkstation {
    constructor() {
        this.ws = null;
        this.activeTaskId = null;
        this.totalTokens = 0;
        this.initElements();
        this.bindEvents();
        this.connectWebSocket();
        this.loadInitialData();
    }

    initElements() {
        this.wsStatus = document.getElementById('ws-status');
        this.goalInput = document.getElementById('goal-input');
        this.modeSelect = document.getElementById('browser-mode-select');
        this.runBtn = document.getElementById('run-task-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        this.timelineFeed = document.getElementById('timeline-feed');
        this.milestonesList = document.getElementById('milestones-list');
        this.sessionList = document.getElementById('session-list');
        this.taskList = document.getElementById('task-list');
        this.artifactList = document.getElementById('artifact-list');
        this.screenshotContainer = document.getElementById('screenshot-container');
        this.telemetryUrl = document.getElementById('telemetry-url');
        this.telemetryAction = document.getElementById('telemetry-action');
        this.telemetryVerification = document.getElementById('telemetry-verification');
        this.headerTokens = document.getElementById('header-tokens');
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmationDetails = document.getElementById('confirmation-details');
        this.modalConfirmBtn = document.getElementById('modal-confirm-btn');
        this.modalRejectBtn = document.getElementById('modal-reject-btn');
    }

    bindEvents() {
        this.runBtn.addEventListener('click', () => this.runTask());
        this.goalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runTask();
        });
        this.pauseBtn.addEventListener('click', () => this.pauseTask());
        this.cancelBtn.addEventListener('click', () => this.cancelTask());
        this.modalConfirmBtn.addEventListener('click', () => this.confirmAction());
        this.modalRejectBtn.addEventListener('click', () => this.rejectAction());
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/workstation`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            this.wsStatus.textContent = 'CONNECTED';
            this.wsStatus.className = 'metric-value status-online';
        };

        this.ws.onclose = () => {
            this.wsStatus.textContent = 'DISCONNECTED';
            this.wsStatus.className = 'metric-value text-amber';
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this.handleServerEvent(msg.event, msg.data);
            } catch (err) {
                console.error('Error parsing WS message:', err);
            }
        };
    }

    async loadInitialData() {
        try {
            const sessRes = await fetch('/api/sessions');
            const sessData = await sessRes.json();
            this.renderSessions(sessData.sessions || []);

            const taskRes = await fetch('/api/tasks');
            const taskData = await taskRes.json();
            this.renderTasks(taskData.tasks || []);

            const artRes = await fetch('/api/workspace/artifacts');
            const artData = await artRes.json();
            this.renderArtifacts(artData.artifacts || []);
        } catch (err) {
            console.error('Failed to load initial data:', err);
        }
    }

    async runTask() {
        const goal = this.goalInput.value.trim();
        if (!goal) return;

        const mode = this.modeSelect.value;
        this.runBtn.disabled = true;
        this.runBtn.textContent = 'STARTING...';

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, browser_mode: mode })
            });
            const data = await res.json();
            if (data.task) {
                this.activeTaskId = data.task.id;
                this.pauseBtn.disabled = false;
                this.cancelBtn.disabled = false;
                this.clearTimeline();
            }
        } catch (err) {
            alert('Failed to launch task: ' + err.message);
        } finally {
            this.runBtn.disabled = false;
            this.runBtn.textContent = 'RUN AGENT';
        }
    }

    async pauseTask() {
        if (!this.activeTaskId) return;
        await fetch(`/api/tasks/${this.activeTaskId}/pause`, { method: 'POST' });
    }

    async cancelTask() {
        if (!this.activeTaskId) return;
        await fetch(`/api/tasks/${this.activeTaskId}/cancel`, { method: 'POST' });
        this.pauseBtn.disabled = true;
        this.cancelBtn.disabled = true;
    }

    async confirmAction() {
        if (!this.activeTaskId) return;
        await fetch(`/api/tasks/${this.activeTaskId}/confirm`, { method: 'POST' });
        this.confirmationModal.classList.add('hidden');
    }

    async rejectAction() {
        if (!this.activeTaskId) return;
        await this.pauseTask();
        this.confirmationModal.classList.add('hidden');
    }

    clearTimeline() {
        this.timelineFeed.innerHTML = '';
        this.milestonesList.innerHTML = '<span class="empty-text">Formulating plan...</span>';
    }

    handleServerEvent(eventType, data) {
        if (eventType === 'STEP_PLANNED') {
            this.appendStepPlanned(data);
        } else if (eventType === 'ACTION_RECEIPT') {
            this.appendActionReceipt(data);
        } else if (eventType === 'CONFIRMATION_REQUIRED') {
            this.showConfirmationModal(data.task);
        } else if (eventType === 'TASK_COMPLETED') {
            this.appendTaskCompleted(data.task);
            this.pauseBtn.disabled = true;
            this.cancelBtn.disabled = true;
        } else if (eventType === 'TASK_FAILED') {
            this.appendTaskFailed(data.task);
            this.pauseBtn.disabled = true;
            this.cancelBtn.disabled = true;
        }
        this.loadInitialData();
    }

    appendStepPlanned(data) {
        const entry = document.createElement('div');
        entry.className = 'timeline-entry';
        entry.innerHTML = `
            <div class="timeline-header">
                <span>STEP ${data.step} • PLAN</span>
                <span class="timeline-action">${data.action.tool}</span>
            </div>
            <div class="timeline-thought">${data.thought}</div>
            <div class="telemetry-value">Action: ${JSON.stringify(data.action.params)}</div>
        `;
        this.timelineFeed.appendChild(entry);
        this.timelineFeed.scrollTop = this.timelineFeed.scrollHeight;

        this.telemetryAction.textContent = data.action.tool;
    }

    appendActionReceipt(data) {
        const receipt = data.receipt;
        const ver = receipt.verification;
        const entry = document.createElement('div');
        const isVerified = ver.status === 'VERIFIED';
        entry.className = `timeline-entry ${isVerified ? '' : 'failed'}`;
        entry.innerHTML = `
            <div class="timeline-header">
                <span>STEP ${data.step} • VERIFY</span>
                <span class="badge ${isVerified ? 'badge-success' : 'badge-danger'}">${ver.status}</span>
            </div>
            <div class="timeline-verification">${ver.actual_state}</div>
        `;
        this.timelineFeed.appendChild(entry);
        this.timelineFeed.scrollTop = this.timelineFeed.scrollHeight;

        if (receipt.screenshot_path) {
            this.screenshotContainer.innerHTML = `<img src="/${receipt.screenshot_path}" alt="Browser Screenshot" />`;
        }

        this.telemetryUrl.textContent = receipt.page_url || 'about:blank';
        this.telemetryVerification.textContent = ver.status;
        this.telemetryVerification.className = `telemetry-value badge ${isVerified ? 'badge-success' : 'badge-danger'}`;
    }

    showConfirmationModal(task) {
        this.confirmationDetails.textContent = JSON.stringify(task.pending_confirmation_action, null, 2);
        this.confirmationModal.classList.remove('hidden');
    }

    appendTaskCompleted(task) {
        const entry = document.createElement('div');
        entry.className = 'timeline-entry';
        entry.style.borderLeftColor = 'var(--success)';
        entry.innerHTML = `
            <div class="timeline-header">
                <span style="color: var(--success); font-weight: bold;">TASK COMPLETED</span>
            </div>
            <p>${task.result_summary || 'Task accomplished successfully.'}</p>
        `;
        this.timelineFeed.appendChild(entry);
        this.timelineFeed.scrollTop = this.timelineFeed.scrollHeight;
    }

    appendTaskFailed(task) {
        const entry = document.createElement('div');
        entry.className = 'timeline-entry failed';
        entry.innerHTML = `
            <div class="timeline-header">
                <span style="color: var(--danger); font-weight: bold;">TASK FAILED</span>
            </div>
            <p>${task.error_message || 'An error occurred.'}</p>
        `;
        this.timelineFeed.appendChild(entry);
    }

    renderSessions(sessions) {
        document.getElementById('session-count').textContent = sessions.length;
        if (!sessions.length) {
            this.sessionList.innerHTML = '<span class="empty-state">No active browser sessions</span>';
            return;
        }
        this.sessionList.innerHTML = sessions.map(s => `
            <div class="session-item active">
                <div class="session-header">
                    <span class="status-dot"></span>
                    <span class="session-name">${s.session_id} (${s.profile_id})</span>
                </div>
                <span class="session-url">${s.url || 'about:blank'}</span>
            </div>
        `).join('');
    }

    renderTasks(tasks) {
        document.getElementById('task-count').textContent = tasks.length;
        if (!tasks.length) {
            this.taskList.innerHTML = '<span class="empty-state">No tasks recorded</span>';
            return;
        }
        this.taskList.innerHTML = tasks.slice(-5).reverse().map(t => `
            <div class="task-item">
                <div class="session-header">
                    <span class="badge ${t.status === 'completed' ? 'badge-success' : 'badge-pulse'}">${t.status.toUpperCase()}</span>
                    <span style="font-size: 11px;">${t.id}</span>
                </div>
                <span class="session-url">${t.goal}</span>
            </div>
        `).join('');
    }

    renderArtifacts(artifacts) {
        if (!artifacts.length) {
            this.artifactList.innerHTML = '<span class="empty-state">No artifacts generated</span>';
            return;
        }
        this.artifactList.innerHTML = artifacts.map(a => `
            <div class="session-item">
                <span style="font-weight: 500;">📄 ${a.name}</span>
                <span class="session-url">${(a.size / 1024).toFixed(1)} KB</span>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.workstation = new DeepBrowserWorkstation();
});
