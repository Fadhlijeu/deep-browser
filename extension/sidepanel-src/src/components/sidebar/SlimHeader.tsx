import React from 'react';
import { Menu, Plus, Bot } from 'lucide-react';
import { ConnectionStatus, RunState } from '../../types';

interface SlimHeaderProps {
  onOpenSidebar: () => void;
  onNewSession: () => void;
  connectionStatus: ConnectionStatus;
  runState: RunState;
  modelName: string;
}

export const SlimHeader: React.FC<SlimHeaderProps> = ({
  onOpenSidebar,
  onNewSession,
  connectionStatus,
  runState,
  modelName,
}) => {
  const isOnline = connectionStatus.connected;
  const isExecuting = runState === 'running';

  return (
    <header className="slim-header-bar">
      {/* Left: Hamburger menu toggle & brand title */}
      <div className="slim-header-left">
        <button 
          className="slim-hamburger-btn" 
          onClick={onOpenSidebar} 
          title="Buka Menu & Sesi"
          aria-label="Buka Menu"
        >
          <Menu size={16} />
        </button>
        <div className="slim-brand-group">
          <h1 className="slim-editorial-title">Deep Browser</h1>
        </div>
      </div>

      {/* Right: Quick indicators & new session button */}
      <div className="slim-header-right">
        {/* Model chip */}
        <span className="slim-model-chip truncate" title={modelName}>
          <Bot size={11} className="shrink-0" />
          <span className="truncate">{modelName}</span>
        </span>

        {/* Live connection dot */}
        <span 
          className={`slim-conn-indicator ${isOnline ? 'online' : 'offline'}`} 
          title={isOnline ? 'Terhubung (Online)' : 'Terputus (Offline)'}
        />

        {/* Sesi Baru quick action */}
        <button 
          className="slim-quick-new-btn" 
          onClick={onNewSession} 
          title="Mulai Sesi Baru"
        >
          <Plus size={13} />
        </button>
      </div>
    </header>
  );
};
