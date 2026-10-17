import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Cpu,
  ArrowUp,
  Square,
  Bot,
  Search,
  Database,
  FileText,
  Eye,
  Paperclip,
  Video,
  Monitor,
  X,
} from 'lucide-react';
import { PRESET_OPTIONS, MODE_OPTIONS, sidepanelStore } from '../../state/sidepanelStore';
import { PresetId, ExecutionMode, ModelDef, StagedFile } from '../../types';
import { ProviderLogo } from '../common/ProviderLogo';

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
  selectedPreset,
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
  const presetScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPresetLeft, setCanScrollPresetLeft] = useState(false);
  const [canScrollPresetRight, setCanScrollPresetRight] = useState(false);

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
  const modeIconColor = selectedMode === 'hitl' ? '#f59e0b' : (selectedMode === 'auto' ? '#10b981' : '#60a5fa');

  const checkPresetScroll = useCallback(() => {
    if (presetScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = presetScrollRef.current;
      setCanScrollPresetLeft(scrollLeft > 2);
      setCanScrollPresetRight(scrollLeft + clientWidth < scrollWidth - 2);
    }
  }, []);

  useEffect(() => {
    checkPresetScroll();
    const el = presetScrollRef.current;
    if (el) el.addEventListener('scroll', checkPresetScroll, { passive: true });
    window.addEventListener('resize', checkPresetScroll);
    return () => {
      if (el) el.removeEventListener('scroll', checkPresetScroll);
      window.removeEventListener('resize', checkPresetScroll);
    };
  }, [checkPresetScroll]);

  const slidePreset = (direction: 'left' | 'right') => {
    if (presetScrollRef.current) {
      const offset = direction === 'left' ? -120 : 120;
      presetScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkPresetScroll, 200);
    }
  };

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

  const renderPresetIcon = (id: PresetId) => {
    switch (id) {
      case 'research':
        return <Search size={12} style={{ flexShrink: 0 }} />;
      case 'data_extraction':
        return <Database size={12} style={{ flexShrink: 0 }} />;
      case 'form_filling':
        return <FileText size={12} style={{ flexShrink: 0 }} />;
      case 'read_only':
        return <Eye size={12} style={{ flexShrink: 0 }} />;
      case 'default':
      default:
        return <Bot size={12} style={{ flexShrink: 0 }} />;
    }
  };

  return (
    <div className="composer-dock">
      {/* Presets Slider Bar */}
      <div className="slider-container preset-slider-container">
        {canScrollPresetLeft && (
          <button
            className="slider-nav-btn slider-nav-left"
            onClick={() => slidePreset('left')}
            title="Scroll preset kiri"
            aria-label="Scroll preset kiri"
          >
            <ChevronLeft size={12} />
          </button>
        )}

        <div className="slider-track presets-bar" ref={presetScrollRef}>
          {PRESET_OPTIONS.map((p) => (
            <button
              key={p.id}
              className={`preset-chip ${selectedPreset === p.id ? 'active' : ''}`}
              onClick={() => sidepanelStore.setSelectedPreset(p.id)}
              title={`Mode Preset: ${p.name}`}
            >
              {renderPresetIcon(p.id)}
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        {canScrollPresetRight && (
          <button
            className="slider-nav-btn slider-nav-right"
            onClick={() => slidePreset('right')}
            title="Scroll preset kanan"
            aria-label="Scroll preset kanan"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* Staged Attachments Row */}
      {stagedFiles && stagedFiles.length > 0 && (
        <div className="staged-files-row">
          {stagedFiles.map((file) => (
            <div key={file.id} className="staged-file-chip" title={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}>
              <Paperclip size={11} style={{ flexShrink: 0, opacity: 0.7 }} />
              <span className="chip-name">{file.name}</span>
              <span className="chip-size">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                className="chip-remove-btn"
                onClick={() => sidepanelStore.removeStagedFile(file.id)}
                title="Hapus lampiran"
              >
                <X size={10} />
              </button>
            </div>
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

      {/* Input Field */}
      <div className="composer-input-wrap">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder="Perintahkan agen (contoh: Buka portal X lalu cari data Y)..."
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
            type="button"
            className="pill-selector-btn"
            onClick={onOpenModels}
            title={`Model Aktif: ${selectedModel.name} (${selectedModel.provider})`}
          >
            <ProviderLogo provider={selectedModel.provider} size={13} />
            <span className="truncate">{selectedModel.name}</span>
          </button>

          {/* Mode / Decide Selector Pill */}
          <div className="mode-selector-wrap" ref={modeMenuRef}>
            <button
              type="button"
              className="pill-selector-btn mode-pill-btn"
              onClick={() => setIsModeOpen((prev) => !prev)}
              title={`Mode Otonomi: ${currentModeOpt.name} (Klik untuk mengganti mode)`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px', color: modeIconColor }}>
                {currentModeOpt.icon}
              </span>
              <span className="truncate">{currentModeOpt.name}</span>
              <ChevronDown size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
            </button>

            {isModeOpen && (
              <div className="mode-popover-menu">
                <div className="mode-popover-header">Mode Eksekusi Agen</div>
                {MODE_OPTIONS.map((m) => {
                  const isActive = (selectedMode || 'agent_decide') === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`mode-popover-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        sidepanelStore.setMode(m.id);
                        setIsModeOpen(false);
                      }}
                    >
                      <span className="material-symbols-outlined mode-item-icon">
                        {m.icon}
                      </span>
                      <div className="mode-item-details">
                        <div className="mode-item-title">{m.name}</div>
                        <div className="mode-item-desc">{m.desc}</div>
                      </div>
                      {isActive && <Check size={13} className="mode-item-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attach File Button */}
          <button
            type="button"
            className={`composer-tool-btn ${stagedFiles.length > 0 ? 'active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            title={stagedFiles.length > 0 ? `${stagedFiles.length} berkas terlampir` : 'Lampirkan Berkas untuk Upload'}
          >
            <Paperclip size={13} />
          </button>

          {/* Session Video Recording Toggle */}
          <button
            type="button"
            className={`composer-tool-btn ${isRecordingEnabled ? 'active recording' : ''}`}
            onClick={() => sidepanelStore.toggleRecording()}
            title={isRecordingEnabled ? 'Perekam Video: AKTIF (Merekam saat jalan)' : 'Aktifkan Perekaman Video Tab'}
          >
            <Video size={13} />
          </button>

          {/* In-Page Demo HUD Toggle */}
          <button
            type="button"
            className={`composer-tool-btn ${isHudEnabled ? 'active' : ''}`}
            onClick={() => sidepanelStore.toggleDemoHud()}
            title={isHudEnabled ? 'In-Page Demo HUD: AKTIF di Halaman' : 'Tampilkan Floating Demo HUD di Halaman Web'}
          >
            <Monitor size={13} />
          </button>
        </div>

        {/* Action Button */}
        <button
          className={`send-btn ${runState === 'running' ? 'stop' : ''}`}
          onClick={handleSubmit}
          disabled={runState !== 'running' && !text.trim()}
          title={runState === 'running' ? 'Hentikan Eksekusi' : 'Kirim Perintah'}
        >
          {runState === 'running' ? (
            <Square size={13} fill="currentColor" />
          ) : (
            <ArrowUp size={15} strokeWidth={2.4} />
          )}
        </button>
      </div>
    </div>
  );
};

