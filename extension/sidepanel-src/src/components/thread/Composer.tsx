import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paperclip,
  Cpu,
  ShieldCheck,
  ChevronDown,
  Check,
  ArrowUp,
  Square,
  Video,
  Monitor,
  X,
  FileText
} from 'lucide-react';
import { MODE_OPTIONS, sidepanelStore } from '../../state/sidepanelStore';
import { PresetId, ExecutionMode, ModelDef, StagedFile } from '../../types';

interface ComposerProps {
  runState: string;
  selectedPreset: PresetId;
  selectedMode?: ExecutionMode;
  selectedModel: ModelDef;
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenModels: () => void;
  onOpenMode?: () => void;
  onOpenSettings: () => void;
  initialPrompt?: string;
}

export const Composer: React.FC<ComposerProps> = ({
  runState,
  selectedMode = 'agent_decide',
  selectedModel,
  onSend,
  onCancel,
  onOpenModels,
  onOpenMode,
  initialPrompt = '',
}) => {
  const [text, setText] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store sync for staged files, recording, and HUD
  const [storeState, setStoreState] = useState(() => sidepanelStore.getState());
  useEffect(() => {
    return sidepanelStore.subscribe(() => {
      setStoreState({ ...sidepanelStore.getState() });
    });
  }, []);

  const stagedFiles = storeState.stagedFiles || [];
  const isRecordingEnabled = storeState.isRecordingEnabled || false;
  const isHudEnabled = storeState.isHudEnabled || false;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        sidepanelStore.addStagedFile({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: reader.result as string,
          base64: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  const currentModeOpt = MODE_OPTIONS.find((m) => m.id === selectedMode) || MODE_OPTIONS[0];

  useEffect(() => {
    if (initialPrompt) {
      setText(initialPrompt);
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
    }
  }, [initialPrompt]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSubmit = useCallback(() => {
    if (runState === 'running') {
      onCancel();
      return;
    }
    if (!text.trim()) return;
    const promptToSend = text;
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSend(promptToSend);
  }, [runState, text, onSend, onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Short names for space efficiency in compact sidepanel
  const shortModelName = selectedModel.name
    .replace('Gemini ', '')
    .replace('Claude ', '')
    .replace('GPT-', '');

  const shortModeName = selectedMode === 'agent_decide'
    ? 'Auto'
    : selectedMode === 'hitl'
    ? 'Review'
    : 'Proceed';

  return (
    <div className="composer-area">
      <div className="composer-wrap">
        {/* Staged Attachments Row */}
        {stagedFiles.length > 0 && (
          <div className="toolbar" style={{ marginBottom: '5px' }}>
            {stagedFiles.map((file) => (
              <span key={file.id} className="pill" title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}>
                <FileText size={10} />
                <span>{file.name}</span>
                <button
                  type="button"
                  style={{ border: 0, background: 'none', padding: '0 0 0 4px', color: 'var(--muted)', cursor: 'pointer' }}
                  onClick={() => sidepanelStore.removeStagedFile(file.id)}
                  aria-label="Remove attachment"
                >
                  <X size={9} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* The Main Compact Composer Box */}
        <div className="composer">
          <textarea
            ref={textareaRef}
            aria-label="Message"
            rows={1}
            placeholder="Message Deep Browser Copilot…"
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={runState === 'running'}
          />

          <div className="composer-bottom">
            {/* Attach Button */}
            <button
              type="button"
              className={`composer-btn ${stagedFiles.length > 0 ? 'active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              title="Attach a file for automated upload"
            >
              <Paperclip size={12} />
              <span className="composer-btn-text">Attach</span>
            </button>

            {/* Model Pill Button */}
            <button
              type="button"
              className="composer-btn model"
              onClick={onOpenModels}
              title={`Active Model: ${selectedModel.name}`}
            >
              <Cpu size={12} />
              <span>{shortModelName}</span>
              <ChevronDown size={9} />
            </button>

            {/* Mode Pill Button (Opens Mode Modal matching prototype) */}
            <button
              type="button"
              className="composer-btn mode"
              onClick={() => (onOpenMode ? onOpenMode() : sidepanelStore.setModal('mode', true))}
              title={`Execution Mode: ${currentModeOpt.name}`}
            >
              <ShieldCheck size={12} />
              <span>{shortModeName}</span>
              <ChevronDown size={9} />
            </button>

            {/* Session Video Recording Toggle */}
            <button
              type="button"
              className={`composer-btn composer-icon-btn ${isRecordingEnabled ? 'active' : ''}`}
              onClick={() => sidepanelStore.toggleRecording()}
              title={isRecordingEnabled ? 'Session recording active (captures tab video)' : 'Enable native video session recording'}
            >
              <Video size={12} />
              {isRecordingEnabled && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--red)' }} />}
            </button>

            {/* In-Page Demo HUD Toggle */}
            <button
              type="button"
              className={`composer-btn composer-icon-btn ${isHudEnabled ? 'active' : ''}`}
              onClick={() => sidepanelStore.toggleDemoHud()}
              title={isHudEnabled ? 'In-page floating HUD active' : 'Toggle in-page floating HUD'}
            >
              <Monitor size={12} />
            </button>

            <span className="composer-spacer" />

            {/* Send / Stop Button */}
            {runState === 'running' ? (
              <button
                type="button"
                className="send-btn"
                onClick={onCancel}
                title="Cancel execution"
                style={{ background: 'var(--accent)' }}
              >
                <Square size={11} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                className="send-btn"
                onClick={handleSubmit}
                disabled={!text.trim()}
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Composer Footer Hints */}
        <div className="composer-foot">
          <span>
            <span className="kbd">↵</span> to send · <span className="kbd">Shift ↵</span> new line
          </span>
          <span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b9a7d', display: 'inline-block' }} />
            Direct CDP &amp; Browser-Use
          </span>
        </div>
      </div>
    </div>
  );
};
