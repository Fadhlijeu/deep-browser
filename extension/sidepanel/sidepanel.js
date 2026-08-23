/**
 * Deep Browser Extension — Standalone SidePanel Controller
 * =========================================================
 *
 * Runs the Browser Use agent runtime directly in the Chrome Extension.
 * Zero WebSocket server / companion dependency.
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  currentTab: null,
  sessions: [],
  activeSessionId: null,
  currentAgent: null,
  agentRunning: false,
  selectedModel: 'gemini/gemini-2.0-flash',
  selectedMode: 'agent_decide',
  apiKeys: {},
  settingsPanelOpen: false,
  apikeyPanelOpen: false,
  drawerOpen: false,
};

// ─── Model & Mode Config ─────────────────────────────────────────────────────
const MODELS = [
  { id: 'gemini/gemini-2.0-flash',      name: 'Gemini 2.0 Flash (Default Primary)', icon: '⚡', provider: 'gemini' },
  { id: 'gemini/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Fast)',        icon: '🏃', provider: 'gemini' },
  { id: 'gemini/gemini-1.5-pro',        name: 'Gemini 1.5 Pro (Deep Reasoning)',    icon: '🔬', provider: 'gemini' },
  { id: 'gemini/gemini-1.5-flash',      name: 'Gemini 1.5 Flash',                   icon: '💡', provider: 'gemini' },
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                             icon: '🤖', provider: 'openai' },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini (Fast)',                 icon: '⚡', provider: 'openai' },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',                 icon: '🎭', provider: 'anthropic' },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local / Ollama)',            icon: '🦙', provider: 'ollama' },
];

const MODES = [
  { id: 'agent_decide', name: 'Agent Decide (Adaptif)', icon: '🤖' },
  { id: 'auto',         name: 'Always Proceed (Auto)',  icon: '⚡' },
  { id: 'hitl',         name: 'Request Review (HITL)',  icon: '🔵' },
];

const PROVIDERS = [
  { id: 'gemini',    name: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'openai',    name: 'OpenAI',        placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic',     placeholder: 'sk-ant-...' },
  { id: 'ollama',    name: 'Ollama (Local)', placeholder: 'http://localhost:11434' },
];

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const elMain          = $('main');
const elTimeline      = $('timeline');
const elEmptyState    = $('empty-state');
const elGoalInput     = $('goal-input');
const elBtnSend       = $('btn-send');
const elStatusDot     = $('status-dot');
const elApiBadge      = $('api-badge');
const elApiIndicator  = $('api-indicator');
const elApiBadgeText  = $('api-badge-text');
const elModelPill     = $('model-pill');
const elModelPillName = $('model-pill-name');
const elTabStrip      = $('tab-strip');
const elTabFavicon    = $('tab-favicon');
const elTabTitle      = $('tab-title');
const elSettingsPanel = $('settings-panel');
const elApikeyPanel   = $('apikey-panel');
const elDrawer        = $('session-drawer');
const elDrawerOverlay = $('drawer-overlay');
const elSessionList   = $('session-list');

// ─── Initialization ──────────────────────────────────────────────────────────
async function init() {
  await loadStorage();
  renderModelRadio();
  renderModeRadio();
  renderApikeyProviders();
  renderModelPill();
  renderApiStatus();
  bindEvents();
  detectCurrentTab();
  loadSessions();

  // Standalone status: Always ready
  elStatusDot.className = 'online';
  elStatusDot.title = 'Deep Browser Extension Ready (Standalone Mode)';
}

// ─── Storage ─────────────────────────────────────────────────────────────────
async function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get([
      'selectedModel', 'selectedMode', 'apiKeys', 'sessions', 'activeSessionId'
    ], data => {
      if (data.selectedModel) state.selectedModel = data.selectedModel;
      if (data.selectedMode)  state.selectedMode  = data.selectedMode;
      if (data.apiKeys)       state.apiKeys       = data.apiKeys;
      if (data.sessions)      state.sessions      = data.sessions;
      if (data.activeSessionId) state.activeSessionId = data.activeSessionId;
      resolve();
    });
  });
}

async function saveStorage(keys) {
  return new Promise(resolve => chrome.storage.local.set(keys, resolve));
}

// ─── Tab Tracking ────────────────────────────────────────────────────────────
function detectCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs?.[0]) setCurrentTab(tabs[0]);
  });
  chrome.tabs.onActivated.addListener(info => {
    chrome.tabs.get(info.tabId, tab => { if (tab) setCurrentTab(tab); });
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (state.currentTab && tabId === state.currentTab.id && (changeInfo.title || changeInfo.url)) {
      setCurrentTab(tab);
    }
  });
}

function setCurrentTab(tab) {
  state.currentTab = tab;
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
    elTabStrip.classList.add('visible');
    elTabFavicon.src = tab.favIconUrl || '';
    elTabTitle.textContent = tab.title || tab.url;
  }
}

// ─── Sessions ────────────────────────────────────────────────────────────────
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
  [...state.sessions].reverse().forEach(s => {
    const div = document.createElement('div');
    div.className = 'session-item' + (s.id === state.activeSessionId ? ' active' : '');
    div.innerHTML = `<div class="session-name">${escHtml(s.name)}</div>
      <div class="session-meta">${new Date(s.createdAt).toLocaleDateString('id-ID')}</div>`;
    div.addEventListener('click', () => {
      state.activeSessionId = s.id;
      saveStorage({ activeSessionId: s.id });
      renderSessionList();
      closeDrawer();
    });
    elSessionList.appendChild(div);
  });
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

  // Validate API key for selected provider
  const providerInfo = MODELS.find(m => m.id === state.selectedModel);
  const provider = providerInfo?.provider || 'gemini';
  const apiKey = state.apiKeys[provider] || '';

  if (provider !== 'ollama' && (!apiKey || !apiKey.trim())) {
    appendCard('error', '🔑', 'API KEY DIBUTUHKAN', `Silakan masukkan ${providerInfo?.name || provider} API Key terlebih dahulu di ikon kunci (atas kanan).`);
    toggleApikey();
    return;
  }

  appendCard('user', '👤', 'ANDA', goal);
  elGoalInput.value = '';
  resizeTextarea();
  hideEmptyState();
  setAgentRunning(true);

  const modelParts = state.selectedModel.split('/');
  const modelName = modelParts[1] || modelParts[0];

  const browserSession = new window.BrowserSession({
    tabId: state.currentTab?.id,
    windowId: state.currentTab?.windowId,
  });

  const llmClient = new window.LLMClient({
    provider,
    model: modelName,
    apiKey,
    ollamaHost: state.apiKeys['ollama'] || 'http://localhost:11434',
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
    // Already emitted FAILED event
  } finally {
    setAgentRunning(false);
    state.currentAgent = null;
  }
}

function stopAgent() {
  if (state.currentAgent) {
    state.currentAgent.stop();
  }
  setAgentRunning(false);
  state.currentAgent = null;
}

// ─── Timeline Event Handler ──────────────────────────────────────────────────
function handleAgentEvent(evt) {
  const t = evt.event_type || '';
  const msg = evt.message || '';
  const data = evt.data || {};

  switch (t) {
    case 'TASK_STARTED':
      appendCard('action', '🚀', 'AGENT', msg || 'Agent dimulai — menganalisis halaman...');
      break;
    case 'CONTEXT_ATTACHED':
      appendCard('action', '🔗', 'TERHUBUNG', msg);
      break;
    case 'OBSERVATION':
      appendCard('observation', '👁️', 'OBSERVASI', msg);
      break;
    case 'THINKING_STATUS':
      appendCard('thinking', '🧠', 'BERPIKIR', msg);
      break;
    case 'CLICK':
      appendCard('action', '🖱️', 'KLIK', msg);
      break;
    case 'TYPE':
      appendCard('action', '⌨️', 'KETIK', msg);
      break;
    case 'NAVIGATE':
      appendCard('action', '🌐', 'NAVIGASI', msg);
      break;
    case 'SCROLL':
      appendCard('action', '📜', 'SCROLL', msg);
      break;
    case 'ACTION':
      appendCard('action', '⚡', 'AKSI', msg);
      break;
    case 'COMPLETED':
      appendCard('completed', '✅', 'SELESAI', data.result || msg || 'Tugas selesai');
      break;
    case 'FAILED':
      appendCard('error', '❌', 'GAGAL', data.error || msg);
      break;
    case 'STOPPED':
      appendCard('thinking', '⏹️', 'BERHENTI', 'Agent dihentikan oleh pengguna');
      break;
  }
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────
function appendCard(type, icon, tag, body) {
  hideEmptyState();

  const card = document.createElement('div');
  card.className = `event-card ${type}`;
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  card.innerHTML = `
    <div class="event-header">
      <span style="font-size:13px">${icon}</span>
      <span class="event-tag">${escHtml(tag)}</span>
      <span class="event-time">${time}</span>
    </div>
    <div class="event-body ${type === 'user' || type === 'completed' ? 'highlight' : ''}">${escHtml(body)}</div>
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

function setAgentRunning(running) {
  state.agentRunning = running;
  elBtnSend.disabled = false;
  if (running) {
    elBtnSend.classList.add('running');
    elBtnSend.title = 'Hentikan agent';
    elBtnSend.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
  } else {
    elBtnSend.classList.remove('running');
    elBtnSend.title = 'Kirim';
    elBtnSend.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  }
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Settings & Configuration UI ─────────────────────────────────────────────
function renderModelRadio() {
  const group = $('model-radio-group');
  group.innerHTML = '';
  MODELS.forEach(m => {
    const div = document.createElement('div');
    div.className = 'radio-item' + (state.selectedModel === m.id ? ' selected' : '');
    div.innerHTML = `
      <div class="radio-left">
        <span class="radio-icon">${m.icon}</span>
        <span class="radio-name">${escHtml(m.name)}</span>
      </div>
      <div class="radio-check"></div>
    `;
    div.addEventListener('click', () => {
      state.selectedModel = m.id;
      saveStorage({ selectedModel: m.id });
      renderModelRadio();
      renderModelPill();
    });
    group.appendChild(div);
  });
}

function renderModeRadio() {
  const group = $('mode-radio-group');
  group.innerHTML = '';
  MODES.forEach(m => {
    const div = document.createElement('div');
    div.className = 'radio-item' + (state.selectedMode === m.id ? ' selected' : '');
    div.innerHTML = `
      <div class="radio-left">
        <span class="radio-icon">${m.icon}</span>
        <span class="radio-name">${escHtml(m.name)}</span>
      </div>
      <div class="radio-check"></div>
    `;
    div.addEventListener('click', () => {
      state.selectedMode = m.id;
      saveStorage({ selectedMode: m.id });
      renderModeRadio();
    });
    group.appendChild(div);
  });
}

function renderModelPill() {
  const m = MODELS.find(x => x.id === state.selectedModel) || MODELS[0];
  elModelPillName.textContent = m.name.length > 28 ? m.name.slice(0, 28) + '...' : m.name;
}

function renderApiStatus() {
  const hasKey = Object.values(state.apiKeys).some(v => v && v.trim());
  elApiIndicator.className = hasKey ? 'set' : '';
  elApiBadgeText.textContent = hasKey ? 'API Key Set' : 'No API Key';
}

function renderApikeyProviders() {
  const container = $('apikey-providers');
  container.innerHTML = '';
  PROVIDERS.forEach(p => {
    const saved = state.apiKeys[p.id] || '';
    const div = document.createElement('div');
    div.className = 'provider-row';
    div.innerHTML = `
      <div class="provider-name">${escHtml(p.name)}</div>
      <div class="apikey-input-wrap">
        <input class="apikey-input" type="password" id="apikey-${p.id}"
          placeholder="${escHtml(p.placeholder)}" value="${escHtml(saved)}" autocomplete="off" />
        <button class="apikey-toggle" data-target="apikey-${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    `;
    div.querySelector('.apikey-toggle').addEventListener('click', function() {
      const inp = document.getElementById(this.dataset.target);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    div.querySelector(`#apikey-${p.id}`).addEventListener('change', async function() {
      state.apiKeys[p.id] = this.value.trim();
      await saveStorage({ apiKeys: state.apiKeys });
      renderApiStatus();
    });
    container.appendChild(div);
  });
}

function toggleSettings() {
  state.settingsPanelOpen = !state.settingsPanelOpen;
  state.apikeyPanelOpen = false;
  elSettingsPanel.classList.toggle('visible', state.settingsPanelOpen);
  elApikeyPanel.classList.remove('visible');
  elModelPill.classList.toggle('open', state.settingsPanelOpen);
}

function closeSettings() {
  state.settingsPanelOpen = false;
  elSettingsPanel.classList.remove('visible');
  elModelPill.classList.remove('open');
}

function toggleApikey() {
  state.apikeyPanelOpen = !state.apikeyPanelOpen;
  state.settingsPanelOpen = false;
  elApikeyPanel.classList.toggle('visible', state.apikeyPanelOpen);
  elSettingsPanel.classList.remove('visible');
}

function closeApikey() {
  state.apikeyPanelOpen = false;
  elApikeyPanel.classList.remove('visible');
}

function openDrawer() {
  state.drawerOpen = true;
  elDrawer.classList.add('open');
  elDrawerOverlay.classList.add('visible');
}

function closeDrawer() {
  state.drawerOpen = false;
  elDrawer.classList.remove('open');
  elDrawerOverlay.classList.remove('visible');
}

function resizeTextarea() {
  elGoalInput.style.height = 'auto';
  elGoalInput.style.height = Math.min(elGoalInput.scrollHeight, 120) + 'px';
}

// ─── Event Bindings ──────────────────────────────────────────────────────────
function bindEvents() {
  elBtnSend.addEventListener('click', () => {
    if (state.agentRunning) {
      stopAgent();
    } else {
      submitTask();
    }
  });

  elGoalInput.addEventListener('input', () => {
    resizeTextarea();
    elBtnSend.disabled = !elGoalInput.value.trim() && !state.agentRunning;
  });
  elGoalInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!elBtnSend.disabled) submitTask();
    }
  });
  elGoalInput.addEventListener('focus', () => {
    elBtnSend.disabled = !elGoalInput.value.trim() && !state.agentRunning;
  });

  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-new').addEventListener('click', () => { createNewSession(); });
  $('btn-settings').addEventListener('click', toggleSettings);
  $('api-badge').addEventListener('click', toggleApikey);

  $('close-settings').addEventListener('click', closeSettings);
  $('close-apikey').addEventListener('click', closeApikey);
  $('btn-open-apikey').addEventListener('click', () => {
    closeSettings();
    setTimeout(() => { state.apikeyPanelOpen = false; toggleApikey(); }, 10);
  });

  elModelPill.addEventListener('click', toggleSettings);
  elDrawerOverlay.addEventListener('click', closeDrawer);
  $('drawer-close').addEventListener('click', closeDrawer);
  $('btn-new-session').addEventListener('click', createNewSession);

  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      elGoalInput.value = btn.dataset.prompt;
      resizeTextarea();
      elBtnSend.disabled = false;
    });
  });

  document.addEventListener('click', e => {
    if (!elSettingsPanel.contains(e.target) && !$('btn-settings').contains(e.target) && !elModelPill.contains(e.target)) {
      closeSettings();
    }
    if (!elApikeyPanel.contains(e.target) && !elApiBadge.contains(e.target)) {
      closeApikey();
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
