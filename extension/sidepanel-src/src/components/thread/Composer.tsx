import React, { useState, useRef, useEffect } from 'react';
import { PRESET_OPTIONS, MODE_OPTIONS, sidepanelStore } from '../../state/sidepanelStore';
import { PresetId, ExecutionMode, ModelDef } from '../../types';

interface ComposerProps {
  runState: string;
  selectedPreset: PresetId;
  selectedMode: ExecutionMode;
  selectedModel: ModelDef;
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenModels: () => void;
  onOpenSettings: () => void;
  initialPrompt?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  runState,
  selectedPreset,
  selectedMode,
  selectedModel,
  onSend,
  onCancel,
  onOpenModels,
  onOpenSettings,
  initialPrompt = '',
}) => {
  const [text, setText] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setText(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (runState === 'running') {
      onCancel();
      return;
    }
    if (!text.trim()) return;
    onSend(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const currentModeDef = MODE_OPTIONS.find((m) => m.id === selectedMode) || MODE_OPTIONS[0];

  return (
    <div className="composer-dock">
      {/* Presets Bar */}
      <div className="presets-bar">
        {PRESET_OPTIONS.map((p) => (
          <button
            key={p.id}
            className={`preset-chip ${selectedPreset === p.id ? 'active' : ''}`}
            onClick={() => sidepanelStore.setSelectedPreset(p.id)}
            title={`Mode Preset: ${p.name}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>

      {/* Input Field */}
      <div className="composer-input-wrap">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Perintahkan agent (contoh: Cari data di PDDIKTI)..."
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
        />
      </div>

      {/* Footer Controls */}
      <div className="composer-footer">
        <div className="footer-left">
          {/* Model Selector Pill */}
          <button
            className="pill-selector-btn"
            onClick={onOpenModels}
            title={`Model Aktif: ${selectedModel.name}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--accent)' }}>
              {selectedModel.icon}
            </span>
            <span>{selectedModel.name}</span>
          </button>

          {/* Mode Selector Pill */}
          <button
            className="pill-selector-btn"
            onClick={onOpenSettings}
            title={`Mode Eksekusi: ${currentModeDef.name}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--status-warning)' }}>
              {currentModeDef.icon}
            </span>
            <span>{currentModeDef.name}</span>
          </button>
        </div>

        {/* Action Button */}
        <button
          className={`send-btn ${runState === 'running' ? 'stop' : ''}`}
          onClick={handleSubmit}
          disabled={runState !== 'running' && !text.trim()}
          title={runState === 'running' ? 'Hentikan Eksekusi' : 'Kirim Perintah'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
            {runState === 'running' ? 'stop' : 'arrow_upward'}
          </span>
        </button>
      </div>
    </div>
  );
};
