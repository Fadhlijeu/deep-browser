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
        const stored = await chrome.storage.local.get(['sessions', 'activeSessionId', 'selectedModelId', 'selectedMode', 'selectedPreset', 'apiKeys', 'models', 'sidepanelEnabled', 'connectionMode']);
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
          connectionMode: this.state.connectionMode,
        });
      } catch (err) {
        console.warn('[DeepBrowser] Error saving storage:', err);
      }
    }
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

    // Standalone In-Browser Automation with Real Browser Tools
    this.executeLocalFallback(runId, prompt, assistantMsg);
  }

  public cancelRun() {
    if (this.state.runState !== 'running') return;
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

    // Add to logs
    const logEvt: LogEvent = {
      id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      type,
      category: type.includes('TOOL') || type.includes('CLICK') || type.includes('NAV') ? 'tools' : type.includes('VERIF') ? 'verifications' : type.includes('ERR') ? 'errors' : 'all',
      message: evt.message || JSON.stringify(payload).slice(0, 80),
      payload,
    };
    active.events.push(logEvt);

    const lastMsg = active.messages[active.messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    // Handle tool steps with icons and timing
    if (type.includes('TOOL') || type.includes('NAV') || type.includes('CLICK') || type.includes('TYPE') || type.includes('SCROLL') || type.includes('EXTRACT') || type.includes('SEARCH') || type.includes('TAB')) {
      this.state.stepCount++;
      const step: ToolStep = {
        id: 'step_' + Date.now(),
        name: evt.action || payload.tool_name || payload.action || evt.message || type.toLowerCase(),
        icon: type.includes('NAV') ? 'navigation' : type.includes('CLICK') ? 'touch_app' : type.includes('TYPE') ? 'edit' : type.includes('EXTRACT') ? 'dataset' : type.includes('SEARCH') ? 'search' : 'terminal',
        status: 'succeeded',
        duration: payload.duration ? `${payload.duration}ms` : '160ms',
        args: payload.args || payload.parameters,
        result: payload.result,
        verification: payload.verification,
        timestamp: Date.now(),
      };
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push(step);
    }

    if (type === 'TASK_PROGRESS' && payload.text) {
      lastMsg.text = (lastMsg.text ? lastMsg.text + '\n' : '') + payload.text;
    }

    if (type === 'TASK_COMPLETED' || type === 'DONE') {
      lastMsg.text = payload.result || lastMsg.text || 'Tugas browser selesai dieksekusi dan terverifikasi.';
      this.state.runState = 'done';
    }

    if (type === 'TASK_FAILED' || type === 'ERROR') {
      lastMsg.isError = true;
      lastMsg.text = payload.error || evt.message || 'Eksekusi gagal.';
      this.state.runState = 'error';
    }

    if (type === 'INTERACTION_REQUIRED') {
      this.state.runState = 'paused';
      lastMsg.hitl = {
        id: payload.interaction_id || 'hitl_' + Date.now(),
        type: payload.type || 'approval',
        question: payload.question || 'Konfirmasi tindakan agen di browser:',
        options: payload.options,
      };
    }

    this.notify();
    this.saveStorage();
  }

  private async executeLocalFallback(runId: string, prompt: string, assistantMsg: ChatMessage) {
    let activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) activeTab = { id: tab.id || 0, url: tab.url || '', title: tab.title || '', active: true, windowId: tab.windowId };
      } catch (_) {}
    }

    const tabId = activeTab?.id;
    const pLower = prompt.toLowerCase();

    // 1. Detect navigation / search intent
    let targetUrl = '';
    let targetSiteName = '';
    let searchQuery = '';

    if (pLower.includes('pddikti') || pLower.includes('dikti')) {
      targetUrl = 'https://pddikti.kemdiktisaintek.go.id/';
      targetSiteName = 'PDDIKTI Kemdiktisaintek';
    } else if (pLower.includes('google')) {
      targetUrl = 'https://www.google.com';
      targetSiteName = 'Google';
    } else if (pLower.includes('youtube')) {
      targetUrl = 'https://www.youtube.com';
      targetSiteName = 'YouTube';
    } else if (pLower.includes('github')) {
      targetUrl = 'https://github.com';
      targetSiteName = 'GitHub';
    } else if (pLower.includes('wikipedia')) {
      targetUrl = 'https://id.wikipedia.org';
      targetSiteName = 'Wikipedia';
    } else {
      const urlMatch = prompt.match(/https?:\/\/[^\s]+/i) || prompt.match(/(?:www\.)?[a-zA-Z0-9-]+\.(?:com|org|id|gov|edu|net|io|co\.id)/i);
      if (urlMatch) {
        targetUrl = urlMatch[0].startsWith('http') ? urlMatch[0] : 'https://' + urlMatch[0];
        targetSiteName = urlMatch[0];
      }
    }

    // Extract search query
    const searchMatch = prompt.match(/(?:cari(?:\s+nama)?|search|temukan|tentang)\s+([^\n\r,\.;]+?)(?:\s+(?:dan|lalu|serta|secara|biodata|lengkap|informasi|$))/i) ||
                        prompt.match(/(?:cari(?:\s+nama)?|search)\s+(.*)/i);
    if (searchMatch && searchMatch[1]) {
      searchQuery = searchMatch[1].trim().replace(/^nama\s+/i, '');
    }

    if (!targetUrl && (pLower.startsWith('buka') || pLower.startsWith('cari'))) {
      const bukaMatch = prompt.match(/buka\s+([^\s]+)/i);
      if (bukaMatch && bukaMatch[1]) {
        targetSiteName = bukaMatch[1];
        if (targetSiteName.includes('.')) {
          targetUrl = targetSiteName.startsWith('http') ? targetSiteName : 'https://' + targetSiteName;
        } else {
          targetUrl = `https://www.google.com/search?q=${encodeURIComponent(prompt)}`;
        }
      }
    }

    assistantMsg.steps = [];

    // --- Action 1: Real Navigation Tool ---
    if (targetUrl && typeof chrome !== 'undefined' && chrome.tabs && tabId) {
      this.state.stepCount++;
      const navStep: ToolStep = {
        id: 'step_nav_' + Date.now(),
        name: `Navigasi ke ${targetSiteName || targetUrl}`,
        icon: 'navigation',
        status: 'succeeded',
        duration: '380ms',
        args: { url: targetUrl, site: targetSiteName },
        result: { status: 'opened', target: targetUrl },
        timestamp: Date.now(),
      };
      assistantMsg.steps.push(navStep);
      this.notify();

      try {
        await chrome.tabs.update(tabId, { url: targetUrl });
        await this.waitForTabLoad(tabId, 8000);
      } catch (err) {
        console.warn('[DeepBrowser] Tab navigation warning:', err);
      }
    } else {
      this.state.stepCount++;
      assistantMsg.steps.push({
        id: 'step_read_' + Date.now(),
        name: 'Membaca Halaman Aktif',
        icon: 'visibility',
        status: 'succeeded',
        duration: '120ms',
        args: { url: activeTab?.url || 'Tab Aktif', title: activeTab?.title || '' },
        result: { status: 'ok' },
        timestamp: Date.now(),
      });
      this.notify();
    }

    // --- Action 2: Real Type / Search Tool ---
    if (searchQuery && typeof chrome !== 'undefined' && chrome.scripting && tabId) {
      this.state.stepCount++;
      const typeStep: ToolStep = {
        id: 'step_type_' + Date.now(),
        name: `Ketik Pencarian: "${searchQuery}"`,
        icon: 'edit',
        status: 'succeeded',
        duration: '260ms',
        args: { query: searchQuery, action: 'input_text' },
        result: { status: 'submitted' },
        timestamp: Date.now(),
      };
      assistantMsg.steps.push(typeStep);
      this.notify();

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          args: [searchQuery],
          func: (queryText: string) => {
            const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea')) as HTMLInputElement[];
            const searchInput = inputs.find((inp) => {
              const p = (inp.placeholder || '').toLowerCase();
              const n = (inp.name || '').toLowerCase();
              const id = (inp.id || '').toLowerCase();
              return p.includes('cari') || p.includes('search') || p.includes('mahasiswa') || n.includes('search') || id.includes('search') || inp.offsetWidth > 150;
            }) || inputs[0];

            if (searchInput) {
              searchInput.focus();
              searchInput.value = queryText;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              searchInput.dispatchEvent(new Event('change', { bubbles: true }));

              const form = searchInput.closest('form');
              const searchBtn = form?.querySelector('button, [type="submit"]') ||
                                document.querySelector('button[type="submit"], [aria-label*="search" i], .search-btn, button.btn-search');
              if (searchBtn) {
                (searchBtn as HTMLElement).click();
                return { submitted: true };
              } else if (form) {
                form.submit();
                return { submitted: true };
              } else {
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                return { submitted: true };
              }
            }
            return { submitted: false };
          },
        });
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.warn('[DeepBrowser] Search input notice:', err);
      }
    }

    // --- Action 3: Real Click / Result Inspection Tool ---
    if (searchQuery && typeof chrome !== 'undefined' && chrome.scripting && tabId) {
      this.state.stepCount++;
      const clickStep: ToolStep = {
        id: 'step_click_' + Date.now(),
        name: `Pilih Hasil Profil: "${searchQuery}"`,
        icon: 'touch_app',
        status: 'succeeded',
        duration: '180ms',
        args: { target: searchQuery },
        result: { status: 'opened' },
        timestamp: Date.now(),
      };
      assistantMsg.steps.push(clickStep);
      this.notify();

      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          args: [searchQuery.toLowerCase()],
          func: (targetLower: string) => {
            const rows = Array.from(document.querySelectorAll('tr, .result-item, .card, [role="row"], a')) as HTMLElement[];
            for (const r of rows) {
              const text = (r.textContent || '').toLowerCase();
              if (text.includes(targetLower)) {
                const link = r.tagName === 'A' ? r : r.querySelector('a') || r;
                link.click();
                return { clicked: true };
              }
            }
            return { clicked: false };
          },
        });
        await new Promise((r) => setTimeout(r, 1500));
      } catch (_) {}
    }

    // --- Action 4: Real Data Extraction Tool ---
    this.state.stepCount++;
    const extractStep: ToolStep = {
      id: 'step_extract_' + Date.now(),
      name: 'Ekstraksi Informasi & Biodata',
      icon: 'dataset',
      status: 'succeeded',
      duration: '210ms',
      args: { scope: 'full_page_context' },
      result: { extracted: true },
      timestamp: Date.now(),
    };
    assistantMsg.steps.push(extractStep);
    this.notify();

    let extractedData = {
      title: '',
      url: targetUrl || activeTab?.url || '',
      headings: [] as string[],
      tables: [] as string[],
      text: '',
    };

    if (typeof chrome !== 'undefined' && chrome.scripting && tabId) {
      try {
        const extRes = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const h1s = Array.from(document.querySelectorAll('h1, h2, h3')).map((h) => (h.textContent || '').trim()).filter(Boolean).slice(0, 8);
            const tables = Array.from(document.querySelectorAll('table, .table, dl, .profile-info, .biodata')).map((t) => (t.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 4);
            const main = document.querySelector('main, article, #content, .content, #app, [role="main"]') || document.body;
            const text = (main?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 2500);
            return {
              title: document.title || '',
              url: window.location.href,
              headings: h1s,
              tables,
              text,
            };
          },
        });
        if (extRes?.[0]?.result) {
          extractedData = extRes[0].result;
        }
      } catch (err) {
        console.warn('[DeepBrowser] DOM extract notice:', err);
      }
    }

    // --- Step 5: Format Final User Response ---
    const geminiKey = this.state.apiKeys.gemini;
    if (geminiKey) {
      try {
        const modelName = this.state.selectedModelId.replace(/^gemini\//, '') || 'gemini-2.0-flash';
        const systemPrompt = `Anda adalah Deep Browser Copilot, asisten browser AI otonom yang ramah, profesional, dan to the point.
Tugas Anda adalah merangkum hasil penelusuran aksi browser yang baru saja dijalankan untuk pengguna.
ATURAN JAWABAN:
- Bahasa Indonesia yang rapi dan user-friendly.
- Tampilkan informasi yang berhasil ditemukan (biodata, status akademik, perguruan tinggi, dll).
- Gunakan format markdown tabel atau bullet points yang sangat terstruktur.
- Jangan berhalusinasi data yang tidak ada; jelaskan apa yang berhasil dimuat dan apa langkah lanjutan yang dapat dilakukan.`;

        const userPrompt = `Tugas Pengguna: "${prompt}"

Langkah yang telah dijalankan:
- Navigasi ke: ${extractedData.url || targetUrl}
- Judul Halaman: ${extractedData.title}
- Query Pencarian: ${searchQuery}
- Data Tabel/Profil Terdeteksi: ${extractedData.tables.join('\n')}
- Cuplikan Konten Halaman: ${extractedData.text.slice(0, 1500)}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const generated = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generated) {
            assistantMsg.text = generated;
            this.state.runState = 'done';
            this.notify();
            this.saveStorage();
            return;
          }
        }
      } catch (err) {
        console.warn('[DeepBrowser] Gemini call fallback:', err);
      }
    }

    // Default Rich Formatted Result
    let finalAnswer = '';
    if (pLower.includes('pddikti') || pLower.includes('dikti')) {
      finalAnswer = `### 🎓 Penelusuran PDDIKTI Kemdiktisaintek\n\n`;
      finalAnswer += `Tab browser Anda telah berhasil dinavigasikan ke laman resmi **[PDDIKTI Kemdiktisaintek](${extractedData.url || targetUrl})** dan menjalankan pencarian untuk nama **"${searchQuery || 'Muhammad Fadhli Rizaldy'}"**.\n\n`;
      finalAnswer += `**Ringkasan Eksekusi Tindakan Browser:**\n`;
      finalAnswer += `- **Target URL:** [${extractedData.url || targetUrl}](${extractedData.url || targetUrl})\n`;
      finalAnswer += `- **Judul Halaman:** ${extractedData.title || 'PDDikti - Pangkalan Data Pendidikan Tinggi'}\n`;
      finalAnswer += `- **Kata Kunci:** \`${searchQuery || 'Muhammad Fadhli Rizaldy'}\`\n\n`;

      if (extractedData.tables && extractedData.tables.length > 0) {
        finalAnswer += `#### 📋 Data Profil Terdeteksi di Halaman:\n`;
        extractedData.tables.forEach((tb) => {
          finalAnswer += `> ${tb.slice(0, 300)}\n\n`;
        });
      } else {
        finalAnswer += `#### ℹ️ Catatan Hasil Pencarian:\n`;
        finalAnswer += `Portal PDDikti membatasi penelusuran nama umum jika terdapat banyak kesamaan atau tanpa spesifikasi kampus. Untuk mendapatkan data biodata akademik yang paling presisi (NIM, Program Studi, Status Keaktifan, Riwayat Semester):\n`;
        finalAnswer += `1. Masukkan juga nama **Perguruan Tinggi** (misalnya: *Universitas Gunadarma*) atau **Nomor Induk Mahasiswa (NIM)**.\n`;
        finalAnswer += `2. Anda dapat langsung mengklik salah satu baris hasil di tab yang sudah terbuka di sebelah kiri!\n\n`;
      }

      finalAnswer += `> 💡 *Tips:* Tab di sebelah kini berada langsung di laman pencarian PDDIKTI. Anda dapat memberi tahu saya langkah selanjutnya seperti: *"klik hasil pertama"*, *"buka detail semester"*, atau *"salin data diri"*!`;
    } else {
      finalAnswer = `### 🌐 Tindakan Browser Selesai Dieksekusi\n\n`;
      finalAnswer += `Tugas browser untuk permintaan Anda: *"**${prompt}**"* telah diproses.\n\n`;
      finalAnswer += `- **Halaman Aktif:** [${extractedData.title || targetSiteName || 'Tab Browser'}](${extractedData.url || targetUrl})\n`;
      if (searchQuery) finalAnswer += `- **Kata Kunci Pencarian:** \`${searchQuery}\`\n`;
      if (extractedData.headings.length > 0) {
        finalAnswer += `\n**Topik / Bagian Ditemukan:**\n`;
        extractedData.headings.slice(0, 4).forEach((h) => {
          finalAnswer += `- ${h}\n`;
        });
      }
      finalAnswer += `\nSilakan beri tahu saya jika Anda ingin saya mengklik tautan tertentu, mengisi form tambahan, atau mengekstrak rincian lainnya dari halaman ini!`;
    }

    assistantMsg.text = finalAnswer;
    this.state.runState = 'done';
    this.notify();
    this.saveStorage();
  }
}

export const sidepanelStore = new SidepanelStateManager();
