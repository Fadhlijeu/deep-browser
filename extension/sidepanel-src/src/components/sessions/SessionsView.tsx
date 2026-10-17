import React, { useState } from 'react';
import { Plus, Search, Pin, MessageSquare, Pencil, Trash2, Archive, Check } from 'lucide-react';
import { Session } from '../../types';

interface SessionsViewProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, name: string) => void;
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
  onTogglePin,
  onToggleArchive,
}) => {
  const [filter, setFilter] = useState<'active' | 'pinned' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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
              <div key={s.id} className={`session-item ${isCurrent ? 'current' : ''}`}>
                <div className="session-initial">
                  {s.pinned ? <Pin size={16} /> : <MessageSquare size={16} />}
                </div>

                <div className="session-info">
                  {editingId === s.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        className="input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveRename(s.id)}
                        autoFocus
                        style={{ padding: '4px 8px', fontSize: '11px', width: '220px' }}
                      />
                      <button className="btn small primary" onClick={() => saveRename(s.id)}>
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <strong>
                      {s.name}
                      {s.pinned && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· Pinned</span>}
                      {isCurrent && <span className="mini-badge" style={{ marginLeft: 6 }}>Current</span>}
                    </strong>
                  )}

                  <p title={lastMsg}>{lastMsg}</p>

                  <div className="session-meta">
                    <span>{timeAgo}</span>
                    <span>·</span>
                    <span>{s.messages.length} messages</span>
                  </div>
                </div>

                <button className="btn small" onClick={() => onSelectSession(s.id)}>
                  Open
                </button>

                <div className="row-actions">
                  <button
                    className="icon-btn"
                    onClick={() => onTogglePin(s.id)}
                    title={s.pinned ? 'Unpin' : 'Pin to top'}
                  >
                    <Pin size={14} color={s.pinned ? 'var(--accent)' : 'currentColor'} />
                  </button>

                  <button
                    className="icon-btn"
                    onClick={() => startRename(s)}
                    title="Rename session"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    className="icon-btn"
                    onClick={() => onToggleArchive(s.id)}
                    title={s.archived ? 'Restore' : 'Archive'}
                  >
                    <Archive size={14} />
                  </button>

                  <button
                    className="icon-btn"
                    onClick={() => onDeleteSession(s.id)}
                    title="Delete session"
                  >
                    <Trash2 size={14} color="var(--red)" />
                  </button>
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
