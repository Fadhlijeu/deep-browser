import React from 'react';
import { Search, ExternalLink, Sun, Moon, Settings2, Sparkles, PanelTop } from 'lucide-react';
import { ViewType, ConnectionStatus, RunState } from '../../types';

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
        <span>{currentView === 'settings' ? 'Configure' : 'Workspace'}</span>
        <span className="crumb-sep">/</span>
        <strong>{VIEW_TITLES[currentView] || 'Chat'}</strong>
      </div>

      <div className="top-actions">
        {/* Real Status Badge (NO MORE "SIMULATED ENVIRONMENT" dummy string!) */}
        {runState === 'running' ? (
          <span className="sim-label running" title="Agent executing browser actions">
            <span className="dot" /> STEP {stepCount || 1} RUNNING
          </span>
        ) : connectionStatus === 'connected' ? (
          <span className="sim-label daemon" title="Connected to background agent daemon">
            <span className="dot" /> DAEMON LIVE
          </span>
        ) : (
          <span className="sim-label" title="Direct CDP attached to active browser window">
            <span className="dot" /> EDGE ATTACHED
          </span>
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
