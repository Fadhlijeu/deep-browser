import React, { useState } from 'react';
import { LogEvent } from '../../types';

interface LogsViewProps {
  events: LogEvent[];
  filter: 'all' | 'tools' | 'approvals' | 'errors' | 'verifications';
  search: string;
  onSetFilter: (f: 'all' | 'tools' | 'approvals' | 'errors' | 'verifications') => void;
  onSetSearch: (s: string) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({
  events,
  filter,
  search,
  onSetFilter,
  onSetSearch,
}) => {
  const [copied, setCopied] = useState(false);

  const filteredEvents = events.filter((e) => {
    if (filter !== 'all' && e.category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const msgMatch = e.message.toLowerCase().includes(q);
      const typeMatch = e.type.toLowerCase().includes(q);
      return msgMatch || typeMatch;
    }
    return true;
  });

  const copyAll = () => {
    navigator.clipboard?.writeText?.(JSON.stringify(events, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '3px 6px', gap: '5px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>search</span>
          <input
            type="text"
            placeholder="Cari event, tool, atau argumen..."
            value={search}
            onChange={(e) => onSetSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '11px', outline: 'none', width: '100%' }}
          />
          {search && (
            <button className="icon-btn" onClick={() => onSetSearch('')} style={{ width: '16px', height: '16px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>close</span>
            </button>
          )}
        </div>
        <button className="btn-ghost" onClick={copyAll} title="Salin Semua Log">
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
            {copied ? 'check' : 'content_copy'}
          </span>
          <span style={{ fontSize: '10.5px' }}>{copied ? 'Tersalin' : 'Salin'}</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px 8px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto' }}>
        {(['all', 'tools', 'approvals', 'errors', 'verifications'] as const).map((cat) => (
          <button
            key={cat}
            className={`preset-chip ${filter === cat ? 'active' : ''}`}
            onClick={() => onSetFilter(cat)}
            style={{ textTransform: 'capitalize' }}
          >
            {cat === 'all' ? 'Semua' : cat}
          </button>
        ))}
      </div>

      {/* Logs List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {filteredEvents.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11.5px', padding: '24px' }}>
            Belum ada log rekaman pada filter ini.
          </div>
        ) : (
          filteredEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-tertiary)', fontSize: '9.5px', marginBottom: '2px' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{evt.type}</span>
                <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
              </div>
              <div style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{evt.message}</div>
              {evt.payload && Object.keys(evt.payload).length > 0 && (
                <details style={{ marginTop: '4px' }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '9.5px' }}>Payload</summary>
                  <pre style={{ margin: '3px 0 0', padding: '4px', background: 'var(--bg-base)', borderRadius: '3px', fontSize: '9.5px', overflowX: 'auto' }}>
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
