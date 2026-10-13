import React from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Folder, 
  ExternalLink, 
  Settings, 
  Key, 
  Eye, 
  MessageSquare, 
  Terminal, 
  Laptop, 
  Wifi, 
  Radio
} from 'lucide-react';
import { Session, ViewType, ConnectionStatus, RunState } from '../../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  runState: RunState;
  connectionStatus: ConnectionStatus;
  isDetached: boolean;
  stepCount?: { current: number; max: number };
  currentView: ViewType;
  logsCount: number;
  sessions: Session[];
  activeSessionId: string;
  onSetView: (v: ViewType) => void;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onClearActiveSession: () => void;
  onOpenApikeys: () => void;
  onOpenSettings: () => void;
  onReconnect: () => void;
  onToggleOnline: () => void;
  onToggleDetach: () => void;
  indexLabelingEnabled: boolean;
  onToggleIndexLabeling: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  runState,
  connectionStatus,
  isDetached,
  stepCount,
  currentView,
  logsCount,
  sessions,
  activeSessionId,
  onSetView,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onClearActiveSession,
  onOpenApikeys,
  onOpenSettings,
  onReconnect,
  onToggleOnline,
  onToggleDetach,
  indexLabelingEnabled,
  onToggleIndexLabeling,
}) => {
  if (!isOpen) return null;

  const isOnline = connectionStatus.connected;
  const isExecuting = runState === 'running';

  return (
    <div className="sidebar-overlay-container">
      {/* Dark backdrop overlay */}
      <div className="sidebar-backdrop" onClick={onClose} />

      {/* Slide-in Sidebar Panel on Top Layer */}
      <aside className="sidebar-panel">
        {/* Header: Brand & Close */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">D</div>
            <div>
              <h1 className="sidebar-title">Deep Browser</h1>
              <p className="sidebar-subtitle">Autonomous Web Copilot</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Tutup Menu">
            <X size={15} />
          </button>
        </div>

        {/* Status & Connection Pill */}
        <div className="sidebar-status-card">
          <div className="sidebar-status-row">
            <button 
              className="sidebar-conn-btn" 
              onClick={onToggleOnline} 
              title="Beralih Mode Online / Mandiri"
            >
              <span className={`sidebar-conn-dot ${isOnline ? 'online' : 'offline'}`} />
              <span className="sidebar-conn-text">
                {isOnline ? 'In-Browser Mandiri' : 'Daemon Offline'}
              </span>
            </button>
            <span className="sidebar-badge-mono">
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="sidebar-target-row">
            <span className="truncate">Target: Tab Aktif Web</span>
            <span className="sidebar-mono-port">CDP:9222</span>
          </div>

          {/* Step counter when executing */}
          {isExecuting && (
            <div className="sidebar-step-card">
              <span className="sidebar-step-pulse">
                <span className="sidebar-step-dot" />
                <span>Langkah Otonom</span>
              </span>
              <span className="sidebar-step-num">
                {stepCount ? `${stepCount.current} / ${stepCount.max}` : 'Menjalankan...'}
              </span>
            </div>
          )}
        </div>

        {/* View Switcher: Chat vs Logs */}
        <div className="sidebar-view-switcher">
          <button
            className={`sidebar-view-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => {
              onSetView('chat');
              onClose();
            }}
          >
            <MessageSquare size={13} />
            <span>Chat</span>
          </button>
          <button
            className={`sidebar-view-btn ${currentView === 'logs' ? 'active' : ''}`}
            onClick={() => {
              onSetView('logs');
              onClose();
            }}
          >
            <Terminal size={13} />
            <span>Logs</span>
            <span className="sidebar-badge-count">{logsCount}</span>
          </button>
        </div>

        {/* Session Management (Clean List, No Tree!) */}
        <div className="sidebar-sessions-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Riwayat Sesi</span>
            <button 
              className="sidebar-new-btn" 
              onClick={() => {
                onNewSession();
                onClose();
              }}
              title="Buat Sesi Baru"
            >
              <Plus size={11} />
              <span>Sesi Baru</span>
            </button>
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
                    <Folder size={12} className="sidebar-session-icon" />
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
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Utility Controls */}
        <div className="sidebar-footer">
          <div className="sidebar-mode-policy">
            <span className="sidebar-policy-label">Mode Eksekusi:</span>
            <span className="sidebar-policy-val">Agent Decide</span>
          </div>

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
              className="sidebar-icon-action" 
              onClick={onOpenApikeys} 
              title="Kunci API"
            >
              <Key size={13} />
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
