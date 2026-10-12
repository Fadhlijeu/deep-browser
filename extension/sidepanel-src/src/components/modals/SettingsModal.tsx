import React from 'react';
import { MODE_OPTIONS, sidepanelStore } from '../../state/sidepanelStore';
import { ExecutionMode } from '../../types';

interface SettingsModalProps {
  isOpen: boolean;
  selectedMode: ExecutionMode;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, selectedMode, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--status-warning)' }}>tune</span>
            <span className="modal-title">Mode & Kebijakan Eksekusi</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
            Tentukan tingkat otonomi agen ketika mengeksekusi navigasi dan interaksi formulir di browser.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {MODE_OPTIONS.map((m) => {
              const isSelected = selectedMode === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => sidepanelStore.setSelectedMode(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-base)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)', marginTop: '2px' }}>
                    {m.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.35 }}>
                      {m.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidepanel Integration Settings */}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Sidepanel & Jendela Melayang
            </div>

            <div
              onClick={() => sidepanelStore.toggleSidepanelEnabled()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                marginBottom: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: '11.5px', color: 'var(--text-primary)' }}>
                  Integrasi Sidepanel Otomatis
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                  {sidepanelStore.getState().sidepanelEnabled ? 'Aktif (Membuka di side panel browser)' : 'Nonaktif (Hanya gunakan jendela melayang/popup)'}
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: sidepanelStore.getState().sidepanelEnabled ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
                {sidepanelStore.getState().sidepanelEnabled ? 'toggle_on' : 'toggle_off'}
              </span>
            </div>

            <button
              className="btn-secondary"
              onClick={() => {
                sidepanelStore.toggleDetach();
                onClose();
              }}
              style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                {sidepanelStore.getState().isDetached ? 'dock_to_right' : 'open_in_new'}
              </span>
              <span>{sidepanelStore.getState().isDetached ? 'Pasang Kembali ke Sidepanel' : 'Lepas ke Jendela Melayang (Pop Out)'}</span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
};
