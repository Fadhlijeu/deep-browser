import React from 'react';
import { Search, ExternalLink, Sun, Moon, Settings2, Sparkles, PanelTop } from 'lucide-react';
import { ViewType, ConnectionStatus, RunState } from '../../types';

import { sidepanelStore } from '../../state/sidepanelStore';

interface CopilotTopbarProps {
  currentView: ViewType;
  connectionStatus: ConnectionStatus;
  runState: RunState;
  stepCount: number;
  theme: 'light' | 'dark' | 'system';
  isDetached: boolean;
  isInspectorOpen?: boolean;
  onToggleInspector?: () => void;
  onToggleTheme: () => void;
  onToggleDetach: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

const VIEW_TITLES: Record<ViewType, string> = {
  chat: 'Chat',
  sessions: 'Sessions',
  activity: 'Activity & Runs',
  tools: 'Tools',
  skills: 'Skills',
  automations: 'Skills',
  settings: 'Settings',
};

export const CopilotTopbar: React.FC<CopilotTopbarProps> = ({
  currentView,
  connectionStatus,
  runState,
  stepCount,
  theme,
  isDetached,
  isInspectorOpen,
  onToggleInspector,
  onToggleTheme,
  onToggleDetach,
  onOpenSearch,
  onOpenSettings,
}) => {
  const isDark = theme === 'dark';

  return (
    <header className="topbar">
      <div className="crumbs">
        <strong>{VIEW_TITLES[currentView] || 'Chat'}</strong>
      </div>

      <div className="top-actions">
        {/* Dynamic Connection Status: Online, Offline, Reconnect */}
        {runState === 'running' ? (
          <span className="sim-label running" title="Agent executing browser actions">
            <span className="dot" /> STEP {stepCount || 1} RUNNING
          </span>
        ) : connectionStatus === 'connected' || connectionStatus === 'standalone' ? (
          <span className="sim-label online" title="Status: Online (Browser CDP Runtime Terhubung)">
            <span className="dot" style={{ background: 'var(--green)' }} /> Online
          </span>
        ) : connectionStatus === 'reconnecting' ? (
          <span className="sim-label reconnecting" title="Status: Menghubungkan ulang...">
            <span className="dot" style={{ background: 'var(--amber)' }} /> Reconnect...
          </span>
        ) : (
          <button
            type="button"
            className="sim-label offline"
            onClick={() => sidepanelStore.reconnect()}
            title="Status: Offline. Klik untuk Reconnect"
            style={{ cursor: 'pointer', border: '1px solid #e8c4bd', background: 'var(--red-soft)', color: 'var(--red)' }}
          >
            <span className="dot" style={{ background: 'var(--red)' }} /> Offline · Reconnect
          </button>
        )}

        {/* Quick Search */}
        <button
          className="icon-btn"
          onClick={onOpenSearch}
          title="Quick search / Actions (Ctrl/⌘ K)"
          aria-label="Search"
        >
          <Search size={15} />
        </button>

        {/* Theme Toggle */}
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          title={isDark ? 'Switch to Light paper theme' : 'Switch to Dark theme'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Execution Inspector Toggle (when in Chat) */}
        {currentView === 'chat' && onToggleInspector && (
          <button
            className={`icon-btn ${isInspectorOpen ? 'active' : ''}`}
            onClick={onToggleInspector}
            title={isInspectorOpen ? 'Close execution inspector' : 'Open execution trace & inspector'}
            aria-label="Toggle execution inspector"
          >
            <PanelTop size={15} />
          </button>
        )}

        {/* Detach / Popout Window */}
        <button
          className="icon-btn"
          onClick={onToggleDetach}
          title={isDetached ? 'Dock to Sidepanel' : 'Pop out into dedicated window'}
          aria-label="Detach window"
        >
          <ExternalLink size={15} />
        </button>
      </div>
    </header>
  );
};
