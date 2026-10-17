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

  // Execution mode dropdown state
  const [isModeOpen, setIsModeOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeOpen(false);
      }
    };
    if (isModeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModeOpen]);

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

  return (
    <div className="composer-area">
      <div className="composer-wrap">
        {/* Staged Attachments Row */}
        {stagedFiles.length > 0 && (
          <div className="toolbar" style={{ marginBottom: '7px' }}>
            {stagedFiles.map((file) => (
              <span key={file.id} className="pill" title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}>
                <FileText size={11} />
                <span>{file.name}</span>
                <button
                  type="button"
                  style={{ border: 0, background: 'none', padding: '0 0 0 4px', color: 'var(--muted)', cursor: 'pointer' }}
                  onClick={() => sidepanelStore.removeStagedFile(file.id)}
                  aria-label="Remove attachment"
                >
                  <X size={10} />
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

        {/* The Main Composer Box */}
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
              <Paperclip size={13} />
              <span>Attach</span>
            </button>

            {/* Model Pill Button */}
            <button
              type="button"
              className="composer-btn model"
              onClick={onOpenModels}
              title={`Active Model: ${selectedModel.name}`}
            >
              <Cpu size={13} />
              <span>{selectedModel.name}</span>
              <ChevronDown size={11} />
            </button>

            {/* Mode Pill Dropdown */}
            <div style={{ position: 'relative' }} ref={modeMenuRef}>
              <button
                type="button"
                className="composer-btn mode"
                onClick={() => setIsModeOpen((prev) => !prev)}
                title={`Execution Mode: ${currentModeOpt.name}`}
              >
                <ShieldCheck size={13} />
                <span>{currentModeOpt.name}</span>
                <ChevronDown size={11} />
              </button>

              {isModeOpen && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '8px',
                    width: '240px',
                    background: 'var(--paper)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow)',
                    padding: '6px',
                    zIndex: 50,
                  }}
                >
                  <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '6px 8px 4px' }}>
                    Agent Execution Mode
                  </div>
                  {MODE_OPTIONS.map((m) => {
                    const isActive = selectedMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          sidepanelStore.setMode(m.id);
                          setIsModeOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px',
                          borderRadius: '6px',
                          border: 0,
                          background: isActive ? 'var(--line)' : 'transparent',
                          color: 'var(--ink)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 650 }}>{m.name}</div>
                          <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '2px' }}>{m.desc}</div>
                        </div>
                        {isActive && <Check size={13} color="var(--accent)" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Session Video Recording Toggle */}
            <button
              type="button"
              className={`composer-btn ${isRecordingEnabled ? 'active' : ''}`}
              onClick={() => sidepanelStore.toggleRecording()}
              title={isRecordingEnabled ? 'Session recording active (captures tab video)' : 'Enable native video session recording'}
            >
              <Video size={13} />
              {isRecordingEnabled && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)' }} />}
            </button>

            {/* In-Page Demo HUD Toggle */}
            <button
              type="button"
              className={`composer-btn ${isHudEnabled ? 'active' : ''}`}
              onClick={() => sidepanelStore.toggleDemoHud()}
              title={isHudEnabled ? 'In-page floating HUD active' : 'Toggle in-page floating HUD'}
            >
              <Monitor size={13} />
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
                <Square size={13} fill="currentColor" />
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
                <ArrowUp size={15} />
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
