import React from 'react';
import { RunState, ConnectionStatus } from '../../types';

interface TopbarProps {
  runState: RunState;
  connectionStatus: ConnectionStatus;
  isDetached: boolean;
  stepCount: number;
  currentView: 'chat' | 'logs';
  logsCount: number;
  indexLabelingEnabled?: boolean;
  onSetView: (v: 'chat' | 'logs') => void;
  onOpenDrawer: () => void;
  onNewSession: () => void;
  onOpenApikeys: () => void;
  onOpenSettings: () => void;
  onReconnect: () => void;
  onToggleOnline: () => void;
  onToggleDetach: () => void;
  onToggleIndexLabeling?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  runState,
  connectionStatus,
  isDetached,
  stepCount,
  currentView,
  logsCount,
  indexLabelingEnabled = true,
  onSetView,
  onOpenDrawer,
  onNewSession,
  onOpenApikeys,
  onOpenSettings,
  onReconnect,
  onToggleOnline,
  onToggleDetach,
  onToggleIndexLabeling,
}) => {
  const getBrowserIcon = () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    if (ua.includes('edg/')) {
      // Microsoft Edge SVG Logo
      return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 13.5C22 8.25 17.75 4 12.5 4C7.25 4 3 8.25 3 13.5C3 18.75 7.25 23 12.5 23C13.5 23 17 22.5 19 20C17 20 15 19 14.5 17.5C14 16 14.5 14.5 16 14C17.5 13.5 19.5 14 20.5 15.5C21.5 17 21 18.5 21 18.5C21.5 17 22 15.3 22 13.5Z" fill="#0078D7" />
          <path d="M12.5 4C14 4 19 5.5 20.5 10C19 9 17 8.5 15 9C12.5 9.6 11 11.5 11 14C11 16.5 12.5 18 14.5 18C13 19.5 10.5 20 8.5 19C5.5 17.5 4.5 14 5 11C5.5 7.5 8.5 4 12.5 4Z" fill="#00BCF2" />
          <path d="M12.5 23C8.5 23 5 20 4.5 16C5.5 18.5 8 20 11 20C14 20 16 18.5 17 17C15.5 17 14 16 13.5 14.5C13 13 14 11.5 15.5 11C13.5 11 11.5 12.5 11 14.5C10.5 16.5 11.5 18.5 13 19.5C10.5 21 7.5 20.5 6 19C7.5 21.5 10 23 12.5 23Z" fill="#00B294" />
        </svg>
      );
    }
    // Google Chrome SVG Logo
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#4285F4" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" fill="#4285F4" />
        <path d="M12 7.5H21.5" stroke="#EA4335" strokeWidth="2" />
        <path d="M8.1 14.25L3.35 6" stroke="#34A853" strokeWidth="2" />
        <path d="M15.9 14.25L11.15 22.5" stroke="#FBBC05" strokeWidth="2" />
      </svg>
    );
  };

  const getConnectionTitle = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Backend Daemon Terhubung (ws://127.0.0.1:7788) • Klik untuk beralih ke Mode In-Browser';
      case 'standalone':
        return 'Online (Mode In-Browser - Siap pakai tanpa backend) • Klik untuk hubungkan ke Backend Daemon';
      case 'reconnecting':
        return 'Sedang mencari Backend Daemon... • Klik untuk langsung Online Mandiri';
      case 'disconnected':
      default:
        return 'Backend Offline • Klik untuk LANGSUNG ONLINE di Browser (tanpa perlu backend)!';
    }
  };

  const getConnectionSymbol = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'lan';
      case 'standalone':
        return 'bolt';
      case 'reconnecting':
        return 'sync';
      case 'disconnected':
      default:
        return 'link_off';
    }
  };

  const getConnectionLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Daemon';
      case 'standalone':
        return 'Online';
      case 'reconnecting':
        return 'Connecting';
      case 'disconnected':
      default:
        return 'Offline';
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" onClick={onOpenDrawer} title="Menu Sesi">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="brand-wrap">
          {/* Browser Icon (No text abbreviation) */}
          <div className="browser-icon-badge" title="Browser Terintegrasi">
            {getBrowserIcon()}
          </div>

          {/* Functional Connection Status Pill */}
          <button
            className={`status-pill status-${connectionStatus}`}
            onClick={onToggleOnline}
            title={getConnectionTitle()}
          >
            <div className={`status-dot dot-${connectionStatus}`}></div>
            <span className={`material-symbols-outlined status-symbol symbol-${connectionStatus}`}>
              {getConnectionSymbol()}
            </span>
            <span className="status-label">
              {getConnectionLabel()}
            </span>
          </button>

          {/* Quick Online Action if Disconnected */}
          {connectionStatus === 'disconnected' && (
            <button
              className="quick-online-btn"
              onClick={onToggleOnline}
              title="Aktifkan Mode Online In-Browser langsung tanpa backend Python"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>bolt</span>
              <span>Go Online</span>
            </button>
          )}

          {/* Step Counter — visible only while running */}
          {runState === 'running' && stepCount > 0 && (
            <span className="step-counter" title="Jumlah langkah eksekusi">
              {stepCount} / 25
            </span>
          )}
        </div>
      </div>

      {/* View Switcher: Chat vs Logs */}
      <div className="topbar-center">
        <div className="view-switcher" role="tablist">
          <button
            className={`view-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => onSetView('chat')}
            role="tab"
            aria-selected={currentView === 'chat'}
            title="Tampilan Chat & Timeline"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>chat</span>
            <span>Chat</span>
          </button>
          <button
            className={`view-btn ${currentView === 'logs' ? 'active' : ''}`}
            onClick={() => onSetView('logs')}
            role="tab"
            aria-selected={currentView === 'logs'}
            title="Tampilan Event Logs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>terminal</span>
            <span>Logs</span>
            {logsCount > 0 && <span className="badge-count">{logsCount}</span>}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="topbar-actions">
        <button
          className={`icon-btn ${isDetached ? 'active' : ''}`}
          onClick={onToggleDetach}
          title={isDetached ? 'Pasang Kembali ke Sidepanel' : 'Lepas dari Sidepanel (Buka Jendela Melayang)'}
        >
          <span className="material-symbols-outlined">
            {isDetached ? 'dock_to_right' : 'open_in_new'}
          </span>
        </button>
        <button className="icon-btn" onClick={onNewSession} title="Sesi Baru">
          <span className="material-symbols-outlined">add</span>
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="Pengaturan & Mode Engine">
          <span className="material-symbols-outlined">tune</span>
        </button>
      </div>
    </div>
  );
};
