/**
 * Deep Browser Extension — SidePanel UI & Lifecycle Controller
 * =============================================================
 *
 * Implements:
 *   - Dark-First Modern AI Workspace (Linear / ChatGPT / Dev-tool aesthetic)
 *   - Deterministic Authoritative State Machine & Verification Engine
 *   - Collapsible Execution Timeline with truthful tool states & verification evidence
 *   - Dedicated Real-time Searchable & Filterable Event Log View
 *   - Functional Reusable Tool Presets (Auto, Research, Extraction, Form Fill, Read-only)
 *   - Safe Retry Protocol & Side-effect Warning Modal (Class A, B, C)
 *   - Atomic Human-in-the-Loop (HITL) Approval & Review Gate
 *   - Full Model CRUD & Multi-Session History Persistence
 *   - Live Edge Multi-Tab Strip & In-Page Floating Island Bridge
 */

'use strict';

// ─── Default Models ───────────────────────────────────────────────────────────
const DEFAULT_MODELS = [
  // Google Gemini (8 Active Models Only)
  { id: 'gemini/gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', icon: 'speed',      provider: 'gemini',        modelId: 'gemini-3.5-flash-lite', category: 'Text-out models', rpm: '15', tpm: '250K', rpd: '500' },
  { id: 'gemini/gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', icon: 'speed',      provider: 'gemini',        modelId: 'gemini-3.1-flash-lite', category: 'Text-out models', rpm: '15', tpm: '250K', rpd: '500' },
  { id: 'gemini/gemini-2.5-flash',      name: 'Gemini 2.5 Flash',       icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-2.5-flash',      category: 'Text-out models', rpm: '5',  tpm: '250K', rpd: '20' },
  { id: 'gemini/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite',  icon: 'speed',      provider: 'gemini',        modelId: 'gemini-2.5-flash-lite', category: 'Text-out models', rpm: '10', tpm: '250K', rpd: '20' },
  { id: 'gemini/gemini-3-flash',        name: 'Gemini 3 Flash',        icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-3-flash',        category: 'Text-out models', rpm: '5',  tpm: '250K', rpd: '20' },
  { id: 'gemini/gemini-3.6-flash',      name: 'Gemini 3.6 Flash',      icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-3.6-flash',      category: 'Text-out models', rpm: '5',  tpm: '250K', rpd: '20' },
  { id: 'gemini/gemini-3.7-flash',      name: 'Gemini 3.7 Flash',      icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-3.7-flash',      category: 'Text-out models', rpm: '5',  tpm: '250K', rpd: '20' },
  { id: 'gemini/gemini-3.8-flash',      name: 'Gemini 3.8 Flash',      icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-3.8-flash',      category: 'Text-out models', rpm: '5',  tpm: '250K', rpd: '20' },
  // Other Non-Gemini Providers
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                 icon: 'memory',     provider: 'openai',        modelId: 'gpt-4o' },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini',            icon: 'bolt',       provider: 'openai',        modelId: 'gpt-4o-mini' },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',      icon: 'psychology', provider: 'anthropic',     modelId: 'claude-3-5-sonnet-20241022' },
  { id: 'custom/deepseek-chat',         name: 'DeepSeek Chat (V3)',     icon: 'hub',        provider: 'custom_openai', modelId: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local)',        icon: 'terminal',   provider: 'ollama',        modelId: 'llama3', baseUrl: 'http://localhost:11434' },
];

const MODES = [
  { id: 'agent_decide', name: 'Agent Decide',    desc: 'Agent mengambil keputusan adaptif dengan konfirmasi dinamis.', icon: 'smart_toy' },
  { id: 'auto',         name: 'Always Proceed',  desc: 'Eksekusi cepat otomatis tanpa jeda manual.', icon: 'bolt' },
  { id: 'hitl',         name: 'Request Review',  desc: 'Review proposal sebelum eksekusi setiap aksi browser.', icon: 'shield' },
];

const PROVIDERS = [
  { id: 'gemini',        name: 'Google Gemini',          placeholder: 'AIzaSy...' },
  { id: 'openai',        name: 'OpenAI',                 placeholder: 'sk-proj-...' },
  { id: 'anthropic',     name: 'Anthropic Claude',       placeholder: 'sk-ant-api03-...' },
  { id: 'custom_openai', name: 'DeepSeek / Custom URL',  placeholder: 'sk-...' },
  { id: 'ollama',        name: 'Ollama Host',            placeholder: 'http://localhost:11434' },
];

// Presets definition reference
const PRESET_DEFS = (typeof window !== 'undefined' && window.DeepBrowserState?.PRESETS) || {
  DEFAULT:         { id: 'default',         name: 'Auto',        icon: 'smart_toy',    readOnly: false },
  RESEARCH:        { id: 'research',        name: 'Research',    icon: 'manage_search',readOnly: true },
  DATA_EXTRACTION: { id: 'data_extraction', name: 'Extraction',  icon: 'dataset',      readOnly: true },
  FORM_FILLING:    { id: 'form_filling',    name: 'Form Fill',   icon: 'edit_note',    readOnly: false },
  READ_ONLY:       { id: 'read_only',       name: 'Read-only',   icon: 'visibility',   readOnly: true },
};

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  currentTab: null,
  tabsList: [],
  models: [...DEFAULT_MODELS],
  selectedModelId: 'gemini/gemini-3.5-flash-lite',
  selectedMode: 'agent_decide',
  selectedPreset: 'default',
  apiKeys: {},
  sessions: [],
  activeSessionId: null,
  currentAgent: null,     // JS Agent instance (fallback)
  currentTaskId: null,    // Backend task ID
  agentRunning: false,
  editingModelId: null,
  currentView: 'chat',    // 'chat' | 'logs'
  logFilter: 'all',       // 'all' | 'tools' | 'approvals' | 'errors' | 'verifications'
  logSearchQuery: '',
  retryPendingAction: null,
  activeTimeline: null,   // Current DOM timeline element
  judgeEnabled: false,    // Independent AI Judge Evaluation
  judgeModelId: 'auto',   // 'auto' or specific model id
};

// State Machine Engine instance
const StateMachineClass = (typeof window !== 'undefined' && window.DeepBrowserState?.StateMachine) || null;
let stateMachine = StateMachineClass ? new StateMachineClass() : null;

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const elMain                = $('main');
const elChatView            = $('chat-view');
const elLogsView            = $('logs-view');
const elTimeline            = $('timeline');
const elEmptyState          = $('empty-state');
const elGoalInput           = $('goal-input');
const elBtnSend             = $('btn-send');
const elSendIcon            = $('send-icon');
const elStatusPill          = $('status-pill');
const elStatusText          = $('status-text');
const elStepCounter         = $('step-counter');
const elTabStrip            = $('tab-strip');
const elModelBadgeIcon      = $('model-badge-icon');
const elModelBadgeName      = $('model-badge-name');
const elModeBadgeIcon       = $('mode-badge-icon');
const elModeBadgeName       = $('mode-badge-name');
const elBtnViewChat         = $('btn-view-chat');
const elBtnViewLogs         = $('btn-view-logs');
const elLogsBadge           = $('logs-badge');
const elLogsContainer       = $('logs-container');
const elLogsSearchInput     = $('logs-search-input');
const elLogsSearchClear     = $('logs-search-clear');
const elPresetsContainer    = $('presets-chips-container');

// Modals
const elModalModels         = $('modal-models');
const elModalApikeys        = $('modal-apikeys');
const elModalSettings       = $('modal-settings');
const elModalRetryConfirm   = $('modal-retry-confirm');
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
  if (window.WidgetManager) {
    widgetManager = new window.WidgetManager(elTimeline);
  }

  // Subscribe state machine to UI updates
  if (stateMachine) {
    stateMachine.subscribe((sm) => {
      syncStatusFromStateMachine(sm);
    });
  }

  await loadStorage();
  bindEvents();
  renderModelPill();
  renderModePill();
  renderPresets();
  renderModelsList();
  renderApikeys();
  renderModeOptions();
  renderJudgeSettings();
  detectCurrentTab();
  loadSessions();
  updateTabStrip();
  updateStatus('idle', 'Siap');

  // Connect to backend Python agent event stream
  connectBackendEventStream();
}

// ─── Storage Operations ──────────────────────────────────────────────────────
async function loadStorage() {
  return new Promise((resolve) => {
    chrome.storage?.local?.get(
      ['models', 'selectedModelId', 'selectedMode', 'selectedPreset', 'apiKeys', 'sessions', 'activeSessionId', 'judgeEnabled', 'judgeModelId'],
      (data) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          state.models = data.models;
        }
        if (data?.selectedModelId) state.selectedModelId = data.selectedModelId;
        if (data?.selectedMode) state.selectedMode = data.selectedMode;
        if (data?.selectedPreset) state.selectedPreset = data.selectedPreset;
        if (data?.apiKeys) state.apiKeys = data.apiKeys;
        if (data?.sessions && Array.isArray(data.sessions)) state.sessions = data.sessions;
        if (data?.activeSessionId) state.activeSessionId = data.activeSessionId;
        if (data?.judgeEnabled !== undefined) state.judgeEnabled = data.judgeEnabled;
        if (data?.judgeModelId) state.judgeModelId = data.judgeModelId;

        // Ensure at least one active session
        if (!state.sessions || state.sessions.length === 0) {
          const initId = 'session_' + Date.now();
          state.sessions = [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [], events: [] }];
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


// ─── AI Judge Settings Binding ───────────────────────────────────────────────
function renderJudgeSettings() {
  const chkJudge = $('chk-enable-judge');
  const wrapSelect = $('judge-model-select-wrap');
  const selJudgeModel = $('sel-judge-model');

  if (chkJudge) {
    chkJudge.checked = !!state.judgeEnabled;
    if (wrapSelect) wrapSelect.style.display = state.judgeEnabled ? 'block' : 'none';

    chkJudge.onchange = () => {
      state.judgeEnabled = chkJudge.checked;
      if (wrapSelect) wrapSelect.style.display = chkJudge.checked ? 'block' : 'none';
      saveStorage({ judgeEnabled: state.judgeEnabled });
    };
  }

  if (selJudgeModel) {
    selJudgeModel.innerHTML = '<option value="auto">Sama dengan Model Utama (Default)</option>';
    (state.models || []).forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} (${m.provider})`;
      if (m.id === state.judgeModelId) opt.selected = true;
      selJudgeModel.appendChild(opt);
    });

    selJudgeModel.onchange = () => {
      state.judgeModelId = selJudgeModel.value;
      saveStorage({ judgeModelId: state.judgeModelId });
    };
  }
}

// ─── Presets ─────────────────────────────────────────────────────────────────
function renderPresets() {
  if (!elPresetsContainer) return;
  const chips = elPresetsContainer.querySelectorAll('.preset-chip');
  chips.forEach((chip) => {
    const pId = chip.dataset.preset;
    if (pId === state.selectedPreset) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
    chip.addEventListener('click', () => {
      state.selectedPreset = pId;
      saveStorage({ selectedPreset: pId });
      renderPresets();
    });
  });
}

// ─── View Switching (Chat vs Logs) ───────────────────────────────────────────
function switchView(viewName) {
  state.currentView = viewName;
  if (viewName === 'chat') {
    elChatView.style.display = 'flex';
    elLogsView.style.display = 'none';
    elBtnViewChat.classList.add('active');
    elBtnViewChat.setAttribute('aria-selected', 'true');
    elBtnViewLogs.classList.remove('active');
    elBtnViewLogs.setAttribute('aria-selected', 'false');
  } else {
    elChatView.style.display = 'none';
    elLogsView.style.display = 'flex';
    elBtnViewChat.classList.remove('active');
    elBtnViewChat.setAttribute('aria-selected', 'false');
    elBtnViewLogs.classList.add('active');
    elBtnViewLogs.setAttribute('aria-selected', 'true');
    renderLogsList();
  }
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
  if (!chrome.tabs || !elTabStrip) return;

  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    state.tabsList = tabs || [];
    elTabStrip.innerHTML = '';

    tabs.forEach((tab) => {
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://')) return;

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
  if (elModelBadgeIcon) elModelBadgeIcon.textContent = m.icon || 'bolt';
  if (elModelBadgeName) elModelBadgeName.textContent = m.name;
}

function renderModePill() {
  const mode = MODES.find((m) => m.id === state.selectedMode) || MODES[0];
  if (elModeBadgeIcon) elModeBadgeIcon.textContent = mode.icon || 'smart_toy';
  if (elModeBadgeName) elModeBadgeName.textContent = mode.name;
}

function renderModelsList() {
  if (!elModelsContainer) return;
  elModelsContainer.innerHTML = '';

  state.models.forEach((m) => {
    const isSelected = m.id === state.selectedModelId;
    const card = document.createElement('div');
    card.className = 'model-card-item' + (isSelected ? ' selected' : '');

    let badgeText = (m.provider || 'gemini').toUpperCase();
    if (m.provider === 'custom_openai') badgeText = 'CUSTOM URL';
    if (m.provider === 'ollama') badgeText = 'LOCAL';

    card.innerHTML = `
      <div class="model-card-info" style="flex:1">
        <div class="model-card-name">
          <span class="material-symbols-outlined" style="font-size:15px;color:var(--text-secondary)">${m.icon || 'bolt'}</span>
          <span>${escHtml(m.name)}</span>
          ${isSelected ? '<span style="color:var(--accent);font-size:10px;font-weight:600;margin-left:4px">Aktif</span>' : ''}
        </div>
        <div class="model-card-meta">
          <span style="background:var(--bg-surface-elevated);padding:1px 4px;border-radius:3px">${badgeText}</span>
          <span style="font-family:var(--font-mono)">${escHtml(m.modelId || m.id)}</span>
        </div>
      </div>
      <div class="model-card-actions">
        <button class="icon-btn btn-edit-model" data-id="${m.id}" title="Edit Model">
          <span class="material-symbols-outlined" style="font-size:14px">edit</span>
        </button>
        <button class="icon-btn btn-delete-model" data-id="${m.id}" title="Hapus Model" style="color:var(--status-error)">
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
  closeModelForm();
  renderModelsList();
}

async function deleteModel(modelId) {
  if (state.models.length <= 1) {
    alert('Minimal harus ada 1 model tersedia');
    return;
  }
  state.models = state.models.filter((m) => m.id !== modelId);
  if (state.selectedModelId === modelId) {
    state.selectedModelId = state.models[0].id;
  }
  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
}

async function resetDefaultModels() {
  state.models = [...DEFAULT_MODELS];
  state.selectedModelId = DEFAULT_MODELS[0].id;
  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
}

// ─── API Keys Manager ────────────────────────────────────────────────────────
function renderApikeys() {
  if (!elApikeysContainer) return;
  elApikeysContainer.innerHTML = '';
  PROVIDERS.forEach((prov) => {
    const div = document.createElement('div');
    div.className = 'form-group';
    const val = state.apiKeys[prov.id] || '';
    div.innerHTML = `
      <label class="form-label">${escHtml(prov.name)}</label>
      <input class="form-input" type="password" id="key-${prov.id}" value="${escHtml(val)}" placeholder="${escHtml(prov.placeholder)}" />
    `;
    elApikeysContainer.appendChild(div);
  });
}

async function saveApikeys() {
  PROVIDERS.forEach((prov) => {
    const input = $(`key-${prov.id}`);
    if (input) state.apiKeys[prov.id] = input.value.trim();
  });
  await saveStorage({ apiKeys: state.apiKeys });
  closeModal('modal-apikeys');
}

// ─── Mode & Execution Options ────────────────────────────────────────────────
function renderModeOptions() {
  if (!elModeOptionsContainer) return;
  elModeOptionsContainer.innerHTML = '';
  MODES.forEach((m) => {
    const isSelected = m.id === state.selectedMode;
    const card = document.createElement('div');
    card.className = 'model-card-item' + (isSelected ? ' selected' : '');
    card.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600;font-size:12px;display:flex;align-items:center;gap:6px">
          <span class="material-symbols-outlined" style="font-size:15px;color:var(--text-secondary)">${m.icon}</span>
          <span>${escHtml(m.name)}</span>
          ${isSelected ? '<span style="color:var(--accent);font-size:10px;font-weight:600;margin-left:4px">Aktif</span>' : ''}
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">${escHtml(m.desc)}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      state.selectedMode = m.id;
      saveStorage({ selectedMode: m.id });
      renderModePill();
      renderModeOptions();
    });
    elModeOptionsContainer.appendChild(card);
  });
}

// ─── Session Management ──────────────────────────────────────────────────────
function getActiveSession() {
  return state.sessions.find((s) => s.id === state.activeSessionId) || state.sessions[0];
}

function loadSessions() {
  renderSessionList();
  renderActiveSessionTimeline();
}

async function createNewSession() {
  const newId = 'session_' + Date.now();
  const newSession = {
    id: newId,
    name: 'Sesi ' + (state.sessions.length + 1),
    createdAt: Date.now(),
    messages: [],
    events: [],
  };
  state.sessions.unshift(newSession);
  state.activeSessionId = newId;
  await saveStorage({ sessions: state.sessions, activeSessionId: state.activeSessionId });
  closeDrawer();
  renderSessionList();
  renderActiveSessionTimeline();
  updateStatus('idle', 'Siap');
}

async function switchSession(sessionId) {
  state.activeSessionId = sessionId;
  await saveStorage({ activeSessionId: sessionId });
  closeDrawer();
  renderSessionList();
  renderActiveSessionTimeline();
}

async function deleteSession(sessionId, e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const idStr = String(sessionId);
  if (state.sessions.length <= 1) {
    // If only 1 session exists, reset it cleanly instead of blocking with an alert
    const initId = 'session_' + Date.now();
    state.sessions = [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [], events: [] }];
    state.activeSessionId = initId;
  } else {
    state.sessions = state.sessions.filter((s) => String(s.id) !== idStr);
    if (String(state.activeSessionId) === idStr) {
      state.activeSessionId = state.sessions[0].id;
    }
  }
  await saveStorage({ sessions: state.sessions, activeSessionId: state.activeSessionId });
  renderSessionList();
  renderActiveSessionTimeline();
  if (stateMachine) {
    stateMachine.runState = 'idle';
    syncStatusFromStateMachine(stateMachine);
  } else {
    updateStatus('idle', 'Siap');
  }
}

async function clearActiveSession() {
  const current = getActiveSession();
  if (current) {
    current.messages = [];
    current.events = [];
    current.name = 'Sesi Baru';
    await saveStorage({ sessions: state.sessions });
    renderSessionList();
    renderActiveSessionTimeline();
    if (stateMachine) {
      stateMachine.runState = 'idle';
      syncStatusFromStateMachine(stateMachine);
    } else {
      updateStatus('idle', 'Siap');
    }
    closeDrawer();
  }
}

function renderSessionList() {
  if (!elSessionList) return;
  elSessionList.innerHTML = '';
  state.sessions.forEach((s) => {
    const div = document.createElement('div');
    const isActive = String(s.id) === String(state.activeSessionId);
    div.className = 'session-row' + (isActive ? ' active' : '');
    div.innerHTML = `
      <div class="session-row-info">
        <div class="session-name">${escHtml(s.name)}</div>
        <div class="session-date">${new Date(s.createdAt).toLocaleDateString('id-ID')}</div>
      </div>
      <button class="icon-btn session-delete-btn" data-id="${s.id}" title="${state.sessions.length > 1 ? 'Hapus Sesi' : 'Reset Sesi'}" style="color:var(--status-error)">
        <span class="material-symbols-outlined" style="font-size:14px">delete</span>
      </button>
    `;
    div.addEventListener('click', (e) => {
      if (e.target.closest('.session-delete-btn')) return;
      switchSession(s.id);
    });
    const delBtn = div.querySelector('.session-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        deleteSession(s.id, e);
      });
    }
    elSessionList.appendChild(div);
  });
}

function openDrawer() {
  if (elSessionDrawer) elSessionDrawer.classList.add('open');
  if (elDrawerOverlay) elDrawerOverlay.classList.add('active');
}

function closeDrawer() {
  if (elSessionDrawer) elSessionDrawer.classList.remove('open');
  if (elDrawerOverlay) elDrawerOverlay.classList.remove('active');
}

// ─── Status Synchronization ──────────────────────────────────────────────────
function syncStatusFromStateMachine(sm) {
  if (!sm) return;
  const status = sm.runState;
  const labelMap = {
    idle: 'Siap',
    queued: 'Queued',
    running: 'Running',
    waiting_for_approval: 'Menunggu Review',
    completed: 'Selesai',
    failed: 'Gagal',
    cancelled: 'Dibatalkan',
    interrupted: 'Interrupted',
    outcome_unknown: 'Outcome Unknown',
  };
  updateStatus(status, labelMap[status] || status);
}

function updateStatus(stateKey, text) {
  if (!elStatusPill || !elStatusText) return;
  elStatusPill.setAttribute('data-state', stateKey);
  elStatusPill.setAttribute('title', `Status: ${text}`);
  elStatusText.textContent = text;

  if (elStepCounter) {
    if (stateKey === 'running' && state.activeTimeline?.stepCount > 0) {
      elStepCounter.style.display = 'inline-block';
      elStepCounter.textContent = `${state.activeTimeline.stepCount} / 25`;
    } else {
      elStepCounter.style.display = 'none';
    }
  }
}

// ─── Backend WebSocket & Event Stream ────────────────────────────────────────
const BACKEND_URL = 'http://localhost:7788';
const BACKEND_WS  = 'ws://localhost:7788';
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
      if (elStatusPill) elStatusPill.dataset.backendConnected = 'true';
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
      if (elStatusPill) delete elStatusPill.dataset.backendConnected;
    };

    ws.onclose = () => {
      backendEventWs = null;
      if (elStatusPill) delete elStatusPill.dataset.backendConnected;
      // If run was active and connection drops without terminal result, mark interrupted
      if (state.agentRunning && stateMachine) {
        stateMachine.transitionRun('interrupted', { reason: 'Backend connection lost' });
      }
      backendReconnectTimer = setTimeout(connectBackendEventStream, 3000);
    };
  } catch (err) {
    console.error('[DeepBrowser] Failed to open backend WS:', err);
    backendReconnectTimer = setTimeout(connectBackendEventStream, 3000);
  }
}

// ─── Ext-Transport WS (CDP Command Executor) ─────────────────────────────────
let extTransportWs = null;
let currentTransportTaskId = null;

function connectExtTransport(taskId) {
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

    ws.onerror = (err) => console.error(`[ExtTransport:${taskId}] error:`, err);
    ws.onclose = () => {
      if (currentTransportTaskId === taskId) {
        extTransportWs = null;
        currentTransportTaskId = null;
      }
    };
  } catch (err) {
    console.error('[ExtTransport] Failed to open WS:', err);
  }
}

async function executeTransportCommand(command, params) {
  let tabId = state.currentTab?.id;
  if (!tabId) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        state.currentTab = activeTab;
        tabId = activeTab.id;
      }
    } catch (_) {}
  }

  switch (command) {
    case 'GET_STATE':
      return await capturePageState(tabId, params.include_screenshot !== false);

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
      return res || { success: true };
    }

    case 'TYPE': {
      const { index, xpath, text, clear } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'TYPE', index, xpath, text, clear: clear !== false
      });
      return res || { success: true };
    }

    case 'SCROLL': {
      const { direction, amount } = params;
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'DEEP_BROWSER_CMD', command: 'SCROLL', direction: direction || 'down', amount: amount || 500
      });
      return res || { success: true };
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

    case 'TAKE_SCREENSHOT': {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 85 });
      const cleanB64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      return { screenshot: cleanB64, format: 'png' };
    }

    default:
      return { warning: `Command unsupported: ${command}` };
  }
}

async function capturePageState(tabId, includeScreenshot) {
  const tab = tabId ? await chrome.tabs.get(tabId) : state.currentTab;
  let elements = [];
  let pageInfo = {};

  try {
    const domRes = await chrome.tabs.sendMessage(tab?.id, {
      type: 'DEEP_BROWSER_CMD', command: 'GET_DOM_STATE'
    });
    elements = domRes?.elements || [];
    pageInfo = domRes?.pageInfo || {};
  } catch (_) {}

  let screenshot = null;
  if (includeScreenshot) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 85 });
      screenshot = dataUrl.replace(/^data:image\/png;base64,/, '');
    } catch (_) {}
  }

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

// ─── Task Submission ─────────────────────────────────────────────────────────
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

  hideEmptyState();

  // Render User Message
  renderUserMessage(goal);
  recordMessageToActiveSession({ role: 'user', text: goal, timestamp: Date.now() });

  elGoalInput.value = '';
  resizeTextarea();

  // Initialize brand new Run State Machine with isolated Run ID
  const runId = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  if (stateMachine) {
    stateMachine.startRun(runId, state.selectedPreset);
  }

  setAgentRunning(true);
  updateStatus('running', 'Running');

  // Create Assistant Response Block & Collapsible Execution Timeline in Chat
  state.activeTimeline = createAssistantRunCard(runId, activeModel, state.selectedPreset);

  const backendAvailable = backendEventWs && backendEventWs.readyState === WebSocket.OPEN;

  if (backendAvailable) {
    try {
      stateMachine?.transitionRun('running');
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
          preset: state.selectedPreset,
          safe_mode: state.selectedMode === 'hitl' || state.selectedPreset === 'read_only',
          safe_timeout_seconds: 60.0,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`Backend /api/tasks status ${resp.status}: ${errBody}`);
      }

      const { task_id } = await resp.json();
      state.currentTaskId = task_id;
      state.currentAgent = null;

      connectExtTransport(task_id);
    } catch (err) {
      console.error('[SidePanel] Backend task submission failed:', err);
      handleAgentEvent({
        event_type: 'ERROR',
        message: `Gagal terhubung ke backend: ${err.message}`,
        data: { error: err.message },
      });
      setAgentRunning(false);
      stateMachine?.transitionRun('failed', { error: err.message });
    }
  } else {
    // Standalone JS Agent Mode
    console.log('[SidePanel] Running standalone JS Agent.');
    stateMachine?.transitionRun('running');
    await _runStandaloneAgent(goal, activeModel, provider, apiKey);
  }
}

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
        stateMachine?.transitionRun('waiting_for_approval');
        updateStatus('waiting_for_approval', 'Menunggu Review');
      } else if (newState === 'RUNNING') {
        stateMachine?.transitionRun('running');
        updateStatus('running', 'Running');
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

  if (widgetManager) widgetManager.setInteractionManager(interactionManager);

  let judgeLlmClient = null;
  if (state.judgeEnabled && state.judgeModelId && state.judgeModelId !== 'auto') {
    const jModel = state.models.find(m => m.id === state.judgeModelId);
    if (jModel) {
      const jProvider = jModel.provider;
      const jApiKey = state.apiKeys[jProvider] || '';
      judgeLlmClient = new window.LLMClient({
        provider: jProvider,
        model: jModel.modelId || jModel.id,
        apiKey: jApiKey,
        baseUrl: jModel.baseUrl || state.apiKeys['custom_openai'] || '',
        ollamaHost: state.apiKeys['ollama'] || 'http://localhost:11434',
        temperature: jModel.temperature ?? 0.1,
      });
    }
  }

  const agent = new window.Agent({
    taskId: state.activeSessionId,
    task: goal,
    preset: state.selectedPreset,
    browserSession,
    llmClient,
    interactionManager,
    maxSteps: Infinity,
    mode: state.selectedMode,
    useJudge: state.judgeEnabled,
    judgeLlmClient: judgeLlmClient || llmClient,
    onEvent: handleAgentEvent,
  });

  state.currentAgent = agent;

  try {
    await agent.run();
  } catch (err) {
    console.error('[SidePanel] Standalone agent error:', err);
    stateMachine?.transitionRun('failed', { error: err.message });
  } finally {
    setAgentRunning(false);
    state.currentAgent = null;
    if (widgetManager) widgetManager.clear();
    updateTabStrip();
  }
}

async function stopAgent() {
  if (stateMachine) {
    stateMachine.transitionRun('cancelled');
  }

  if (state.currentTaskId) {
    try {
      await fetch(`${BACKEND_URL}/api/agent/stop`, { method: 'POST' });
    } catch (_) {}
    state.currentTaskId = null;
  }

  if (state.currentAgent) {
    state.currentAgent.stop();
    state.currentAgent = null;
  }

  if (extTransportWs) {
    try { extTransportWs.close(); } catch (_) {}
    extTransportWs = null;
    currentTransportTaskId = null;
  }

  setAgentRunning(false);
  updateStatus('cancelled', 'Dibatalkan');
  if (widgetManager) widgetManager.clear();
}

// ─── Event Dispatch & Execution Timeline ──────────────────────────────────────
function handleAgentEvent(evt) {
  const t = evt.event_type || '';
  const msg = evt.message || '';
  const data = evt.data || {};
  const timestamp = evt.timestamp || Date.now();

  // Record to stateMachine event log
  if (stateMachine) {
    stateMachine.addEvent({
      id: evt.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: t,
      timestamp,
      message: msg,
      args: data.parameters || data.args || null,
      result: data.result || null,
      verification: data.verification || null,
      error: data.error || null,
      status: t === 'TASK_COMPLETED' ? 'succeeded' : (t === 'ERROR' || t === 'FAILED' ? 'failed' : null),
    });
    updateLogsBadge();
    if (state.currentView === 'logs') renderLogsList();
  }

  // Record to active session for persistence
  recordEventToActiveSession(evt);

  // Broadcast event to in-page Floating HUD Island
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, evt).catch(() => {});
      }
    });
  }

  // 1. Completion
  if (t === 'TASK_COMPLETED') {
    stateMachine?.transitionRun('completed', { result: data.result || msg, timestamp });
    setAgentRunning(false);
    updateStatus('completed', 'Selesai');
    finalizeAssistantRunCard(data.result || msg || 'Tugas selesai.', false);
    return;
  }

  // 2. Error / Terminal Failure
  if (t === 'ERROR' || t === 'FAILED') {
    stateMachine?.transitionRun('failed', { error: data.error || msg, timestamp });
    setAgentRunning(false);
    updateStatus('failed', 'Gagal');
    finalizeAssistantRunCard(data.error || msg, true);
    return;
  }

  // 3. Human in the Loop / Approval Gate
  if (t === 'CONFIRMATION_REQUIRED' || t === 'USER_INPUT_REQUIRED' || t === 'USER_APPROVAL_REQUIRED') {
    stateMachine?.transitionRun('waiting_for_approval');
    updateStatus('waiting_for_approval', 'Menunggu Review');

    const confId = data.confirmation_id || data.interaction_id || ('conf_' + Date.now());
    const interactionObj = data.interaction || {
      type: t === 'CONFIRMATION_REQUIRED' ? 'approval' : (data.type || 'choice'),
      question: data.reason || data.question || msg || 'Konfirmasi aksi browser',
      action_name: data.action || 'Aksi Browser',
      parameters: data.parameters || {},
      category: data.category,
      interaction_id: confId,
      options: data.options || [],
    };

    if (widgetManager) {
      widgetManager.renderInteraction(interactionObj).then(async (res) => {
        const isApproved = res.approved !== false && res.value !== 'reject' && res.value !== false;
        const decision = isApproved ? 'CONFIRM' : 'REJECT';

        // Atomic transition: acknowledge user submission
        if (stateMachine) stateMachine.setActionState('submitting');

        if (backendEventWs && backendEventWs.readyState === WebSocket.OPEN) {
          backendEventWs.send(JSON.stringify({
            type: 'CONFIRMATION_DECISION',
            confirmation_id: confId,
            decision: decision,
          }));
        }

        try {
          fetch(`${BACKEND_URL}/api/confirmations/${confId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision }),
          }).catch(() => {});
        } catch (_) {}

        if (state.activeTimeline) {
          addTimelineStepRow(state.activeTimeline, {
            icon: isApproved ? 'check_circle' : 'cancel',
            name: `Review: ${isApproved ? 'Approved' : 'Rejected'}`,
            timestamp,
            duration: '0ms',
            status: isApproved ? 'succeeded' : 'failed',
            args: interactionObj.parameters,
            result: { decision },
          });
        }
      });
    }
    return;
  }

  // 4. Screenshots & Visual Artifacts
  if (t === 'SCREENSHOT_CAPTURED' || t === 'SCREENSHOT') {
    renderScreenshotInChat(data.screenshotDataUrl || data.screenshot, data.fileName || 'screenshot.png');
    recordMessageToActiveSession({ role: 'screenshot', dataUrl: data.screenshotDataUrl || data.screenshot, fileName: data.fileName });
    return;
  }

  if (t === 'HTML_SNIPPET_CAPTURED') {
    renderHtmlSnippetInChat(data.html, data.title || 'Informasi Visual', data.text);
    recordMessageToActiveSession({ role: 'snippet', html: data.html, title: data.title });
    return;
  }

  if (t === 'JUDGE_STARTED') {
    renderJudgeEvaluatingCard(msg, data);
    if (state.activeTimeline) {
      addTimelineStepRow(state.activeTimeline, {
        icon: 'gavel',
        name: `AI Judge Evaluating (${data.model || 'Judge'})...`,
        timestamp,
        duration: '...',
        status: 'running',
        args: { task: data.task },
      });
    }
    return;
  }

  if (t === 'TRACE_JUDGED') {
    renderJudgeVerdictCard(data);
    if (state.activeTimeline) {
      addTimelineStepRow(state.activeTimeline, {
        icon: 'gavel',
        name: `AI Judge Verdict: ${data.verdict ? 'PASSED' : 'FAILED'}`,
        timestamp,
        duration: '1.5s',
        status: data.verdict ? 'succeeded' : 'failed',
        args: { task: data.task, groundTruth: data.groundTruth },
        result: { verdict: data.verdict, reasoning: data.reasoning, failure_reason: data.failure_reason },
      });
    }
    return;
  }

  if (t === 'PDF_SAVED') {
    renderPdfBadgeInChat(data.fileName, data.title, data.url, data.html);
    recordMessageToActiveSession({ role: 'pdf', fileName: data.fileName, title: data.title, url: data.url });
    return;
  }

  if (t === 'CHESS_BOARD_UPDATED' || t === 'CHESS_MOVE_PLAYED') {
    renderChessBoardCardInChat(data.html_board, data.label, data.move_uci, data.eval_cp, data.reason);
    recordMessageToActiveSession({ role: 'chess_board', html: data.html_board, label: data.label, move_uci: data.move_uci });
    return;
  }

  // 5. Tool Action Events
  let iconName = 'terminal';
  let actionName = '';
  let duration = data.duration ? `${data.duration}ms` : '120ms';
  let status = 'succeeded';
  let verification = data.verification || null;

  if (t === 'CLICK' || t === 'click_element') {
    iconName = 'touch_app';
    actionName = `click_element [${data.index || evt.target || ''}]`;
  } else if (t === 'TYPE' || t === 'input_text') {
    iconName = 'edit';
    actionName = `input_text [${data.index || ''}]: "${(data.text || '').slice(0, 30)}"`;
  } else if (t === 'NAVIGATION' || t === 'NAVIGATE' || t === 'navigate') {
    iconName = 'navigation';
    actionName = `navigate "${(data.url || msg).slice(0, 45)}"`;
  } else if (t === 'SCROLL' || t === 'scroll_page') {
    iconName = 'swap_vert';
    actionName = `scroll_page ${data.direction || 'down'}`;
  } else if (t === 'EXTRACTION' || t === 'extract') {
    iconName = 'dataset';
    actionName = `extract: "${(data.query || '').slice(0, 30)}"`;
  } else if (t === 'ACTION_FAILED') {
    iconName = 'error';
    actionName = `action_failed: ${msg}`;
    status = 'failed';
  } else if (t === 'REASONING') {
    // Keep reasoning truthfully represented in timeline without cluttering final answer
    iconName = 'psychology';
    actionName = `thought: ${msg.slice(0, 50)}`;
  } else {
    return;
  }

  const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  if (stateMachine) {
    stateMachine.registerToolCall(toolCallId, actionName, data.parameters || data);
    stateMachine.transitionTool(toolCallId, status, { timestamp, result: data.result, verification });
  }

  if (state.activeTimeline) {
    addTimelineStepRow(state.activeTimeline, {
      icon: iconName,
      name: actionName,
      timestamp,
      duration,
      status,
      args: data.parameters || data,
      result: data.result || null,
      verification,
      error: status === 'failed' ? (data.error || msg) : null,
    });
  }
}

// ─── Chat View Components ───────────────────────────────────────────────────
function renderUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-user-message';
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="chat-user-header">
      <div style="display:flex;align-items:center;gap:4px">
        <span class="material-symbols-outlined" style="font-size:13px">person</span>
        <span>User</span>
      </div>
      <span style="font-family:var(--font-mono);font-size:9.5px">${timeStr}</span>
    </div>
    <div>${escHtml(text)}</div>
  `;
  elTimeline.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function createAssistantRunCard(runId, model, preset) {
  const block = document.createElement('div');
  block.className = 'chat-assistant-block';
  block.id = `run_${runId}`;

  const startTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Run Metadata Strip
  const metaStrip = document.createElement('div');
  metaStrip.className = 'run-metadata-strip';
  metaStrip.innerHTML = `
    <span class="meta-chip">
      <span class="material-symbols-outlined" style="font-size:13px;color:var(--accent)">bolt</span>
      <strong>${escHtml(model.name)}</strong>
    </span>
    <span class="meta-chip">
      <span class="material-symbols-outlined" style="font-size:12px;color:var(--text-tertiary)">schedule</span>
      <span>${startTimeStr}</span>
    </span>
    <span class="meta-chip-mono" title="Klik untuk salin Run ID" data-runid="${runId}">
      #${escHtml(runId.slice(0, 10))}...
    </span>
    <span class="meta-chip" style="margin-left:auto;background:var(--accent-muted);padding:1px 6px;border-radius:3px;color:var(--accent);font-weight:600">
      ${escHtml(preset.toUpperCase())}
    </span>
  `;

  metaStrip.querySelector('.meta-chip-mono').addEventListener('click', (e) => {
    navigator.clipboard?.writeText?.(runId);
    e.target.textContent = 'Tersalin!';
    setTimeout(() => { e.target.textContent = `#${runId.slice(0, 10)}...`; }, 1500);
  });

  // Collapsible Execution Timeline Card
  const timelineWrap = document.createElement('div');
  timelineWrap.className = 'execution-timeline';

  const timelineHeader = document.createElement('div');
  timelineHeader.className = 'timeline-header open';
  timelineHeader.innerHTML = `
    <div class="timeline-header-left">
      <span class="material-symbols-outlined timeline-chevron">chevron_right</span>
      <span class="timeline-title">Execution Timeline</span>
    </div>
    <span class="timeline-counter" style="font-family:var(--font-mono);font-size:10px;color:var(--text-tertiary)">0 langkah</span>
  `;

  const timelineBody = document.createElement('div');
  timelineBody.className = 'timeline-body open';

  timelineHeader.addEventListener('click', () => {
    const isOpen = timelineHeader.classList.toggle('open');
    timelineBody.classList.toggle('open', isOpen);
  });

  timelineWrap.appendChild(timelineHeader);
  timelineWrap.appendChild(timelineBody);

  // Result Container (will hold markdown answer once completed)
  const resultContainer = document.createElement('div');
  resultContainer.className = 'assistant-result-wrap';

  block.appendChild(metaStrip);
  block.appendChild(timelineWrap);
  block.appendChild(resultContainer);
  elTimeline.appendChild(block);
  block.scrollIntoView({ behavior: 'smooth', block: 'end' });

  return {
    block,
    timelineHeader,
    timelineBody,
    counter: timelineHeader.querySelector('.timeline-counter'),
    resultContainer,
    stepCount: 0,
    startTime: Date.now(),
  };
}

function addTimelineStepRow(timelineRef, stepData) {
  if (!timelineRef || !timelineRef.timelineBody) return;
  timelineRef.stepCount++;
  timelineRef.counter.textContent = `${timelineRef.stepCount} langkah`;

  const row = document.createElement('div');
  row.className = 'timeline-step-row';

  const timeStr = new Date(stepData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  row.innerHTML = `
    <div class="step-row-main">
      <div class="step-row-left">
        <span class="material-symbols-outlined step-icon">${stepData.icon}</span>
        <span class="step-action-name" title="${escHtml(stepData.name)}">${escHtml(stepData.name)}</span>
      </div>
      <div class="step-row-right">
        <span class="step-duration">${escHtml(stepData.duration)}</span>
        <span class="step-status-tag status-${stepData.status}">${escHtml(stepData.status)}</span>
      </div>
    </div>
    <div class="step-details-panel">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="detail-section-title">Waktu: ${timeStr}</span>
        <button class="icon-btn btn-copy-step" title="Salin Payload" style="width:20px;height:20px">
          <span class="material-symbols-outlined" style="font-size:12px">content_copy</span>
        </button>
      </div>
      ${stepData.args ? `<div class="detail-section-title">Argumen:</div><div class="detail-code-block">${escHtml(JSON.stringify(stepData.args, null, 2))}</div>` : ''}
      ${stepData.result ? `<div class="detail-section-title">Hasil:</div><div class="detail-code-block">${escHtml(JSON.stringify(stepData.result, null, 2))}</div>` : ''}
      ${stepData.verification ? `<div class="verification-evidence-box"><span class="material-symbols-outlined" style="font-size:14px">verified</span><span>Bukti Terverifikasi: ${escHtml(JSON.stringify(stepData.verification))}</span></div>` : ''}
      ${stepData.error ? `<div style="color:var(--status-error);font-size:11px;font-weight:500">Error: ${escHtml(stepData.error)}</div>` : ''}
    </div>
  `;

  const detailsPanel = row.querySelector('.step-details-panel');
  row.querySelector('.step-row-main').addEventListener('click', () => {
    detailsPanel.classList.toggle('open');
  });

  row.querySelector('.btn-copy-step').addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(JSON.stringify(stepData, null, 2));
  });

  timelineRef.timelineBody.appendChild(row);
  row.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function finalizeAssistantRunCard(resultText, isError = false) {
  if (!state.activeTimeline) return;

  const { resultContainer, timelineHeader, timelineBody, startTime } = state.activeTimeline;
  const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));

  // Auto-collapse timeline on terminal completion so clean markdown answer is focal point
  if (!isError) {
    timelineHeader.classList.remove('open');
    timelineBody.classList.remove('open');
  }

  const resultCard = document.createElement('div');
  resultCard.className = `assistant-result-card ${isError ? 'is-error' : ''}`;
  resultCard.innerHTML = `
    <div class="result-header">
      <div style="display:flex;align-items:center;gap:5px">
        <span class="material-symbols-outlined" style="font-size:15px;color:${isError ? 'var(--status-error)' : 'var(--status-success)'}">
          ${isError ? 'error' : 'check_circle'}
        </span>
        <span style="font-weight:600">${isError ? 'Gagal Dieksekusi' : 'Jawaban Akhir Agent'}</span>
      </div>
      <button class="icon-btn btn-copy-result" title="Salin Jawaban" style="width:22px;height:22px">
        <span class="material-symbols-outlined" style="font-size:13px">content_copy</span>
      </button>
    </div>
    <div class="result-markdown-body">${isError ? escHtml(resultText) : renderMarkdownToHtml(resultText)}</div>
  `;

  resultCard.querySelector('.btn-copy-result').addEventListener('click', () => {
    navigator.clipboard?.writeText?.(resultText);
  });

  resultContainer.appendChild(resultCard);
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'end' });

  // Record assistant result message to active session
  recordMessageToActiveSession({
    role: 'agent',
    text: resultText,
    isError,
    duration: `${elapsed}s`,
    timestamp: Date.now(),
  });
}

function recordEventToActiveSession(evt) {
  const current = getActiveSession();
  if (current) {
    if (!current.events) current.events = [];
    current.events.push(evt);
    saveStorage({ sessions: state.sessions });
  }
}

function recordMessageToActiveSession(msgObj) {
  const current = getActiveSession();
  if (current) {
    if (!current.messages) current.messages = [];
    current.messages.push(msgObj);
    saveStorage({ sessions: state.sessions });
  }
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
    } else if (msg.role === 'agent') {
      const card = document.createElement('div');
      card.className = `assistant-result-card ${msg.isError ? 'is-error' : ''}`;
      card.innerHTML = `
        <div class="result-header">
          <div style="display:flex;align-items:center;gap:5px">
            <span class="material-symbols-outlined" style="font-size:15px;color:${msg.isError ? 'var(--status-error)' : 'var(--status-success)'}">
              ${msg.isError ? 'error' : 'check_circle'}
            </span>
            <span style="font-weight:600">${msg.isError ? 'Gagal Dieksekusi' : 'Jawaban Akhir Agent'}</span>
          </div>
          <button class="icon-btn btn-copy-result" title="Salin Jawaban" style="width:22px;height:22px">
            <span class="material-symbols-outlined" style="font-size:13px">content_copy</span>
          </button>
        </div>
        <div class="result-markdown-body">${msg.isError ? escHtml(msg.text) : renderMarkdownToHtml(msg.text)}</div>
      `;
      card.querySelector('.btn-copy-result').addEventListener('click', () => {
        navigator.clipboard?.writeText?.(msg.text);
      });
      elTimeline.appendChild(card);
    } else if (msg.role === 'screenshot') {
      renderScreenshotInChat(msg.dataUrl, msg.fileName);
    } else if (msg.role === 'snippet') {
      renderHtmlSnippetInChat(msg.html, msg.title, msg.text);
    } else if (msg.role === 'pdf') {
      renderPdfBadgeInChat(msg.fileName, msg.title, msg.url, msg.html);
    } else if (msg.role === 'chess_board') {
      renderChessBoardCardInChat(msg.html, msg.label, msg.move_uci);
    }
  });
}

// ─── Event Logs View ─────────────────────────────────────────────────────────
function updateLogsBadge() {
  if (!elLogsBadge || !stateMachine) return;
  const count = stateMachine.events.length;
  elLogsBadge.textContent = count;
  elLogsBadge.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderLogsList() {
  if (!elLogsContainer || !stateMachine) return;
  elLogsContainer.innerHTML = '';

  const query = (state.logSearchQuery || '').toLowerCase().trim();
  const filter = state.logFilter || 'all';

  const filtered = stateMachine.events.filter((evt) => {
    // Filter type
    if (filter === 'tools' && !['CLICK', 'TYPE', 'NAVIGATION', 'NAVIGATE', 'SCROLL', 'EXTRACTION', 'ACTION_EXECUTED'].includes(evt.type)) {
      return false;
    }
    if (filter === 'approvals' && !['CONFIRMATION_REQUIRED', 'USER_INPUT_REQUIRED', 'USER_APPROVAL_REQUIRED'].includes(evt.type)) {
      return false;
    }
    if (filter === 'errors' && !['ERROR', 'FAILED', 'ACTION_FAILED'].includes(evt.type)) {
      return false;
    }
    if (filter === 'verifications' && !evt.verification) {
      return false;
    }

    // Search query
    if (query) {
      const matchType = (evt.type || '').toLowerCase().includes(query);
      const matchMsg = (evt.message || '').toLowerCase().includes(query);
      const matchArgs = JSON.stringify(evt.args || {}).toLowerCase().includes(query);
      return matchType || matchMsg || matchArgs;
    }
    return true;
  });

  if (filtered.length === 0) {
    elLogsContainer.innerHTML = '<div class="logs-empty-state">Tidak ada event yang cocok dengan filter.</div>';
    return;
  }

  filtered.forEach((evt) => {
    const row = document.createElement('div');
    row.className = 'log-entry-row';

    const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    row.innerHTML = `
      <div class="log-row-header">
        <div class="log-header-left">
          <span class="log-timestamp">${timeStr}</span>
          <span class="log-type-tag">${escHtml(evt.type)}</span>
          <span class="log-message-text" title="${escHtml(evt.message)}">${escHtml(evt.message || '-')}</span>
        </div>
        <button class="icon-btn btn-copy-event" title="Salin JSON" style="width:20px;height:20px">
          <span class="material-symbols-outlined" style="font-size:12px">content_copy</span>
        </button>
      </div>
      <div class="log-expanded-payload">
        <div class="detail-code-block">${escHtml(JSON.stringify(evt, null, 2))}</div>
      </div>
    `;

    const expanded = row.querySelector('.log-expanded-payload');
    row.querySelector('.log-row-header').addEventListener('click', (e) => {
      if (e.target.closest('.btn-copy-event')) return;
      expanded.classList.toggle('open');
    });

    row.querySelector('.btn-copy-event').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText?.(JSON.stringify(evt, null, 2));
    });

    elLogsContainer.appendChild(row);
  });
}

// ─── Rich Media Artifact Helpers ─────────────────────────────────────────────

// ─── AI Judge UI Card Components ─────────────────────────────────────────────
let currentJudgeCardEl = null;

function renderJudgeEvaluatingCard(message, data) {
  hideEmptyState();
  if (currentJudgeCardEl && currentJudgeCardEl.parentElement) {
    currentJudgeCardEl.remove();
  }

  const card = document.createElement('div');
  card.className = 'judge-eval-card';
  card.id = 'active-judge-card';
  card.innerHTML = `
    <div class="judge-card-header">
      <div class="judge-card-header-left">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--accent);animation:spin 2s linear infinite">sync</span>
        <span>AI Judge Evaluation (${escHtml(data?.model || 'Independent Evaluator')})</span>
      </div>
      <span class="judge-verdict-badge evaluating">Evaluating Trace...</span>
    </div>
    <div class="judge-card-summary" style="font-style:italic">
      ${escHtml(message || 'Mengevaluasi apakah hasil akhir dan aksi agen memenuhi sasaran pengguna...')}
    </div>
  `;

  if (state.activeTimeline && state.activeTimeline.block) {
    state.activeTimeline.block.appendChild(card);
  } else {
    elTimeline.appendChild(card);
  }
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  currentJudgeCardEl = card;
}

function renderJudgeVerdictCard(judgement) {
  hideEmptyState();
  const card = (currentJudgeCardEl && currentJudgeCardEl.parentElement)
    ? currentJudgeCardEl
    : document.createElement('div');

  const isPassed = judgement.verdict === true;
  card.className = `judge-eval-card ${isPassed ? 'verdict-passed' : 'verdict-failed'}`;
  card.id = 'active-judge-card';

  const badgeClass = isPassed ? 'passed' : 'failed';
  const badgeText = isPassed ? 'PASSED (VALID)' : 'FAILED (INVALID)';
  const badgeIcon = isPassed ? 'check_circle' : 'cancel';

  card.innerHTML = `
    <div class="judge-card-header">
      <div class="judge-card-header-left">
        <span class="material-symbols-outlined" style="font-size:16px;color:${isPassed ? '#4ade80' : '#f87171'}">gavel</span>
        <span>Evaluasi AI Judge (${escHtml(judgement.model || 'AI Judge')})</span>
      </div>
      <span class="judge-verdict-badge ${badgeClass}">
        <span class="material-symbols-outlined" style="font-size:12px">${badgeIcon}</span>
        ${badgeText}
      </span>
    </div>
    <div class="judge-card-summary">
      <strong>Analisis Judge:</strong> ${escHtml(judgement.reasoning || (isPassed ? 'Tugas dinyatakan berhasil memenuhi sasaran.' : (judgement.failure_reason || 'Kriteria belum sepenuhnya terpenuhi.')))}
    </div>
    <div>
      <button class="judge-details-toggle">
        <span class="material-symbols-outlined" style="font-size:14px;transition:transform 0.15s ease">expand_more</span>
        <span>Lihat Rincian Proses &amp; Trace Evaluasi</span>
      </button>
    </div>
    <div class="judge-card-details">
      <div class="judge-detail-section">
        <span class="judge-detail-label">🎯 Sasaran Pengguna yang Dievaluasi:</span>
        <div class="judge-detail-content" style="white-space:normal">${escHtml(judgement.task || '-')}</div>
      </div>
      ${judgement.groundTruth ? `
      <div class="judge-detail-section">
        <span class="judge-detail-label">🔍 Kriteria Validasi (Ground Truth):</span>
        <div class="judge-detail-content" style="white-space:normal">${escHtml(judgement.groundTruth)}</div>
      </div>` : ''}
      <div class="judge-detail-section">
        <span class="judge-detail-label">📜 Trace Langkah &amp; Aksi Agen:</span>
        <div class="judge-detail-content">${escHtml(judgement.formattedSteps || '(Tidak ada riwayat langkah)')}</div>
      </div>
      <div class="judge-detail-section">
        <span class="judge-detail-label">🏁 Jawaban Akhir yang Diperiksa:</span>
        <div class="judge-detail-content" style="white-space:normal">${escHtml(judgement.finalResult || '(Kosong)')}</div>
      </div>
      ${judgement.failure_reason ? `
      <div class="judge-detail-section">
        <span class="judge-detail-label" style="color:var(--status-error)">⚠️ Alasan Kegagalan:</span>
        <div class="judge-detail-content" style="color:var(--status-error);border-color:rgba(239,68,68,0.3)">${escHtml(judgement.failure_reason)}</div>
      </div>` : ''}
      <div style="display:flex;gap:12px;font-size:10.5px;color:var(--text-tertiary);margin-top:2px">
        <span>Blocked Captcha: <strong>${judgement.reached_captcha ? 'Ya ⚠️' : 'Tidak'}</strong></span>
        <span>Tugas Mustahil: <strong>${judgement.impossible_task ? 'Ya ⚠️' : 'Tidak'}</strong></span>
      </div>
    </div>
  `;

  const btnToggle = card.querySelector('.judge-details-toggle');
  const detailsPanel = card.querySelector('.judge-card-details');
  const chevronIcon = btnToggle.querySelector('.material-symbols-outlined');

  const toggleOpen = () => {
    const isOpen = detailsPanel.classList.toggle('open');
    chevronIcon.style.transform = isOpen ? 'rotate(180deg)' : 'none';
    btnToggle.querySelector('span:last-child').textContent = isOpen
      ? 'Tutup Rincian Evaluasi'
      : 'Lihat Rincian Proses & Trace Evaluasi';
  };

  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOpen();
  });

  card.querySelector('.judge-card-header').addEventListener('click', () => {
    toggleOpen();
  });

  if (!card.parentElement) {
    if (state.activeTimeline && state.activeTimeline.block) {
      state.activeTimeline.block.appendChild(card);
    } else {
      elTimeline.appendChild(card);
    }
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
  currentJudgeCardEl = null;
}

function renderScreenshotInChat(dataUrl, fileName = 'screenshot.png') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'assistant-result-card';
  card.innerHTML = `
    <div class="result-header">
      <div style="display:flex;align-items:center;gap:5px">
        <span class="material-symbols-outlined" style="font-size:15px;color:var(--accent)">photo_camera</span>
        <span style="font-weight:600">${escHtml(fileName)}</span>
      </div>
      <a href="${dataUrl}" download="${escHtml(fileName)}" class="icon-btn" title="Unduh Tangkapan Layar">
        <span class="material-symbols-outlined" style="font-size:14px">download</span>
      </a>
    </div>
    <div style="border-radius:6px;overflow:hidden;border:1px solid var(--border-subtle);margin-top:4px">
      <img src="${dataUrl}" alt="${escHtml(fileName)}" style="width:100%;display:block" />
    </div>
  `;
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderChessBoardCardInChat(htmlContent, label = 'BEST', moveUci = '') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'assistant-result-card';
  card.innerHTML = htmlContent || `<div style="font-weight:600;color:var(--accent)">Langkah: ${moveUci} (${label})</div>`;
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function renderHtmlSnippetInChat(htmlContent, title = 'Informasi Visual', rawText = '') {
  hideEmptyState();
  const card = document.createElement('div');
  card.className = 'assistant-result-card';
  card.innerHTML = `
    <div class="result-header">
      <div style="display:flex;align-items:center;gap:5px">
        <span class="material-symbols-outlined" style="font-size:15px;color:var(--status-success)">code_blocks</span>
        <span style="font-weight:600">${escHtml(title)}</span>
      </div>
      <button class="icon-btn btn-copy-snippet" title="Salin HTML">
        <span class="material-symbols-outlined" style="font-size:14px">content_copy</span>
      </button>
    </div>
    <div style="margin-top:4px;padding:8px;background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:6px">
      ${htmlContent}
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
  card.className = 'assistant-result-card';
  const docBlob = new Blob([htmlContent || `<!DOCTYPE html><html><body><h1>${title}</h1></body></html>`], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(docBlob);

  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span class="material-symbols-outlined" style="font-size:22px;color:var(--status-error)">picture_as_pdf</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:12px">${escHtml(fileName)}</div>
        <div style="font-size:10.5px;color:var(--text-secondary)">${escHtml(title || url)}</div>
      </div>
      <a href="${blobUrl}" download="${escHtml(fileName)}" class="icon-btn" title="Unduh Dokumen PDF">
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--accent)">download</span>
      </a>
    </div>
  `;
  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ─── Markdown Renderer ───────────────────────────────────────────────────────
function renderMarkdownToHtml(md) {
  if (!md) return '';
  let html = String(md)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```([\w-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div style="background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:6px;padding:8px;margin:6px 0;overflow-x:auto"><div style="font-size:9.5px;font-family:var(--font-mono);color:var(--text-tertiary);margin-bottom:4px">${lang || 'code'}</div><pre style="margin:0;font-family:var(--font-mono);font-size:11px;color:var(--text-primary)"><code>${code.trim()}</code></pre></div>`;
  });

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="font-size:13px;font-weight:600;margin:8px 0 4px;color:var(--text-primary)">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="font-size:14px;font-weight:600;margin:10px 0 4px;color:var(--text-primary)">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="font-size:15px;font-weight:700;margin:12px 0 6px;color:var(--text-primary)">$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-surface-elevated);border:1px solid var(--border-subtle);padding:1px 4px;border-radius:3px;font-family:var(--font-mono);font-size:11px;color:var(--text-primary)">$1</code>');

  // Paragraph breaks & newlines
  html = html.replace(/\n\n+/g, '<div style="height:8px"></div>');
  html = html.replace(/\n/g, '<br />');

  return html;
}

// ─── UI Utility Helpers ──────────────────────────────────────────────────────
function hideEmptyState() {
  if (elEmptyState) elEmptyState.style.display = 'none';
}

function setAgentRunning(running) {
  state.agentRunning = running;
  if (!elBtnSend) return;
  elBtnSend.disabled = false;
  if (running) {
    elBtnSend.classList.add('stop-btn');
    elBtnSend.title = 'Hentikan Agent';
    if (elSendIcon) elSendIcon.textContent = 'stop';
  } else {
    elBtnSend.classList.remove('stop-btn');
    elBtnSend.title = 'Kirim Perintah';
    if (elSendIcon) elSendIcon.textContent = 'send';
  }
}

function resizeTextarea() {
  if (!elGoalInput) return;
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
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('open');
}

// ─── Event Bindings ──────────────────────────────────────────────────────────
function bindEvents() {
  if (elBtnSend) elBtnSend.addEventListener('click', () => submitTask());

  if (elGoalInput) {
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
  }

  // View Switcher: Chat vs Event Logs
  if (elBtnViewChat) elBtnViewChat.addEventListener('click', () => switchView('chat'));
  if (elBtnViewLogs) elBtnViewLogs.addEventListener('click', () => switchView('logs'));

  // Logs Toolbar
  if (elLogsSearchInput) {
    elLogsSearchInput.addEventListener('input', () => {
      state.logSearchQuery = elLogsSearchInput.value;
      if (elLogsSearchClear) elLogsSearchClear.style.display = elLogsSearchInput.value ? 'inline-flex' : 'none';
      renderLogsList();
    });
  }
  if (elLogsSearchClear) {
    elLogsSearchClear.addEventListener('click', () => {
      elLogsSearchInput.value = '';
      state.logSearchQuery = '';
      elLogsSearchClear.style.display = 'none';
      renderLogsList();
    });
  }

  // Filter Chips in Logs View
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.logFilter = chip.dataset.filter;
      renderLogsList();
    });
  });

  const btnCopyAllLogs = $('btn-copy-all-logs');
  if (btnCopyAllLogs) {
    btnCopyAllLogs.addEventListener('click', () => {
      if (stateMachine) {
        navigator.clipboard?.writeText?.(JSON.stringify(stateMachine.events, null, 2));
        btnCopyAllLogs.querySelector('span:last-child').textContent = 'Tersalin!';
        setTimeout(() => { btnCopyAllLogs.querySelector('span:last-child').textContent = 'Salin'; }, 1500);
      }
    });
  }

  // Retry Confirmation Modal
  const btnCancelRetry = $('btn-cancel-retry');
  if (btnCancelRetry) {
    btnCancelRetry.addEventListener('click', () => {
      closeModal('modal-retry-confirm');
      state.retryPendingAction = null;
    });
  }
  const btnConfirmRetry = $('btn-confirm-retry');
  if (btnConfirmRetry) {
    btnConfirmRetry.addEventListener('click', () => {
      closeModal('modal-retry-confirm');
      if (state.retryPendingAction) {
        submitTask(state.retryPendingAction);
        state.retryPendingAction = null;
      }
    });
  }
  const btnCloseRetryConfirm = $('close-modal-retry-confirm');
  if (btnCloseRetryConfirm) {
    btnCloseRetryConfirm.addEventListener('click', () => closeModal('modal-retry-confirm'));
  }

  // Drawer
  $('btn-menu')?.addEventListener('click', openDrawer);
  $('btn-new')?.addEventListener('click', createNewSession);
  $('drawer-close')?.addEventListener('click', closeDrawer);
  if (elDrawerOverlay) elDrawerOverlay.addEventListener('click', closeDrawer);
  $('btn-new-session')?.addEventListener('click', createNewSession);
  $('btn-clear-active-session')?.addEventListener('click', clearActiveSession);

  // Settings
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

  // Popout Mode
  const btnPopout = $('btn-popout');
  if (btnPopout) {
    btnPopout.addEventListener('click', async () => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          const tab = tabs?.[0];
          if (!tab?.id) return;
          if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            if (chrome.windows) {
              chrome.windows.create({ url: chrome.runtime.getURL('compact/compact.html'), type: 'popup', width: 360, height: 480 });
            }
            return;
          }
          try {
            if (chrome.scripting) {
              await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/floating_hud.css'] }).catch(() => {});
              await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/floating_hud.js'] }).catch(() => {});
            }
            chrome.tabs.sendMessage(tab.id, { type: 'SHOW_FLOATING_HUD' }).catch(() => {});
          } catch (_) {
            if (chrome.windows) {
              chrome.windows.create({ url: chrome.runtime.getURL('compact/compact.html'), type: 'popup', width: 360, height: 480 });
            }
          }
        });
      }
    });
  }

  // Model Modal
  $('btn-select-model')?.addEventListener('click', () => {
    closeModelForm();
    renderModelsList();
    openModal('modal-models');
  });
  $('close-modal-models')?.addEventListener('click', () => closeModal('modal-models'));
  $('btn-close-models')?.addEventListener('click', () => closeModal('modal-models'));
  $('btn-add-model')?.addEventListener('click', () => openModelForm(null));
  $('btn-cancel-model')?.addEventListener('click', closeModelForm);
  $('btn-save-model')?.addEventListener('click', saveModelForm);
  $('btn-reset-default-models')?.addEventListener('click', resetDefaultModels);

  // API Keys Modal
  $('btn-open-apikeys')?.addEventListener('click', () => {
    renderApikeys();
    openModal('modal-apikeys');
  });
  $('close-modal-apikeys')?.addEventListener('click', () => closeModal('modal-apikeys'));
  $('btn-save-apikeys')?.addEventListener('click', saveApikeys);

  // Mode Modal
  $('btn-open-settings')?.addEventListener('click', () => {
    renderModeOptions();
    renderJudgeSettings();
    openModal('modal-settings');
  });
  $('btn-select-mode')?.addEventListener('click', () => {
    renderModeOptions();
    renderJudgeSettings();
    openModal('modal-settings');
  });
  $('close-modal-settings')?.addEventListener('click', () => closeModal('modal-settings'));
  $('btn-close-settings')?.addEventListener('click', () => closeModal('modal-settings'));

  // Quick Chips
  document.querySelectorAll('.quick-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      elGoalInput.value = btn.dataset.prompt;
      resizeTextarea();
      elBtnSend.disabled = false;
      elGoalInput.focus();
    });
  });

  // Modal Backdrop Click
  ['modal-models', 'modal-apikeys', 'modal-settings', 'modal-retry-confirm'].forEach((mId) => {
    const el = $(mId);
    if (el) {
      el.addEventListener('click', (e) => {
        if (e.target === el) closeModal(mId);
      });
    }
  });

  // Keyboard Shortcuts: Escape closes any active modal or drawer
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['modal-models', 'modal-apikeys', 'modal-settings', 'modal-retry-confirm'].forEach(closeModal);
      closeDrawer();
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
