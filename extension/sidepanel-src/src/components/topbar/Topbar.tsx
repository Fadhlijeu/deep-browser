import React from 'react';
import { RunState } from '../../types';

interface TopbarProps {
  runState: RunState;
  stepCount: number;
  currentView: 'chat' | 'logs';
  logsCount: number;
  onSetView: (v: 'chat' | 'logs') => void;
  onOpenDrawer: () => void;
  onNewSession: () => void;
  onOpenApikeys: () => void;
  onOpenSettings: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  runState,
  stepCount,
  currentView,
  logsCount,
  onSetView,
  onOpenDrawer,
  onNewSession,
  onOpenApikeys,
  onOpenSettings,
}) => {
  const getStatusLabel = () => {
    switch (runState) {
      case 'running': return 'Berjalan';
      case 'paused': return 'Menunggu';
      case 'error': return 'Error';
      default: return 'Siap';
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="icon-btn" onClick={onOpenDrawer} title="Menu Sesi">
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="brand-wrap">
          <span className="brand-title">Deep Browser</span>
          <span className="brand-badge">ED</span>

          {/* Runtime Status Pill */}
          <div className="status-pill" data-state={runState} title={`Status: ${getStatusLabel()}`}>
            <div className="status-dot"></div>
            <span>{getStatusLabel()}</span>
          </div>

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
        <button className="icon-btn" onClick={onNewSession} title="Sesi Baru">
          <span className="material-symbols-outlined">add</span>
        </button>
        <button className="icon-btn" onClick={onOpenApikeys} title="Kelola Kunci API">
          <span className="material-symbols-outlined">key</span>
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="Pengaturan & Mode">
          <span className="material-symbols-outlined">tune</span>
        </button>
      </div>
    </div>
  );
};
