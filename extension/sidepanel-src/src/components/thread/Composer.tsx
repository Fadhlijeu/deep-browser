import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Cpu,
  ArrowUp,
  Square,
  Bot,
  Search,
  Database,
  FileText,
  Eye,
} from 'lucide-react';
import { PRESET_OPTIONS, sidepanelStore } from '../../state/sidepanelStore';
import { PresetId, ExecutionMode, ModelDef } from '../../types';

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
  selectedModel,
  onSend,
  onCancel,
  onOpenModels,
  initialPrompt = '',
}) => {
  const [text, setText] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const presetScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollPresetLeft, setCanScrollPresetLeft] = useState(false);
  const [canScrollPresetRight, setCanScrollPresetRight] = useState(false);

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
            className="pill-selector-btn"
            onClick={onOpenModels}
            title={`Model Aktif: ${selectedModel.name}`}
          >
            <Cpu size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>{selectedModel.name}</span>
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

