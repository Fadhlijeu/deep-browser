import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquare, Layers, Activity, Blocks, CalendarClock, Settings2, Cpu, ArrowRight } from 'lucide-react';
import { ViewType, ModelDef, Session } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSetView: (v: ViewType) => void;
  onSelectModel: (id: string) => void;
  onSelectSession: (id: string) => void;
  models: ModelDef[];
  sessions: Session[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSetView,
  onSelectModel,
  onSelectSession,
  models,
  sessions,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open in parent
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const pages: { id: ViewType; label: string; icon: any }[] = [
    { id: 'chat', label: 'Go to Chat', icon: MessageSquare },
    { id: 'sessions', label: 'Go to Sessions', icon: Layers },
    { id: 'activity', label: 'Go to Activity & Runs', icon: Activity },
    { id: 'tools', label: 'Go to Tools Catalog', icon: Blocks },
    { id: 'automations', label: 'Go to Automations & Skills', icon: CalendarClock },
    { id: 'settings', label: 'Go to Settings', icon: Settings2 },
  ];

  const matchedPages = pages.filter((p) => !q || p.label.toLowerCase().includes(q));
  const matchedModels = models.filter((m) => !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q));
  const matchedSessions = sessions.filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: '520px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <Search size={16} color="var(--muted)" />
          <input
            ref={inputRef}
            className="input"
            style={{ border: 0, padding: 0, fontSize: '13px', background: 'transparent', outline: 'none', boxShadow: 'none' }}
            placeholder="Type a command, model, or search sessions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="close-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div style={{ maxHeight: '380px', overflow: 'auto', padding: '10px' }}>
          {/* Quick Views */}
          {matchedPages.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="info-label" style={{ padding: '4px 8px', marginBottom: '4px' }}>Navigation</div>
              {matchedPages.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    className="nav-btn"
                    onClick={() => {
                      onSetView(p.id);
                      onClose();
                    }}
                    style={{ padding: '8px 10px', fontSize: '11px' }}
                  >
                    <Icon size={14} />
                    <span>{p.label}</span>
                    <ArrowRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                  </button>
                );
              })}
            </div>
          )}

          {/* Models */}
          {matchedModels.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div className="info-label" style={{ padding: '4px 8px', marginBottom: '4px' }}>Switch AI Model</div>
              {matchedModels.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  className="nav-btn"
                  onClick={() => {
                    onSelectModel(m.id);
                    onClose();
                  }}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  <Cpu size={14} />
                  <span>{m.name}</span>
                  <span className="pill" style={{ marginLeft: 'auto', fontSize: '8px' }}>{m.provider}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sessions */}
          {matchedSessions.length > 0 && (
            <div>
              <div className="info-label" style={{ padding: '4px 8px', marginBottom: '4px' }}>Jump to Session</div>
              {matchedSessions.slice(0, 5).map((s) => (
                <button
                  key={s.id}
                  className="nav-btn"
                  onClick={() => {
                    onSelectSession(s.id);
                    onSetView('chat');
                    onClose();
                  }}
                  style={{ padding: '8px 10px', fontSize: '11px' }}
                >
                  <MessageSquare size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                    {s.messages.length} msgs
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchedPages.length === 0 && matchedModels.length === 0 && matchedSessions.length === 0 && (
            <div className="empty-inline" style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
              No matching commands or resources found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
