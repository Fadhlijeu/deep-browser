import React, { useState } from 'react';
import { sidepanelStore } from '../../state/sidepanelStore';

interface ApiKeysModalProps {
  isOpen: boolean;
  apiKeys: Record<string, string>;
  onClose: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({ isOpen, apiKeys, onClose }) => {
  const [keys, setKeys] = useState({ ...apiKeys });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const providers = [
    { id: 'gemini', name: 'Google Gemini', placeholder: 'AIzaSy...' },
    { id: 'openai', name: 'OpenAI', placeholder: 'sk-proj-...' },
    { id: 'anthropic', name: 'Anthropic Claude', placeholder: 'sk-ant-api03-...' },
    { id: 'custom_openai', name: 'DeepSeek / Custom API Key', placeholder: 'sk-...' },
    { id: 'ollama', name: 'Ollama Host Endpoint', placeholder: 'http://localhost:11434' },
  ];

  const handleSave = () => {
    Object.entries(keys).forEach(([p, val]) => {
      sidepanelStore.setApiKey(p, val);
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--accent)' }}>key</span>
            <span className="modal-title">Kelola Kunci API</span>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            Kunci API disimpan secara lokal di storage browser Anda (`chrome.storage.local`) dan tidak pernah dikirim ke server pihak ketiga.
          </p>

          {providers.map((p) => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {p.name}
              </label>
              <input
                type={p.id === 'ollama' ? 'text' : 'password'}
                placeholder={p.placeholder}
                value={keys[p.id] || ''}
                onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                style={{
                  padding: '6px 8px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  outline: 'none',
                }}
              />
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn-primary" onClick={handleSave}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
              {saved ? 'check' : 'save'}
            </span>
            <span>{saved ? 'Tersimpan!' : 'Simpan Kunci'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
