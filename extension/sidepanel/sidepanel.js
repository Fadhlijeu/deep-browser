/**
 * Deep Browser Extension — SidePanel UI & Lifecycle Controller
 * =============================================================
 *
 * Implements:
 *   - Google Material Symbols (zero emojis)
 *   - Streamlined, clean "Worked for Xs >" thought & action logs (Reasoning + concrete actions only)
 *   - Full Model CRUD (ability to delete and edit any model)
 *   - Full Session Management (persistence, switching, and deleting sessions)
 *   - Multi-tab strip and live Edge tab controller
 */

'use strict';

// ─── Default Models ───────────────────────────────────────────────────────────
const DEFAULT_MODELS = [
  { id: 'gemini/gemini-2.0-flash',      name: 'Gemini 2.0 Flash',       icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-2.0-flash' },
  { id: 'gemini/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite',  icon: 'speed',      provider: 'gemini',        modelId: 'gemini-2.0-flash-lite' },
  { id: 'gemini/gemini-1.5-pro',        name: 'Gemini 1.5 Pro',         icon: 'psychology', provider: 'gemini',        modelId: 'gemini-1.5-pro' },
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                 icon: 'memory',     provider: 'openai',        modelId: 'gpt-4o' },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini',            icon: 'bolt',       provider: 'openai',        modelId: 'gpt-4o-mini' },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',      icon: 'psychology', provider: 'anthropic',     modelId: 'claude-3-5-sonnet-20241022' },
  { id: 'custom/deepseek-chat',         name: 'DeepSeek Chat (V3)',     icon: 'hub',        provider: 'custom_openai', modelId: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local)',        icon: 'terminal',   provider: 'ollama',        modelId: 'llama3', baseUrl: 'http://localhost:11434' },
];

const MODES = [
  { id: 'agent_decide', name: 'Agent Decide',    desc: 'Agent mengambil keputusan adaptif.', icon: 'smart_toy' },
  { id: 'auto',         name: 'Always Proceed',  desc: 'Eksekusi cepat otomatis.', icon: 'bolt' },
  { id: 'hitl',         name: 'Request Review',  desc: 'Review proposal sebelum eksekusi.', icon: 'shield' },
];

const PROVIDERS = [
  { id: 'gemini',        name: 'Google Gemini',          placeholder: 'AIzaSy...' },
  { id: 'openai',        name: 'OpenAI',                 placeholder: 'sk-proj-...' },
  { id: 'anthropic',     name: 'Anthropic Claude',       placeholder: 'sk-ant-api03-...' },
  { id: 'custom_openai', name: 'DeepSeek / Custom URL',  placeholder: 'sk-...' },
  { id: 'ollama',        name: 'Ollama Host',            placeholder: 'http://localhost:11434' },
];

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  currentTab: null,
  tabsList: [],
  models: [...DEFAULT_MODELS],
  selectedModelId: 'gemini/gemini-2.0-flash',
  selectedMode: 'agent_decide',
  apiKeys: {},
  sessions: [],
  activeSessionId: null,
  currentAgent: null,     // JS Agent instance (legacy / fallback mode)
  currentTaskId: null,    // Backend task ID (backend mode)
  agentRunning: false,
  editingModelId: null,
  activeStepDropdown: null,
  activeStepBody: null,
  stepStartTime: 0,
};

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const elMain                = $('main');
const elTimeline            = $('timeline');
const elEmptyState          = $('empty-state');
const elGoalInput           = $('goal-input');
const elBtnSend             = $('btn-send');
const elSendIcon            = $('send-icon');
const elStatusPill          = $('status-pill');
const elStatusText          = $('status-text');
const elStepCounter         = $('step-counter');
const elTabStrip            = $('tab-strip');
const elWidgetContainer     = $('widget-container');
const elModelBadgeIcon      = $('model-badge-icon');
const elModelBadgeName      = $('model-badge-name');
const elModeBadgeIcon       = $('mode-badge-icon');
const elModeBadgeName       = $('mode-badge-name');

// Modals
const elModalModels         = $('modal-models');
const elModalApikeys        = $('modal-apikeys');
const elModalSettings       = $('modal-settings');
const elModelListView       = $('model-list-view');
const elModelFormView       = $('model-form-view');
const elModelsModalFooter   = $('models-modal-footer');
const elModelsContainer     = $('models-container');
const elApikeysContainer    = $('apikeys-container');
const elModeOptionsContainer= $('mode-options-container');

// Drawer
const elSessionDrawer       = $('session-drawer');
const elDrawerOverlay       = $('drawer-overlay');
const elSessionList         = $('session-list');

let widgetManager = null;

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  widgetManager = new window.WidgetManager(elTimeline);
  await loadStorage();
  bindEvents();
  renderModelPill();
  renderModePill();
  renderModelsList();
  renderApikeys();
  renderModeOptions();
  detectCurrentTab();
  loadSessions();
  updateTabStrip();
  updateStatus('Siap', false);
  // Connect to backend Python agent event stream (auto-reconnects on disconnect)
  connectBackendEventStream();
}


// ─── Storage Operations ──────────────────────────────────────────────────────
async function loadStorage() {
  return new Promise((resolve) => {
    chrome.storage?.local?.get(
      ['models', 'selectedModelId', 'selectedMode', 'apiKeys', 'sessions', 'activeSessionId'],
      (data) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          state.models = data.models;
        }
        if (data?.selectedModelId) state.selectedModelId = data.selectedModelId;
        if (data?.selectedMode) state.selectedMode = data.selectedMode;
        if (data?.apiKeys) state.apiKeys = data.apiKeys;
        if (data?.sessions && Array.isArray(data.sessions)) state.sessions = data.sessions;
        if (data?.activeSessionId) state.activeSessionId = data.activeSessionId;

        // Ensure at least one active session
        if (!state.sessions || state.sessions.length === 0) {
          const initId = 'session_' + Date.now();
          state.sessions = [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [] }];
          state.activeSessionId = initId;
        }
        resolve();
      }
    );
  });
}

async function saveStorage(keys) {
  return new Promise((resolve) => chrome.storage?.local?.set(keys, resolve));
}

// ─── Tab Strip & Active Tab Tracking ─────────────────────────────────────────
function detectCurrentTab() {
  chrome.tabs?.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs?.[0]) setCurrentTab(tabs[0]);
  });
  chrome.tabs?.onActivated?.addListener((info) => {
    chrome.tabs.get(info.tabId, (tab) => {
      if (tab) {
        setCurrentTab(tab);
        updateTabStrip();
      }
    });
  });
  chrome.tabs?.onUpdated?.addListener((tabId, changeInfo, tab) => {
    if (state.currentTab && tabId === state.currentTab.id && (changeInfo.title || changeInfo.url)) {
      setCurrentTab(tab);
    }
    updateTabStrip();
  });
  chrome.tabs?.onRemoved?.addListener(() => updateTabStrip());
}

function setCurrentTab(tab) {
  state.currentTab = tab;
}

async function updateTabStrip() {
  if (!chrome.tabs) return;

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    state.tabsList = tabs || [];
    elTabStrip.innerHTML = '';

    tabs.forEach((tab) => {
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

      const pill = document.createElement('div');
      const isActive = state.currentTab && tab.id === state.currentTab.id;
      pill.className = 'tab-pill' + (isActive ? ' active' : '');

      const faviconSrc = tab.favIconUrl || '';
      pill.innerHTML = `
        ${faviconSrc ? `<img src="${faviconSrc}" alt="" />` : '<span class="material-symbols-outlined" style="font-size:12px">language</span>'}
        <span>${escHtml(tab.title || tab.url)}</span>
      `;

      pill.addEventListener('click', async () => {
        await chrome.tabs.update(tab.id, { active: true });
        setCurrentTab(tab);
        updateTabStrip();
      });

      elTabStrip.appendChild(pill);
    });
  });
}

// ─── Model CRUD & Selector ───────────────────────────────────────────────────
function getActiveModel() {
  return state.models.find((m) => m.id === state.selectedModelId) || state.models[0] || DEFAULT_MODELS[0];
}

function renderModelPill() {
  const m = getActiveModel();
  elModelBadgeIcon.textContent = m.icon || 'bolt';
  elModelBadgeName.textContent = m.name;
}

function renderModelsList() {
  elModelsContainer.innerHTML = '';

  state.models.forEach((m) => {
    const isSelected = m.id === state.selectedModelId;
    const card = document.createElement('div');
    card.className = 'model-card-item' + (isSelected ? ' selected' : '');

    let badgeText = m.provider.toUpperCase();
    if (m.provider === 'custom_openai') badgeText = 'CUSTOM URL';
    if (m.provider === 'ollama') badgeText = 'LOCAL';

    card.innerHTML = `
      <div class="model-card-info" style="flex:1">
        <div class="model-card-name">
          <span class="material-symbols-outlined" style="font-size:15px;color:var(--muted-foreground)">${m.icon || 'bolt'}</span>
          <span>${escHtml(m.name)}</span>
          ${isSelected ? '<span style="color:var(--primary);font-size:10.5px;font-weight:600;margin-left:4px">Aktif</span>' : ''}
        </div>
        <div class="model-card-meta">
          <span style="background:var(--secondary);padding:1px 4px;border-radius:3px">${badgeText}</span>
          <span>${escHtml(m.modelId || m.id)}</span>
        </div>
      </div>
      <div class="model-card-actions">
        <button class="icon-btn btn-edit-model" data-id="${m.id}" title="Edit Model">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button class="icon-btn btn-delete-model" data-id="${m.id}" title="Hapus Model" style="color:var(--destructive)">
          <span class="material-symbols-outlined" style="font-size:14px">delete</span>
        </button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.model-card-actions')) return;
      state.selectedModelId = m.id;
      saveStorage({ selectedModelId: m.id });
      renderModelPill();
      renderModelsList();
    });

    card.querySelector('.btn-edit-model').addEventListener('click', (e) => {
      e.stopPropagation();
      openModelForm(m.id);
    });

    card.querySelector('.btn-delete-model').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteModel(m.id);
    });

    elModelsContainer.appendChild(card);
  });
}

function openModelForm(modelId = null) {
  state.editingModelId = modelId;
  elModelListView.style.display = 'none';
  elModelsModalFooter.style.display = 'none';
  elModelFormView.style.display = 'flex';

  if (modelId) {
    $('models-modal-title').textContent = 'Edit Model';
    const m = state.models.find((x) => x.id === modelId);
    if (m) {
      $('input-model-name').value = m.name || '';
      $('select-model-provider').value = m.provider || 'gemini';
      $('input-model-id').value = m.modelId || m.id || '';
      $('input-model-baseurl').value = m.baseUrl || '';
      $('input-model-temp').value = m.temperature ?? 0.1;
    }
  } else {
    $('models-modal-title').textContent = 'Tambah Model Baru';
    $('input-model-name').value = '';
    $('select-model-provider').value = 'gemini';
    $('input-model-id').value = '';
    $('input-model-baseurl').value = '';
    $('input-model-temp').value = 0.1;
  }
}

function closeModelForm() {
  state.editingModelId = null;
  $('models-modal-title').textContent = 'Pilih & Kelola Model';
  elModelFormView.style.display = 'none';
  elModelListView.style.display = 'flex';
  elModelsModalFooter.style.display = 'flex';
}

async function saveModelForm() {
  const name = $('input-model-name').value.trim();
  const provider = $('select-model-provider').value;
  const modelId = $('input-model-id').value.trim();
  const baseUrl = $('input-model-baseurl').value.trim();
  const temp = parseFloat($('input-model-temp').value) || 0.1;

  if (!name || !modelId) {
    alert('Harap isi Nama dan Model ID');
    return;
  }

  let icon = 'bolt';
  if (provider === 'gemini') icon = 'bolt';
  else if (provider === 'openai') icon = 'memory';
  else if (provider === 'anthropic') icon = 'psychology';
  else if (provider === 'ollama') icon = 'terminal';
  else if (provider === 'custom_openai') icon = 'hub';

  if (state.editingModelId) {
    const idx = state.models.findIndex((x) => x.id === state.editingModelId);
    if (idx !== -1) {
      state.models[idx] = {
        ...state.models[idx],
        name,
        provider,
        modelId,
        baseUrl: baseUrl || undefined,
        temperature: temp,
        icon,
      };
    }
  } else {
    const newId = `${provider}/${modelId}_${Date.now().toString(36)}`;
    const newModel = {
      id: newId,
      name,
      provider,
      modelId,
      baseUrl: baseUrl || undefined,
      temperature: temp,
      icon,
    };
    state.models.push(newModel);
    state.selectedModelId = newId;
  }

  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
  closeModelForm();
}

async function deleteModel(modelId) {
  if (state.models.length <= 1) {
    alert('Minimal harus ada 1 model di daftar.');
    return;
  }
  if (!confirm('Hapus model ini dari daftar?')) return;
  state.models = state.models.filter((m) => m.id !== modelId);
  if (state.selectedModelId === modelId) {
    state.selectedModelId = state.models[0].id;
  }
  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
}

async function resetDefaultModels() {
  if (!confirm('Reset semua model ke pengaturan default?')) return;
  state.models = [...DEFAULT_MODELS];
  state.selectedModelId = DEFAULT_MODELS[0].id;
  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
}

// ─── API Key Management ──────────────────────────────────────────────────────
function renderApikeys() {
  elApikeysContainer.innerHTML = '';
  PROVIDERS.forEach((p) => {
    const savedKey = state.apiKeys[p.id] || '';
    const row = document.createElement('div');
    row.className = 'form-group';
    row.innerHTML = `
      <label class="form-label">${escHtml(p.name)}</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input class="form-input" type="password" id="apikey-input-${p.id}"
          placeholder="${escHtml(p.placeholder)}" value="${escHtml(savedKey)}" />
        <button class="icon-btn btn-toggle-key" data-target="apikey-input-${p.id}" title="Lihat / Sembunyikan">
          <span class="material-symbols-outlined" style="font-size:14px">visibility</span>
        </button>
      </div>
    `;

    row.querySelector('.btn-toggle-key').addEventListener('click', function () {
      const inp = document.getElementById(this.dataset.target);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    row.querySelector(`#apikey-input-${p.id}`).addEventListener('input', function () {
      state.apiKeys[p.id] = this.value.trim();
    });

    elApikeysContainer.appendChild(row);
  });
}

async function saveApikeys() {
  PROVIDERS.forEach((p) => {
    const inp = document.getElementById(`apikey-input-${p.id}`);
    if (inp) state.apiKeys[p.id] = inp.value.trim();
  });
  await saveStorage({ apiKeys: state.apiKeys });
  closeModal('modal-apikeys');
}

// ─── Mode Selector ───────────────────────────────────────────────────────────
function renderModePill() {
  const m = MODES.find((x) => x.id === state.selectedMode) || MODES[0];
  elModeBadgeIcon.textContent = m.icon;
  elModeBadgeName.textContent = m.name;
}

function renderModeOptions() {
  elModeOptionsContainer.innerHTML = '';
  MODES.forEach((m) => {
    const isSelected = m.id === state.selectedMode;
    const card = document.createElement('div');
    card.className = 'model-card-item' + (isSelected ? ' selected' : '');
    card.innerHTML = `
      <div class="model-card-info">
        <div class="model-card-name">
          <span class="material-symbols-outlined" style="font-size:15px">${m.icon}</span>
          <span>${escHtml(m.name)}</span>
          ${isSelected ? '<span style="color:var(--primary);font-size:10.5px;font-weight:600;margin-left:4px">Aktif</span>' : ''}
        </div>

        <div class="model-card-meta">${escHtml(m.desc)}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.selectedMode = m.id;
      saveStorage({ selectedMode: m.id });
      renderModePill();
      renderModeOptions();
      closeModal('modal-settings');
    });
    elModeOptionsContainer.appendChild(card);
  });
}

// ─── Session Management (Switch, Delete, Persist) ────────────────────────────
function loadSessions() {
  renderSessionList();
  renderActiveSessionTimeline();
}

function getActiveSession() {
  return state.sessions.find((s) => s.id === state.activeSessionId) || state.sessions[0];
}

function createNewSession() {
  const id = 'session_' + Date.now();
  const session = {
    id,
    name: 'Sesi ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    createdAt: Date.now(),
    messages: [],
  };
  state.sessions.unshift(session);
  state.activeSessionId = id;
  saveStorage({ sessions: state.sessions, activeSessionId: id });
  renderSessionList();
  renderActiveSessionTimeline();
  closeDrawer();
  return id;
}

function switchSession(sessionId) {
  state.activeSessionId = sessionId;
  saveStorage({ activeSessionId: sessionId });
  renderSessionList();
  renderActiveSessionTimeline();
  closeDrawer();
}

async function deleteSession(sessionId, e) {
  if (e) e.stopPropagation();
  if (!confirm('Hapus sesi ini?')) return;

  state.sessions = state.sessions.filter((s) => s.id !== sessionId);
  if (state.sessions.length === 0) {
    const newId = 'session_' + Date.now();
    state.sessions = [{ id: newId, name: 'Sesi Baru', createdAt: Date.now(), messages: [] }];
    state.activeSessionId = newId;
  } else if (state.activeSessionId === sessionId) {
    state.activeSessionId = state.sessions[0].id;
  }

  await saveStorage({ sessions: state.sessions, activeSessionId: state.activeSessionId });
  renderSessionList();
  renderActiveSessionTimeline();
}

function renderSessionList() {
  elSessionList.innerHTML = '';
  state.sessions.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'session-row' + (s.id === state.activeSessionId ? ' active' : '');
    div.innerHTML = `
      <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">
        <div style="font-weight:500">${escHtml(s.name)}</div>
        <div style="font-size:10px;color:var(--muted-foreground)">${new Date(s.createdAt).toLocaleDateString('id-ID')}</div>
      </div>
      <button class="session-delete-btn" data-id="${s.id}" title="Hapus Sesi">
        <span class="material-symbols-outlined" style="font-size:14px">delete</span>
      </button>
    `;
    div.addEventListener('click', () => switchSession(s.id));
    div.querySelector('.session-delete-btn').addEventListener('click', (e) => deleteSession(s.id, e));
    elSessionList.appendChild(div);
  });
}

function renderActiveSessionTimeline() {
  elTimeline.innerHTML = '';
  const current = getActiveSession();
  if (!current || !current.messages || current.messages.length === 0) {
    elEmptyState.style.display = 'flex';
    return;
  }

  elEmptyState.style.display = 'none';
  current.messages.forEach((msg) => {
    if (msg.role === 'user') {
      renderUserMessage(msg.text);
    } else if (msg.role === 'step') {
      const dd = renderStepDropdown(msg.duration || '2s', false);
      (msg.items || []).forEach((item) => {
        if (item.isReasoning) {
          renderReasoningBlock(dd.body, item.text);
        } else {
          renderStepSubItem(dd.body, item.icon, item.text);
        }
      });
    } else if (msg.role === 'agent') {
      renderAgentResult(msg.text, msg.isError);
    } else if (msg.role === 'screenshot') {
      renderScreenshotInChat(msg.dataUrl, msg.fileName);
    } else if (msg.role === 'snippet') {
      renderHtmlSnippetInChat(msg.html, msg.title, msg.text);
    } else if (msg.role === 'pdf') {
      renderPdfBadgeInChat(msg.fileName, msg.title, msg.url, msg.html);
    } else if (msg.role === 'widget_resolved') {
      renderResolvedWidgetBadge(msg.label || msg.text);
    }
  });
}

function renderResolvedWidgetBadge(label) {
  const div = document.createElement('div');
  div.className = 'agent-widget-card resolved';
  div.innerHTML = `
    <div class="widget-resolved-status">
      <span class="material-symbols-outlined" style="font-size:16px;color:#22c55e">check_circle</span>
      <div style="flex:1">
        <span style="color:#a1a1aa">Respon Anda:</span>
        <strong style="color:#f4f4f5;margin-left:4px">${escHtml(label)}</strong>
      </div>
    </div>
  `;
  elTimeline.appendChild(div);
}

function recordMessageToActiveSession(msgObj) {
  const current = getActiveSession();
  if (current) {
    if (!current.messages) current.messages = [];
    current.messages.push(msgObj);
    saveStorage({ sessions: state.sessions });
  }
}

function openDrawer() {
  elSessionDrawer.classList.add('open');
  elDrawerOverlay.classList.add('active');
}

function closeDrawer() {
  elSessionDrawer.classList.remove('open');
  elDrawerOverlay.classList.remove('active');
}

// ─── Backend Configuration ────────────────────────────────────────────────────
const BACKEND_URL = 'http://localhost:7788';
const BACKEND_WS  = 'ws://localhost:7788';

// ─── Backend Event Stream (persistent WS, auto-reconnect) ────────────────────
let backendEventWs = null;
let backendReconnectTimer = null;

function connectBackendEventStream() {
  if (backendEventWs && (backendEventWs.readyState === WebSocket.OPEN || backendEventWs.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(backendReconnectTimer);

  try {
    const ws = new WebSocket(`${BACKEND_WS}/ws/extension`);
    backendEventWs = ws;

    ws.onopen = () => {
      console.log('[DeepBrowser] Connected to backend event stream.');
      updateBackendStatus(true);
    };

    ws.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data);
        handleAgentEvent(evt);
      } catch (err) {
        console.error('[DeepBrowser] Event parse error:', err);
      }
    };

    ws.onerror = () => {
      updateBackendStatus(false);
    };

    ws.onclose = () => {
      backendEventWs = null;
      updateBackendStatus(false);
      // Auto-reconnect after 3s unless explicitly closed
      backendReconnectTimer = setTimeout(connectBackendEventStream, 3000);
    };
  } catch (err) {
    console.error('[DeepBrowser] Failed to open backend WS:', err);
    backendReconnectTimer = setTimeout(connectBackendEventStream, 3000);
  }
}

function updateBackendStatus(connected) {
  // Visual indicator for backend connectivity (optional enhancement)
  const pill = document.getElementById('status-pill');
  if (pill) {
    if (connected) {
      pill.dataset.backendConnected = 'true';
    } else {
      delete pill.dataset.backendConnected;
    }
  }
}

// ─── Ext-Transport WS (CDP command executor for active task) ─────────────────
let extTransportWs = null;
let currentTransportTaskId = null;

function connectExtTransport(taskId) {
  // Close existing transport if any
  if (extTransportWs) {
    try { extTransportWs.close(); } catch (_) {}
    extTransportWs = null;
  }

  currentTransportTaskId = taskId;

  try {
    const ws = new WebSocket(`${BACKEND_WS}/ws/ext-transport/${taskId}`);
    extTransportWs = ws;

    ws.onopen = () => {
      console.log(`[ExtTransport:${taskId}] Connected. Ready for CDP commands.`);
    };

    ws.onmessage = async (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }

      if (msg.type === 'TRANSPORT_COMMAND') {
        const { request_id, command, params } = msg;
        try {
          const result = await executeTransportCommand(command, params || {});
          ws.send(JSON.stringify({ request_id, result: result || {} }));
        } catch (err) {
          ws.send(JSON.stringify({ request_id, error: err.message || String(err) }));
        }
      }
    };

    ws.onerror = (err) => {
      console.error(`[ExtTransport:${taskId}] WS error:`, err);
    };

    ws.onclose = () => {
      console.log(`[ExtTransport:${taskId}] Disconnected.`);
      if (currentTransportTaskId === taskId) {
        extTransportWs = null;
        currentTransportTaskId = null;
      }
    };
  } catch (err) {
    console.error('[ExtTransport] Failed to open WS:', err);
  }
}

/**
 * Execute a CDP command sent by the backend's ExtensionBrowserSession.
 * Returns a plain object that will be JSON-serialized back as the response.
 */
async function executeTransportCommand(command, params) {
  const tabId = state.currentTab?.id;

  switch (command) {
    case 'GET_STATE': {
      return await capturePageState(tabId, params.include_screenshot !== false);
    }

    case 'NAVIGATE': {
      const { url, new_tab } = params;
      if (new_tab) {
        const tab = await chrome.tabs.create({ url, active: true });
        state.currentTab = tab;
        updateTabStrip();
        await waitForTabLoad(tab.id, 10000);
        const updatedTab = await chrome.tabs.get(tab.id);
        return { url: updatedTab.url, title: updatedTab.title };
      } else {
        await chrome.tabs.update(tabId, { url });
        await waitForTabLoad(tabId, 10000);
        const updatedTab = await chrome.tabs.get(tabId);
        return { url: updatedTab.url, title: updatedTab.title };
      }
    }

    case 'CLICK': {
      const { index, xpath, button } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'CLICK', index, xpath, button: button || 'left'
      });
      return res || {};
    }

    case 'CLICK_COORDINATE': {
      const { x, y, button } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'CLICK_COORDINATE', x, y, button: button || 'left'
      });
      return res || {};
    }

    case 'TYPE': {
      const { index, xpath, text, clear } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'TYPE', index, xpath, text, clear: !!clear
      });
      return res || {};
    }

    case 'SCROLL': {
      const { direction, amount } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'SCROLL', direction, amount: amount || 300
      });
      return res || {};
    }

    case 'SCROLL_TO_TEXT': {
      const { text: scrollText, direction: scrollDir } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'SCROLL_TO_TEXT', text: scrollText, direction: scrollDir
      });
      return res || {};
    }

    case 'SEND_KEYS': {
      const { keys } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'SEND_KEYS', keys
      });
      return res || {};
    }

    case 'GO_BACK': {
      await chrome.tabs.sendMessage(tabId, { type: 'DEEP_BROWSER_CMD', command: 'GO_BACK' });
      await new Promise(r => setTimeout(r, 800));
      const t = await chrome.tabs.get(tabId);
      return { url: t.url, title: t.title };
    }

    case 'GO_FORWARD': {
      await chrome.tabs.sendMessage(tabId, { type: 'DEEP_BROWSER_CMD', command: 'GO_FORWARD' });
      await new Promise(r => setTimeout(r, 800));
      const t = await chrome.tabs.get(tabId);
      return { url: t.url, title: t.title };
    }

    case 'REFRESH': {
      await chrome.tabs.reload(tabId);
      await waitForTabLoad(tabId, 10000);
      const t = await chrome.tabs.get(tabId);
      return { url: t.url, title: t.title };
    }

    case 'SWITCH_TAB': {
      const { target_id } = params;
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const found = tabs.find(t => String(t.id) === String(target_id) || String(t.url).includes(target_id));
      if (found) {
        await chrome.tabs.update(found.id, { active: true });
        state.currentTab = found;
        updateTabStrip();
        return { tab_id: found.id, url: found.url, title: found.title };
      }
      return { tab_id: target_id };
    }

    case 'CLOSE_TAB': {
      const { target_id } = params;
      if (target_id) {
        await chrome.tabs.remove(parseInt(target_id, 10));
      }
      return {};
    }

    case 'TAKE_SCREENSHOT': {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: params.format === 'jpeg' ? 'jpeg' : 'png',
          quality: params.quality || 90,
        });
        const cleanB64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        return { screenshot: cleanB64, format: params.format || 'png' };
      } catch (err) {
        console.warn('[ExtTransport] TAKE_SCREENSHOT failed:', err);
        return { error: err.message || String(err) };
      }
    }

    case 'SAVE_AS_PDF': {
      try {
        const domResult = await chrome.tabs.sendMessage(tabId, {
          type: 'DEEP_BROWSER_CMD', command: 'GET_PAGE_HTML'
        });
        const html = domResult?.html || '<html><body>PDF Document</body></html>';
        const title = state.currentTab?.title || 'Dokumen';
        const url = state.currentTab?.url || '';
        const fileName = (params.file_name || 'dokumen').replace(/\.pdf$/i, '') + '.pdf';
        handleAgentEvent({
          event_type: 'PDF_SAVED',
          message: `Dokumen PDF disimpan: ${fileName}`,
          data: { fileName, title, url, html },
        });
        return { success: true, fileName, title };
      } catch (err) {
        return { error: err.message || String(err) };
      }
    }

    case 'GET_PAGE_HTML': {
      const domResult = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'GET_PAGE_HTML'
      });
      return domResult || {};
    }

    default:
      console.warn(`[ExtTransport] Unknown command: ${command}`);
      return { warning: `Unknown command: ${command}` };
  }
}

/** Capture full page state: DOM elements + screenshot + tabs */
async function capturePageState(tabId, includeScreenshot) {
  const tab = tabId ? await chrome.tabs.get(tabId) : state.currentTab;
  const activeTabId = tab?.id;

  // Get DOM elements via content script
  let elements = [];
  let pageInfo = {};
  try {
    const domResult = await chrome.tabs.sendMessage(activeTabId, {
      type: 'DEEP_BROWSER_CMD', command: 'GET_DOM_STATE'
    });
    elements = domResult?.elements || [];
    pageInfo = domResult?.pageInfo || {};
  } catch (err) {
    console.warn('[capturePageState] DOM capture failed:', err.message);
  }

  // Screenshot
  let screenshot = null;
  if (includeScreenshot) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 85 });
      screenshot = dataUrl.replace(/^data:image\/png;base64,/, '');
    } catch (err) {
      console.warn('[capturePageState] Screenshot failed:', err.message);
    }
  }

  // All open tabs
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  const tabs = allTabs.map(t => ({ id: t.id, url: t.url, title: t.title, active: t.active }));

  return {
    url: tab?.url || '',
    title: tab?.title || '',
    screenshot,
    elements,
    page_info: pageInfo,
    tabs,
  };
}

/** Wait for a tab to finish loading, with timeout */
function waitForTabLoad(tabId, timeout = 10000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    function check(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      } else if (Date.now() > deadline) {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(check);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(check); resolve(); }, timeout);
  });
}

// ─── Task Execution ──────────────────────────────────────────────────────────
async function submitTask(explicitGoal = null) {
  if (state.agentRunning) {
    stopAgent();
    return;
  }

  const goal = (typeof explicitGoal === 'string' && explicitGoal.trim())
    ? explicitGoal.trim()
    : elGoalInput.value.trim();

  if (!goal) return;

  const activeModel = getActiveModel();
  const provider = activeModel.provider;
  const apiKey = state.apiKeys[provider] || '';

  // Update session title if first message
  const activeSession = getActiveSession();
  if (activeSession && (!activeSession.messages || activeSession.messages.length === 0)) {
    activeSession.name = goal.slice(0, 24) + (goal.length > 24 ? '...' : '');
    saveStorage({ sessions: state.sessions });
    renderSessionList();
  }

  // Render & persist user message
  hideEmptyState();
  renderUserMessage(goal);
  recordMessageToActiveSession({ role: 'user', text: goal });

  elGoalInput.value = '';
  resizeTextarea();
  setAgentRunning(true);
  updateStatus('Bekerja...', true);
  state.stepStartTime = Date.now();

  // ── Backend Path ──────────────────────────────────────────────────────────
  // Check if backend is available; fall back to standalone JS Agent if not.
  const backendAvailable = backendEventWs && backendEventWs.readyState === WebSocket.OPEN;

  if (backendAvailable) {
    // BACKEND PATH: Delegate task to Python browser_use.Agent
    try {
      const resp = await fetch(`${BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: goal,
          owner: 'EXTENSION',
          browser_mode: 'ATTACHED',
          tab_id: state.currentTab?.id ?? null,
          window_id: state.currentTab?.windowId ?? null,
          url: state.currentTab?.url ?? null,
          title: state.currentTab?.title ?? null,
          model_provider: provider,
          model_name: activeModel.modelId || activeModel.id,
          api_key: apiKey,
          base_url: activeModel.baseUrl || '',
          safe_mode: state.selectedMode === 'hitl',
          safe_timeout_seconds: 60.0,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Backend /api/tasks returned ${resp.status}: ${errBody}`);
      }

      const { task_id } = await resp.json();
      state.currentTaskId = task_id;
      state.currentAgent = null; // No JS agent — backend owns execution

      // Connect ext-transport WS so backend can issue CDP commands to this tab
      connectExtTransport(task_id);

    } catch (err) {
      console.error('[SidePanel] Backend task submission failed:', err);
      // Show error immediately — don't silently swallow
      handleAgentEvent({
        event_type: 'ERROR',
        message: `Gagal terhubung ke backend: ${err.message}. Pastikan server berjalan di port 7788.`,
        data: { error: err.message },
      });
      setAgentRunning(false);
      updateStatus('Error', false);
    }
    // Task running via backend; UI updates come via /ws/extension event stream.
    // setAgentRunning(false) is called when TASK_COMPLETED or ERROR arrives.

  } else {
    // FALLBACK PATH: No backend — run standalone JS Agent (legacy mode)
    console.warn('[SidePanel] Backend not connected. Running standalone JS Agent (legacy mode).');
    await _runStandaloneAgent(goal, activeModel, provider, apiKey);
  }
}

/** Legacy standalone JS Agent (used only when backend is unavailable) */
async function _runStandaloneAgent(goal, activeModel, provider, apiKey) {
  const browserSession = new window.BrowserSession({
    tabId: state.currentTab?.id,
    windowId: state.currentTab?.windowId,
  });

  const llmClient = new window.LLMClient({
    provider,
    model: activeModel.modelId || activeModel.id,
    apiKey,
    baseUrl: activeModel.baseUrl || state.apiKeys['custom_openai'] || '',
    ollamaHost: state.apiKeys['ollama'] || 'http://localhost:11434',
    temperature: activeModel.temperature ?? 0.1,
  });

  const interactionManager = new window.InteractionManager({
    taskId: state.activeSessionId,
    onStateChange: (newState) => {
      if (newState === 'WAITING_FOR_USER') {
        updateStatus('Menunggu Anda', false, true);
        elBtnSend.disabled = false;
        elBtnSend.title = 'Menunggu respon interaktif';
      } else if (newState === 'RUNNING') {
        updateStatus('Bekerja...', true, false);
      }
    },
    onInteractionEvent: (ixEvt) => {
      if (ixEvt.event === 'USER_INPUT_REQUIRED') {
        widgetManager.renderInteraction(ixEvt.interaction);
      } else if (ixEvt.event === 'INTERACTION_RESOLVED' || ixEvt.event === 'INTERACTION_CANCELLED') {
        widgetManager.clear();
      }
    },
  });

  widgetManager.setInteractionManager(interactionManager);

  const agent = new window.Agent({
    taskId: state.activeSessionId,
    task: goal,
    browserSession,
    llmClient,
    interactionManager,
    maxSteps: 25,
    mode: state.selectedMode,
    onEvent: handleAgentEvent,
  });

  state.currentAgent = agent;

  try {
    await agent.run();
  } catch (err) {
    console.error('[SidePanel] Agent run error:', err);
  } finally {
    setAgentRunning(false);
    updateStatus('Siap', false);
    state.currentAgent = null;
    widgetManager.clear();
    updateTabStrip();
  }
}


async function stopAgent() {
  // Stop backend task if running via backend
  if (state.currentTaskId) {
    try {
      await fetch(`${BACKEND_URL}/api/agent/stop`, { method: 'POST' });
    } catch (_) {}
    state.currentTaskId = null;
  }

  // Stop standalone JS agent if running
  if (state.currentAgent) {
    state.currentAgent.stop();
    state.currentAgent = null;
  }

  // Close ext-transport WS
  if (extTransportWs) {
    try { extTransportWs.close(); } catch (_) {}
    extTransportWs = null;
    currentTransportTaskId = null;
  }

  setAgentRunning(false);
  updateStatus('Dihentikan', false);

  state.currentAgent = null;
  widgetManager.clear();
}

function handleAgentEvent(evt) {
  const t = evt.event_type || '';
  const msg = evt.message || '';
  const data = evt.data || {};

  // Broadcast event to in-page Floating HUD Island
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, evt).catch(() => {});
      }
    });
  }

  if (t === 'TASK_STARTED') {
    state.stepStartTime = Date.now();
    currentStepLogs = [];
    state.activeStepDropdown = null;
    state.activeStepBody = null;
    return;
  }


  // Handle completion
  if (t === 'TASK_COMPLETED') {
    const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
    if (state.activeStepDropdown) {
      state.activeStepDropdown.headerText.textContent = `Worked for ${elapsed}s`;
      // Collapse dropdown on finish so result is visible cleanly
      state.activeStepDropdown.header.classList.remove('open');
      state.activeStepDropdown.body.classList.remove('open');
    }
    renderAgentResult(data.result || msg || 'Tugas selesai.', false);

    const current = getActiveSession();
    if (current && current.messages) {
      const lastMsg = current.messages[current.messages.length - 1];
      if (lastMsg && lastMsg.role === 'step' && lastMsg._isActive) {
        lastMsg.duration = `${elapsed}s`;
        lastMsg.items = [...currentStepLogs];
        delete lastMsg._isActive;
      } else if (currentStepLogs.length > 0) {
        current.messages.push({
          role: 'step',
          duration: `${elapsed}s`,
          items: [...currentStepLogs],
        });
      }
      current.messages.push({ role: 'agent', text: data.result || msg, isError: false });
      saveStorage({ sessions: state.sessions });
    }

    state.activeStepDropdown = null;
    state.activeStepBody = null;
    currentStepLogs = [];
    // Backend task finished — reset running state
    setAgentRunning(false);
    updateStatus('Siap', false);
    state.currentTaskId = null;
    state.currentAgent = null;
    widgetManager.clear();
    updateTabStrip();
    return;
  }

  // Handle error / failure
  if (t === 'ERROR' || t === 'FAILED') {
    renderAgentResult(data.error || msg, true);
    recordMessageToActiveSession({ role: 'agent', text: data.error || msg, isError: true });
    state.activeStepDropdown = null;
    state.activeStepBody = null;
    currentStepLogs = [];
    // Backend task failed — reset running state
    setAgentRunning(false);
    updateStatus('Error', false);
    state.currentTaskId = null;
    state.currentAgent = null;
    widgetManager.clear();
    return;
  }

  // Handle Rich Visual Media in Chat
  if (t === 'SCREENSHOT_CAPTURED') {
    renderScreenshotInChat(data.screenshotDataUrl, data.fileName || 'screenshot.png');
    recordMessageToActiveSession({ role: 'screenshot', dataUrl: data.screenshotDataUrl, fileName: data.fileName });
    return;
  }

  if (t === 'HTML_SNIPPET_CAPTURED') {
    renderHtmlSnippetInChat(data.html, data.title || 'Struktur Informasi Visual', data.text);
    recordMessageToActiveSession({ role: 'snippet', html: data.html, title: data.title });
    return;
  }

  if (t === 'PDF_SAVED') {
    renderPdfBadgeInChat(data.fileName, data.title, data.url, data.html);
    recordMessageToActiveSession({ role: 'pdf', fileName: data.fileName, title: data.title, url: data.url });
    return;
  }

  if (t === 'PARALLEL_WORKER_PROGRESS') {
    renderParallelWorkersGrid(data.workers || []);
    return;
  }

  if (t === 'PARALLEL_RESEARCH_COMPLETED') {
    renderAgentResult(data.report || msg, false);
    recordMessageToActiveSession({ role: 'agent', text: data.report || msg, isError: false });
    return;
  }

  if (t === 'CONFIRMATION_REQUIRED' || t === 'USER_INPUT_REQUIRED') {
    updateStatus('Menunggu Respon Anda', false, true);
    const confId = data.confirmation_id || data.interaction_id || ('conf_' + Date.now());
    const interactionObj = data.interaction || {
      type: t === 'CONFIRMATION_REQUIRED' ? 'approval' : (data.type || 'choice'),
      question: data.reason || data.question || msg || 'Konfirmasi aksi sensitif',
      action_name: data.action || 'Aksi Sensitif',
      parameters: data.parameters || {},
      category: data.category,
      interaction_id: confId,
      options: data.options || [],
    };
    widgetManager.renderInteraction(interactionObj).then(async (res) => {
      const isApproved = res.approved !== false && res.value !== 'reject' && res.value !== false;
      const decision = isApproved ? 'CONFIRM' : 'REJECT';

      // 1. Dispatch decision over WebSocket to backend SafeModeManager
      if (backendEventWs && backendEventWs.readyState === WebSocket.OPEN) {
        backendEventWs.send(JSON.stringify({
          type: 'CONFIRMATION_DECISION',
          confirmation_id: confId,
          decision: decision,
        }));
      }

      // 2. Fallback HTTP confirmation resolution
      try {
        fetch(`${BACKEND_URL}/api/confirmations/${confId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        }).catch(() => {});
      } catch (_) {}

      // 3. Move widget resolution into the step dropdown (anti-clutter)
      if (!state.activeStepDropdown) {
        const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
        state.activeStepDropdown = renderStepDropdown(elapsed + 's', true);
        state.activeStepBody = state.activeStepDropdown.body;
      }
      const label = res.label || String(res.value || decision);
      renderStepSubItem(state.activeStepBody, 'check_circle', 'Input Pengguna: "' + label + '"');
      currentStepLogs.push({ icon: 'check_circle', text: 'Input Pengguna: "' + label + '"' });
      saveActiveStepState();
      updateStatus('Memproses respon...', true);

      // Record to active session for reload persistence
      recordMessageToActiveSession({ role: 'widget_resolved', label: label });
    });
    return;
  }

  let iconName = null;
  let text = '';
  let isReasoning = false;

  if (t === 'REASONING') {
    isReasoning = true;
    text = data.thinking || msg;
  } else if (t === 'CLICK') {
    iconName = 'touch_app';
    const clickTarget = data.target || evt.target || '';
    text = ('Click [' + (data.index || '') + '] ' + clickTarget).trim();
  } else if (t === 'TYPE') {
    iconName = 'edit';
    const typeText = (data.text || evt.target || '').slice(0, 50);
    text = 'Type "' + typeText + '" into [' + (data.index || '') + ']';
  } else if (t === 'NAVIGATION' || t === 'NAVIGATE') {
    iconName = 'navigation';
    text = 'Navigate to ' + (data.url || evt.target || msg);
  } else if (t === 'SCROLL') {
    iconName = 'swap_vert';
    const scrollDir = data.direction || '';
    text = 'Scroll ' + (scrollDir.toLowerCase().startsWith('up') ? 'up' : 'down');
  } else if (t === 'PRESS_KEY') {
    iconName = 'keyboard';
    text = 'Key: ' + (data.key || evt.target || msg);
  } else if (t === 'TAB_SWITCH') {
    iconName = 'tab';
    text = 'Switch to tab: ' + (data.url || evt.target || msg);
  } else if (t === 'EXTRACTION') {
    iconName = 'dataset';
    text = 'Extract: ' + (data.query || '');
  } else if (t === 'ACTION_FAILED') {
    iconName = 'error';
    text = 'Failed: ' + msg;
  } else {
    return;
  }

  if (!state.activeStepDropdown) {
    const el = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
    state.activeStepDropdown = renderStepDropdown(el + 's', true);
    state.activeStepBody = state.activeStepDropdown.body;
  }

  if (isReasoning) {
    renderReasoningBlock(state.activeStepBody, text);
    currentStepLogs.push({ isReasoning: true, text });
  } else {
    renderStepSubItem(state.activeStepBody, iconName, text);
    currentStepLogs.push({ icon: iconName, text });
  }

  saveActiveStepState();

  const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
  if (state.activeStepDropdown) {
    state.activeStepDropdown.headerText.textContent = 'Worked for ' + elapsed + 's';
  }
}
function saveActiveStepState() {
  const current = getActiveSession();
  if (!current) return;
  if (!current.messages) current.messages = [];

  const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
  const lastMsg = current.messages[current.messages.length - 1];
  if (lastMsg && lastMsg.role === 'step' && lastMsg._isActive) {
    lastMsg.duration = `${elapsed}s`;
    lastMsg.items = [...currentStepLogs];
  } else if (currentStepLogs.length > 0) {
    current.messages.push({
      role: 'step',
      duration: `${elapsed}s`,
      items: [...currentStepLogs],
      _isActive: true,
    });
  }
  saveStorage({ sessions: state.sessions });
}

// ─── UI Render Helpers (Zero Emojis, Google Material) ─────────────────────────
function renderUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-user-message';
  div.innerHTML = `
    <div class="chat-user-header">
      <span class="material-symbols-outlined" style="font-size:14px">person</span>
      <span>User</span>
    </div>
    <div>${escHtml(text)}</div>
  `;
  elTimeline.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderStepDropdown(durationStr = '1s', isOpen = true) {
  const container = document.createElement('div');
  container.className = 'thought-dropdown';

  const header = document.createElement('div');
  header.className = 'thought-header' + (isOpen ? ' open' : '');
  header.innerHTML = `
    <span class="chevron-icon material-symbols-outlined">chevron_right</span>
    <span class="header-label">Worked for ${escHtml(durationStr)}</span>
  `;

  const body = document.createElement('div');
  body.className = 'thought-body' + (isOpen ? ' open' : '');

  header.addEventListener('click', () => {
    const openState = header.classList.toggle('open');
    body.classList.toggle('open', openState);
  });

  container.appendChild(header);
  container.appendChild(body);
  elTimeline.appendChild(container);
  container.scrollIntoView({ behavior: 'smooth', block: 'end' });

  return {
    container,
    header,
    headerText: header.querySelector('.header-label'),
    body,
  };
}

function renderReasoningBlock(bodyEl, text) {
  if (!bodyEl || !text) return;
  const div = document.createElement('div');
  div.className = 'thought-text-block';
  div.textContent = text;
  bodyEl.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderStepSubItem(bodyEl, iconName, text) {
  if (!bodyEl) return;
  const item = document.createElement('div');
  item.className = 'thought-sub-item';
  item.innerHTML = `
    <span class="material-symbols-outlined item-icon">${iconName}</span>
    <span>${escHtml(text)}</span>
  `;
  bodyEl.appendChild(item);
  item.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderScreenshotInChat(dataUrl, fileName = 'screenshot.png') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'chat-media-card';
  card.innerHTML = `
    <div class="chat-media-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="material-symbols-outlined" style="font-size:16px;color:#8b5cf6">photo_camera</span>
        <span style="font-weight:600;font-size:11.5px;color:var(--foreground)">${escHtml(fileName)}</span>
      </div>
      <a href="${dataUrl}" download="${escHtml(fileName)}" class="media-download-btn" title="Download Screenshot">
        <span class="material-symbols-outlined" style="font-size:14px">download</span>
      </a>
    </div>
    <div class="chat-media-preview-wrap">
      <img src="${dataUrl}" alt="${escHtml(fileName)}" class="chat-screenshot-img" />
    </div>
  `;
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderHtmlSnippetInChat(htmlContent, title = 'Struktur Informasi Visual', rawText = '') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'chat-html-snippet-card';
  card.innerHTML = `
    <div class="chat-snippet-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="material-symbols-outlined" style="font-size:16px;color:#22c55e">code_blocks</span>
        <span style="font-weight:600;font-size:11.5px;color:var(--foreground)">${escHtml(title)}</span>
      </div>
      <button class="btn-copy-snippet" title="Salin HTML" style="background:transparent;border:none;color:var(--muted-foreground);cursor:pointer">
        <span class="material-symbols-outlined" style="font-size:14px">content_copy</span>
      </button>
    </div>
    <div class="chat-snippet-body">
      <div class="chat-snippet-rendered">${htmlContent}</div>
    </div>
  `;
  card.querySelector('.btn-copy-snippet').addEventListener('click', () => {
    navigator.clipboard?.writeText?.(htmlContent);
  });
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderPdfBadgeInChat(fileName = 'document.pdf', title = '', url = '', htmlContent = '') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'chat-pdf-card';

  const docBlob = new Blob([htmlContent || `<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:sans-serif;padding:24px;color:#111}</style></head><body><h1>${title}</h1><p>Sumber: <a href="${url}">${url}</a></p></body></html>`], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(docBlob);

  card.innerHTML = `
    <div class="chat-pdf-inner">
      <span class="material-symbols-outlined" style="font-size:20px;color:#ef4444">picture_as_pdf</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:11.5px;color:var(--foreground)">${escHtml(fileName)}</div>
        <div style="font-size:10px;color:var(--muted-foreground)">${escHtml(title || url)}</div>
      </div>
      <a href="${blobUrl}" download="${escHtml(fileName)}" class="media-download-btn" title="Unduh Dokumen PDF">
        <span class="material-symbols-outlined" style="font-size:16px;color:#8b5cf6">download</span>
      </a>
    </div>
  `;
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderAgentResult(text, isError = false) {
  hideEmptyState();
  const div = document.createElement('div');
  div.className = `chat-agent-result ${isError ? 'error' : 'completed'}`;
  const renderedContent = isError ? escHtml(text) : renderMarkdownToHtml(text);
  div.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;font-weight:600;font-size:12px;color:${isError ? 'var(--destructive)' : 'var(--success)'};margin-bottom:6px">
      <span class="material-symbols-outlined" style="font-size:16px">${isError ? 'error' : 'check_circle'}</span>
      <span>${isError ? 'Gagal Dieksekusi' : 'Hasil Agent'}</span>
    </div>
    <div class="chat-agent-markdown">${renderedContent}</div>
  `;
  elTimeline.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderMarkdownToHtml(md) {
  if (!md) return '';
  let html = String(md)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Fenced Code blocks ```lang\n...```
  html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="md-codeblock"><div class="md-code-header">${lang || 'code'}</div><pre><code>${code.trim()}</code></pre></div>`;
  });

  // Headers (###, ##, #)
  html = html.replace(/^### (.*$)/gim, '<h4 class="md-h3">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="md-h2">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="md-h1">$1</h2>');

  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code `...`
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Math tokens like $n$, $l$, $m$, $s$
  html = html.replace(/\$([a-zA-Z0-9_\^\+\-\s]+)\$/g, '<span class="md-math-token">$1</span>');

  // Horizontal Rule
  html = html.replace(/^---$/gim, '<hr class="md-hr" />');

  // Ordered lists (1. Item)
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<div class="md-list-item ordered"><span class="md-num">$1.</span><span>$2</span></div>');

  // Unordered lists (- Item or * Item)
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<div class="md-list-item unordered"><span class="md-bullet">•</span><span>$1</span></div>');

  // Paragraph breaks
  html = html.replace(/\n\n+/g, '<div class="md-para-gap"></div>');
  html = html.replace(/\n/g, '<br />');

  return html;
}

function renderParallelWorkersGrid(workers) {
  hideEmptyState();
  let gridWrap = document.getElementById('parallel-workers-grid-wrap');
  if (!gridWrap) {
    gridWrap = document.createElement('div');
    gridWrap.id = 'parallel-workers-grid-wrap';
    gridWrap.className = 'parallel-workers-container';
    elTimeline.appendChild(gridWrap);
  }

  gridWrap.innerHTML = `
    <div class="parallel-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="material-symbols-outlined" style="font-size:16px;color:#8b5cf6">hub</span>
        <span style="font-weight:600;font-size:12px;color:#f4f4f5">Riset Paralel Multi-Tab (${workers.length} Worker)</span>
      </div>
      <span class="parallel-pulse-badge">Aktif</span>
    </div>
    <div class="parallel-cards-grid">
      ${workers.map(w => `
        <div class="worker-tab-card ${w.done ? 'done' : 'running'}" data-tabid="${w.tabId || ''}">
          <div class="worker-card-top">
            <span class="worker-index">[Tab ${w.index}]</span>
            <span class="worker-topic" title="${escHtml(w.topic)}">${escHtml(w.topic)}</span>
            <span class="worker-status-chip ${w.done ? 'done' : ''}">${escHtml(w.status)}</span>
          </div>
          <div class="worker-card-preview">
            ${w.thumbnail 
              ? `<img src="${w.thumbnail}" alt="" class="worker-thumb-img" />`
              : `<div class="worker-thumb-placeholder"><span class="material-symbols-outlined" style="font-size:22px;color:#71717a">tab</span><span>${escHtml(w.status)}</span></div>`
            }
          </div>
          <div class="worker-progress-bar">
            <div class="worker-progress-fill" style="width:${w.progress || 0}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Bind click to focus tab
  gridWrap.querySelectorAll('.worker-tab-card').forEach(card => {
    card.addEventListener('click', async () => {
      const tabId = parseInt(card.dataset.tabid, 10);
      if (tabId && chrome.tabs) {
        await chrome.tabs.update(tabId, { active: true });
      }
    });
  });

  gridWrap.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function hideEmptyState() {
  elEmptyState.style.display = 'none';
}

function updateStatus(text, isRunning, isWaiting = false) {
  elStatusText.textContent = text;
  elStatusPill.classList.remove('running', 'waiting');
  if (isRunning) {
    elStatusPill.classList.add('running');
  } else if (isWaiting) {
    elStatusPill.classList.add('waiting');
  }
}


function setAgentRunning(running) {
  state.agentRunning = running;
  elBtnSend.disabled = false;
  if (running) {
    elBtnSend.classList.add('running');
    elBtnSend.title = 'Hentikan Agent';
    elSendIcon.textContent = 'stop';
  } else {
    elBtnSend.classList.remove('running');
    elBtnSend.title = 'Kirim Perintah';
    elSendIcon.textContent = 'send';
  }
}

function resizeTextarea() {
  elGoalInput.style.height = 'auto';
  elGoalInput.style.height = Math.min(elGoalInput.scrollHeight, 120) + 'px';
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('active');
}

// ─── Event Bindings ──────────────────────────────────────────────────────────
function bindEvents() {
  elBtnSend.addEventListener('click', submitTask);
  elGoalInput.addEventListener('input', () => {
    resizeTextarea();
    elBtnSend.disabled = !elGoalInput.value.trim() && !state.agentRunning;
  });
  elGoalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!elBtnSend.disabled) submitTask();
    }
  });

  // Topbar
  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-new').addEventListener('click', () => createNewSession());
  $('drawer-close').addEventListener('click', closeDrawer);
  elDrawerOverlay.addEventListener('click', closeDrawer);
  $('btn-new-session').addEventListener('click', createNewSession);

  // Settings & Parallel Tab options
  const chkShowTabs = $('chk-show-parallel-tabs');
  if (chkShowTabs) {
    chkShowTabs.checked = state.showParallelTabs !== false;
    chkShowTabs.addEventListener('change', () => {
      state.showParallelTabs = chkShowTabs.checked;
      saveStorage({ showParallelTabs: chkShowTabs.checked });
    });
  }

  const selWorkers = $('sel-max-parallel-workers');
  if (selWorkers) {
    selWorkers.value = String(state.maxParallelWorkers || 3);
    selWorkers.addEventListener('change', () => {
      state.maxParallelWorkers = parseInt(selWorkers.value, 10);
      saveStorage({ maxParallelWorkers: state.maxParallelWorkers });
    });
  }

  const btnPopout = $('btn-popout');
  if (btnPopout) {
    btnPopout.addEventListener('click', async () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs?.[0];
          if (!tab?.id) return;

          // If internal browser page (edge://, chrome://, about:), open standalone compact window
          if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            if (chrome.windows) {
              chrome.windows.create({
                url: chrome.runtime.getURL('compact/compact.html'),
                type: 'popup',
                width: 360,
                height: 480,
              });
            }
            return;
          }

          // In-page Floating Dynamic Island injection
          try {
            if (chrome.scripting) {
              await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/floating_hud.css'] }).catch(() => {});
              await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/floating_hud.js'] }).catch(() => {});
            }
            chrome.tabs.sendMessage(tab.id, { type: 'SHOW_FLOATING_HUD' }).catch(() => {});
          } catch (e) {
            console.warn('[PopOut] Injection fallback:', e);
            if (chrome.windows) {
              chrome.windows.create({
                url: chrome.runtime.getURL('compact/compact.html'),
                type: 'popup',
                width: 360,
                height: 480,
              });
            }
          }
        });
      }
    });
  }

  // Listen to triggers from In-Page Floating Island HUD
  chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {

    if (!msg) return;
    if (msg.action === 'START_TASK_FROM_HUD' && msg.task) {
      submitTask(msg.task);
      sendResponse?.({ success: true });
      return true;
    }
    if (msg.action === 'STOP_TASK_FROM_HUD') {
      stopAgent();
      sendResponse?.({ success: true });
      return true;
    }
    if (msg.action === 'RESOLVE_INTERACTION_FROM_HUD') {
      if (widgetManager?.interactionManager) {
        const activeIx = widgetManager.interactionManager.activeInteraction;
        if (activeIx?.interaction_id) {
          widgetManager.interactionManager.submitResponse(activeIx.interaction_id, msg.value);
        }
      }
      sendResponse?.({ success: true });
      return true;
    }
  });





  // Model Modal
  $('btn-select-model').addEventListener('click', () => {
    closeModelForm();
    renderModelsList();
    openModal('modal-models');
  });
  $('close-modal-models').addEventListener('click', () => closeModal('modal-models'));
  $('btn-close-models').addEventListener('click', () => closeModal('modal-models'));
  $('btn-add-model').addEventListener('click', () => openModelForm(null));
  $('btn-cancel-model').addEventListener('click', closeModelForm);
  $('btn-save-model').addEventListener('click', saveModelForm);
  $('btn-reset-default-models').addEventListener('click', resetDefaultModels);

  // API Keys Modal
  $('btn-open-apikeys').addEventListener('click', () => {
    renderApikeys();
    openModal('modal-apikeys');
  });
  $('close-modal-apikeys').addEventListener('click', () => closeModal('modal-apikeys'));
  $('btn-save-apikeys').addEventListener('click', saveApikeys);

  // Mode Modal
  $('btn-open-settings').addEventListener('click', () => {
    renderModeOptions();
    openModal('modal-settings');
  });
  $('btn-select-mode').addEventListener('click', () => {
    renderModeOptions();
    openModal('modal-settings');
  });
  $('close-modal-settings').addEventListener('click', () => closeModal('modal-settings'));
  $('btn-close-settings').addEventListener('click', () => closeModal('modal-settings'));

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      elGoalInput.value = btn.dataset.prompt;
      resizeTextarea();
      elBtnSend.disabled = false;
      elGoalInput.focus();
    });
  });

  // Close modals on backdrop click
  ['modal-models', 'modal-apikeys', 'modal-settings'].forEach((mId) => {
    $(mId).addEventListener('click', (e) => {
      if (e.target === $(mId)) closeModal(mId);
    });
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
