import React, { useState } from 'react';
import { Plus, Search, Pin, MessageSquare, Pencil, Trash2, Archive, Check, Sparkles, X } from 'lucide-react';
import { Session } from '../../types';

interface SessionsViewProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
  onAiAutoName?: (id: string) => Promise<string> | void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onAiAutoName,
  onTogglePin,
  onToggleArchive,
}) => {
  const [filter, setFilter] = useState<'active' | 'pinned' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [namingId, setNamingId] = useState<string | null>(null);

  const filteredSessions = sessions
    .filter((s) => {
      if (filter === 'archived') return Boolean(s.archived);
      if (filter === 'pinned') return Boolean(s.pinned && !s.archived);
      return !s.archived;
    })
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchTitle = s.name.toLowerCase().includes(q);
      const matchLast = s.messages.at(-1)?.text.toLowerCase().includes(q);
      return matchTitle || matchLast;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
    });

  const startRename = (s: Session) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const saveRename = (id: string) => {
    if (editName.trim()) {
      onRenameSession(id, editName.trim());
    }
    setEditingId(null);
  };

  const friendlyTime = (ts: number) => {
    const diff = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Workspace / Memory</div>
          <h1>Sessions</h1>
          <p className="page-subtitle">
            Pick up a thread, or start a clean workspace. Session messages, models, and executions are kept separate.
          </p>
        </div>
        <button className="btn primary" onClick={onNewSession}>
          <Plus size={14} /> New session
        </button>
      </div>

      <div className="toolbar" style={{ marginBottom: '14px' }}>
        <div className="searchbox">
          <Search size={14} />
          <input
            className="input"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="nav-tabs" style={{ margin: 0, border: 0 }}>
          <button
            className={`nav-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            All active
          </button>
          <button
            className={`nav-tab ${filter === 'pinned' ? 'active' : ''}`}
            onClick={() => setFilter('pinned')}
          >
            Pinned
          </button>
          <button
            className={`nav-tab ${filter === 'archived' ? 'active' : ''}`}
            onClick={() => setFilter('archived')}
          >
            Archived
          </button>
        </div>

        <span className="muted tiny" style={{ marginLeft: 'auto' }}>
          {filteredSessions.length} sessions
        </span>
      </div>

      <div className="session-list">
        {filteredSessions.length > 0 ? (
          filteredSessions.map((s) => {
            const isCurrent = s.id === activeSessionId;
            const lastMsg = s.messages.at(-1)?.text || 'No messages yet in this session.';
            const timeAgo = friendlyTime(s.updatedAt || s.createdAt);

            return (
              <div
                key={s.id}
                className={`session-item ${isCurrent ? 'current' : ''}`}
                onClick={() => onSelectSession(s.id)}
                title="Click to open session"
              >
                {/* Header Row: Title & Badges on Left, Actions on Right */}
                <div className="session-item-header">
                  {editingId === s.id ? (
                    <div
                      style={{ display: 'flex', gap: '5px', alignItems: 'center', width: '100%' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        className="input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(s.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        style={{ padding: '3px 7px', fontSize: '11px', flex: 1, minWidth: 0 }}
                      />
                      <button className="icon-btn" onClick={() => saveRename(s.id)} title="Save name">
                        <Check size={13} color="var(--green)" />
                      </button>
                      <button className="icon-btn" onClick={() => setEditingId(null)} title="Cancel">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="session-item-title-wrap">
                        <span className="session-item-icon">
                          {s.pinned ? <Pin size={13} color="var(--accent)" /> : <MessageSquare size={13} />}
                        </span>
                        <span className="session-item-title">{s.name}</span>
                        {s.pinned && (
                          <span style={{ color: 'var(--accent)', fontSize: '9.5px', flexShrink: 0 }}>
                            · Pinned
                          </span>
                        )}
                        {isCurrent && <span className="mini-badge">Current</span>}
                      </div>

                      <div className="session-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="icon-btn"
                          onClick={async () => {
                            if (!onAiAutoName || namingId) return;
                            setNamingId(s.id);
                            try {
                              await onAiAutoName(s.id);
                            } finally {
                              setNamingId(null);
                            }
                          }}
                          title="Auto-name session with AI"
                          disabled={namingId === s.id}
                        >
                          <Sparkles
                            size={13}
                            color="var(--accent)"
                            style={namingId === s.id ? { opacity: 0.5 } : undefined}
                          />
                        </button>

                        <button
                          className="icon-btn"
                          onClick={() => onTogglePin(s.id)}
                          title={s.pinned ? 'Unpin' : 'Pin to top'}
                        >
                          <Pin size={13} color={s.pinned ? 'var(--accent)' : 'currentColor'} />
                        </button>

                        <button
                          className="icon-btn"
                          onClick={() => startRename(s)}
                          title="Rename session"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          className="icon-btn"
                          onClick={() => onToggleArchive(s.id)}
                          title={s.archived ? 'Restore' : 'Archive'}
                        >
                          <Archive size={13} />
                        </button>

                        <button
                          className="icon-btn danger"
                          onClick={() => onDeleteSession(s.id)}
                          title="Delete session"
                        >
                          <Trash2 size={13} color="var(--red)" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Message Snippet: 1 clean full-width line */}
                <p className="session-item-snippet" title={lastMsg}>
                  {lastMsg}
                </p>

                {/* Meta Footer */}
                <div className="session-item-meta">
                  <span>{timeAgo}</span>
                  <span>·</span>
                  <span>{s.messages.length} messages</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="blank">
            <div className="blank-icon">
              <MessageSquare size={20} />
            </div>
            <strong>No matching sessions found</strong>
            <p>Try adjusting your search query or create a fresh workspace.</p>
            <button className="btn primary" onClick={onNewSession}>
              <Plus size={14} /> New session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
