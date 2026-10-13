import React from 'react';
import { Menu, MessageSquare, Terminal, Network, Zap, RefreshCw, Unlink } from 'lucide-react';
import { ConnectionStatus, RunState, ViewType } from '../../types';

interface SlimHeaderProps {
  onOpenSidebar: () => void;
  currentView: ViewType;
  logsCount: number;
  onSetView: (v: ViewType) => void;
  connectionStatus: ConnectionStatus;
  runState: RunState;
  stepCount: number;
  onToggleOnline: () => void;
}

export const SlimHeader: React.FC<SlimHeaderProps> = ({
  onOpenSidebar,
  currentView,
  logsCount,
  onSetView,
  connectionStatus,
  runState,
  stepCount,
  onToggleOnline,
}) => {
  const getConnectionInfo = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          label: 'Daemon',
          title: 'Backend Daemon Terhubung (127.0.0.1:7788) • Klik untuk beralih ke In-Browser',
          icon: <Network size={11} className="status-symbol" />,
          className: 'status-connected',
        };
      case 'standalone':
        return {
          label: 'Online',
          title: 'Mode In-Browser Mandiri (Aktif) • Klik untuk cari Daemon Backend',
          icon: <Zap size={11} className="status-symbol" />,
          className: 'status-standalone',
        };
      case 'reconnecting':
        return {
          label: 'Connecting...',
          title: 'Sedang mencari Backend Daemon... • Klik untuk langsung Online Mandiri',
          icon: <RefreshCw size={11} className="status-symbol" style={{ animation: 'spinSymbol 1.5s linear infinite' }} />,
          className: 'status-reconnecting',
        };
      case 'disconnected':
      default:
        return {
          label: 'Offline',
          title: 'Backend Offline • Klik untuk langsung Online di Browser!',
          icon: <Unlink size={11} className="status-symbol" />,
          className: 'status-disconnected',
        };
    }
  };

  const connInfo = getConnectionInfo();

  return (
    <header className="slim-header-bar">
      {/* Left: Hamburger menu toggle button (no Deep Browser text) */}
      <div className="slim-header-left">
        <button 
          className="slim-hamburger-btn" 
          onClick={onOpenSidebar} 
          title="Buka Menu & Sesi"
          aria-label="Buka Menu"
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Center: View Switcher (Chat vs Logs) */}
      <div className="slim-header-center">
        <div className="view-switcher" role="tablist">
          <button
            className={`view-btn ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => onSetView('chat')}
            role="tab"
            aria-selected={currentView === 'chat'}
            title="Tampilan Chat"
          >
            <MessageSquare size={13} style={{ flexShrink: 0 }} />
            <span>Chat</span>
          </button>
          <button
            className={`view-btn ${currentView === 'logs' ? 'active' : ''}`}
            onClick={() => onSetView('logs')}
            role="tab"
            aria-selected={currentView === 'logs'}
            title="Tampilan Event Logs"
          >
            <Terminal size={13} style={{ flexShrink: 0 }} />
            <span>Logs</span>
            {logsCount > 0 && <span className="badge-count">{logsCount}</span>}
          </button>
        </div>
      </div>

      {/* Right: Functional Online / Offline / Reconnect Status Pill */}
      <div className="slim-header-right">
        {/* Step Counter — visible while running */}
        {runState === 'running' && stepCount > 0 && (
          <span className="step-counter" title="Langkah eksekusi otonom">
            Langkah {stepCount}
          </span>
        )}

        {/* Functional connection pill */}
        <button
          className={`status-pill ${connInfo.className}`}
          onClick={onToggleOnline}
          title={connInfo.title}
        >
          <div className={`status-dot dot-${connectionStatus}`} />
          {connInfo.icon}
          <span className="status-label">{connInfo.label}</span>
        </button>

        {/* Quick Go Online action button if disconnected */}
        {connectionStatus === 'disconnected' && (
          <button
            className="quick-online-btn"
            onClick={onToggleOnline}
            title="Aktifkan Mode Online In-Browser langsung"
          >
            <Zap size={10} style={{ flexShrink: 0 }} />
            <span>Go Online</span>
          </button>
        )}
      </div>
    </header>
  );
};
