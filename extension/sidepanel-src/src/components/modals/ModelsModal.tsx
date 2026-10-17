import React from 'react';
import { Scale, Bot, Check, X, Sparkles } from 'lucide-react';
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

export const ModelsModal: React.FC<ModelsModalProps> = ({
  isOpen,
  models,
  selectedModelId,
  judgeEnabled = false,
  judgeModelId = 'auto',
  onClose,
}) => {
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
        <div className="modal-body" style={{ maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Section 1: Main Agent Model */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Model Utama Agen
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {models.length} model terdaftar
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {models.map((m) => {
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
                      background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-base)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '15px', color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                        {m.icon}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                          {m.provider}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={15} style={{ color: 'var(--accent)' }} />
                    )}
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
