import { Session, ChatMessage, ModelDef, TabItem, RunState, ConnectionStatus, ConnectionMode, PresetId, ExecutionMode, LogEvent, ToolStep, HitlInteraction } from '../types';

declare const chrome: any;

export const DEFAULT_MODELS: ModelDef[] = [
  { id: 'gemini/gemini-2.0-flash',      name: 'Gemini 2.0 Flash',      icon: 'bolt',       provider: 'gemini',        modelId: 'gemini-2.0-flash' },
  { id: 'gemini/gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', icon: 'speed',      provider: 'gemini',        modelId: 'gemini-2.0-flash-lite' },
  { id: 'gemini/gemini-1.5-pro',        name: 'Gemini 1.5 Pro',        icon: 'psychology', provider: 'gemini',        modelId: 'gemini-1.5-pro' },
  { id: 'openai/gpt-4o',                name: 'GPT-4o',                icon: 'memory',     provider: 'openai',        modelId: 'gpt-4o' },
  { id: 'openai/gpt-4o-mini',           name: 'GPT-4o Mini',           icon: 'bolt',       provider: 'openai',        modelId: 'gpt-4o-mini' },
  { id: 'anthropic/claude-3-5-sonnet',  name: 'Claude 3.5 Sonnet',     icon: 'psychology', provider: 'anthropic',     modelId: 'claude-3-5-sonnet-20241022' },
  { id: 'custom/deepseek-chat',         name: 'DeepSeek Chat (V3)',    icon: 'hub',        provider: 'custom_openai', modelId: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'ollama/llama3',                name: 'Llama 3 (Local)',       icon: 'terminal',   provider: 'ollama',        modelId: 'llama3', baseUrl: 'http://localhost:11434' },
];

export const PRESET_OPTIONS: { id: PresetId; name: string; icon: string }[] = [
  { id: 'default',         name: 'Auto',       icon: 'smart_toy' },
  { id: 'research',        name: 'Research',   icon: 'manage_search' },
  { id: 'data_extraction', name: 'Extraction', icon: 'dataset' },
  { id: 'form_filling',    name: 'Form Fill',  icon: 'edit_note' },
  { id: 'read_only',       name: 'Read-only',  icon: 'visibility' },
];

export const MODE_OPTIONS: { id: ExecutionMode; name: string; desc: string; icon: string }[] = [
  { id: 'agent_decide', name: 'Agent Decide',   desc: 'Agent mengambil keputusan adaptif dengan konfirmasi dinamis.', icon: 'smart_toy' },
  { id: 'auto',         name: 'Always Proceed', desc: 'Eksekusi cepat otomatis tanpa jeda manual.', icon: 'bolt' },
  { id: 'hitl',         name: 'Request Review', desc: 'Review proposal sebelum eksekusi setiap aksi browser.', icon: 'shield' },
];

export interface SidepanelState {
  sessions: Session[];
  activeSessionId: string;
  models: ModelDef[];
  selectedModelId: string;
  selectedMode: ExecutionMode;
  selectedPreset: PresetId;
  apiKeys: Record<string, string>;
  tabs: TabItem[];
  runState: RunState;
  connectionStatus: ConnectionStatus;
  connectionMode: ConnectionMode;
  sidepanelEnabled: boolean;
  indexLabelingEnabled: boolean;
  isDetached: boolean;
  stepCount: number;
  currentView: 'chat' | 'logs';
  logFilter: 'all' | 'tools' | 'approvals' | 'errors' | 'verifications';
  logSearch: string;
  modals: {
    drawer: boolean;
    apikeys: boolean;
    settings: boolean;
    models: boolean;
  };
}

export class SidepanelStateManager {
  private state: SidepanelState;
  private listeners: Set<() => void> = new Set();
  private ws: WebSocket | null = null;
  private currentRunId: string | null = null;
  private extTransportWs: WebSocket | null = null;
  private currentTransportTaskId: string | null = null;
  private activeAgent: any = null;
  private coreLoadedPromise: Promise<void> | null = null;

  constructor() {
    const initId = 'session_' + Date.now();
    const isDetached = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('detached') === 'true';

    this.state = {
      sessions: [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [], events: [] }],
      activeSessionId: initId,
      models: [...DEFAULT_MODELS],
      selectedModelId: 'gemini/gemini-2.0-flash',
      selectedMode: 'agent_decide',
      selectedPreset: 'default',
      apiKeys: {},
      tabs: [],
      runState: 'idle',
      connectionStatus: 'standalone',
      connectionMode: 'auto',
      sidepanelEnabled: true,
      indexLabelingEnabled: true,
      isDetached,
      stepCount: 0,
      currentView: 'chat',
      logFilter: 'all',
      logSearch: '',
      modals: { drawer: false, apikeys: false, settings: false, models: false },
    };

    this.loadFromStorage();
    this.initTabsListener();
    this.initWebSocket();
    this.ensureCoreRuntimeLoaded().catch((err) => {
      console.warn('[DeepBrowser] Core runtime background preload notice:', err);
    });
  }

  public async ensureCoreRuntimeLoaded(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).Agent) return;
    if (this.coreLoadedPromise) return this.coreLoadedPromise;

    this.coreLoadedPromise = (async () => {
      const scripts = [
        'core/interaction_manager.js',
        'core/dom_service.js',
        'core/browser_session.js',
        'core/extractor.js',
        'core/research_engine.js',
        'core/skills/skill_base.js',
        'core/skills/research_skill.js',
        'core/security_policy.js',
        'core/state_machine.js',
        'core/widgets.js',
        'core/tools.js',
        'core/message_manager.js',
        'core/llm_client.js',
        'core/agent.js',
      ];

      for (const file of scripts) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL(file)
            : `../../${file}`;
          s.onload = () => resolve();
          s.onerror = (e) => {
            console.error(`[DeepBrowser] Failed to load core script: ${file}`, e);
            reject(new Error(`Failed to load ${file}`));
          };
          document.head.appendChild(s);
        });
      }
    })();

    return this.coreLoadedPromise;
  }

  public getState(): SidepanelState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private async loadFromStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get(['sessions', 'activeSessionId', 'selectedModelId', 'selectedMode', 'selectedPreset', 'apiKeys', 'models', 'sidepanelEnabled', 'indexLabelingEnabled', 'connectionMode']);
        if (stored.sessions && stored.sessions.length > 0) {
          this.state.sessions = stored.sessions;
        }
        if (stored.activeSessionId && this.state.sessions.some((s) => String(s.id) === String(stored.activeSessionId))) {
          this.state.activeSessionId = stored.activeSessionId;
        }
        if (stored.selectedModelId) this.state.selectedModelId = stored.selectedModelId;
        if (stored.selectedMode) this.state.selectedMode = stored.selectedMode;
        if (stored.selectedPreset) this.state.selectedPreset = stored.selectedPreset;
        if (stored.apiKeys) this.state.apiKeys = stored.apiKeys;
        if (stored.models && stored.models.length > 0) this.state.models = stored.models;
        if (typeof stored.sidepanelEnabled === 'boolean') this.state.sidepanelEnabled = stored.sidepanelEnabled;
        if (typeof stored.indexLabelingEnabled === 'boolean') this.state.indexLabelingEnabled = stored.indexLabelingEnabled;
        if (stored.connectionMode) {
          this.state.connectionMode = stored.connectionMode;
          if (stored.connectionMode === 'standalone') {
            this.state.connectionStatus = 'standalone';
          }
        }
        this.notify();
      } catch (err) {
        console.warn('[DeepBrowser] Error loading storage:', err);
      }
    }
  }

  public async saveStorage() {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set({
          sessions: this.state.sessions,
          activeSessionId: this.state.activeSessionId,
          selectedModelId: this.state.selectedModelId,
          selectedMode: this.state.selectedMode,
          selectedPreset: this.state.selectedPreset,
          apiKeys: this.state.apiKeys,
          models: this.state.models,
          sidepanelEnabled: this.state.sidepanelEnabled,
          indexLabelingEnabled: this.state.indexLabelingEnabled,
          connectionMode: this.state.connectionMode,
        });
      } catch (err) {
        console.warn('[DeepBrowser] Error saving storage:', err);
      }
    }
  }

  public toggleIndexLabeling(enabled?: boolean) {
    const nextVal = enabled !== undefined ? enabled : !this.state.indexLabelingEnabled;
    this.state.indexLabelingEnabled = nextVal;
    if (this.activeAgent?.browserSession?.setHighlightsEnabled) {
      this.activeAgent.browserSession.setHighlightsEnabled(nextVal);
    }
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any[]) => {
        if (tab?.id && !nextVal) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const overlay = document.getElementById('__deep_browser_highlight_overlay__');
              if (overlay) overlay.remove();
            },
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    this.notify();
    this.saveStorage();
  }

  private async initTabsListener() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const updateTabs = async () => {
        try {
          const chromeTabs = await chrome.tabs.query({ currentWindow: true });
          this.state.tabs = chromeTabs.map((t: any) => ({
            id: t.id || 0,
            title: t.title || 'Tab Tanpa Judul',
            url: t.url || '',
            active: Boolean(t.active),
            favIconUrl: t.favIconUrl,
          }));
          this.notify();
        } catch (_) {}
      };

      updateTabs();
      chrome.tabs.onActivated?.addListener(updateTabs);
      chrome.tabs.onUpdated?.addListener(updateTabs);
    }
  }

  private initWebSocket() {
    if (this.state.connectionMode === 'standalone') {
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      this.state.connectionStatus = 'standalone';
      this.notify();
      return;
    }

    try {
      this.state.connectionStatus = 'reconnecting';
      this.notify();

      const ws = new WebSocket('ws://127.0.0.1:7788/ws/extension');
      this.ws = ws;

      // 1.2s Auto-On Fallback timer: if backend daemon is not active, automatically switch to Online In-Browser
      const autoOnTimer = setTimeout(() => {
        if (this.state.connectionMode === 'auto' && this.state.connectionStatus === 'reconnecting') {
          console.log('[DeepBrowser] Backend daemon offline. Auto-On Standalone In-Browser Mode activated.');
          this.state.connectionStatus = 'standalone';
          this.notify();
        }
      }, 1200);

      ws.onopen = () => {
        clearTimeout(autoOnTimer);
        console.log('[DeepBrowser] Connected to local agent daemon ws.');
        this.state.connectionStatus = 'connected';
        this.notify();
      };

      ws.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          this.handleIncomingAgentEvent(evt);
        } catch (err) {
          console.error('[DeepBrowser] WS message error:', err);
        }
      };

      ws.onclose = () => {
        clearTimeout(autoOnTimer);
        this.ws = null;
        if (this.state.connectionMode === 'auto') {
          // In Auto mode, switch to standalone Online without showing red error
          this.state.connectionStatus = 'standalone';
          this.notify();
          // Silently probe for backend daemon every 15 seconds
          setTimeout(() => {
            if (this.state.connectionMode === 'auto' && this.state.connectionStatus === 'standalone') {
              this.probeDaemonSilent();
            }
          }, 15000);
        } else {
          this.state.connectionStatus = 'disconnected';
          this.notify();
          setTimeout(() => {
            if (this.state.connectionStatus === 'disconnected' && this.state.connectionMode === 'daemon') {
              this.initWebSocket();
            }
          }, 4000);
        }
      };

      ws.onerror = () => {
        clearTimeout(autoOnTimer);
        if (this.state.connectionMode === 'auto') {
          this.state.connectionStatus = 'standalone';
          this.notify();
        } else {
          this.state.connectionStatus = 'disconnected';
          this.notify();
        }
        try { ws.close(); } catch (_) {}
      };
    } catch (_) {
      if (this.state.connectionMode === 'auto') {
        this.state.connectionStatus = 'standalone';
      } else {
        this.state.connectionStatus = 'disconnected';
      }
      this.notify();
    }
  }

  private probeDaemonSilent() {
    try {
      const probe = new WebSocket('ws://127.0.0.1:7788/ws/extension');
      probe.onopen = () => {
        console.log('[DeepBrowser] Background daemon detected online. Upgrading connection...');
        try { probe.close(); } catch (_) {}
        if (this.state.connectionMode === 'auto') {
          this.initWebSocket();
        }
      };
      probe.onerror = () => {
        try { probe.close(); } catch (_) {}
      };
    } catch (_) {}
  }

  public connectExtTransport(taskId: string) {
    if (this.extTransportWs) {
      try { this.extTransportWs.close(); } catch (_) {}
      this.extTransportWs = null;
    }
    this.currentTransportTaskId = taskId;

    try {
      const ws = new WebSocket(`ws://127.0.0.1:7788/ws/ext-transport/${taskId}`);
      this.extTransportWs = ws;

      ws.onopen = () => {
        console.log(`[ExtTransport:${taskId}] Connected. Ready for CDP transport commands.`);
      };

      ws.onmessage = async (e) => {
        let msg: any;
        try { msg = JSON.parse(e.data); } catch (_) { return; }

        if (msg.type === 'TRANSPORT_COMMAND') {
          const { request_id, command, params } = msg;
          try {
            const result = await this.executeTransportCommand(command, params || {});
            ws.send(JSON.stringify({ request_id, result: result || {} }));
          } catch (err: any) {
            ws.send(JSON.stringify({ request_id, error: err?.message || String(err) }));
          }
        }
      };

      ws.onerror = (err) => console.error(`[ExtTransport:${taskId}] error:`, err);
      ws.onclose = () => {
        if (this.currentTransportTaskId === taskId) {
          this.extTransportWs = null;
          this.currentTransportTaskId = null;
        }
      };
    } catch (err) {
      console.error('[ExtTransport] Failed to open WS:', err);
    }
  }

  private async executeTransportCommand(command: string, params: any): Promise<any> {
    const activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    const tabId = activeTab?.id;

    switch (command) {
      case 'GET_STATE': {
        let elements = [];
        let pageInfo = {};
        if (typeof chrome !== 'undefined' && chrome.tabs && tabId) {
          try {
            const domRes = await chrome.tabs.sendMessage(tabId, {
              type: 'DEEP_BROWSER_CMD', command: 'GET_DOM_STATE'
            });
            elements = domRes?.elements || [];
            pageInfo = domRes?.pageInfo || {};
          } catch (_) {}
        }
        let screenshot = null;
        if (params.include_screenshot !== false && typeof chrome !== 'undefined' && chrome.tabs) {
          try {
            const dataUrl = await chrome.tabs.captureVisibleTab(null as any, { format: 'png', quality: 85 });
            screenshot = dataUrl.replace(/^data:image\/png;base64,/, '');
          } catch (_) {}
        }
        return {
          url: activeTab?.url || '',
          title: activeTab?.title || '',
          screenshot,
          elements,
          page_info: pageInfo,
          tabs: this.state.tabs,
        };
      }

      case 'NAVIGATE': {
        const { url, new_tab } = params;
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          if (new_tab) {
            const tab = await chrome.tabs.create({ url, active: true });
            await this.waitForTabLoad(tab.id || 0, 10000);
            return { url: tab.url, title: tab.title };
          } else if (tabId) {
            await chrome.tabs.update(tabId, { url });
            await this.waitForTabLoad(tabId, 10000);
            const updated = await chrome.tabs.get(tabId);
            return { url: updated.url, title: updated.title };
          }
        }
        return { url, title: 'Navigated' };
      }

      case 'CLICK': {
        if (typeof chrome !== 'undefined' && chrome.tabs && tabId) {
          const res = await chrome.tabs.sendMessage(tabId, {
            type: 'DEEP_BROWSER_CMD', command: 'CLICK', index: params.index, xpath: params.xpath, button: params.button || 'left'
          });
          return res || { success: true };
        }
        return { success: true };
      }

      case 'TYPE': {
        if (typeof chrome !== 'undefined' && chrome.tabs && tabId) {
          const res = await chrome.tabs.sendMessage(tabId, {
            type: 'DEEP_BROWSER_CMD', command: 'TYPE', index: params.index, xpath: params.xpath, text: params.text, clear: params.clear !== false
          });
          return res || { success: true };
        }
        return { success: true };
      }

      case 'SCROLL': {
        if (typeof chrome !== 'undefined' && chrome.tabs && tabId) {
          const res = await chrome.tabs.sendMessage(tabId, {
            type: 'DEEP_BROWSER_CMD', command: 'SCROLL', direction: params.direction || 'down', amount: params.amount || 500
          });
          return res || { success: true };
        }
        return { success: true };
      }

      case 'SWITCH_TAB': {
        const targetId = params.target_id;
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const found = this.state.tabs.find((t) => String(t.id) === String(targetId) || t.url.includes(targetId));
          if (found && found.id) {
            await chrome.tabs.update(found.id, { active: true });
            return { tab_id: found.id, url: found.url, title: found.title };
          }
        }
        return { tab_id: targetId };
      }

      case 'TAKE_SCREENSHOT': {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const dataUrl = await chrome.tabs.captureVisibleTab(null as any, { format: 'png', quality: 85 });
          const cleanB64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
          return { screenshot: cleanB64, format: 'png' };
        }
        return { screenshot: null };
      }

      default:
        return { warning: `Command unsupported: ${command}` };
    }
  }

  public waitForTabLoad(tabId: number, timeout = 10000): Promise<void> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.tabs) {
        setTimeout(resolve, 800);
        return;
      }
      const deadline = Date.now() + timeout;
      function check(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(check);
          resolve();
        } else if (Date.now() > deadline) {
          chrome.tabs.onUpdated.removeListener(check);
          resolve();
        }
      }
      chrome.tabs.onUpdated.addListener(check);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(check);
        resolve();
      }, timeout);
    });
  }

  public setConnectionMode(mode: ConnectionMode) {
    this.state.connectionMode = mode;
    this.saveStorage();
    if (mode === 'standalone') {
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
        this.ws = null;
      }
      this.state.connectionStatus = 'standalone';
      this.notify();
    } else {
      this.initWebSocket();
    }
  }

  public toggleOnline() {
    if (this.state.connectionStatus === 'standalone') {
      // User clicks pill while Online: switch to daemon probe
      this.setConnectionMode('daemon');
    } else {
      // User clicks pill while Offline/Connecting: instantly force Online In-Browser!
      this.setConnectionMode('standalone');
    }
  }

  public reconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.initWebSocket();
  }

  public getActiveSession(): Session {
    let session = this.state.sessions.find((s) => String(s.id) === String(this.state.activeSessionId)) || this.state.sessions[0];
    if (!session) {
      session = {
        id: 'session_' + Date.now(),
        name: 'Sesi Baru',
        createdAt: Date.now(),
        messages: [],
        events: [],
      };
      this.state.sessions = [session];
      this.state.activeSessionId = session.id;
    }
    return session;
  }

  public setView(view: 'chat' | 'logs') {
    this.state.currentView = view;
    this.notify();
  }

  public setLogFilter(filter: 'all' | 'tools' | 'approvals' | 'errors' | 'verifications') {
    this.state.logFilter = filter;
    this.notify();
  }

  public setLogSearch(query: string) {
    this.state.logSearch = query;
    this.notify();
  }

  public setModal(modalName: keyof SidepanelState['modals'], open: boolean) {
    this.state.modals[modalName] = open;
    this.notify();
  }

  public setSelectedModel(modelId: string) {
    this.state.selectedModelId = modelId;
    this.saveStorage();
    this.notify();
  }

  public setSelectedMode(mode: ExecutionMode) {
    this.state.selectedMode = mode;
    this.saveStorage();
    this.notify();
  }

  public setSelectedPreset(preset: PresetId) {
    this.state.selectedPreset = preset;
    this.saveStorage();
    this.notify();
  }

  public setApiKey(provider: string, key: string) {
    this.state.apiKeys = { ...this.state.apiKeys, [provider]: key };
    this.saveStorage();
    this.notify();
  }

  public async toggleDetach() {
    if (this.state.isDetached) {
      if (typeof chrome !== 'undefined' && chrome.sidePanel) {
        try {
          const windows = await chrome.windows.getAll();
          const normalWin = windows.find((w: any) => w.type === 'normal');
          if (normalWin?.id) {
            await chrome.sidePanel.open({ windowId: normalWin.id });
          }
        } catch (_) {}
      }
      window.close();
    } else {
      if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.create({
          url: chrome.runtime.getURL('sidepanel/dist/index.html?detached=true'),
          type: 'popup',
          width: 440,
          height: 720,
          focused: true,
        });
      }
    }
  }

  public async toggleSidepanelEnabled() {
    const nextState = !this.state.sidepanelEnabled;
    this.state.sidepanelEnabled = nextState;
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      try {
        await chrome.sidePanel.setOptions({ enabled: nextState });
      } catch (err) {
        console.warn('sidePanel.setOptions error:', err);
      }
    }
    this.saveStorage();
    this.notify();
  }

  public switchSession(sessionId: string) {
    this.state.activeSessionId = sessionId;
    this.state.runState = 'idle';
    this.state.stepCount = 0;
    this.state.modals.drawer = false;
    this.saveStorage();
    this.notify();
  }

  public createNewSession() {
    const newId = 'session_' + Date.now();
    const newSession: Session = {
      id: newId,
      name: 'Sesi Baru',
      createdAt: Date.now(),
      messages: [],
      events: [],
    };
    this.state.sessions.unshift(newSession);
    this.state.activeSessionId = newId;
    this.state.runState = 'idle';
    this.state.stepCount = 0;
    this.state.modals.drawer = false;
    this.saveStorage();
    this.notify();
  }

  public deleteSession(sessionId: string) {
    const idStr = String(sessionId);
    if (this.state.sessions.length <= 1) {
      // Clean reset
      const initId = 'session_' + Date.now();
      this.state.sessions = [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [], events: [] }];
      this.state.activeSessionId = initId;
    } else {
      this.state.sessions = this.state.sessions.filter((s) => String(s.id) !== idStr);
      if (String(this.state.activeSessionId) === idStr) {
        this.state.activeSessionId = this.state.sessions[0].id;
      }
    }
    this.state.runState = 'idle';
    this.state.stepCount = 0;
    this.saveStorage();
    this.notify();
  }

  public clearActiveSession() {
    const active = this.getActiveSession();
    if (active) {
      active.messages = [];
      active.events = [];
      active.name = 'Sesi Baru';
      this.state.runState = 'idle';
      this.state.stepCount = 0;
      this.state.modals.drawer = false;
      this.saveStorage();
      this.notify();
    }
  }

  public async sendMessage(prompt: string) {
    if (!prompt.trim() || this.state.runState === 'running') return;

    const active = this.getActiveSession();
    if (active.messages.length === 0 && active.name === 'Sesi Baru') {
      active.name = prompt.slice(0, 24) + (prompt.length > 24 ? '...' : '');
    }

    // 1. Append user message
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
    };
    active.messages.push(userMsg);

    // 2. Prepare assistant placeholder
    const runId = 'run_' + Date.now();
    this.currentRunId = runId;
    const model = this.state.models.find((m) => m.id === this.state.selectedModelId) || this.state.models[0];

    const assistantMsg: ChatMessage = {
      id: runId,
      role: 'assistant',
      text: '',
      timestamp: Date.now(),
      modelName: model.name,
      preset: this.state.selectedPreset,
      steps: [],
    };
    active.messages.push(assistantMsg);

    this.state.runState = 'running';
    this.state.stepCount = 0;
    this.notify();
    this.saveStorage();

    // 3. Dispatch to Daemon if connected, or trigger local agent simulation
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
        const resp = await fetch('http://127.0.0.1:7788/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: prompt,
            owner: 'EXTENSION',
            browser_mode: 'ATTACHED',
            tab_id: activeTab?.id,
            window_id: activeTab?.windowId,
            url: activeTab?.url,
            title: activeTab?.title,
            model_provider: model.provider || 'gemini',
            model_name: model.id,
            api_key: this.state.apiKeys[model.provider] || this.state.apiKeys.gemini || '',
            preset: this.state.selectedPreset,
            safe_mode: this.state.selectedMode === 'hitl',
            safe_timeout_seconds: 60.0,
          }),
        });

        if (resp.ok) {
          const resData = await resp.json();
          if (resData.task_id) {
            this.currentRunId = resData.task_id;
            this.connectExtTransport(resData.task_id);
            return;
          }
        }
      } catch (err) {
        console.warn('[DeepBrowser] Backend daemon task submission failed, falling back to in-browser agent:', err);
      }
    }

    // Standalone In-Browser Autonomous Agent Loop (Browser-Use Core)
    this._runStandaloneAgent(runId, prompt, assistantMsg);
  }

  public cancelRun() {
    if (this.state.runState !== 'running') return;
    if (this.activeAgent) {
      try { this.activeAgent.stop(); } catch (_) {}
      this.activeAgent = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentRunId) {
      try {
        fetch('http://127.0.0.1:7788/api/agent/stop', { method: 'POST' }).catch(() => {});
      } catch (_) {}
    }
    if (this.extTransportWs) {
      try { this.extTransportWs.close(); } catch (_) {}
      this.extTransportWs = null;
      this.currentTransportTaskId = null;
    }
    this.state.runState = 'idle';
    this.notify();
  }

  public respondHitl(interactionId: string, value: unknown) {
    if (this.activeAgent && (this.activeAgent as any).interactionManager) {
      const im = (this.activeAgent as any).interactionManager;
      try {
        if (typeof im.submitResponse === 'function') {
          im.submitResponse(interactionId, value);
        } else if (typeof im.resolveInteraction === 'function') {
          im.resolveInteraction(interactionId, value);
        }
      } catch (err) {
        console.warn('[DeepBrowser] Error submitting interaction response:', err);
      }
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'RESOLVE_INTERACTION',
        interaction_id: interactionId,
        response: { value, submitted_at: Date.now() },
      }));
    }
    // Clear HITL prompt on message
    const active = this.getActiveSession();
    const lastMsg = active.messages[active.messages.length - 1];
    if (lastMsg && lastMsg.hitl && lastMsg.hitl.id === interactionId) {
      lastMsg.hitl = undefined;
    }
    this.state.runState = 'running';
    this.notify();
  }

  private handleIncomingAgentEvent(evt: any) {
    const active = this.getActiveSession();
    const type = evt.event_type || evt.type || '';
    const payload = evt.data || evt.payload || {};

    // Add to event logs
    const logEvt: LogEvent = {
      id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      type,
      category: type.includes('TOOL') || type.includes('CLICK') || type.includes('NAV') ? 'tools' : type.includes('VERIF') ? 'verifications' : type.includes('ERR') ? 'errors' : 'all',
      message: evt.message || JSON.stringify(payload).slice(0, 80),
      payload,
    };
    active.events.push(logEvt);

    // Forward to in-page Floating HUD Island if active
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs?.[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, evt).catch(() => {});
        }
      });
    }

    const lastMsg = active.messages[active.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    // 1. Genuine LLM Reasoning / Thinking emission
    if (type === 'REASONING') {
      const thinkingText = payload.thinking || evt.message || '';
      if (thinkingText) {
        lastMsg.thought = (lastMsg.thought ? lastMsg.thought + '\n\n' : '') + thinkingText;
      }
    }

    // 2. Observations & Page Perception
    if (type === 'OBSERVATION') {
      this.state.stepCount++;
      const step: ToolStep = {
        id: 'step_obs_' + Date.now(),
        name: evt.message || `Membaca Halaman (${payload.elementsCount || 0} elemen interaktif)`,
        icon: 'visibility',
        status: 'succeeded',
        duration: '120ms',
        args: { url: payload.url, elementsCount: payload.elementsCount },
        result: { scroll_y: payload.scroll_y, pixels_below: payload.pixels_below },
        timestamp: Date.now(),
      };
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push(step);
    }

    // 3. Parallel Multi-Tab Research Started
    if (type === 'PARALLEL_RESEARCH_STARTED') {
      this.state.stepCount++;
      const step: ToolStep = {
        id: 'step_par_' + Date.now(),
        name: `Riset Paralel Multi-Tab (${payload.totalTopics || 3} worker simultan)`,
        icon: 'view_carousel',
        status: 'running',
        duration: 'paralel',
        args: { topics: payload.topics, maxParallel: payload.maxParallel },
        result: { status: 'in_progress' },
        timestamp: Date.now(),
      };
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push(step);
    }

    // 4. Handle tool steps with icons and verification
    if (type.includes('TOOL') || type.includes('NAV') || type.includes('CLICK') || type.includes('TYPE') || type.includes('SCROLL') || type.includes('EXTRACT') || type.includes('SEARCH') || type.includes('TAB') || type === 'ACTION_EXECUTED') {
      this.state.stepCount++;
      const icon = type.includes('NAV') ? 'navigation'
        : type.includes('CLICK') ? 'touch_app'
        : type.includes('TYPE') ? 'edit'
        : type.includes('SCROLL') ? 'swap_vert'
        : type.includes('EXTRACT') ? 'dataset'
        : type.includes('SEARCH') ? 'search'
        : 'terminal';

      const step: ToolStep = {
        id: 'step_' + Date.now(),
        name: evt.action || payload.tool_name || payload.action || evt.message || type.toLowerCase(),
        icon,
        status: 'succeeded',
        duration: payload.duration ? `${payload.duration}ms` : '180ms',
        args: payload.args || payload.parameters,
        result: payload.result || payload.data,
        verification: payload.verification,
        timestamp: Date.now(),
      };
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push(step);
    }

    // 5. Deterministic Verification Evidence
    if (type === 'VERIFICATION') {
      if (lastMsg.steps && lastMsg.steps.length > 0) {
        const latestStep = lastMsg.steps[lastMsg.steps.length - 1];
        latestStep.verification = payload;
      }
    }

    // 6. Action Failed
    if (type === 'ACTION_FAILED') {
      if (lastMsg.steps && lastMsg.steps.length > 0) {
        const latestStep = lastMsg.steps[lastMsg.steps.length - 1];
        latestStep.status = 'failed';
        latestStep.error = payload.error || evt.message;
      }
    }

    // 7. Progress text
    if (type === 'TASK_PROGRESS' && payload.text) {
      lastMsg.text = (lastMsg.text ? lastMsg.text + '\n' : '') + payload.text;
    }

    // 8. Visual Artifacts
    if (type === 'SCREENSHOT_CAPTURED' || type === 'SCREENSHOT') {
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push({
        id: 'step_sc_' + Date.now(),
        name: 'Tangkapan Layar Viewport',
        icon: 'screenshot',
        status: 'succeeded',
        duration: '100ms',
        result: { screenshot: payload.screenshot ? 'Captured' : 'OK' },
        timestamp: Date.now(),
      });
    }

    if (type === 'PDF_SAVED') {
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push({
        id: 'step_pdf_' + Date.now(),
        name: `Ekspor PDF: ${payload.fileName || 'document.pdf'}`,
        icon: 'picture_as_pdf',
        status: 'succeeded',
        duration: '350ms',
        result: payload,
        timestamp: Date.now(),
      });
    }

    // 9. Completion
    if (type === 'TASK_COMPLETED' || type === 'DONE') {
      lastMsg.text = payload.result || evt.message || lastMsg.text || 'Tugas browser selesai dieksekusi dan terverifikasi.';
      this.state.runState = 'done';
    }

    // 10. Failure / Error
    if (type === 'TASK_FAILED' || type === 'ERROR') {
      lastMsg.isError = true;
      lastMsg.text = payload.error || evt.message || 'Eksekusi gagal.';
      this.state.runState = 'error';
    }

    // 11. HITL Gate / Interactive Widget
    if (type === 'INTERACTION_REQUIRED' || type === 'USER_INPUT_REQUIRED' || type === 'USER_APPROVAL_REQUIRED' || type === 'CONFIRMATION_REQUIRED') {
      this.state.runState = 'paused';
      const ixData = payload.interaction || payload;
      const rawOptions = ixData.options || payload.options || [];
      const formattedOptions = rawOptions.map((opt: any, idx: number) => {
        if (typeof opt === 'string') {
          return { id: opt, label: opt, index: idx + 1 };
        }
        return {
          id: opt.id || opt.value || opt.label || String(idx + 1),
          label: opt.label || opt.name || opt.text || String(opt),
          description: opt.description || '',
          index: idx + 1,
        };
      });

      lastMsg.hitl = {
        id: ixData.interaction_id || payload.interaction_id || payload.confirmation_id || 'hitl_' + Date.now(),
        type: ixData.type || payload.type || (type === 'USER_APPROVAL_REQUIRED' ? 'approval' : 'confirm'),
        question: ixData.question || payload.question || payload.reason || evt.message || 'Interaksi diperlukan:',
        description: ixData.description || payload.description || '',
        action_name: ixData.action_name || payload.action_name,
        parameters: ixData.parameters || payload.parameters,
        options: formattedOptions,
        defaultValue: ixData.defaultValue || payload.defaultValue,
        isMultiSelect: ixData.type === 'multi_choice' || payload.isMultiSelect,
      };
    }

    this.notify();
    this.saveStorage();
  }

  private async _runStandaloneAgent(runId: string, prompt: string, assistantMsg: ChatMessage) {
    try {
      await this.ensureCoreRuntimeLoaded();
    } catch (err: any) {
      this.handleIncomingAgentEvent({
        event_type: 'ERROR',
        message: `Gagal memuat modul autonomous agent: ${err.message}`,
        data: { error: err.message },
      });
      return;
    }

    const activeModel = this.state.models.find((m) => m.id === this.state.selectedModelId) || this.state.models[0];
    const provider = activeModel.provider;
    const apiKey = this.state.apiKeys[provider] || this.state.apiKeys.gemini || '';

    let activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) activeTab = { id: tab.id || 0, url: tab.url || '', title: tab.title || '', active: true, windowId: tab.windowId };
      } catch (_) {}
    }

    try {
      const browserSession = new (window as any).BrowserSession({
        tabId: activeTab?.id,
        windowId: activeTab?.windowId,
        highlightsEnabled: this.state.indexLabelingEnabled,
      });

      const llmClient = new (window as any).LLMClient({
        provider,
        model: activeModel.modelId || activeModel.id,
        apiKey,
        baseUrl: activeModel.baseUrl || this.state.apiKeys.custom_openai || '',
        ollamaHost: this.state.apiKeys.ollama || 'http://localhost:11434',
        temperature: 0.1,
      });

      const interactionManager = (window as any).InteractionManager ? new (window as any).InteractionManager({
        taskId: runId,
        onStateChange: (newState: string) => {
          if (newState === 'WAITING_FOR_USER') {
            this.state.runState = 'paused';
            this.notify();
          } else if (newState === 'RUNNING') {
            this.state.runState = 'running';
            this.notify();
          }
        },
      }) : null;

      const agent = new (window as any).Agent({
        taskId: runId,
        task: prompt,
        preset: this.state.selectedPreset,
        browserSession,
        llmClient,
        interactionManager,
        maxSteps: 25,
        mode: this.state.selectedMode,
        onEvent: (evt: any) => this.handleIncomingAgentEvent(evt),
      });

      this.activeAgent = agent;
      await agent.run();
    } catch (err: any) {
      console.error('[DeepBrowser] Autonomous agent execution error:', err);
      this.handleIncomingAgentEvent({
        event_type: 'ERROR',
        message: err.message || String(err),
        data: { error: err.message },
      });
    } finally {
      this.activeAgent = null;
      if (this.state.runState === 'running') {
        this.state.runState = 'idle';
      }
      this.notify();
      this.saveStorage();
    }
  }
}

export const sidepanelStore = new SidepanelStateManager();
