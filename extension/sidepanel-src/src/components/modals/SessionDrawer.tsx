import React from 'react';
import { Session } from '../../types';

interface SessionDrawerProps {
  isOpen: boolean;
  sessions: Session[];
  activeSessionId: string;
  onClose: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onCreateNewSession: () => void;
  onClearActiveSession: () => void;
}

export const SessionDrawer: React.FC<SessionDrawerProps> = ({
  isOpen,
  sessions,
  activeSessionId,
  onClose,
  onSwitchSession,
  onDeleteSession,
  onCreateNewSession,
  onClearActiveSession,
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel">
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>folder</span>
            <span style={{ fontWeight: 600, fontSize: '12.5px' }}>Riwayat Sesi</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="drawer-body">
          {sessions.map((s) => {
            const isActive = String(s.id) === String(activeSessionId);
            return (
              <div
                key={s.id}
                className={`session-item ${isActive ? 'active' : ''}`}
                onClick={() => onSwitchSession(s.id)}
              >
                <div className="session-item-info">
                  <div className="session-item-name">{s.name}</div>
                  <div className="session-item-date">
                    {new Date(s.createdAt).toLocaleDateString('id-ID')}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(s.id);
                  }}
                  title={sessions.length > 1 ? 'Hapus Sesi' : 'Reset Sesi'}
                  style={{ color: 'var(--status-error)', width: '22px', height: '22px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete</span>
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button className="btn-secondary" onClick={onCreateNewSession} style={{ width: '100%', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>add</span>
            Buat Sesi Baru
          </button>
          <button
            className="btn-ghost"
            onClick={onClearActiveSession}
            style={{ width: '100%', justifyContent: 'center', color: 'var(--status-error)', fontSize: '11px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>delete_sweep</span>
            Bersihkan Sesi Ini
          </button>
        </div>
      </div>
    </>
  );
};
