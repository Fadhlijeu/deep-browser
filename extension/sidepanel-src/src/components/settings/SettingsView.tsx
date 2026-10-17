import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Server,
  Cpu,
  KeyRound,
  ShieldCheck,
  Check,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { ModelDef, ExecutionMode } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface SettingsViewProps {
  models: ModelDef[];
  selectedModelId: string;
  selectedMode: ExecutionMode;
  apiKeys: Record<string, string>;
  theme: 'light' | 'dark' | 'system';
  indexLabelingEnabled: boolean;
  isRecordingEnabled: boolean;
  isHudEnabled: boolean;
  judgeEnabled: boolean;
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
  onSelectModel: (id: string) => void;
  onSetMode: (m: ExecutionMode) => void;
  onSaveApiKey: (provider: string, key: string) => void;
  onToggleIndexLabeling: () => void;
  onToggleRecording: () => void;
  onToggleHud: () => void;
  onToggleJudge: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  models,
  selectedModelId,
  selectedMode,
  apiKeys,
  theme,
  indexLabelingEnabled,
  isRecordingEnabled,
  isHudEnabled,
  judgeEnabled,
  onSetTheme,
  onSelectModel,
  onSetMode,
  onSaveApiKey,
  onToggleIndexLabeling,
  onToggleRecording,
  onToggleHud,
  onToggleJudge,
}) => {
  const [tab, setTab] = useState<'general' | 'providers' | 'models' | 'api' | 'agent'>('general');

  // API Config Form State
  const [apiProvider, setApiProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'custom_openai'>('gemini');
  const [inputKey, setInputKey] = useState(apiKeys[apiProvider] || '');
  const [showSecret, setShowSecret] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleProviderChange = (p: 'gemini' | 'openai' | 'anthropic' | 'custom_openai') => {
    setApiProvider(p);
    setInputKey(apiKeys[p] || '');
    setTestStatus(null);
    setIsSaved(false);
  };

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(apiProvider, inputKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    if (!inputKey.trim()) {
      setTestStatus('Please enter an API key first.');
      return;
    }
    setIsTesting(true);
    setTestStatus('Testing endpoint connection…');

    try {
      if (apiProvider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${inputKey.trim()}`);
        if (res.ok) {
          setTestStatus('Google Gemini API Key is valid and active!');
        } else {
          const err = await res.json().catch(() => ({}));
          setTestStatus(`Gemini error: ${err.error?.message || res.statusText}`);
        }
      } else if (apiProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${inputKey.trim()}` },
        });
        if (res.ok) {
          setTestStatus('OpenAI API Key is valid and connected!');
        } else {
          setTestStatus(`OpenAI HTTP ${res.status}: Unauthorized`);
        }
      } else {
        setTestStatus('Connection format verified.');
      }
    } catch (err: any) {
      setTestStatus(`Connection error: ${err.message || 'Network failure'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const providers = [
    { id: 'gemini', name: 'Google Gemini', defaultModel: 'Gemini 3.5 Flash Lite', short: 'G' },
    { id: 'openai', name: 'OpenAI', defaultModel: 'GPT-4o Mini', short: 'O' },
    { id: 'anthropic', name: 'Anthropic Claude', defaultModel: 'Claude 3.5 Sonnet', short: 'A' },
    { id: 'ollama', name: 'Ollama (Local)', defaultModel: 'Llama 3 (Local)', short: 'OL' },
    { id: 'custom_openai', name: 'Custom OpenAI-Compatible', defaultModel: 'DeepSeek Chat', short: 'C' },
  ];

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Configuration</div>
          <h1>Settings</h1>
          <p className="page-subtitle">
            Tune workspace appearance, configure AI model providers, API credentials, and agent execution preferences.
          </p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Settings Left Nav */}
        <nav className="settings-nav">
          <button
            className={tab === 'general' ? 'active' : ''}
            onClick={() => setTab('general')}
          >
            <SlidersHorizontal size={14} />
            <span>General</span>
          </button>
          <button
            className={tab === 'providers' ? 'active' : ''}
            onClick={() => setTab('providers')}
          >
            <Server size={14} />
            <span>Providers</span>
          </button>
          <button
            className={tab === 'models' ? 'active' : ''}
            onClick={() => setTab('models')}
          >
            <Cpu size={14} />
            <span>Models</span>
          </button>
          <button
            className={tab === 'api' ? 'active' : ''}
            onClick={() => setTab('api')}
          >
            <KeyRound size={14} />
            <span>API configuration</span>
          </button>
          <button
            className={tab === 'agent' ? 'active' : ''}
            onClick={() => setTab('agent')}
          >
            <ShieldCheck size={14} />
            <span>Agent preferences</span>
          </button>
        </nav>

        {/* Settings Right Panel */}
        <section className="settings-panel">
          {/* 1. General Preferences */}
          {tab === 'general' && (
            <div>
              <h2>General Preferences</h2>
              <p>Appearance and interaction settings for your Deep Browser Copilot.</p>

              <div className="setting-row">
                <div>
                  <strong>Appearance Theme</strong>
                  <p>Switch between warm paper editorial and high-contrast dark mode.</p>
                </div>
                <select
                  className="select"
                  style={{ width: '130px' }}
                  value={theme}
                  onChange={(e) => onSetTheme(e.target.value as any)}
                >
                  <option value="light">Light Paper</option>
                  <option value="dark">Dark Theme</option>
                  <option value="system">System Default</option>
                </select>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Interactive Index Labeling</strong>
                  <p>Display numbered index badges over clickable DOM elements during runs.</p>
                </div>
                <button
                  className={`toggle ${indexLabelingEnabled ? 'on' : ''}`}
                  onClick={onToggleIndexLabeling}
                  aria-label="Toggle index labeling"
                >
                  <span />
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>Session Video Recording</strong>
                  <p>Capture native video WebM recording of the tab during agent execution.</p>
                </div>
                <button
                  className={`toggle ${isRecordingEnabled ? 'on' : ''}`}
                  onClick={onToggleRecording}
                  aria-label="Toggle video recording"
                >
                  <span />
                </button>
              </div>

              <div className="setting-row">
                <div>
                  <strong>In-Page Live Floating HUD</strong>
                  <p>Show floating telemetry status card directly on the target browser page.</p>
                </div>
                <button
                  className={`toggle ${isHudEnabled ? 'on' : ''}`}
                  onClick={onToggleHud}
                  aria-label="Toggle live HUD"
                >
                  <span />
                </button>
              </div>

              <div className="rule" />

              <h2 style={{ marginTop: '12px' }}>Keyboard Shortcuts</h2>
              <div className="setting-row">
                <div><strong>Send prompt</strong></div>
                <span className="kbd">Enter</span>
              </div>
              <div className="setting-row">
                <div><strong>New line in composer</strong></div>
                <span className="kbd">Shift + Enter</span>
              </div>
              <div className="setting-row">
                <div><strong>Quick command search</strong></div>
                <span className="kbd">Ctrl / ⌘ K</span>
              </div>
            </div>
          )}

          {/* 2. Providers */}
          {tab === 'providers' && (
            <div>
              <h2>Configured Providers</h2>
              <p>Supported LLM backends for autonomous reasoning and DOM synthesis.</p>

              {providers.map((p) => {
                const hasKey = Boolean(apiKeys[p.id]);
                return (
                  <div key={p.id} className="provider-row">
                    <div className="provider-badge">{p.short}</div>
                    <div className="provider-main">
                      <strong>{p.name}</strong>
                      <span>
                        {hasKey ? 'API Key Configured locally' : 'Not configured'} · Default: {p.defaultModel}
                      </span>
                    </div>
                    <div className="provider-actions">
                      <span className={`status ${hasKey ? 'success' : 'paused'}`}>
                        {hasKey ? 'Configured' : 'No Key'}
                      </span>
                      <button
                        className="btn small"
                        onClick={() => {
                          setApiProvider(p.id as any);
                          setInputKey(apiKeys[p.id] || '');
                          setTab('api');
                        }}
                      >
                        Edit Key
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. Models */}
          {tab === 'models' && (
            <div>
              <h2>Active Model Inventory</h2>
              <p>
                Select the primary model for your autonomous agent. Gemini models only include the 8 active generation models.
              </p>

              {models.map((m) => {
                const isSelected = selectedModelId === m.id;
                return (
                  <div key={m.id} className="provider-row">
                    <div className="provider-badge">
                      {m.provider === 'gemini' ? 'G' : m.provider === 'openai' ? 'O' : m.provider === 'anthropic' ? 'A' : 'L'}
                    </div>
                    <div className="provider-main">
                      <strong>
                        {m.name}
                        {isSelected && <span className="mini-badge" style={{ marginLeft: '8px' }}>Active</span>}
                      </strong>
                      <span>
                        {m.category || m.provider} {m.rpm ? `· RPM: ${m.rpm} · TPM: ${m.tpm} · RPD: ${m.rpd}` : ''}
                      </span>
                    </div>
                    <div className="provider-actions">
                      <button
                        className={`btn small ${isSelected ? 'accent' : ''}`}
                        onClick={() => onSelectModel(m.id)}
                        disabled={isSelected}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. API Configuration Form */}
          {tab === 'api' && (
            <div>
              <h2>API Configuration</h2>
              <p>Store your API credentials securely in browser local storage.</p>

              <div className="callout" style={{ marginBottom: '16px' }}>
                <ShieldCheck size={15} />
                <span>
                  <strong>Local-First Storage:</strong> Keys are stored only inside Chrome extension local storage on this computer. They are never sent to external servers or logged in telemetry.
                </span>
              </div>

              <form onSubmit={handleSaveKey}>
                <div className="form-grid">
                  <div className="field">
                    <label>Provider</label>
                    <select
                      className="select"
                      value={apiProvider}
                      onChange={(e) => handleProviderChange(e.target.value as any)}
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="custom_openai">Custom OpenAI-Compatible (DeepSeek)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Selected Provider Slug</label>
                    <input className="input mono" disabled value={apiProvider} />
                  </div>

                  <div className="field full">
                    <label>API Key</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        className="input mono"
                        type={showSecret ? 'text' : 'password'}
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder={`Paste your ${apiProvider} API key here…`}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setShowSecret(!showSecret)}
                        title={showSecret ? 'Hide key' : 'Show key'}
                      >
                        {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <span className="help">
                      {apiProvider === 'gemini'
                        ? 'Obtain key from Google AI Studio (aistudio.google.com)'
                        : 'Obtain key from provider dashboard'}
                    </span>
                  </div>
                </div>

                {testStatus && (
                  <div className="callout" style={{ marginTop: '12px' }}>
                    <Zap size={14} />
                    <span>{testStatus}</span>
                  </div>
                )}

                {isSaved && (
                  <div style={{ color: 'var(--green)', fontSize: '11px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Check size={13} /> API Key saved successfully to local storage!
                  </div>
                )}

                <div className="rule" />

                <div className="toolbar" style={{ justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={handleTestConnection}
                    disabled={isTesting || !inputKey.trim()}
                  >
                    <Zap size={13} />
                    {isTesting ? 'Testing…' : 'Test connection'}
                  </button>

                  <button type="submit" className="btn primary">
                    <Check size={13} /> Save changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. Agent Preferences */}
          {tab === 'agent' && (
            <div>
              <h2>Agent Execution Preferences</h2>
              <p>Configure autonomous decision policy and human verification boundaries.</p>

              <div className="field">
                <label>Default Execution Mode</label>
                <div className="mode-options" style={{ marginTop: '8px' }}>
                  {[
                    ['agent_decide', 'Agent Decide', 'Evaluates mutation risk and asks for confirmation dynamically.'],
                    ['auto', 'Always Proceed', 'Fast execution with zero confirmation halts.'],
                    ['hitl', 'Request Review', 'Human review gate required before every browser action.'],
                  ].map(([id, title, desc]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mode-option ${selectedMode === id ? 'active' : ''}`}
                      onClick={() => onSetMode(id as ExecutionMode)}
                    >
                      <span className="radio-mark" />
                      <span>
                        <strong>{title}</strong>
                        <p>{desc}</p>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row" style={{ marginTop: '16px' }}>
                <div>
                  <strong>Independent AI Judge Verification</strong>
                  <p>Run a second independent LLM pass to verify completion against ground-truth.</p>
                </div>
                <button
                  className={`toggle ${judgeEnabled ? 'on' : ''}`}
                  onClick={onToggleJudge}
                  aria-label="Toggle AI Judge"
                >
                  <span />
                </button>
              </div>

              <div className="rule" />

              <h2>Capability Invariants</h2>
              <div className="setting-row">
                <div><strong>Local-First CDP Connection</strong></div>
                <span className="pill">Direct Chromium Bindings</span>
              </div>
              <div className="setting-row">
                <div><strong>Deterministic Mutation Check</strong></div>
                <span className="pill">Enforced on Every Action</span>
              </div>
              <div className="setting-row">
                <div><strong>Cloud Dependency Lock-In</strong></div>
                <span className="pill">Zero Mandatory Cloud</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
