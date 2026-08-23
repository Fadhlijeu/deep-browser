/**
 * Deep Browser Extension — Sidepanel Client & Browser Transport Adapter
 * =====================================================================
 *
 * Architecture:
 *   1. User submits task → POST /api/tasks (owner=EXTENSION)
 *   2. Backend launches genuine Browser Use Agent with ExtensionBrowserSession
 *   3. Extension opens WebSocket to /ws/ext-transport/{task_id}
 *   4. Extension handles atomic browser commands from ExtensionBrowserSession:
 *      - GET_STATE    → Scrapes DOM tree + captures tab screenshot
 *      - NAVIGATE     → chrome.tabs.update()
 *      - CLICK        → chrome.scripting (scrollIntoView + focus + click)
 *      - TYPE         → chrome.scripting (value set + input/change events)
 *      - SCROLL       → chrome.scripting (window.scrollBy)
 *      - SEND_KEYS    → chrome.scripting (keyboard events)
 *   5. Presentation UI receives live timeline events from /ws/extension broadcast
 */

'use strict';

const SERVER = 'http://127.0.0.1:8765';
const SERVER_WS = 'ws://127.0.0.1:8765';

// ─── State ───────────────────────────────────────────────────────────────────
let state = {
  serverOnline: false,
  currentTab: null,
  sessions: [],
  activeSessionId: null,
  activeTaskId: null,
  transportWs: null,      // /ws/ext-transport/{task_id}
  eventWs: null,          // /ws/extension
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
  connectEventStream();
  detectCurrentTab();
  checkServerHealth();
  loadSessions();
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

// ─── Server Health Monitor ───────────────────────────────────────────────────
async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER}/api/health`, { signal: AbortSignal.timeout(2000) });
    state.serverOnline = res.ok;
  } catch {
    state.serverOnline = false;
  }
  elStatusDot.className = state.serverOnline ? 'online' : 'offline';
  elStatusDot.title = state.serverOnline ? 'Companion server online' : 'Companion server offline';
  setTimeout(checkServerHealth, 5000);
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
    if (state.currentTab && tabId === state.currentTab.id && changeInfo.title) {
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

// ─── Broadcast Event Stream (Presentation UI) ────────────────────────────────
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
  // Extension ONLY handles its own events — strictly isolated from Workspace
  if (evt.owner && evt.owner !== 'EXTENSION') return;
  if (evt.task_id && state.activeTaskId && evt.task_id !== state.activeTaskId) return;

  const t = evt.event_type || '';
  const msg = evt.message || evt.summary || '';
  const data = evt.data || {};

  if (t === 'TASK_CREATED') return; // Handled locally

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

// ─── Task Submission ─────────────────────────────────────────────────────────
async function submitTask() {
  const goal = elGoalInput.value.trim();
  if (!goal || state.agentRunning) return;

  if (!state.activeSessionId) createNewSession();

  appendCard('user', '👤', 'ANDA', goal);
  elGoalInput.value = '';
  resizeTextarea();
  hideEmptyState();
  setAgentRunning(true);

  const providerInfo = MODELS.find(m => m.id === state.selectedModel);
  const provider = providerInfo?.provider || 'gemini';
  const apiKey = state.apiKeys[provider] || '';

  const modelParts = state.selectedModel.split('/');
  const modelName = modelParts[1] || modelParts[0];

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

  // Connect transport WebSocket to drive browser commands
  connectTransportWs(taskId);
}

// ─── Transport Layer: WebSocket Protocol (Chrome Extension as Browser) ───────
function connectTransportWs(taskId) {
  if (state.transportWs) try { state.transportWs.close(); } catch {}

  const ws = new WebSocket(`${SERVER_WS}/ws/ext-transport/${taskId}`);
  state.transportWs = ws;

  ws.onopen = () => {
    loggerLog('Transport WebSocket connected');
  };

  ws.onerror = () => {
    setAgentRunning(false);
    appendCard('error', '❌', 'TRANSPORT ERROR', 'Gagal menghubungkan transport WebSocket ke server');
  };

  ws.onclose = () => {
    state.transportWs = null;
  };

  ws.onmessage = async e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    if (msg.type === 'TRANSPORT_COMMAND') {
      await handleTransportCommand(msg, ws);
    }
  };
}

async function handleTransportCommand(msg, ws) {
  const { request_id, command, params } = msg;

  try {
    if (command === 'GET_STATE') {
      const stateResult = await captureBrowserState(params?.include_screenshot !== false);
      ws.send(JSON.stringify({
        request_id,
        result: stateResult,
      }));
      return;
    }

    if (command === 'NAVIGATE') {
      const res = await executeNavigate(params?.url, params?.new_tab);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'CLICK') {
      const res = await executeClick(params?.index, params?.xpath);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'CLICK_COORDINATE') {
      const res = await executeClickCoordinate(params?.x, params?.y);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'TYPE') {
      const res = await executeType(params?.index, params?.text, params?.clear, params?.xpath);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'SCROLL') {
      const res = await executeScroll(params?.direction, params?.amount);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'SCROLL_TO_TEXT') {
      const res = await executeScrollToText(params?.text);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'SEND_KEYS') {
      const res = await executeSendKeys(params?.keys);
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'REFRESH') {
      const res = await executeRefresh();
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'GO_BACK') {
      const res = await executeGoBack();
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    if (command === 'GO_FORWARD') {
      const res = await executeGoForward();
      ws.send(JSON.stringify({ request_id, result: res }));
      return;
    }

    // Default error for unhandled commands
    ws.send(JSON.stringify({
      request_id,
      error: `Unknown transport command: ${command}`,
    }));
  } catch (err) {
    ws.send(JSON.stringify({
      request_id,
      error: err.message || String(err),
    }));
  }
}

// ─── Browser Operations via Chrome APIs ──────────────────────────────────────

async function captureBrowserState(includeScreenshot) {
  const tab = state.currentTab;
  if (!tab?.id) {
    return { url: '', title: '', elements: [], tabs: [], screenshot: null };
  }

  // 1. Scrape DOM interactive elements and page metadata
  let domData = { elements: [], page_info: {} };
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
            while (sib) {
              if (sib.tagName === cur.tagName) idx++;
              sib = sib.previousElementSibling;
            }
            parts.unshift(cur.tagName.toLowerCase() + (idx > 1 ? '[' + idx + ']' : ''));
            cur = cur.parentElement;
          }
          return '/' + parts.join('/');
        }

        const selector = [
          'a[href]', 'button:not([disabled])', 'input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])', 'textarea:not([disabled])',
          '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
          '[role="checkbox"]', '[role="radio"]', '[role="combobox"]',
          '[onclick]', '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        const seen = new Set();
        const elements = [];
        let counter = 1;

        document.querySelectorAll(selector).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);

          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) return;

          const text = (
            el.innerText || el.value || el.placeholder ||
            el.getAttribute('aria-label') || el.getAttribute('title') || ''
          ).trim().slice(0, 120);

          elements.push({
            index: counter++,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            role: el.getAttribute('role') || '',
            text,
            href: el.href || '',
            name: el.getAttribute('name') || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            value: ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ? el.value : '',
            xpath: getXPath(el),
          });
        });

        const docEl = document.documentElement;
        const pageInfo = {
          viewport_width: window.innerWidth,
          viewport_height: window.innerHeight,
          page_width: docEl ? docEl.scrollWidth : window.innerWidth,
          page_height: docEl ? docEl.scrollHeight : window.innerHeight,
          scroll_x: window.scrollX,
          scroll_y: window.scrollY,
          pixels_above: window.scrollY,
          pixels_below: docEl ? Math.max(0, docEl.scrollHeight - (window.scrollY + window.innerHeight)) : 0,
        };

        return {
          url: location.href,
          title: document.title,
          elements,
          page_info: pageInfo,
        };
      }
    });

    if (results?.[0]?.result) {
      domData = results[0].result;
    }
  } catch (e) {
    loggerLog('DOM scrape error: ' + e.message);
  }

  // 2. Capture screenshot if requested
  let screenshot = null;
  if (includeScreenshot) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      if (dataUrl && dataUrl.includes(',')) {
        screenshot = dataUrl.split(',')[1]; // Strip data:image/png;base64, prefix
      }
    } catch (e) {
      loggerLog('Screenshot capture error: ' + e.message);
    }
  }

  return {
    url: domData.url || tab.url || '',
    title: domData.title || tab.title || '',
    tabs: [{ url: tab.url, title: tab.title, id: tab.id }],
    elements: domData.elements || [],
    screenshot,
    page_info: domData.page_info || {},
  };
}

async function executeNavigate(url, newTab) {
  if (!url) return { success: false, error: 'No URL provided' };

  if (newTab) {
    const created = await chrome.tabs.create({ url });
    setCurrentTab(created);
    return { success: true, url, tab_id: created.id };
  }

  const tab = state.currentTab;
  await chrome.tabs.update(tab.id, { url });

  // Wait for tab navigation to complete
  await new Promise(resolve => {
    const listener = (tabId, changeInfo) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        chrome.tabs.get(tabId, t => { if (t) setCurrentTab(t); });
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 10000); // 10s fallback timeout
  });

  return { success: true, url };
}

async function executeClick(index, xpath) {
  const tab = state.currentTab;
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (idx, xp) => {
      let el = null;
      if (xp) {
        el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      if (!el && idx != null) {
        const sel = 'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [onclick]';
        const matches = Array.from(document.querySelectorAll(sel));
        el = matches[idx - 1];
      }
      if (!el) return { success: false, error: `Element not found (index=${idx}, xpath=${xp})` };

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      el.click();
      return { success: true };
    },
    args: [index, xpath || null]
  });

  return res?.[0]?.result || { success: false, error: 'Click execution failed' };
}

async function executeClickCoordinate(x, y) {
  const tab = state.currentTab;
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (cx, cy) => {
      const el = document.elementFromPoint(cx, cy);
      if (!el) return { success: false, error: `No element at coordinates (${cx}, ${cy})` };
      el.focus();
      el.click();
      return { success: true };
    },
    args: [x, y]
  });
  return res?.[0]?.result || { success: false, error: 'Coordinate click failed' };
}

async function executeType(index, text, clear, xpath) {
  const tab = state.currentTab;
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (idx, txt, clr, xp) => {
      let el = null;
      if (xp) {
        el = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }
      if (!el && idx != null) {
        const sel = 'input:not([type="hidden"]), textarea, select';
        const matches = Array.from(document.querySelectorAll(sel));
        el = matches[idx - 1];
      }
      if (!el) return { success: false, error: `Input element not found (index=${idx})` };

      el.focus();
      if (clr) el.value = '';
      el.value = (clr ? '' : (el.value || '')) + String(txt || '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true };
    },
    args: [index, text, clear !== false, xpath || null]
  });

  return res?.[0]?.result || { success: false, error: 'Type execution failed' };
}

async function executeScroll(direction, amount) {
  const tab = state.currentTab;
  const amt = amount || 400;
  const dir = direction || 'down';
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (d, a) => window.scrollBy(0, d === 'down' ? a : -a),
    args: [dir, amt]
  });
  return { success: true };
}

async function executeScrollToText(text) {
  const tab = state.currentTab;
  const res = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (txt) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent && node.textContent.includes(txt)) {
          const parent = node.parentElement;
          if (parent) {
            parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return { success: true };
          }
        }
      }
      return { success: false, error: `Text "${txt}" not found on page` };
    },
    args: [text]
  });
  return res?.[0]?.result || { success: false, error: 'Scroll to text failed' };
}

async function executeSendKeys(keys) {
  const tab = state.currentTab;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (k) => {
      const el = document.activeElement || document.body;
      ['keydown', 'keypress', 'keyup'].forEach(evt => {
        el.dispatchEvent(new KeyboardEvent(evt, { key: k, code: 'Key' + k, bubbles: true }));
      });
    },
    args: [keys || 'Enter']
  });
  return { success: true };
}

async function executeRefresh() {
  const tab = state.currentTab;
  await chrome.tabs.reload(tab.id);
  return { success: true };
}

async function executeGoBack() {
  const tab = state.currentTab;
  await chrome.tabs.goBack(tab.id);
  return { success: true };
}

async function executeGoForward() {
  const tab = state.currentTab;
  await chrome.tabs.goForward(tab.id);
  return { success: true };
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

function loggerLog(msg) {
  console.log('[DeepBrowser Extension]', msg);
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

async function stopAgent() {
  try { await fetch(`${SERVER}/api/agent/stop`, { method: 'POST' }); } catch {}
  if (state.transportWs) try { state.transportWs.close(); } catch {}
  setAgentRunning(false);
  appendCard('thinking', '⏹️', 'BERHENTI', 'Agent dihentikan oleh pengguna');
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
