import { Scale, Bot, Check, X, Sparkles } from 'lucide-react';
import { ModelDef } from '../../types';
import { PROVIDER_LABELS, sidepanelStore } from '../../state/sidepanelStore';
import { ProviderLogo } from '../common/ProviderLogo';

interface ModelsModalProps {
  isOpen: boolean;
  models: ModelDef[];
  selectedModelId: string;
  judgeEnabled?: boolean;
  judgeModelId?: string;
  onClose: () => void;
}

export const ModelsModal: React.FC<ModelsModalProps> = ({
  isOpen,
  models,
  selectedModelId,
  judgeEnabled = false,
  judgeModelId = 'auto',
  onClose,
}) => {
  if (!isOpen) return null;

  // Group and sort models by provider, then A to Z
  const groupedModels = models.reduce((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<string, ModelDef[]>);

  const providerKeys = ['gemini', 'openai', 'anthropic', 'custom_openai', 'ollama'].filter(
    (p) => groupedModels[p] && groupedModels[p].length > 0
  );
  Object.keys(groupedModels).forEach((p) => {
    if (!providerKeys.includes(p)) providerKeys.push(p);
  });
  providerKeys.forEach((p) => {
    groupedModels[p].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  });

  const handleSelectModel = (modelId: string) => {
    sidepanelStore.setSelectedModel(modelId);
  };

  const handleToggleJudge = () => {
    sidepanelStore.setJudgeEnabled(!judgeEnabled);
  };

  const handleChangeJudgeModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    sidepanelStore.setJudgeModelId(e.target.value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '440px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Bot size={16} style={{ color: 'var(--accent)' }} />
            <span className="modal-title">Pilih Model AI</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup">
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '460px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Section 1: Main Agent Model */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pilih Model Utama Agen
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {models.length} model terdaftar
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {providerKeys.map((provider) => {
                const pModels = groupedModels[provider];
                const providerLabel = PROVIDER_LABELS[provider] || provider.toUpperCase();
                return (
                  <div key={provider} className="provider-model-group">
                    <div className="provider-group-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ProviderLogo provider={provider as any} size={13} />
                        <span className="provider-group-title">{providerLabel}</span>
                      </div>
                      <span className="provider-group-count">{pModels.length} model</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {pModels.map((m) => {
                        const isSelected = selectedModelId === m.id;
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleSelectModel(m.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                              border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.45)' : 'var(--border-subtle)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                              gap: '8px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0 }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: 'var(--radius-xs)',
                                background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-subtle)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <ProviderLogo provider={m.provider} size={15} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '12px', color: isSelected ? '#ffffff' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }} title={m.name}>
                                    {m.name}
                                  </span>
                                  <span style={{
                                    fontSize: '9px',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-tertiary)',
                                    textTransform: 'uppercase',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    padding: '1px 4px',
                                    borderRadius: '3px'
                                  }}>
                                    {m.provider}
                                  </span>
                                </div>
                                {(m.rpm || m.tpm || m.rpd) && (
                                  <div className="model-quota-row" style={{ marginTop: '2px' }}>
                                    {m.rpm && (
                                      <span className="model-quota-chip">
                                        <span className="chip-label">RPM</span>
                                        <span className="chip-val">{m.rpm}</span>
                                      </span>
                                    )}
                                    {m.tpm && (
                                      <span className="model-quota-chip">
                                        <span className="chip-label">TPM</span>
                                        <span className="chip-val">{m.tpm}</span>
                                      </span>
                                    )}
                                    {m.rpd && (
                                      <span className="model-quota-chip">
                                        <span className="chip-label">RPD</span>
                                        <span className="chip-val">{m.rpd}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'rgba(59, 130, 246, 0.2)',
                                border: '1px solid rgba(59, 130, 246, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                <Check size={12} strokeWidth={2.8} style={{ color: '#60a5fa' }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: AI Judge Configuration */}
          <div style={{
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {/* Judge Header & Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Scale size={15} style={{ color: judgeEnabled ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    AI Judge Evaluation
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    Evaluasi mandiri trace & bukti di akhir eksekusi
                  </div>
                </div>
              </div>

              {/* Custom Toggle Switch */}
              <div
                onClick={handleToggleJudge}
                style={{
                  width: '36px',
                  height: '20px',
                  borderRadius: '10px',
                  background: judgeEnabled ? 'var(--accent)' : 'var(--bg-subtle)',
                  border: `1px solid ${judgeEnabled ? 'var(--accent)' : 'var(--border-subtle)'}`,
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease, border-color 0.2s ease',
                  flexShrink: 0,
                }}
                title={judgeEnabled ? 'Nonaktifkan AI Judge' : 'Aktifkan AI Judge'}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: judgeEnabled ? '18px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                  }}
                />
              </div>
            </div>

            {/* When Judge is Enabled: Selector & Notes */}
            {judgeEnabled && (
              <div style={{
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <label style={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Model AI Judge (Evaluator):
                </label>
                <select
                  value={judgeModelId}
                  onChange={handleChangeJudgeModel}
                  style={{
                    background: 'var(--bg-base)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px 8px',
                    fontSize: '11px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="auto">Sama dengan model utama (Otomatis)</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.provider})
                    </option>
                  ))}
                </select>

                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '5px',
                  fontSize: '9.5px',
                  color: 'var(--text-tertiary)',
                  background: 'var(--bg-base)',
                  padding: '5px 7px',
                  borderRadius: 'var(--radius-sm)',
                  lineHeight: '1.3',
                }}>
                  <Sparkles size={11} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '1px' }} />
                  <span>
                    Judge akan memverifikasi hasil browser, DOM mutasi, dan screenshot terhadap tujuan pengguna sebelum sesi ditutup.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose} style={{ minWidth: '80px' }}>
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
