import React, { useState } from 'react';
import { Search, X, CheckCircle, AlertTriangle, Scale } from 'lucide-react';
import { ModelDef } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface ModelsModalProps {
  isOpen: boolean;
  models: ModelDef[];
  selectedModelId: string;
  judgeEnabled?: boolean;
  judgeModelId?: string;
  onClose: () => void;
}

const PROVIDER_NAMES: Record<string, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  custom_openai: 'OpenAI-Compatible',
  ollama: 'Local Ollama',
};

const PROVIDER_SHORTS: Record<string, string> = {
  gemini: 'G',
  openai: 'OAI',
  anthropic: 'ANT',
  custom_openai: 'OC',
  ollama: 'OL',
};

export const ModelsModal: React.FC<ModelsModalProps> = ({
  isOpen,
  models,
  selectedModelId,
  judgeEnabled = false,
  judgeModelId = 'auto',
  onClose,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const handleSelectModel = (modelId: string) => {
    sidepanelStore.setSelectedModel(modelId);
  };

  const handleToggleJudge = () => {
    sidepanelStore.setJudgeEnabled(!judgeEnabled);
  };

  const handleChangeJudgeModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    sidepanelStore.setJudgeModelId(e.target.value);
  };

  // Filter models based on search query
  const q = search.trim().toLowerCase();
  const filteredModels = models.filter((m) => {
    if (!q) return true;
    const providerName = PROVIDER_NAMES[m.provider] || m.provider;
    return (
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      providerName.toLowerCase().includes(q)
    );
  });

  // Group models by provider
  const groupedModels = filteredModels.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, ModelDef[]>);

  const providerOrder = ['gemini', 'openai', 'anthropic', 'custom_openai', 'ollama'];
  const providerKeys = providerOrder.filter((p) => groupedModels[p] && groupedModels[p].length > 0);
  Object.keys(groupedModels).forEach((p) => {
    if (!providerKeys.includes(p)) providerKeys.push(p);
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modelModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="modal-head">
          <div>
            <div className="modal-title" id="modelModalTitle">Choose a model</div>
            <div className="modal-sub">
              Available AI models grouped by provider for browser execution &amp; reasoning.
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Search Box */}
          <div className="searchbox" style={{ maxWidth: 'none', marginBottom: '14px' }}>
            <Search size={14} />
            <input
              className="input"
              id="modelSearchInput"
              placeholder="Search models or provider…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Model List */}
          {providerKeys.length === 0 ? (
            <div className="blank">
              <div className="blank-icon">
                <Search size={18} />
              </div>
              <strong>No models found</strong>
              <p>Try searching with another model name or provider.</p>
            </div>
          ) : (
            providerKeys.map((provider) => {
              const pModels = groupedModels[provider];
              const providerLabel = PROVIDER_NAMES[provider] || provider.toUpperCase();
              return (
                <div key={provider}>
                  <div className="model-group-title">{providerLabel}</div>
                  {pModels.map((m) => {
                    const isSelected = selectedModelId === m.id;
                    const shortLogo = PROVIDER_SHORTS[m.provider] || m.provider.slice(0, 3).toUpperCase();
                    const isFast = m.name.toLowerCase().includes('flash') || m.name.toLowerCase().includes('mini');

                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`model-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectModel(m.id)}
                      >
                        <div className="model-logo">{shortLogo}</div>
                        <div className="model-meta">
                          <div className="model-title">
                            <span>{m.name}</span>
                            <span className="status success">Available</span>
                          </div>
                          <div className="model-id">{m.id} · {providerLabel}</div>
                          <div className="capabilities">
                            <span className="pill">Vision</span>
                            <span className="pill">CDP Tooling</span>
                            <span className="pill">{isFast ? 'Fast' : 'High Reasoning'}</span>
                            {m.rpm && <span className="pill">RPM {m.rpm}</span>}
                            {m.tpm && <span className="pill">TPM {m.tpm}</span>}
                            {m.rpd && <span className="pill">RPD {m.rpd}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="model-check">
                            <CheckCircle size={15} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}

          {/* AI Judge Evaluation Section */}
          <div style={{ marginTop: '18px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
            <div className="model-group-title">AI JUDGE EVALUATION (OPTIONAL)</div>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Scale size={13} style={{ color: 'var(--accent)' }} />
                  <strong style={{ fontSize: '11.5px', color: 'var(--ink)' }}>
                    Independent AI Judge Grading
                  </strong>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', marginTop: '3px', lineHeight: 1.45 }}>
                  Run a secondary LLM to independently grade action execution validity, preventing hallucinated success.
                </span>
              </div>
              <button
                type="button"
                className={`toggle ${judgeEnabled ? 'active' : ''}`}
                onClick={handleToggleJudge}
                style={{ background: judgeEnabled ? 'var(--accent)' : undefined }}
                title="Toggle AI Judge"
              >
                <span style={{ transform: judgeEnabled ? 'translateX(15px)' : 'none' }} />
              </button>
            </div>

            {judgeEnabled && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>Judge Model:</span>
                <select
                  className="select"
                  value={judgeModelId}
                  onChange={handleChangeJudgeModel}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  <option value="auto">Auto (Match Primary Model)</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Foot */}
        <div className="modal-foot">
          <span className="muted tiny">Supports Google Gemini, OpenAI, Claude, and Local Ollama.</span>
          <div className="modal-foot-right">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
