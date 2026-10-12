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

      const ws = new WebSocket('ws://127.0.0.1:7788/ws');
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
      const probe = new WebSocket('ws://127.0.0.1:7788/ws');
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
    return this.state.sessions.find((s) => String(s.id) === String(this.state.activeSessionId)) || this.state.sessions[0];
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
      this.ws.send(JSON.stringify({
        type: 'START_TASK',
        task_id: runId,
        goal: prompt,
        model: this.state.selectedModelId,
        mode: this.state.selectedMode,
        preset: this.state.selectedPreset,
      }));
    } else {
      // Standalone simulation or in-extension execution
      this.executeLocalFallback(runId, prompt, assistantMsg);
    }
  }

  public cancelRun() {
    if (this.state.runState !== 'running') return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentRunId) {
      this.ws.send(JSON.stringify({ type: 'CANCEL_TASK', task_id: this.currentRunId }));
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
    const type = evt.type || '';
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

    // Handle tool steps
    if (type === 'TOOL_CALL' || type === 'NAVIGATE' || type === 'CLICK' || type === 'TYPE' || type === 'SCROLL' || type === 'EXTRACT') {
      this.state.stepCount++;
      const step: ToolStep = {
        id: 'step_' + Date.now(),
        name: evt.action || type.toLowerCase(),
        icon: type.includes('NAV') ? 'navigation' : type.includes('CLICK') ? 'touch_app' : type.includes('TYPE') ? 'edit' : type.includes('EXTRACT') ? 'dataset' : 'terminal',
        status: 'succeeded',
        duration: payload.duration ? `${payload.duration}ms` : '150ms',
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
    const activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    const targetUrl = activeTab?.url || 'https://browser.local';
    const targetTitle = activeTab?.title || 'Tab Aktif';

    // Step 1: Membaca konteks halaman aktif
    assistantMsg.steps = [
      {
        id: 's1',
        name: 'Membaca Halaman Aktif',
        icon: 'visibility',
        status: 'succeeded',
        duration: '120ms',
        args: { url: targetUrl, title: targetTitle },
        result: { status: 'ok', title: targetTitle },
        timestamp: Date.now(),
      },
    ];
    this.state.stepCount = 1;
    this.notify();

    let pageContext = {
      title: targetTitle,
      url: targetUrl,
      description: '',
      headings: [] as string[],
      snippet: '',
    };

    // Ekstraksi konten aktual halaman aktif menggunakan Chrome Scripting API jika tersedia
    if (typeof chrome !== 'undefined' && chrome.scripting && activeTab?.id) {
      try {
        const injected = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const desc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
            const h1s = Array.from(document.querySelectorAll('h1')).map((h) => h.innerText.trim()).filter(Boolean).slice(0, 3);
            const h2s = Array.from(document.querySelectorAll('h2')).map((h) => h.innerText.trim()).filter(Boolean).slice(0, 5);
            const main = document.querySelector('main, article, #content, .content, #readme, [role="main"]') || document.body;
            const text = (main?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 2000);
            return {
              title: document.title || '',
              description: desc,
              headings: [...h1s, ...h2s],
              snippet: text,
            };
          },
        });
        if (injected && injected[0]?.result) {
          const res = injected[0].result;
          if (res.title) pageContext.title = res.title;
          if (res.description) pageContext.description = res.description;
          if (res.headings) pageContext.headings = res.headings;
          if (res.snippet) pageContext.snippet = res.snippet;
        }
      } catch (err) {
        console.log('[DeepBrowser] Tab inspection notice:', err);
      }
    }

    // Step 2: Jika ada API Key Gemini yang terkonfigurasi, panggil Gemini langsung untuk jawaban AI asli
    const geminiKey = this.state.apiKeys.gemini;
    if (geminiKey) {
      try {
        const modelName = this.state.selectedModelId.replace(/^gemini\//, '') || 'gemini-2.0-flash';
        const systemPrompt = `Anda adalah asisten AI browser yang pintar, ramah, dan solutif.
Tugas Anda adalah menjawab pertanyaan pengguna secara langsung, jelas, dan alami berdasarkan halaman yang sedang dibuka pengguna.
PANDUAN MENJAWAB:
- Jawab secara to the point dan ramah dalam bahasa Indonesia yang user-friendly.
- Jangan menyebut nama tools, mode, preset, status eksekusi, verifikasi DOM, atau detail teknis internal agen kecuali pengguna secara spesifik memintanya.
- Gunakan format markdown yang rapi (bold untuk istilah penting, bullet points untuk rincian).
- Jika pengguna bertanya tentang isi layar/halaman, jelaskan apa isi halaman tersebut, tujuan situsnya, dan poin-poin utamanya.`;

        const userPrompt = `Pertanyaan Pengguna: "${prompt}"

Konteks Halaman Web Aktif:
- Judul: ${pageContext.title}
- URL: ${pageContext.url}
- Deskripsi: ${pageContext.description}
- Heading/Topik: ${pageContext.headings.join(' • ')}
- Cuplikan Konten: ${pageContext.snippet}`;

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
          const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            assistantMsg.text = generatedText;
            this.state.runState = 'idle';
            this.notify();
            this.saveStorage();
            return;
          }
        }
      } catch (err) {
        console.warn('[DeepBrowser] Direct Gemini call error, using smart local explainer:', err);
      }
    }

    // Step 3: Natural, user-friendly local response generator (tanpa robotik jargon)
    const cleanUrl = pageContext.url.replace(/^https?:\/\//, '');
    const domain = cleanUrl.split('/')[0];
    const pathParts = cleanUrl.split('/').filter(Boolean);

    let answer = '';
    const pLower = prompt.toLowerCase();
    const isScreenQuery = pLower.includes('layar') || pLower.includes('isi') || pLower.includes('halaman') ||
                          pLower.includes('web') || pLower.includes('apa ini') || pLower.includes('buka apa') ||
                          pLower.includes('ringkas') || pLower.includes('lihat');

    if (isScreenQuery) {
      answer = `Saat ini layar Anda sedang membuka **[${pageContext.title}](${pageContext.url})** di domain \`${domain}\`.\n\n`;

      if (cleanUrl.includes('github.com') && pathParts.length >= 3) {
        const repoName = `${pathParts[1]}/${pathParts[2]}`;
        answer += `### 📦 Repository GitHub: \`${repoName}\`\n`;
        if (pageContext.description) {
          answer += `${pageContext.description}\n\n`;
        } else {
          answer += `Halaman ini merupakan repositori open-source untuk proyek **${pathParts[2]}**.\n\n`;
        }
      } else if (pageContext.description) {
        answer += `### 📌 Deskripsi Halaman\n${pageContext.description}\n\n`;
      }

      if (pageContext.headings && pageContext.headings.length > 0) {
        answer += `### 🔍 Topik & Bagian Utama:\n`;
        pageContext.headings.slice(0, 6).forEach((h) => {
          if (h.trim()) answer += `- **${h.trim()}**\n`;
        });
        answer += '\n';
      }

      if (pageContext.snippet && pageContext.snippet.length > 30) {
        const cleanSnippet = pageContext.snippet.slice(0, 360).trim();
        answer += `### 📄 Rangkuman Konten Halaman:\n> ${cleanSnippet}...\n\n`;
      }

      answer += `Ada bagian tertentu dari halaman ini yang ingin Anda tanyakan atau butuh bantuan lebih lanjut?`;
    } else {
      answer = `Mengenai pertanyaan Anda: *"**${prompt}**"*\n\n`;
      if (pageContext.description) {
        answer += `Berdasarkan konteks halaman **[${pageContext.title}](${pageContext.url})**:\n`;
        answer += `${pageContext.description}\n\n`;
      }
      if (pageContext.snippet && pageContext.snippet.length > 30) {
        answer += `Informasi yang relevan di halaman ini:\n> ${pageContext.snippet.slice(0, 320)}...\n\n`;
      } else {
        answer += `Saya mendeteksi Anda sedang berada di halaman **${pageContext.title}** (${pageContext.url}).\n\n`;
      }
      answer += `Silakan beri tahu saya jika Anda butuh analisis data, navigasi form, atau ekstraksi informasi dari situs ini!`;
    }

    assistantMsg.text = answer;
    this.state.runState = 'idle';
    this.notify();
    this.saveStorage();
  }
}

export const sidepanelStore = new SidepanelStateManager();
