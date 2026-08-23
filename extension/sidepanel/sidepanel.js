/**
 * Deep Browser Extension — SidePanel UI & Lifecycle Controller
 * =============================================================
 *
 * Implements:
 *   - Google Material Symbols (zero emojis)
 *   - Collapsible "Worked for Xs >" thought & tool logs matching Cursor/Antigravity
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
  currentAgent: null,
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
  widgetManager = new window.WidgetManager(elWidgetContainer);
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

// ─── Model CRUD Management ───────────────────────────────────────────────────
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
          ${isSelected ? '<span style="color:var(--primary);font-size:10px;margin-left:4px">✓ Aktif</span>' : ''}
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
          ${isSelected ? '<span style="color:var(--primary);font-size:10px;margin-left:4px">✓ Aktif</span>' : ''}
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
      const dd = renderStepDropdown(msg.duration || '2s');
      (msg.items || []).forEach((item) => renderStepSubItem(dd.body, item.icon, item.text));
    } else if (msg.role === 'agent') {
      renderAgentResult(msg.text, msg.isError);
    }
  });
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

// ─── Task Execution ──────────────────────────────────────────────────────────
async function submitTask() {
  const goal = elGoalInput.value.trim();
  if (!goal) return;

  if (state.agentRunning) {
    stopAgent();
    return;
  }

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

  const agent = new window.Agent({
    task: goal,
    browserSession,
    llmClient,
    maxSteps: 25,
    mode: state.selectedMode,
    onEvent: handleAgentEvent,
    onApprovalRequired: async (proposal) => {
      return widgetManager.requestApproval(proposal);
    },
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

function stopAgent() {
  if (state.currentAgent) {
    state.currentAgent.stop();
  }
  setAgentRunning(false);
  updateStatus('Dihentikan', false);
  state.currentAgent = null;
  widgetManager.clear();
}

// ─── Sleek Event Log Handler (Cursor / Antigravity Style) ──────────────────────
let currentStepLogs = [];

function handleAgentEvent(evt) {
  const t = evt.event_type || '';
  const msg = evt.message || '';
  const data = evt.data || {};
  const step = evt.step;

  if (t === 'TASK_STARTED') {
    state.stepStartTime = Date.now();
    currentStepLogs = [];
    return;
  }

  // Ensure dropdown is created for current step
  if (!state.activeStepDropdown) {
    const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
    state.activeStepDropdown = renderStepDropdown(`${elapsed}s`);
    state.activeStepBody = state.activeStepDropdown.body;
  }

  let iconName = 'info';
  let text = msg;

  switch (t) {
    case 'OBSERVATION':
      iconName = 'visibility';
      text = `Observed: ${data.elementsCount || 0} interactive elements on ${data.title || data.url}`;
      break;
    case 'REASONING':
      iconName = 'psychology';
      text = msg;
      break;
    case 'CLICK':
      iconName = 'touch_app';
      text = `Click [${data.index || ''}] ${data.target || ''}`;
      break;
    case 'TYPE':
      iconName = 'edit';
      text = `Type "${data.text || ''}" into [${data.index || ''}]`;
      break;
    case 'NAVIGATION':
      iconName = 'navigation';
      text = `Navigate to ${data.url || msg}`;
      break;
    case 'SCROLL':
      iconName = 'swap_vert';
      text = `Scroll ${data.down !== false ? 'down' : 'up'}`;
      break;
    case 'EXTRACTION':
      iconName = 'dataset';
      text = `Extracting content: "${data.query || ''}"`;
      break;
    case 'VERIFICATION':
      iconName = 'check_circle';
      text = msg;
      break;
    case 'ACTION_EXECUTED':
      iconName = 'check';
      text = msg;
      break;
    case 'ACTION_FAILED':
      iconName = 'error';
      text = msg;
      break;
    case 'TASK_COMPLETED': {
      const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
      if (state.activeStepDropdown) {
        state.activeStepDropdown.headerText.textContent = `Worked for ${elapsed}s`;
      }
      renderAgentResult(data.result || msg || 'Tugas selesai.', false);
      recordMessageToActiveSession({ role: 'agent', text: data.result || msg, isError: false });
      state.activeStepDropdown = null;
      state.activeStepBody = null;
      return;
    }
    case 'ERROR': {
      renderAgentResult(data.error || msg, true);
      recordMessageToActiveSession({ role: 'agent', text: data.error || msg, isError: true });
      state.activeStepDropdown = null;
      state.activeStepBody = null;
      return;
    }
  }

  renderStepSubItem(state.activeStepBody, iconName, text);
  currentStepLogs.push({ icon: iconName, text });

  // Update elapsed time header
  const elapsed = Math.max(1, Math.round((Date.now() - state.stepStartTime) / 1000));
  if (state.activeStepDropdown) {
    state.activeStepDropdown.headerText.textContent = `Worked for ${elapsed}s`;
  }
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

function renderStepDropdown(durationStr = '1s') {
  const container = document.createElement('div');
  container.className = 'thought-dropdown';

  const header = document.createElement('div');
  header.className = 'thought-header open';
  header.innerHTML = `
    <span class="chevron-icon material-symbols-outlined">chevron_right</span>
    <span class="header-label">Worked for ${escHtml(durationStr)}</span>
  `;

  const body = document.createElement('div');
  body.className = 'thought-body open';

  header.addEventListener('click', () => {
    const isOpen = header.classList.toggle('open');
    body.classList.toggle('open', isOpen);
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

function renderAgentResult(text, isError = false) {
  const div = document.createElement('div');
  div.className = `chat-agent-result ${isError ? 'error' : 'completed'}`;
  div.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;font-weight:600;font-size:12px;color:${isError ? 'var(--destructive)' : 'var(--success)'}">
      <span class="material-symbols-outlined" style="font-size:16px">${isError ? 'error' : 'check_circle'}</span>
      <span>${isError ? 'Gagal' : 'Hasil Agent'}</span>
    </div>
    <div style="white-space:pre-wrap;margin-top:2px">${escHtml(text)}</div>
  `;
  elTimeline.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function hideEmptyState() {
  elEmptyState.style.display = 'none';
}

function updateStatus(text, isRunning) {
  elStatusText.textContent = text;
  if (isRunning) {
    elStatusPill.classList.add('running');
  } else {
    elStatusPill.classList.remove('running');
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
