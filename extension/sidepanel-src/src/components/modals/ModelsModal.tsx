import React from 'react';
import { ModelDef } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface ModelsModalProps {
  isOpen: boolean;
  models: ModelDef[];
  selectedModelId: string;
  onClose: () => void;
}

export const ModelsModal: React.FC<ModelsModalProps> = ({
  isOpen,
  models,
  selectedModelId,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleSelect = (modelId: string) => {
    sidepanelStore.setSelectedModel(modelId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent)' }}>smart_toy</span>
            <span className="modal-title">Pilih Model AI</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '320px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {models.map((m) => {
              const isSelected = selectedModelId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
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
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--accent)' }}>
                      check
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
};
