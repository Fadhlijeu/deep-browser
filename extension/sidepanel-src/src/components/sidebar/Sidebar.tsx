import { 
  X, 
  Plus, 
  Trash2, 
  Folder, 
  ExternalLink, 
  Settings, 
  Eye, 
} from 'lucide-react';
import { Session } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isDetached: boolean;
  sessions: Session[];
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClearActiveSession: () => void;
  onOpenSettings: () => void;
  onToggleDetach: () => void;
  indexLabelingEnabled: boolean;
  onToggleIndexLabeling: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  isDetached,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onClearActiveSession,
  onOpenSettings,
  onToggleDetach,
  indexLabelingEnabled,
  onToggleIndexLabeling,
}) => {
  if (!isOpen) return null;

  return (
    <div className="sidebar-overlay-container">
      {/* Dark backdrop overlay */}
      <div className="sidebar-backdrop" onClick={onClose} />

      {/* Slide-in Sidebar Panel on Top Layer */}
      <aside className="sidebar-panel">
        {/* Header: Large Editorial Title (No Icon) & Close */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <h1 className="sidebar-title-large">Deep Browser</h1>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup Menu">
            <X size={16} />
          </button>
        </div>

        {/* Primary New Session Button (Exclusive to Sidebar) */}
        <div className="sidebar-primary-action">
          <button 
            className="sidebar-primary-new-btn"
            onClick={() => {
              onNewSession();
              onClose();
            }}
            title="Mulai Sesi Baru"
          >
            <Plus size={14} />
            <span>Sesi Baru</span>
          </button>
        </div>

        {/* Session Management (Clean List, No Tree) */}
        <div className="sidebar-sessions-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Riwayat Sesi</span>
            <span className="sidebar-count-mono">{sessions.length} sesi</span>
          </div>

          <div className="sidebar-sessions-list">
            {sessions.map((s) => {
              const isActive = String(s.id) === String(activeSessionId);
              return (
                <div
                  key={s.id}
                  className={`sidebar-session-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    onSwitchSession(s.id);
                    onClose();
                  }}
                >
                  <div className="sidebar-session-left truncate">
                    <Folder size={13} className="sidebar-session-icon" />
                    <span className="sidebar-session-name truncate">{s.name}</span>
                  </div>
                  <div className="sidebar-session-actions">
                    <span className="sidebar-session-date">
                      {new Date(s.createdAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}
                    </span>
                    <button
                      className="sidebar-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      title="Hapus Sesi"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Utility Controls */}
        <div className="sidebar-footer">
          <div className="sidebar-actions-grid">
            <button 
              className="sidebar-action-btn"
              onClick={onToggleDetach} 
              title={isDetached ? 'Kaitkan Kembali' : 'Buka Pop-Out Terpisah'}
            >
              <ExternalLink size={12} />
              <span>{isDetached ? 'Attach' : 'Pop Out'}</span>
            </button>
            <button 
              className="sidebar-icon-action" 
              onClick={onOpenSettings} 
              title="Pengaturan & Mode Engine"
            >
              <Settings size={13} />
            </button>
            <button 
              className={`sidebar-icon-action ${indexLabelingEnabled ? 'active' : ''}`} 
              onClick={onToggleIndexLabeling} 
              title={indexLabelingEnabled ? 'Nonaktifkan Label Indeks Elemen' : 'Aktifkan Label Indeks Elemen'}
            >
              <Eye size={13} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};
