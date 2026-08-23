/**
 * Deep Browser Extension — Standalone SidePanel Controller
 * =========================================================
 *
 * Implements:
 *   - Full Model Management CRUD (Create, Read, Update, Delete)
 *   - API Key & Provider Management
 *   - Autonomous Browser Use Agent execution (Zero WebSocket dependency)
 *   - Rich shadcn-styled event timeline with collapsible reasoning
 */

'use strict';

// ─── Default Model Presets ───────────────────────────────────────────────────
const DEFAULT_MODELS = [
  { id: 'gemini/gemini-2.0-flash',      name: 'Gemini 2.0 Flash',       icon: '⚡', provider: 'gemini',        modelId: 'gemini-2.0-flash',      isPreset: true },
  { id: 'gemini/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite',  icon: '🏃', provider: 'gemini',        modelId: 'gemini-2.0-flash-lite', isPreset: true },
  { id: 'gemini/gemini-1.5-pro',        name: 'Gemini 1.5 Pro',         icon: '🔬', provider: 'gemini',        modelId: 'gemini-1.5-pro',        isPreset: true },
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                 icon: '🤖', provider: 'openai',        modelId: 'gpt-4o',                isPreset: true },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini',            icon: '⚡', provider: 'openai',        modelId: 'gpt-4o-mini',           isPreset: true },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',      icon: '🎭', provider: 'anthropic',     modelId: 'claude-3-5-sonnet-20241022', isPreset: true },
  { id: 'custom/deepseek-chat',         name: 'DeepSeek Chat (V3)',     icon: '🐋', provider: 'custom_openai', modelId: 'deepseek-chat',         baseUrl: 'https://api.deepseek.com/v1', isPreset: true },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local)',        icon: '🦙', provider: 'ollama',        modelId: 'llama3',                baseUrl: 'http://localhost:11434', isPreset: true },
];

const MODES = [
  { id: 'agent_decide', name: 'Adaptif (Agent Decide)', desc: 'Agent memutuskan langkah optimal secara dinamis.', icon: '🤖' },
  { id: 'auto',         name: 'Always Proceed (Auto)',  desc: 'Eksekusi cepat tanpa jeda konfirmasi.', icon: '⚡' },
  { id: 'hitl',         name: 'Human-in-the-Loop',      desc: 'Minta persetujuan sebelum form submission / transaksi.', icon: '🔵' },
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
  models: [...DEFAULT_MODELS],
  selectedModelId: 'gemini/gemini-2.0-flash',
  selectedMode: 'agent_decide',
  apiKeys: {},
  sessions: [],
  activeSessionId: null,
  currentAgent: null,
  agentRunning: false,
  editingModelId: null,
};

// ─── DOM Elements ────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const elMain                = $('main');
const elTimeline            = $('timeline');
const elEmptyState          = $('empty-state');
const elGoalInput           = $('goal-input');
const elBtnSend             = $('btn-send');
const elStatusPill          = $('status-pill');
const elStatusText          = $('status-text');
const elTabIcon             = $('tab-icon');
const elTabName             = $('tab-name');
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

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  await loadStorage();
  bindEvents();
  renderModelPill();
  renderModePill();
  renderModelsList();
  renderApikeys();
  renderModeOptions();
  detectCurrentTab();
  loadSessions();
  updateStatus('Siap', false);
}

// ─── Storage Operations ──────────────────────────────────────────────────────
async function loadStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ['models', 'selectedModelId', 'selectedMode', 'apiKeys', 'sessions', 'activeSessionId'],
      (data) => {
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          state.models = data.models;
        }
        if (data.selectedModelId) state.selectedModelId = data.selectedModelId;
        if (data.selectedMode) state.selectedMode = data.selectedMode;
        if (data.apiKeys) state.apiKeys = data.apiKeys;
        if (data.sessions) state.sessions = data.sessions;
        if (data.activeSessionId) state.activeSessionId = data.activeSessionId;
        resolve();
      }
    );
  });
}

async function saveStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.set(keys, resolve));
}

// ─── Tab Tracking ────────────────────────────────────────────────────────────
function detectCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs?.[0]) setCurrentTab(tabs[0]);
  });
  chrome.tabs.onActivated.addListener((info) => {
    chrome.tabs.get(info.tabId, (tab) => {
      if (tab) setCurrentTab(tab);
    });
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (state.currentTab && tabId === state.currentTab.id && (changeInfo.title || changeInfo.url)) {
      setCurrentTab(tab);
    }
  });
}

function setCurrentTab(tab) {
  state.currentTab = tab;
  if (tab && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
    elTabIcon.src = tab.favIconUrl || '';
    elTabIcon.style.display = tab.favIconUrl ? 'block' : 'none';
    elTabName.textContent = tab.title || tab.url;
  } else {
    elTabIcon.style.display = 'none';
    elTabName.textContent = 'Tab Khusus / Browser';
  }
}

// ─── Model CRUD Management ───────────────────────────────────────────────────

function getActiveModel() {
  return state.models.find((m) => m.id === state.selectedModelId) || state.models[0] || DEFAULT_MODELS[0];
}

function renderModelPill() {
  const m = getActiveModel();
  elModelBadgeIcon.textContent = m.icon || '⚡';
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
          <span>${m.icon || '⚡'}</span>
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
        </button>
        ${
          !m.isPreset
            ? `<button class="icon-btn btn-delete-model" data-id="${m.id}" title="Hapus Model" style="color:var(--destructive)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>`
            : ''
        }
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

    const deleteBtn = card.querySelector('.btn-delete-model');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteModel(m.id);
      });
    }

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

  if (!name) {
    alert('Harap masukkan Nama Tampilan Model');
    return;
  }
  if (!modelId) {
    alert('Harap masukkan Model ID (misal: gemini-2.0-flash / deepseek-chat)');
    return;
  }

  let icon = '⚡';
  if (provider === 'gemini') icon = '⚡';
  else if (provider === 'openai') icon = '🤖';
  else if (provider === 'anthropic') icon = '🎭';
  else if (provider === 'ollama') icon = '🦙';
  else if (provider === 'custom_openai') icon = '🐋';

  if (state.editingModelId) {
    // Update existing
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
    // Create new
    const newId = `${provider}/${modelId}_${Date.now().toString(36)}`;
    const newModel = {
      id: newId,
      name,
      provider,
      modelId,
      baseUrl: baseUrl || undefined,
      temperature: temp,
      icon,
      isPreset: false,
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
  if (!confirm('Hapus model ini dari daftar?')) return;
  state.models = state.models.filter((m) => m.id !== modelId);
  if (state.selectedModelId === modelId) {
    state.selectedModelId = state.models[0]?.id || DEFAULT_MODELS[0].id;
  }
  await saveStorage({ models: state.models, selectedModelId: state.selectedModelId });
  renderModelPill();
  renderModelsList();
}

async function resetDefaultModels() {
  if (!confirm('Reset semua model ke pengaturan awal?')) return;
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
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
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
  elModeBadgeName.textContent = m.name.split(' ')[0];
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
          <span>${m.icon}</span>
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

// ─── Sessions Drawer ─────────────────────────────────────────────────────────
function loadSessions() {
  renderSessionList();
}

function createNewSession() {
  const id = 'ext_' + Date.now();
  const session = { id, name: 'Sesi ' + new Date().toLocaleTimeString('id-ID'), createdAt: Date.now() };
  state.sessions.push(session);
  state.activeSessionId = id;
  saveStorage({ sessions: state.sessions, activeSessionId: id });
  renderSessionList();
  clearTimeline();
  closeDrawer();
  return id;
}

function renderSessionList() {
  elSessionList.innerHTML = '';
  [...state.sessions].reverse().forEach((s) => {
    const div = document.createElement('div');
    div.className = 'session-row' + (s.id === state.activeSessionId ? ' active' : '');
    div.innerHTML = `
      <div>
        <div style="font-weight:500">${escHtml(s.name)}</div>
        <div style="font-size:10px;color:var(--muted-foreground)">${new Date(s.createdAt).toLocaleDateString('id-ID')}</div>
      </div>
    `;
    div.addEventListener('click', () => {
      state.activeSessionId = s.id;
      saveStorage({ activeSessionId: s.id });
      renderSessionList();
      closeDrawer();
    });
    elSessionList.appendChild(div);
  });
}

function openDrawer() {
  elSessionDrawer.classList.add('open');
  elDrawerOverlay.classList.add('active');
}

function closeDrawer() {
  elSessionDrawer.classList.remove('open');
  elDrawerOverlay.classList.remove('active');
}

// ─── Direct Agent Execution (Zero WebSocket) ─────────────────────────────────
async function submitTask() {
  const goal = elGoalInput.value.trim();
  if (!goal) return;

  if (state.agentRunning) {
    stopAgent();
    return;
  }

  if (!state.activeSessionId) createNewSession();

  const activeModel = getActiveModel();
  const provider = activeModel.provider;
  const apiKey = state.apiKeys[provider] || '';

  if (provider !== 'ollama' && (!apiKey || !apiKey.trim())) {
    appendCard('error', '🔑', 'API KEY DIBUTUHKAN', `Silakan masukkan ${provider.toUpperCase()} API Key di menu API Keys terlebih dahulu.`);
    openModal('modal-apikeys');
    return;
  }

  appendCard('user', '👤', 'USER', goal);
  elGoalInput.value = '';
  resizeTextarea();
  hideEmptyState();
  setAgentRunning(true);
  updateStatus('Bekerja...', true);

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
  }
}

function stopAgent() {
  if (state.currentAgent) {
    state.currentAgent.stop();
  }
  setAgentRunning(false);
  updateStatus('Dihentikan', false);
  state.currentAgent = null;
}

function handleAgentEvent(evt) {
  const t = evt.event_type || '';
  const msg = evt.message || '';
  const data = evt.data || {};
  const step = evt.step;

  switch (t) {
    case 'TASK_STARTED':
      appendCard('action', '🚀', 'AGENT', msg, step);
      break;
    case 'CONTEXT_ATTACHED':
      appendCard('action', '🔗', 'ATTACH', msg, step);
      break;
    case 'OBSERVATION':
      appendCard('observation', '👁️', 'OBSERVASI', msg, step);
      break;
    case 'THINKING_STATUS':
      appendCard('thinking', '🧠', 'REASONING', msg, step);
      break;
    case 'CLICK':
      appendCard('action', '🖱️', 'CLICK', msg, step);
      break;
    case 'TYPE':
      appendCard('action', '⌨️', 'TYPE', msg, step);
      break;
    case 'NAVIGATE':
      appendCard('action', '🌐', 'NAVIGATE', msg, step);
      break;
    case 'SCROLL':
      appendCard('action', '📜', 'SCROLL', msg, step);
      break;
    case 'ACTION':
      appendCard('action', '⚡', 'ACTION', msg, step);
      break;
    case 'COMPLETED':
      appendCard('completed', '✅', 'DONE', data.result || msg || 'Tugas selesai', step);
      break;
    case 'FAILED':
      appendCard('error', '❌', 'FAILED', data.error || msg, step);
      break;
    case 'STOPPED':
      appendCard('thinking', '⏹️', 'STOPPED', 'Agent dihentikan oleh pengguna', step);
      break;
  }
}

// ─── Timeline UI Card Helper ─────────────────────────────────────────────────
function appendCard(type, icon, tag, body, step = null) {
  hideEmptyState();

  const card = document.createElement('div');
  card.className = `event-card ${type}`;
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const isThinking = type === 'thinking';
  const isCompleted = type === 'completed';

  card.innerHTML = `
    <div class="event-header">
      <span class="event-badge">${icon} ${escHtml(tag)}</span>
      ${step ? `<span class="event-step-pill">Langkah ${step}</span>` : ''}
      <span class="event-time">${time}</span>
    </div>
    <div class="event-body ${isThinking ? 'thought-accordion' : ''} ${isCompleted ? 'highlight' : ''}">${escHtml(body)}</div>
  `;

  elTimeline.appendChild(card);
  card.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function hideEmptyState() {
  elEmptyState.style.display = 'none';
}

function clearTimeline() {
  elTimeline.innerHTML = '';
  elEmptyState.style.display = '';
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
    elBtnSend.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
  } else {
    elBtnSend.classList.remove('running');
    elBtnSend.title = 'Kirim Perintah';
    elBtnSend.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
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

// ─── Modal Helpers ───────────────────────────────────────────────────────────
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
  // Input submit
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

  // Topbar buttons
  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-new').addEventListener('click', () => createNewSession());
  $('drawer-close').addEventListener('click', closeDrawer);
  elDrawerOverlay.addEventListener('click', closeDrawer);
  $('btn-new-session').addEventListener('click', createNewSession);

  // Model Selector Modal
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

  // Settings / Mode Modal
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

  // Quick prompt chips
  document.querySelectorAll('.quick-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      elGoalInput.value = btn.dataset.prompt;
      resizeTextarea();
      elBtnSend.disabled = false;
      elGoalInput.focus();
    });
  });

  // Close modals on overlay click
  ['modal-models', 'modal-apikeys', 'modal-settings'].forEach((mId) => {
    $(mId).addEventListener('click', (e) => {
      if (e.target === $(mId)) closeModal(mId);
    });
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
