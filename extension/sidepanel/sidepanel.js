/**
 * Deep Browser Extension — Sidepanel Logic
 *
 * Architecture:
 *   1. User types task → POST /api/tasks (owner=EXTENSION)
 *   2. Backend signals: open /ws/ext-agent/{task_id}
 *   3. Extension opens WebSocket to /ws/ext-agent/{task_id}
 *   4. On GET_DOM_SNAPSHOT → scrape DOM via chrome.scripting → send back
 *   5. On EXECUTE_ACTION  → execute via chrome.scripting → send ACTION_RESULT
 *   6. Display events in timeline
 *
 * Uses Browser Use's reasoning algorithms via backend bridge.
 * Zero connection to Workspace sessions or coordinator.
 */

'use strict';

const SERVER = 'http://127.0.0.1:8765';
const SERVER_WS = 'ws://127.0.0.1:8765';

// ─── State ───────────────────────────────────────────────────────
let state = {
  serverOnline: false,
  currentTab: null,
  sessions: [],           // local Extension sessions
  activeSessionId: null,
  activeTaskId: null,
  agentWs: null,          // /ws/ext-agent/{task_id}
  eventWs: null,          // /ws/extension event stream
  agentRunning: false,
  selectedModel: 'gemini/gemini-2.0-flash',
  selectedMode: 'agent_decide',
  apiKeys: {},            // provider → key
  settingsPanelOpen: false,
  apikeyPanelOpen: false,
  drawerOpen: false,
};

// ─── Model & Mode Config ─────────────────────────────────────────
const MODELS = [
  { id: 'gemini/gemini-2.0-flash',      name: 'Auto (Gemini 2.0 Flash Default...)', icon: '✨', provider: 'gemini' },
  { id: 'gemini/gemini-2.0-flash-001',  name: 'Gemini 2.0 Flash (Default Primary)', icon: '⚡', provider: 'gemini' },
  { id: 'gemini/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Fast)',        icon: '🏃', provider: 'gemini' },
  { id: 'gemini/gemini-1.5-flash',      name: 'Gemini 1.5 Flash',                   icon: '💡', provider: 'gemini' },
  { id: 'gemini/gemini-1.5-pro',        name: 'Gemini 1.5 Pro (Deep Reasoning)',    icon: '🔬', provider: 'gemini' },
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                             icon: '🤖', provider: 'openai' },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini (Fast)',                 icon: '⚡', provider: 'openai' },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',                 icon: '🎭', provider: 'anthropic' },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local / Ollama)',            icon: '🦙', provider: 'ollama' },
];

const MODES = [
  { id: 'agent_decide', name: 'Agent Decide (Adaptif)', icon: '🤖',
    desc: 'Agent memutuskan kapan perlu konfirmasi' },
  { id: 'auto',         name: 'Always Proceed (Auto)',  icon: '⚡',
    desc: 'Jalankan semua aksi tanpa konfirmasi' },
  { id: 'hitl',         name: 'Request Review (HITL)',  icon: '🔵',
    desc: 'Konfirmasi setiap aksi penting' },
];

const PROVIDERS = [
  { id: 'gemini',    name: 'Google Gemini', placeholder: 'AIza...' },
  { id: 'openai',    name: 'OpenAI',        placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic',     placeholder: 'sk-ant-...' },
  { id: 'ollama',    name: 'Ollama (Local)', placeholder: 'http://localhost:11434' },
];

// ─── DOM Refs ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const elMain        = $('main');
const elTimeline    = $('timeline');
const elEmptyState  = $('empty-state');
const elGoalInput   = $('goal-input');
const elBtnSend     = $('btn-send');
const elStatusDot   = $('status-dot');
const elApiBadge    = $('api-badge');
const elApiIndicator= $('api-indicator');
const elApiBadgeText= $('api-badge-text');
const elModelPill   = $('model-pill');
const elModelPillName = $('model-pill-name');
const elTabStrip    = $('tab-strip');
const elTabFavicon  = $('tab-favicon');
const elTabTitle    = $('tab-title');
const elSettingsPanel = $('settings-panel');
const elApikeyPanel = $('apikey-panel');
const elDrawer      = $('session-drawer');
const elDrawerOverlay = $('drawer-overlay');
const elSessionList = $('session-list');

// ─── Init ────────────────────────────────────────────────────────
async function init() {
  await loadStorage();
  renderModelRadio();
  renderModeRadio();
  renderApikeyProviders();
  renderModelPill();
  renderApiStatus();
  bindEvents();
  connectEventStream();
  detectCurrentTab();
  checkServerHealth();
  loadSessions();
}

// ─── Storage ─────────────────────────────────────────────────────
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

// ─── Server Health ────────────────────────────────────────────────
async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER}/health`, { signal: AbortSignal.timeout(2000) });
    state.serverOnline = res.ok;
  } catch {
    state.serverOnline = false;
  }
  elStatusDot.className = state.serverOnline ? 'online' : 'offline';
  elStatusDot.title = state.serverOnline ? 'Companion server online' : 'Companion server offline';
  setTimeout(checkServerHealth, 5000);
}

// ─── Current Tab ─────────────────────────────────────────────────
function detectCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs?.[0]) setCurrentTab(tabs[0]);
  });
  chrome.tabs.onActivated.addListener(info => {
    chrome.tabs.get(info.tabId, tab => { if (tab) setCurrentTab(tab); });
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

// ─── Sessions ────────────────────────────────────────────────────
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

// ─── Event Stream WS ─────────────────────────────────────────────
function connectEventStream() {
  if (state.eventWs) try { state.eventWs.close(); } catch {}
  const ws = new WebSocket(`${SERVER_WS}/ws/extension`);
  state.eventWs = ws;
  ws.onopen  = () => {};
  ws.onclose = () => setTimeout(connectEventStream, 3000);
  ws.onerror = () => {};
  ws.onmessage = e => {
    try { handleServerEvent(JSON.parse(e.data)); } catch {}
  };
}

function handleServerEvent(evt) {
  if (evt.task_id && evt.task_id !== state.activeTaskId) return;
  const t = evt.event_type || '';
  const msg = evt.message || evt.summary || '';
  const data = evt.data || {};

  if (t === 'TASK_STARTED') {
    appendCard('action', '🚀', 'AGENT', 'Agent dimulai — menganalisis halaman...');
  } else if (t === 'CONTEXT_ATTACHED') {
    appendCard('action', '🔗', 'TERHUBUNG', msg || 'Agent terhubung ke halaman');
  } else if (t === 'OBSERVATION') {
    appendCard('observation', '👁️', 'OBSERVASI', msg || `${data.url || ''}`);
  } else if (t === 'THINKING_STATUS') {
    appendCard('thinking', '🧠', 'BERPIKIR', msg || data.thinking || 'Menganalisis...');
  } else if (t === 'CLICK') {
    appendCard('action', '🖱️', 'KLIK', msg || data.target || '');
  } else if (t === 'TYPE') {
    appendCard('action', '⌨️', 'KETIK', msg || data.target || '');
  } else if (t === 'NAVIGATE') {
    appendCard('action', '🌐', 'NAVIGASI', data.url || msg);
  } else if (t === 'SCROLL') {
    appendCard('action', '📜', 'SCROLL', msg || 'Menggulir halaman');
  } else if (t === 'CHALLENGE_REQUIRED') {
    appendCard('error', '🔒', 'TANTANGAN', 'Verifikasi diperlukan. Selesaikan di browser.');
  } else if (t === 'COMPLETED') {
    setAgentRunning(false);
    appendCard('completed', '✅', 'SELESAI', data.result || msg || 'Tugas selesai');
  } else if (t === 'FAILED') {
    setAgentRunning(false);
    appendCard('error', '❌', 'GAGAL', data.error || msg);
  } else if (t === 'STOPPED') {
    setAgentRunning(false);
    appendCard('thinking', '⏹️', 'BERHENTI', 'Agent dihentikan oleh pengguna');
  }
}

// ─── Submit Task ─────────────────────────────────────────────────
async function submitTask() {
  const goal = elGoalInput.value.trim();
  if (!goal || state.agentRunning) return;

  // Ensure session exists
  if (!state.activeSessionId) createNewSession();

  appendCard('user', '👤', 'ANDA', goal);
  elGoalInput.value = '';
  resizeTextarea();
  hideEmptyState();
  setAgentRunning(true);

  // Get API key for selected provider
  const providerInfo = MODELS.find(m => m.id === state.selectedModel);
  const provider = providerInfo?.provider || 'gemini';
  const apiKey = state.apiKeys[provider] || '';

  // Parse model name (provider/model → model_name)
  const modelParts = state.selectedModel.split('/');
  const modelName = modelParts[1] || modelParts[0];

  // Submit task — backend will use Browser Use Agent reasoning
  let taskId;
  try {
    const tab = state.currentTab;
    const res = await fetch(`${SERVER}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: goal,
        session_id: state.activeSessionId,
        session_type: 'EXTENSION',
        owner: 'EXTENSION',
        browser_mode: 'EXTENSION_NATIVE',
        browser_type: 'extension',
        browser_id: `ext_tab_${tab?.id || 'current'}`,
        tab_id: tab?.id,
        window_id: tab?.windowId,
        url: tab?.url,
        title: tab?.title,
        model_provider: provider,
        model_name: modelName,
        api_key: apiKey || undefined,
        safe_mode: state.selectedMode === 'hitl',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || `Server ${res.status}`);
    }
    const data = await res.json();
    taskId = data.task_id;
    state.activeTaskId = taskId;
  } catch (e) {
    setAgentRunning(false);
    appendCard('error', '❌', 'ERROR', `Gagal mengirim task: ${e.message}`);
    return;
  }

  // Open WebSocket to agent loop — Extension becomes the browser interface
  connectAgentWs(taskId);
}

// ─── Agent WebSocket — Extension as browser interface ────────────
function connectAgentWs(taskId) {
  if (state.agentWs) try { state.agentWs.close(); } catch {}

  const ws = new WebSocket(`${SERVER_WS}/ws/ext-agent/${taskId}`);
  state.agentWs = ws;

  ws.onopen = () => {
    appendCard('action', '🔗', 'AGENT WS', 'Terhubung ke agen — siap scrape DOM');
  };

  ws.onerror = () => {
    setAgentRunning(false);
    appendCard('error', '❌', 'WS ERROR', 'Gagal terhubung ke agent WebSocket');
  };

  ws.onclose = () => {
    state.agentWs = null;
  };

  ws.onmessage = async e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    await handleAgentMessage(msg, ws);
  };
}

async function handleAgentMessage(msg, ws) {
  const type = msg.type;

  if (type === 'CONNECTED') {
    // Backend agent loop ready
  } else if (type === 'GET_DOM_SNAPSHOT') {
    // Backend requests DOM — scrape the active tab
    const snapshot = await scrapeDom();
    ws.send(JSON.stringify({ type: 'DOM_SNAPSHOT', data: snapshot }));

  } else if (type === 'EXECUTE_ACTION') {
    const { action, params, step } = msg;
    appendCard('action', actionIcon(action), action.toUpperCase(), formatAction(action, params));
    const result = await executeAction(action, params);
    ws.send(JSON.stringify({ type: 'ACTION_RESULT', step, success: result.success, error: result.error || '' }));

  } else if (type === 'AGENT_DONE') {
    setAgentRunning(false);
    appendCard('completed', '✅', 'SELESAI', msg.result || 'Tugas selesai');

  } else if (type === 'ERROR') {
    setAgentRunning(false);
    appendCard('error', '❌', 'ERROR', msg.message || 'Terjadi kesalahan');
  }
}

// ─── DOM Scraping ─────────────────────────────────────────────────
async function scrapeDom() {
  const tab = state.currentTab;
  if (!tab?.id) return { url: '', title: '', bodyText: '', interactiveElements: [] };

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        function getXPath(el) {
          if (el.id) return '//*[@id="' + el.id.replace(/"/g, '\\"') + '"]';
          const parts = [];
          let cur = el;
          while (cur && cur.nodeType === Node.ELEMENT_NODE) {
            let idx = 1, sib = cur.previousElementSibling;
            while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
            parts.unshift(cur.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
            cur = cur.parentElement;
          }
          return '/' + parts.join('/');
        }
        const sel = [
          'a[href]','button:not([disabled])','input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])','textarea:not([disabled])',
          '[role="button"]','[role="link"]','[role="menuitem"]','[role="tab"]',
          '[role="checkbox"]','[role="radio"]','[role="combobox"]',
          '[onclick]','[tabindex]:not([tabindex="-1"])'
        ].join(',');
        const seen = new Set(), elements = [];
        let idx = 0;
        document.querySelectorAll(sel).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 120);
          elements.push({
            index: idx++,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            role: el.getAttribute('role') || '',
            text, href: el.href || '',
            name: el.getAttribute('name') || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            value: ['INPUT','SELECT','TEXTAREA'].includes(el.tagName) ? el.value : '',
            xpath: getXPath(el)
          });
        });
        return {
          url: location.href,
          title: document.title,
          bodyText: document.body ? document.body.innerText.slice(0, 6000) : '',
          interactiveElements: elements
        };
      }
    });
    return results?.[0]?.result || { url: tab.url || '', title: tab.title || '', bodyText: '', interactiveElements: [] };
  } catch (err) {
    return { url: tab.url || '', title: tab.title || '', bodyText: `Error: ${err.message}`, interactiveElements: [] };
  }
}

// ─── Action Execution ─────────────────────────────────────────────
async function executeAction(action, params) {
  const tab = state.currentTab;

  try {
    if (action === 'navigate') {
      const url = params.url;
      await chrome.tabs.update(tab.id, { url });
      // Wait for page load
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            // Update current tab info
            chrome.tabs.get(tabId, t => { if (t) setCurrentTab(t); });
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
        setTimeout(resolve, 8000); // max wait
      });
      return { success: true };
    }

    if (action === 'wait') {
      await new Promise(r => setTimeout(r, (params.seconds || 2) * 1000));
      return { success: true };
    }

    // Actions requiring scripting — need xpath or index
    const xpath = params.xpath || await getXPathByIndex(tab.id, params.index);
    if (!xpath && !['scroll'].includes(action)) {
      return { success: false, error: `Element not found (index=${params.index})` };
    }

    if (action === 'click') {
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (xp) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!el) return { success: false, error: 'Element not found: ' + xp };
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
          el.click();
          return { success: true };
        },
        args: [xpath]
      });
      return res?.[0]?.result || { success: false, error: 'Script failed' };
    }

    if (action === 'type') {
      const text = String(params.text || '');
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (xp, txt) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!el) return { success: false, error: 'Element not found: ' + xp };
          el.focus();
          el.value = txt;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [xpath, text]
      });
      return res?.[0]?.result || { success: false, error: 'Script failed' };
    }

    if (action === 'scroll') {
      const dir = params.direction || 'down';
      const amt = params.amount || 400;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (d, a) => window.scrollBy(0, d === 'down' ? a : -a),
        args: [dir, amt]
      });
      return { success: true };
    }

    if (action === 'select_option') {
      const value = String(params.value || '');
      const res = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (xp, v) => {
          const el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (!el) return { success: false, error: 'Element not found' };
          el.value = v;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true };
        },
        args: [xpath, value]
      });
      return res?.[0]?.result || { success: false, error: 'Script failed' };
    }

    if (action === 'press_key') {
      const key = params.key || 'Enter';
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (k) => {
          const el = document.activeElement;
          ['keydown','keypress','keyup'].forEach(evtName => {
            el.dispatchEvent(new KeyboardEvent(evtName, { key: k, code: 'Key'+k, bubbles: true }));
          });
        },
        args: [key]
      });
      return { success: true };
    }

    return { success: false, error: `Unknown action: ${action}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getXPathByIndex(tabId, index) {
  if (index == null) return null;
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: (idx) => {
        function getXPath(el) {
          if (el.id) return '//*[@id="' + el.id.replace(/"/g, '\\"') + '"]';
          const parts = [];
          let cur = el;
          while (cur && cur.nodeType === Node.ELEMENT_NODE) {
            let i = 1, sib = cur.previousElementSibling;
            while (sib) { if (sib.tagName === cur.tagName) i++; sib = sib.previousElementSibling; }
            parts.unshift(cur.tagName.toLowerCase() + (i > 1 ? '[' + i + ']' : ''));
            cur = cur.parentElement;
          }
          return '/' + parts.join('/');
        }
        const sel = [
          'a[href]','button:not([disabled])','input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])','textarea:not([disabled])',
          '[role="button"]','[role="link"]','[role="menuitem"]','[role="tab"]',
          '[onclick]','[tabindex]:not([tabindex="-1"])'
        ].join(',');
        const seen = new Set(), els = [];
        document.querySelectorAll(sel).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;
          els.push(el);
        });
        const el = els[idx];
        return el ? getXPath(el) : null;
      },
      args: [index]
    });
    return res?.[0]?.result || null;
  } catch {
    return null;
  }
}

// ─── UI Helpers ──────────────────────────────────────────────────
function appendCard(type, icon, tag, body) {
  // Hide empty state on first card
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

function actionIcon(action) {
  const icons = { navigate: '🌐', click: '🖱️', type: '⌨️', scroll: '📜', select_option: '📋', wait: '⏳', press_key: '⌨️', done: '✅' };
  return icons[action] || '⚙️';
}

function formatAction(action, params) {
  if (action === 'navigate') return params.url || '';
  if (action === 'click') return `Element [${params.index}]`;
  if (action === 'type') return `"${String(params.text || '').slice(0, 60)}"`;
  if (action === 'scroll') return `${params.direction} ${params.amount || 400}px`;
  if (action === 'select_option') return `[${params.index}] → "${params.value}"`;
  if (action === 'wait') return `${params.seconds}s`;
  return JSON.stringify(params).slice(0, 80);
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Model & Mode UI ─────────────────────────────────────────────
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

// ─── Panels & Drawer ─────────────────────────────────────────────
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

// ─── Textarea auto-resize ─────────────────────────────────────────
function resizeTextarea() {
  elGoalInput.style.height = 'auto';
  elGoalInput.style.height = Math.min(elGoalInput.scrollHeight, 120) + 'px';
}

// ─── Event Bindings ───────────────────────────────────────────────
function bindEvents() {
  // Send / Stop button
  elBtnSend.addEventListener('click', () => {
    if (state.agentRunning) {
      stopAgent();
    } else {
      submitTask();
    }
  });

  // Textarea
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

  // Top bar
  $('btn-menu').addEventListener('click', openDrawer);
  $('btn-new').addEventListener('click', () => { createNewSession(); });
  $('btn-settings').addEventListener('click', toggleSettings);
  $('api-badge').addEventListener('click', toggleApikey);

  // Panels close
  $('close-settings').addEventListener('click', closeSettings);
  $('close-apikey').addEventListener('click', closeApikey);
  $('btn-open-apikey').addEventListener('click', () => {
    closeSettings();
    setTimeout(() => { state.apikeyPanelOpen = false; toggleApikey(); }, 10);
  });

  // Model pill
  elModelPill.addEventListener('click', toggleSettings);

  // Drawer
  elDrawerOverlay.addEventListener('click', closeDrawer);
  $('drawer-close').addEventListener('click', closeDrawer);
  $('btn-new-session').addEventListener('click', createNewSession);

  // Quick prompts
  document.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      elGoalInput.value = btn.dataset.prompt;
      resizeTextarea();
      elBtnSend.disabled = false;
    });
  });

  // Close panels on outside click
  document.addEventListener('click', e => {
    if (!elSettingsPanel.contains(e.target) && !$('btn-settings').contains(e.target) && !elModelPill.contains(e.target)) {
      closeSettings();
    }
    if (!elApikeyPanel.contains(e.target) && !elApiBadge.contains(e.target)) {
      closeApikey();
    }
  });
}

async function stopAgent() {
  try { await fetch(`${SERVER}/api/agent/stop`, { method: 'POST' }); } catch {}
  if (state.agentWs) try { state.agentWs.close(); } catch {}
  setAgentRunning(false);
  appendCard('thinking', '⏹️', 'BERHENTI', 'Agent dihentikan oleh pengguna');
}

// ─── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
