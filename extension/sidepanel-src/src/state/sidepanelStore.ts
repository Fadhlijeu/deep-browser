import { Session, ChatMessage, ModelDef, TabItem, RunState, ConnectionStatus, ConnectionMode, PresetId, ExecutionMode, LogEvent, LogCategory, ToolStep, HitlInteraction, StagedFile, RecordedVideo, ViewType } from '../types';

declare const chrome: any;

export const DEFAULT_MODELS: ModelDef[] = [
  // 1. Google Gemini (8 Active Models Only, Ordered A to Z)
  {
    id: 'gemini/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    icon: 'bolt',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash',
    category: 'Text-out models',
    rpm: '5',
    tpm: '250K',
    rpd: '20',
  },
  {
    id: 'gemini/gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    icon: 'speed',
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-lite',
    category: 'Text-out models',
    rpm: '10',
    tpm: '250K',
    rpd: '20',
  },
  {
    id: 'gemini/gemini-3-flash',
    name: 'Gemini 3 Flash',
    icon: 'bolt',
    provider: 'gemini',
    modelId: 'gemini-3-flash',
    category: 'Text-out models',
    rpm: '5',
    tpm: '250K',
    rpd: '20',
  },
  {
    id: 'gemini/gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    icon: 'speed',
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-lite',
    category: 'Text-out models',
    rpm: '15',
    tpm: '250K',
    rpd: '500',
  },
  {
    id: 'gemini/gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    icon: 'speed',
    provider: 'gemini',
    modelId: 'gemini-3.5-flash-lite',
    category: 'Text-out models',
    rpm: '15',
    tpm: '250K',
    rpd: '500',
  },
  {
    id: 'gemini/gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    icon: 'bolt',
    provider: 'gemini',
    modelId: 'gemini-3.6-flash',
    category: 'Text-out models',
    rpm: '5',
    tpm: '250K',
    rpd: '20',
  },
  {
    id: 'gemini/gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    icon: 'bolt',
    provider: 'gemini',
    modelId: 'gemini-3.7-flash',
    category: 'Text-out models',
    rpm: '5',
    tpm: '250K',
    rpd: '20',
  },
  {
    id: 'gemini/gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    icon: 'bolt',
    provider: 'gemini',
    modelId: 'gemini-3.8-flash',
    category: 'Text-out models',
    rpm: '5',
    tpm: '250K',
    rpd: '20',
  },
  // 2. OpenAI
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    icon: 'memory',
    provider: 'openai',
    modelId: 'gpt-4o',
    category: 'Flagship Multimodal',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    icon: 'bolt',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    category: 'Fast Lightweight',
  },
  // 3. Anthropic Claude
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    icon: 'psychology',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    category: 'Reasoning & Coding',
  },
  // 4. Custom OpenAI-Compatible
  {
    id: 'custom/deepseek-chat',
    name: 'DeepSeek Chat (V3)',
    icon: 'hub',
    provider: 'custom_openai',
    modelId: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com/v1',
    category: 'OpenAI-Compatible',
  },
  // 5. Ollama (Local)
  {
    id: 'ollama/llama3',
    name: 'Llama 3 (Local)',
    icon: 'terminal',
    provider: 'ollama',
    modelId: 'llama3',
    baseUrl: 'http://localhost:11434',
    category: 'Local Offline',
  },
];

export const PROVIDER_ORDER: Record<string, number> = {
  gemini: 1,
  openai: 2,
  anthropic: 3,
  custom_openai: 4,
  ollama: 5,
};

export const PROVIDER_LABELS: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  custom_openai: 'Custom OpenAI-Compatible',
  ollama: 'Ollama (Local)',
};

export function sortModels(models: ModelDef[]): ModelDef[] {
  return [...models].sort((a, b) => {
    const pA = PROVIDER_ORDER[a.provider] || 99;
    const pB = PROVIDER_ORDER[b.provider] || 99;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

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
  judgeEnabled: boolean;
  judgeModelId: string;
  isDetached: boolean;
  stepCount: number;
  currentView: ViewType;
  logFilter: LogCategory;
  logSearch: string;
  stagedFiles: StagedFile[];
  isRecordingEnabled: boolean;
  isHudEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  isInspectorOpen: boolean;
  modals: {
    drawer: boolean;
    apikeys: boolean;
    settings: boolean;
    models: boolean;
    mode: boolean;
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
  private pendingCloseOnCompletion: boolean = false;

  constructor() {
    const initId = 'session_' + Date.now();
    const isDetached = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('detached') === 'true';

    this.state = {
      sessions: [{ id: initId, name: 'Sesi Baru', createdAt: Date.now(), messages: [], events: [] }],
      activeSessionId: initId,
      models: [...DEFAULT_MODELS],
      selectedModelId: 'gemini/gemini-3.5-flash-lite',
      selectedMode: 'agent_decide',
      selectedPreset: 'default',
      apiKeys: {},
      tabs: [],
      runState: 'idle',
      connectionStatus: 'standalone',
      connectionMode: 'standalone',
      sidepanelEnabled: true,
      indexLabelingEnabled: true,
      judgeEnabled: false,
      judgeModelId: 'auto',
      isDetached,
      stepCount: 0,
      currentView: 'chat',
      logFilter: 'all',
      logSearch: '',
      stagedFiles: [],
      isRecordingEnabled: false,
      isHudEnabled: false,
      theme: 'light',
      isInspectorOpen: false,
      modals: { drawer: false, apikeys: false, settings: false, models: false, mode: false },
    };

    this.loadFromStorage();
    this.initStorageListener();
    this.initCrossWindowMessaging();
    this.initTabsListener();
    if (this.state.connectionMode === 'daemon') {
      this.initWebSocket();
    }
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
        'core/loop_detector.js',
        'core/judge.js',
        'core/skill_manager.js',
        'core/session_recorder.js',
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
        const stored = await chrome.storage.local.get([
          'sessions', 'activeSessionId', 'selectedModelId', 'selectedMode',
          'selectedPreset', 'apiKeys', 'models', 'sidepanelEnabled',
          'indexLabelingEnabled', 'judgeEnabled', 'judgeModelId', 'connectionMode', 'runState', 'stepCount', 'theme'
        ]);
        if (stored.theme) {
          this.state.theme = stored.theme;
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', stored.theme);
          }
        }
        if (stored.sessions && stored.sessions.length > 0) {
          this.state.sessions = stored.sessions;
        }
        if (stored.activeSessionId && this.state.sessions.some((s) => String(s.id) === String(stored.activeSessionId))) {
          this.state.activeSessionId = stored.activeSessionId;
        }
        if (stored.selectedMode) this.state.selectedMode = stored.selectedMode;
        if (stored.selectedPreset) this.state.selectedPreset = stored.selectedPreset;
        if (stored.apiKeys) this.state.apiKeys = stored.apiKeys;
        if (stored.models && stored.models.length > 0) {
          const validGeminiSlugs = new Set([
            'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash',
            'gemini-2.5-flash-lite', 'gemini-3-flash', 'gemini-3.6-flash',
            'gemini-3.7-flash', 'gemini-3.8-flash'
          ]);
          // Filter out legacy models like gemini-2.0-flash or gemini-1.5-pro
          let sanitized: ModelDef[] = stored.models.filter((m: ModelDef) => {
            if (m.provider === 'gemini') {
              return validGeminiSlugs.has(m.modelId);
            }
            return true;
          });
          // Ensure all active Gemini models are populated with quota metadata
          const activeGemini = DEFAULT_MODELS.filter((dm) => dm.provider === 'gemini');
          for (const ag of activeGemini) {
            const existingIdx = sanitized.findIndex((m: ModelDef) => m.modelId === ag.modelId);
            if (existingIdx === -1) {
              sanitized.push({ ...ag });
            } else {
              sanitized[existingIdx] = {
                ...ag,
                ...sanitized[existingIdx],
                rpm: ag.rpm,
                tpm: ag.tpm,
                rpd: ag.rpd,
                category: ag.category,
              };
            }
          }
          this.state.models = sortModels(sanitized);
        } else {
          this.state.models = sortModels([...DEFAULT_MODELS]);
        }

        if (stored.selectedModelId) {
          if (this.state.models.some((m) => m.id === stored.selectedModelId)) {
            this.state.selectedModelId = stored.selectedModelId;
          } else {
            this.state.selectedModelId = 'gemini/gemini-3.5-flash-lite';
          }
        }
        if (typeof stored.sidepanelEnabled === 'boolean') this.state.sidepanelEnabled = stored.sidepanelEnabled;
        if (typeof stored.indexLabelingEnabled === 'boolean') this.state.indexLabelingEnabled = stored.indexLabelingEnabled;
        if (typeof stored.judgeEnabled === 'boolean') this.state.judgeEnabled = stored.judgeEnabled;
        if (stored.judgeModelId) this.state.judgeModelId = stored.judgeModelId;
        if (stored.connectionMode) {
          this.state.connectionMode = stored.connectionMode;
          if (stored.connectionMode === 'standalone') {
            this.state.connectionStatus = 'standalone';
          } else if (stored.connectionMode === 'daemon') {
            this.initWebSocket();
          }
        }
        if (stored.runState && !this.activeAgent) {
          this.state.runState = stored.runState;
        }
        if (typeof stored.stepCount === 'number' && !this.activeAgent) {
          this.state.stepCount = stored.stepCount;
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
          judgeEnabled: this.state.judgeEnabled,
          judgeModelId: this.state.judgeModelId,
          connectionMode: this.state.connectionMode,
          runState: this.state.runState,
          stepCount: this.state.stepCount,
          theme: this.state.theme,
        });
      } catch (err) {
        console.warn('[DeepBrowser] Error saving storage:', err);
      }
    }
  }

  private initStorageListener() {
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes: any, areaName: string) => {
        if (areaName !== 'local') return;
        let changed = false;
        if (changes.sessions) {
          this.state.sessions = changes.sessions.newValue || [];
          changed = true;
        }
        if (changes.activeSessionId) {
          this.state.activeSessionId = changes.activeSessionId.newValue;
          changed = true;
        }
        if (changes.runState && !this.activeAgent) {
          this.state.runState = changes.runState.newValue || 'idle';
          changed = true;
        }
        if (changes.stepCount && !this.activeAgent) {
          this.state.stepCount = changes.stepCount.newValue || 0;
          changed = true;
        }
        if (changes.selectedModelId) {
          this.state.selectedModelId = changes.selectedModelId.newValue;
          changed = true;
        }
        if (changes.models) {
          this.state.models = changes.models.newValue;
          changed = true;
        }
        if (changes.apiKeys) {
          this.state.apiKeys = changes.apiKeys.newValue;
          changed = true;
        }
        if (typeof changes.judgeEnabled?.newValue === 'boolean') {
          this.state.judgeEnabled = changes.judgeEnabled.newValue;
          changed = true;
        }
        if (changes.judgeModelId?.newValue) {
          this.state.judgeModelId = changes.judgeModelId.newValue;
          changed = true;
        }
        if (changed) {
          this.notify();
        }
      });
    }
  }

  private initCrossWindowMessaging() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg: any) => {
        if (msg?.action === 'STOP_AGENT') {
          if (this.activeAgent) {
            try { this.activeAgent.stop(); } catch (_) {}
            this.activeAgent = null;
            this.state.runState = 'idle';
            this.saveStorage();
            this.notify();
          }
        } else if (msg?.action === 'RESOLVE_HITL') {
          if (this.activeAgent && (this.activeAgent as any).interactionManager) {
            const im = (this.activeAgent as any).interactionManager;
            const targetId = (im.activeInteraction && im.activeInteraction.status === 'pending')
              ? im.activeInteraction.interaction_id
              : msg.interactionId;
            try {
              if (typeof im.submitResponse === 'function') {
                im.submitResponse(targetId, msg.value);
              } else if (typeof im.resolveInteraction === 'function') {
                im.resolveInteraction(targetId, msg.value);
              }
            } catch (_) {}
          }
        }
      });
    }
  }

  public async toggleIndexLabeling(enabled?: boolean) {
    const nextVal = enabled !== undefined ? enabled : !this.state.indexLabelingEnabled;
    this.state.indexLabelingEnabled = nextVal;
    if (this.activeAgent?.browserSession?.setHighlightsEnabled) {
      this.activeAgent.browserSession.setHighlightsEnabled(nextVal);
    }
    if (typeof chrome !== 'undefined' && chrome.scripting) {
      try {
        const tab = await this.getTargetActiveTab();
        if (tab?.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('edge://') && !tab.url?.startsWith('about:') && !tab.url?.startsWith('chrome-extension://')) {
          if (!nextVal) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const overlay = document.getElementById('__deep_browser_highlight_overlay__');
                if (overlay) overlay.remove();
                if ((window as any).__deep_browser_cleanup_overlay) {
                  (window as any).__deep_browser_cleanup_overlay();
                }
              },
            }).catch(() => {});
          } else {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => {
                const OVERLAY_ID = '__deep_browser_highlight_overlay__';
                if ((window as any).__deep_browser_cleanup_overlay) {
                  (window as any).__deep_browser_cleanup_overlay();
                }

                function renderHighlights() {
                  let existing = document.getElementById(OVERLAY_ID);
                  if (existing) existing.remove();

                  const container = document.createElement('div');
                  container.id = OVERLAY_ID;
                  container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483640;overflow:hidden;';

                  const candidates = Array.from(document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])'));
                  let idx = 1;
                  candidates.slice(0, 100).forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight) return;
                    const style = window.getComputedStyle(el);
                    if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) < 0.1) return;

                    const tag = el.tagName.toLowerCase();
                    const color = tag === 'button' ? '#ef4444' : tag === 'input' ? '#06b6d4' : tag === 'a' ? '#10b981' : '#8b5cf6';

                    const box = document.createElement('div');
                    box.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;border:1.5px solid ${color};border-radius:3px;pointer-events:none;box-sizing:border-box;z-index:2147483645;`;
                    container.appendChild(box);

                    const badge = document.createElement('div');
                    badge.textContent = String(idx++);
                    badge.style.cssText = `position:fixed;left:${Math.max(0, rect.left - 2)}px;top:${Math.max(0, rect.top - 14)}px;background:${color};color:#ffffff;font-family:monospace;font-size:10px;font-weight:700;line-height:1;padding:2px 4px;border-radius:3px;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,0.35);z-index:2147483646;`;
                    container.appendChild(badge);
                  });

                  (document.body || document.documentElement).appendChild(container);
                }

                renderHighlights();
                const onScrollOrResize = () => requestAnimationFrame(renderHighlights);
                window.addEventListener('scroll', onScrollOrResize, { passive: true });
                window.addEventListener('resize', onScrollOrResize, { passive: true });
                (window as any).__deep_browser_cleanup_overlay = () => {
                  window.removeEventListener('scroll', onScrollOrResize);
                  window.removeEventListener('resize', onScrollOrResize);
                  const el = document.getElementById(OVERLAY_ID);
                  if (el) el.remove();
                };
              },
            }).catch(() => {});
          }
        }
      } catch (_) {}
    }
    this.notify();
    this.saveStorage();
  }

  public addStagedFile(file: StagedFile) {
    this.state.stagedFiles = [...(this.state.stagedFiles || []), file];
    this.notify();
  }

  public removeStagedFile(id: string) {
    this.state.stagedFiles = (this.state.stagedFiles || []).filter((f) => f.id !== id);
    this.notify();
  }

  public clearStagedFiles() {
    this.state.stagedFiles = [];
    this.notify();
  }

  public toggleRecording(enabled?: boolean) {
    this.state.isRecordingEnabled = enabled !== undefined ? enabled : !this.state.isRecordingEnabled;
    this.notify();
    this.saveStorage();
  }

  public toggleDemoHud(enabled?: boolean) {
    const nextVal = enabled !== undefined ? enabled : !this.state.isHudEnabled;
    this.state.isHudEnabled = nextVal;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any[]) => {
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: nextVal ? 'SHOW_FLOATING_HUD' : 'HIDE_FLOATING_HUD' }).catch(() => {});
        }
      }).catch(() => {});
    }
    this.notify();
    this.saveStorage();
  }

  public async getTargetTabs(): Promise<any[]> {
    if (typeof chrome === 'undefined' || !chrome.tabs) return [];
    try {
      if (chrome.windows) {
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
        const targetWin = windows.find((w: any) => w.focused) || windows[0];
        if (targetWin && targetWin.tabs && targetWin.tabs.length > 0) {
          const normalTabs = targetWin.tabs.filter((t: any) => !t.url?.startsWith('chrome-extension://'));
          if (normalTabs.length > 0) return normalTabs;
        }
      }
    } catch (_) {}

    try {
      const allTabs = await chrome.tabs.query({});
      const normalTabs = allTabs.filter((t: any) => !t.url?.startsWith('chrome-extension://'));
      if (normalTabs.length > 0) return normalTabs;
    } catch (_) {}

    try {
      const curTabs = await chrome.tabs.query({ currentWindow: true });
      return curTabs.filter((t: any) => !t.url?.startsWith('chrome-extension://'));
    } catch (_) {}

    return [];
  }

  public async getTargetActiveTab(): Promise<any> {
    const tabs = await this.getTargetTabs();
    const active = tabs.find((t: any) => t.active) || tabs[0];
    return active || null;
  }

  private async initTabsListener() {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const updateTabs = async () => {
        try {
          const chromeTabs = await this.getTargetTabs();
          this.state.tabs = chromeTabs.map((t: any) => ({
            id: t.id || 0,
            title: t.title || 'Tab Tanpa Judul',
            url: t.url || '',
            active: Boolean(t.active),
            favIconUrl: t.favIconUrl,
            windowId: t.windowId,
          }));
          this.notify();
        } catch (_) {}
      };

      updateTabs();
      chrome.tabs.onActivated?.addListener(updateTabs);
      chrome.tabs.onUpdated?.addListener(updateTabs);
      chrome.windows?.onFocusChanged?.addListener(updateTabs);
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
    this.initTabsListener();
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

  public setView(view: ViewType) {
    this.state.currentView = view;
    this.notify();
  }

  public setTheme(theme: 'light' | 'dark' | 'system') {
    this.state.theme = theme;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    this.saveStorage();
    this.notify();
  }

  public toggleInspector(open?: boolean) {
    this.state.isInspectorOpen = open !== undefined ? open : !this.state.isInspectorOpen;
    this.notify();
  }

  public renameSession(sessionId: string, newName: string) {
    const s = this.state.sessions.find((x) => String(x.id) === String(sessionId));
    if (s && newName.trim()) {
      s.name = newName.trim();
      s.updatedAt = Date.now();
      this.saveStorage();
      this.notify();
    }
  }

  public togglePinSession(sessionId: string) {
    const s = this.state.sessions.find((x) => String(x.id) === String(sessionId));
    if (s) {
      s.pinned = !s.pinned;
      s.updatedAt = Date.now();
      this.saveStorage();
      this.notify();
    }
  }

  public toggleArchiveSession(sessionId: string) {
    const s = this.state.sessions.find((x) => String(x.id) === String(sessionId));
    if (s) {
      s.archived = !s.archived;
      s.updatedAt = Date.now();
      this.saveStorage();
      this.notify();
    }
  }

  public setApiKey(provider: string, key: string) {
    this.state.apiKeys = { ...this.state.apiKeys, [provider]: key };
    this.saveStorage();
    this.notify();
  }

  public resolveHitl(interactionId: string, value: any) {
    if (this.activeAgent && (this.activeAgent as any).interactionManager) {
      const im = (this.activeAgent as any).interactionManager;
      const targetId = (im.activeInteraction && im.activeInteraction.status === 'pending')
        ? im.activeInteraction.interaction_id
        : interactionId;
      try {
        if (typeof im.submitResponse === 'function') {
          im.submitResponse(targetId, value);
        } else if (typeof im.resolveInteraction === 'function') {
          im.resolveInteraction(targetId, value);
        }
      } catch (_) {}
    }
    const active = this.getActiveSession();
    if (active) {
      for (let i = active.messages.length - 1; i >= 0; i--) {
        if (active.messages[i].hitl) {
          active.messages[i].hitl = undefined;
          break;
        }
      }
    }
    this.notify();
  }

  public toggleJudge(enabled?: boolean) {
    this.state.judgeEnabled = enabled !== undefined ? enabled : !this.state.judgeEnabled;
    this.saveStorage();
    this.notify();
  }

  public setLogFilter(filter: LogCategory) {
    this.state.logFilter = filter;
    this.notify();
  }

  public setLogSearch(query: string) {
    this.state.logSearch = query;
    this.notify();
  }

  public clearLogs() {
    const active = this.getActiveSession();
    if (active) {
      active.events = [];
      this.saveStorage();
      this.notify();
    }
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

  public setJudgeEnabled(enabled: boolean) {
    this.state.judgeEnabled = enabled;
    this.saveStorage();
    this.notify();
  }

  public setJudgeModelId(modelId: string) {
    this.state.judgeModelId = modelId;
    this.saveStorage();
    this.notify();
  }

  public addModel(model: ModelDef) {
    this.state.models = sortModels([...this.state.models, model]);
    this.saveStorage();
    this.notify();
  }

  public updateModel(id: string, updates: Partial<ModelDef>) {
    const idx = this.state.models.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.state.models[idx] = { ...this.state.models[idx], ...updates };
      this.state.models = sortModels(this.state.models);
      this.saveStorage();
      this.notify();
    }
  }

  public deleteModel(id: string) {
    if (this.state.models.length <= 1) return;
    this.state.models = this.state.models.filter((m) => m.id !== id);
    if (this.state.selectedModelId === id) {
      this.state.selectedModelId = this.state.models[0].id;
    }
    this.saveStorage();
    this.notify();
  }

  public resetModelsToDefault() {
    this.state.models = sortModels([...DEFAULT_MODELS]);
    if (!this.state.models.some((m) => m.id === this.state.selectedModelId)) {
      this.state.selectedModelId = 'gemini/gemini-3.5-flash-lite';
    }
    this.saveStorage();
    this.notify();
  }

  public async autoFetchModels(provider: 'gemini' | 'openai' | 'anthropic' | 'custom_openai' | 'ollama' = 'gemini'): Promise<{ success: boolean; count: number; message: string }> {
    const apiKey = this.state.apiKeys[provider] || (provider === 'gemini' ? this.state.apiKeys.gemini : '');
    try {
      if (provider === 'gemini') {
        if (!apiKey) throw new Error('API Key Google Gemini belum diisi di Pengaturan (ikon kunci).');
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        const apiModels: Array<{ name: string; displayName?: string; description?: string; supportedGenerationMethods?: string[] }> = data.models || [];
        
        let addedCount = 0;
        for (const m of apiModels) {
          const rawSlug = m.name.replace(/^models\//, '');
          if (m.supportedGenerationMethods?.includes('generateContent')) {
            const exists = this.state.models.some((existing) => existing.provider === 'gemini' && existing.modelId === rawSlug);
            if (!exists) {
              this.state.models.push({
                id: `gemini/${rawSlug}`,
                name: m.displayName || rawSlug,
                icon: rawSlug.includes('lite') ? 'speed' : (rawSlug.includes('flash') ? 'bolt' : 'psychology'),
                provider: 'gemini',
                modelId: rawSlug,
                category: 'Auto-fetched API model',
              });
              addedCount++;
            }
          }
        }
        if (addedCount > 0) {
          this.state.models = sortModels(this.state.models);
          this.saveStorage();
          this.notify();
        }
        return {
          success: true,
          count: addedCount,
          message: addedCount > 0 ? `Berhasil mengimpor ${addedCount} model baru dari Google Gemini API.` : 'Semua model Gemini dari API sudah terdaftar.',
        };
      } else if (provider === 'ollama') {
        const host = this.state.apiKeys.ollama || 'http://localhost:11434';
        const res = await fetch(`${host.replace(/\/+$/, '')}/api/tags`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data = await res.json();
        const models: Array<{ name: string }> = data.models || [];
        let addedCount = 0;
        for (const m of models) {
          const slug = m.name;
          const exists = this.state.models.some((existing) => existing.provider === 'ollama' && existing.modelId === slug);
          if (!exists) {
            this.state.models.push({
              id: `ollama/${slug}`,
              name: slug,
              icon: 'terminal',
              provider: 'ollama',
              modelId: slug,
              baseUrl: host,
              category: 'Local Ollama Model',
            });
            addedCount++;
          }
        }
        if (addedCount > 0) {
          this.saveStorage();
          this.notify();
        }
        return {
          success: true,
          count: addedCount,
          message: addedCount > 0 ? `Berhasil mengimpor ${addedCount} model baru dari Ollama lokal.` : 'Semua model Ollama lokal sudah terdaftar.',
        };
      }
      return { success: false, count: 0, message: `Auto-fetch untuk provider "${provider}" belum didukung.` };
    } catch (err: any) {
      return { success: false, count: 0, message: err.message || String(err) };
    }
  }

  public setSelectedMode(mode: ExecutionMode) {
    this.state.selectedMode = mode;
    this.saveStorage();
    this.notify();
  }

  public setMode(mode: ExecutionMode) {
    this.setSelectedMode(mode);
  }

  public setSelectedPreset(preset: PresetId) {
    this.state.selectedPreset = preset;
    this.saveStorage();
    this.notify();
  }

  public async toggleDetach() {
    if (this.state.isDetached) {
      if (typeof chrome !== 'undefined' && chrome.sidePanel) {
        try {
          const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
          const normalWin = windows.find((w: any) => w.type === 'normal') || windows[0];
          if (normalWin?.id) {
            await chrome.sidePanel.open({ windowId: normalWin.id });
          }
        } catch (_) {}
      }

      // If the AI agent is currently running in this popup window context,
      // calling window.close() immediately will kill the JS runtime and abort in-flight fetch(),
      // throwing "LLM Error: Failed to fetch".
      // Instead, minimize this popup window, let the agent complete safely in background,
      // and close the window once the task finishes!
      if (this.state.runState === 'running' || this.activeAgent) {
        this.pendingCloseOnCompletion = true;
        try {
          const currentWin = await chrome.windows.getCurrent();
          if (currentWin?.id) {
            await chrome.windows.update(currentWin.id, { state: 'minimized', focused: false });
          }
        } catch (_) {}
        return;
      }

      try {
        window.close();
      } catch (_) {}
    } else {
      if (typeof chrome !== 'undefined' && chrome.windows) {
        chrome.windows.create({
          url: chrome.runtime.getURL('sidepanel/dist/index.html?detached=true'),
          type: 'popup',
          width: 440,
          height: 720,
          focused: true,
        }, () => {
          if (this.state.runState !== 'running' && !this.activeAgent) {
            try {
              window.close();
            } catch (_) {}
          } else {
            this.pendingCloseOnCompletion = true;
          }
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
    const staged = this.state.stagedFiles && this.state.stagedFiles.length > 0 ? [...this.state.stagedFiles] : undefined;
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: prompt,
      timestamp: Date.now(),
      stagedFiles: staged,
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

    // 3. Dispatch to Daemon ONLY if connectionMode is 'daemon' and ws is connected
    if (this.state.connectionMode === 'daemon' && this.ws && this.ws.readyState === WebSocket.OPEN) {
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

  public async regenerate() {
    if (this.state.runState === 'running') return;
    const active = this.getActiveSession();
    
    // Find the last user prompt in this session
    let lastUserPrompt = '';
    for (let i = active.messages.length - 1; i >= 0; i--) {
      if (active.messages[i].role === 'user') {
        lastUserPrompt = active.messages[i].text;
        break;
      }
    }
    if (!lastUserPrompt) return;

    // Remove the last assistant message if present so we can rebuild fresh
    if (active.messages.length > 0 && active.messages[active.messages.length - 1].role === 'assistant') {
      active.messages.pop();
    }

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

    // Dispatch to Daemon if connected
    if (this.state.connectionMode === 'daemon' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
        const resp = await fetch('http://127.0.0.1:7788/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: lastUserPrompt,
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

    // In-browser agent fallback
    this._runStandaloneAgent(runId, lastUserPrompt, assistantMsg);
  }

  public cancelRun() {
    if (this.activeAgent) {
      try { this.activeAgent.stop(); } catch (_) {}
      this.activeAgent = null;
    }
    // Broadcast stop command to other windows (e.g. background/popup window)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'STOP_AGENT' }).catch(() => {});
      }
    } catch (_) {}

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
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]: any[]) => {
        if (tab?.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const overlay = document.getElementById('__deep_browser_highlight_overlay__');
              if (overlay) overlay.remove();
              const cursor = document.getElementById('__deep_browser_agent_cursor__');
              if (cursor) cursor.remove();
            },
          }).catch(() => {});
        }
      }).catch(() => {});
    }
    this.state.runState = 'idle';
    this.saveStorage();
    this.notify();
  }

  public respondHitl(interactionId: string, value: unknown) {
    if (this.activeAgent && (this.activeAgent as any).interactionManager) {
      const im = (this.activeAgent as any).interactionManager;
      const activeIx = im.activeInteraction;
      const targetId = (activeIx && activeIx.status === 'pending') ? activeIx.interaction_id : interactionId;
      try {
        if (typeof im.submitResponse === 'function') {
          im.submitResponse(targetId, value);
        } else if (typeof im.resolveInteraction === 'function') {
          im.resolveInteraction(targetId, value);
        }
      } catch (err) {
        console.warn('[DeepBrowser] Error submitting interaction response:', err);
      }
    }
    // Relay HITL resolution to any detached window holding the active agent
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'RESOLVE_HITL',
          interactionId,
          value,
        }).catch(() => {});
      }
    } catch (_) {}
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
    if (lastMsg && lastMsg.hitl) {
      lastMsg.hitl = undefined;
    }
    this.state.runState = 'running';
    this.notify();
  }

  private handleIncomingAgentEvent(evt: any) {
    const active = this.getActiveSession();
    const type = evt.event_type || evt.type || '';
    const payload = evt.data || evt.payload || {};

    const getCategory = (t: string): LogCategory => {
      const up = t.toUpperCase();
      if (up.includes('ERR') || up.includes('FAIL')) return 'errors';
      if (up.includes('WAIT')) return 'waiting';
      if (up.includes('TOOL') || up.includes('ACTION') || up.includes('CLICK') || up.includes('TYPE') || up.includes('SCROLL') || up.includes('NAV') || up.includes('SEARCH') || up.includes('HIGHLIGHT')) return 'tools';
      if (up.includes('VERIF')) return 'verifications';
      if (up.includes('REASON') || up.includes('PLAN')) return 'reasoning';
      if (up.includes('APPROV') || up.includes('HITL') || up.includes('USER_INPUT') || up.includes('USER_RESP')) return 'approvals';
      if (up.includes('OBSERV') || up.includes('SCREEN') || up.includes('ATTACH')) return 'observations';
      return 'all';
    };

    // Add to event logs with full correlation
    const activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    const logEvt: LogEvent = {
      id: 'log_' + Date.now() + Math.random().toString(36).slice(2, 5),
      timestamp: Date.now(),
      type,
      step: evt.step || undefined,
      category: getCategory(type),
      message: evt.message || JSON.stringify(payload).slice(0, 120),
      payload,
      runId: evt.taskId || evt.runId || this.currentRunId || undefined,
      sessionId: active.id,
      tabId: evt.tabId || activeTab?.id,
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

    // Helper to push tool step to both steps array and activities timeline
    const recordStep = (step: ToolStep) => {
      if (!lastMsg.steps) lastMsg.steps = [];
      lastMsg.steps.push(step);
      if (!lastMsg.activities) lastMsg.activities = [];
      lastMsg.activities.push({
        id: step.id,
        type: 'step',
        step,
        timestamp: step.timestamp,
      });
    };

    // 1. Genuine LLM Reasoning / Thinking emission
    if (type === 'REASONING') {
      const thinkingText = payload.thinking || evt.message || '';
      if (thinkingText) {
        lastMsg.thought = (lastMsg.thought ? lastMsg.thought + '\n\n' : '') + thinkingText;
        if (!lastMsg.activities) lastMsg.activities = [];
        lastMsg.activities.push({
          id: 'act_th_' + Date.now() + Math.random().toString(36).slice(2, 5),
          type: 'reasoning',
          thought: thinkingText,
          timestamp: Date.now(),
        });
      }
    }

    // 1b. Show Narrative emission (visible progress info directly for the user)
    if (type === 'NARRATIVE' || type === 'SHOW') {
      const narrativeText = payload.text || evt.message || '';
      if (narrativeText) {
        if (!lastMsg.activities) lastMsg.activities = [];
        lastMsg.activities.push({
          id: 'act_narr_' + Date.now() + Math.random().toString(36).slice(2, 5),
          type: 'narrative',
          text: narrativeText,
          timestamp: Date.now(),
        });
      }
    }
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
      recordStep(step);
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
      recordStep(step);
    }

    // 4. Waiting Process (Tanpa Terminasi)
    if (type === 'WAITING' || (type.includes('WAIT') && !type.includes('WAITING_FOR_USER'))) {
      this.state.stepCount++;
      const seconds = payload.seconds || 3;
      const step: ToolStep = {
        id: 'step_wait_' + Date.now(),
        name: evt.message || `Waiting (${seconds}s) — Menunggu proses halaman/sistem selesai`,
        icon: 'hourglass_top',
        status: 'succeeded',
        duration: `${seconds}s`,
        args: payload.args || payload,
        result: {
          status: 'settled',
          seconds,
          message: 'Proses waiting selesai (tanpa terminasi), siap menerima dan membaca info baru.',
        },
        timestamp: Date.now(),
      };
      recordStep(step);
    }

    // 5. Handle tool steps with icons and verification
    if ((type.includes('TOOL') || type.includes('NAV') || type.includes('CLICK') || type.includes('TYPE') || type.includes('SCROLL') || type.includes('EXTRACT') || type.includes('SEARCH') || type.includes('TAB') || type.includes('HIGHLIGHT') || type === 'ACTION_EXECUTED') && !type.includes('WAIT')) {
      this.state.stepCount++;
      const icon = type.includes('NAV') ? 'navigation'
        : type.includes('CLICK') ? 'touch_app'
        : type.includes('TYPE') ? 'edit'
        : type.includes('SCROLL') ? 'swap_vert'
        : type.includes('EXTRACT') ? 'dataset'
        : type.includes('SEARCH') ? 'search'
        : type.includes('HIGHLIGHT') ? 'border_color'
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
      recordStep(step);
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

    // 5b. Visual Artifacts
    if (type === 'SCREENSHOT_CAPTURED' || type === 'SCREENSHOT') {
      const screenshotData = payload.screenshotDataUrl || payload.screenshot || payload.dataUrl;
      const step: ToolStep = {
        id: 'step_sc_' + Date.now(),
        name: 'Tangkapan Layar Viewport',
        icon: 'screenshot',
        status: 'succeeded',
        duration: '100ms',
        result: {
          screenshot: screenshotData || 'Captured',
          fileName: payload.fileName,
        },
        timestamp: Date.now(),
      };
      recordStep(step);
    }

    // 5c. AI Judge Events (Independent Evaluation)
    if (type === 'JUDGE_STARTED') {
      this.state.stepCount++;
      const step: ToolStep = {
        id: 'step_judge_' + Date.now(),
        name: evt.message || `Evaluasi AI Judge (${payload.model || 'Model'})`,
        icon: 'gavel',
        status: 'running',
        duration: 'evaluasi...',
        args: { task: payload.task, totalSteps: payload.totalSteps, model: payload.model },
        result: { status: 'evaluating' },
        timestamp: Date.now(),
      };
      recordStep(step);
    }

    if (type === 'TRACE_JUDGED') {
      const normFailureReasons = Array.isArray(payload.failureReasons)
        ? payload.failureReasons.filter(Boolean)
        : (payload.failure_reason ? [payload.failure_reason] : []);
      const normFormattedSteps = Array.isArray(payload.formattedSteps)
        ? payload.formattedSteps
        : (typeof payload.formattedSteps === 'string' ? payload.formattedSteps.split('\n').map((s: string) => s.trim()).filter(Boolean) : []);

      lastMsg.judgeVerdict = {
        ...payload,
        failureReasons: normFailureReasons,
        formattedSteps: normFormattedSteps,
      };

      if (lastMsg.steps && lastMsg.steps.length > 0) {
        const judgeStep = lastMsg.steps.slice().reverse().find((s) => s.icon === 'gavel' || s.name.includes('Judge'));
        if (judgeStep) {
          judgeStep.status = payload.verdict ? 'succeeded' : 'failed';
          judgeStep.duration = 'selesai';
          judgeStep.result = payload;
          judgeStep.verification = {
            verdict: payload.verdict ? 'PASS' : 'FAIL',
            confidence: payload.confidence,
            reasoning: payload.reasoning,
            failureReasons: normFailureReasons,
          };
        } else {
          const step: ToolStep = {
            id: 'step_judge_done_' + Date.now(),
            name: `Hasil Evaluasi Judge: ${payload.verdict ? 'BERHASIL (Valid)' : 'TIDAK VALID'}`,
            icon: 'gavel',
            status: payload.verdict ? 'succeeded' : 'failed',
            duration: 'selesai',
            args: { task: payload.task, model: payload.model },
            result: payload,
            verification: {
              verdict: payload.verdict ? 'PASS' : 'FAIL',
              confidence: payload.confidence,
              reasoning: payload.reasoning,
              failureReasons: normFailureReasons,
            },
            timestamp: Date.now(),
          };
          recordStep(step);
        }
      }
    }

    if (type === 'PDF_SAVED') {
      const step: ToolStep = {
        id: 'step_pdf_' + Date.now(),
        name: `Ekspor PDF: ${payload.fileName || 'document.pdf'}`,
        icon: 'picture_as_pdf',
        status: 'succeeded',
        duration: '350ms',
        result: payload,
        timestamp: Date.now(),
      };
      recordStep(step);
    }

    // 9. Completion
    if (type === 'TASK_COMPLETED' || type === 'DONE') {
      const finalResult = payload.result || evt.message || lastMsg.text || lastMsg.thought || 'Tugas browser selesai dieksekusi dan terverifikasi.';
      lastMsg.text = finalResult;
      this.state.runState = 'done';
      this.activeAgent = null;
    }

    // 9b. Cancellation
    if (type === 'TASK_CANCELLED' || type === 'CANCELLED') {
      lastMsg.text = lastMsg.text || payload.message || evt.message || 'Tugas dibatalkan oleh pengguna.';
      lastMsg.hitl = undefined;
      this.state.runState = 'idle';
      this.activeAgent = null;
    }

    // 10. Failure / Error
    if (type === 'TASK_FAILED' || type === 'ERROR') {
      lastMsg.isError = true;
      lastMsg.text = payload.error || evt.message || 'Eksekusi gagal.';
      this.state.runState = 'error';
      this.activeAgent = null;
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

    let activeTab = await this.getTargetActiveTab();
    if (!activeTab) {
      activeTab = this.state.tabs.find((t) => t.active) || this.state.tabs[0];
    }

    let recorder: any = null;

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

      let judgeLlmClient = null;
      if (this.state.judgeEnabled) {
        const judgeModelDef = this.state.judgeModelId === 'auto'
          ? activeModel
          : (this.state.models.find((m) => m.id === this.state.judgeModelId) || activeModel);
        const judgeProvider = judgeModelDef.provider;
        const judgeApiKey = this.state.apiKeys[judgeProvider] || this.state.apiKeys.gemini || '';

        judgeLlmClient = new (window as any).LLMClient({
          provider: judgeProvider,
          model: judgeModelDef.modelId || judgeModelDef.id,
          apiKey: judgeApiKey,
          baseUrl: judgeModelDef.baseUrl || this.state.apiKeys.custom_openai || '',
          ollamaHost: this.state.apiKeys.ollama || 'http://localhost:11434',
          temperature: 0.0,
        });
      }

      if (this.state.stagedFiles && this.state.stagedFiles.length > 0 && browserSession?.setStagedFiles) {
        browserSession.setStagedFiles(this.state.stagedFiles);
        this.state.stagedFiles = [];
        this.notify();
      }

      // Check if In-Page Floating HUD is enabled
      if (this.state.isHudEnabled && browserSession?.tabId && typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        chrome.tabs.sendMessage(browserSession.tabId, { type: 'SHOW_FLOATING_HUD' }).catch(() => {});
      }

      // Check if Video Recording is requested
      if (this.state.isRecordingEnabled && (window as any).SessionRecorder && browserSession?.tabId) {
        try {
          const rec = new (window as any).SessionRecorder({ tabId: browserSession.tabId });
          const started = await rec.startRecording(browserSession.tabId);
          if (started) {
            recorder = rec;
          }
        } catch (recErr) {
          console.warn('[SessionRecorder] Start error:', recErr);
        }
      }

      const agent = new (window as any).Agent({
        taskId: runId,
        task: prompt,
        preset: this.state.selectedPreset,
        browserSession,
        llmClient,
        judgeLlmClient,
        useJudge: this.state.judgeEnabled,
        interactionManager,
        maxSteps: Infinity,
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

      // Finalize video recording if active
      if (recorder) {
        try {
          const recResult = await recorder.stopRecording();
          if (recResult && recResult.videoUrl) {
            assistantMsg.recordedVideo = {
              url: recResult.videoUrl,
              fileName: recResult.fileName,
              durationSeconds: recResult.durationSeconds,
              sizeBytes: recResult.sizeBytes,
            };
            this.notify();
            this.saveStorage();
          }
        } catch (stopErr) {
          console.warn('[SessionRecorder] Stop error:', stopErr);
        }
      }

      if (this.state.runState === 'running') {
        this.state.runState = 'idle';
      }
      this.notify();
      this.saveStorage();

      if (this.pendingCloseOnCompletion) {
        setTimeout(() => {
          try {
            window.close();
          } catch (_) {}
        }, 400);
      }
    }
  }
}

export const sidepanelStore = new SidepanelStateManager();
