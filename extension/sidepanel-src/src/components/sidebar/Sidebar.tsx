import React from 'react';
import {
  MessageSquare,
  Layers,
  Activity,
  Blocks,
  CalendarClock,
  Settings2,
  MoreHorizontal,
  Globe
} from 'lucide-react';
import { ViewType, Session, TabItem, RunState } from '../../types';

interface SidebarProps {
  currentView: ViewType;
  onSetView: (view: ViewType) => void;
  sessions: Session[];
  activeTab?: TabItem | null;
  runState: RunState;
  stepCount: number;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSetView,
  sessions,
  activeTab,
  runState,
  stepCount,
  onOpenSettings,
}) => {
  const activeSessionsCount = sessions.filter((s) => !s.archived).length;
  const progressPercent = Math.min(100, Math.max(15, (stepCount / 25) * 100));

  let tabHostname = 'Edge Active Tab';
  if (activeTab?.url) {
    try {
      tabHostname = new URL(activeTab.url).hostname;
    } catch (_) {
      tabHostname = activeTab.title || 'Attached Tab';
    }
  }

  return (
    <aside className="sidebar" aria-label="Main navigation">
      {/* Brand Header with Times New Roman Wordmark */}
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="m10 15 5-3-5-3v6Z" fill="currentColor" />
          </svg>
        </div>
        <div className="brand-copy">
          <div className="brand-name">Deep Browser<br />Copilot</div>
          <div className="brand-sub">Agent workspace</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="nav-label">Workspace</div>
      <nav className="nav">
        <button
          className={`nav-btn ${currentView === 'chat' ? 'active' : ''}`}
          onClick={() => onSetView('chat')}
          title="Chat"
        >
          <MessageSquare />
          <span className="nav-text">Chat</span>
        </button>

        <button
          className={`nav-btn ${currentView === 'sessions' ? 'active' : ''}`}
          onClick={() => onSetView('sessions')}
          title="Sessions"
        >
          <Layers />
          <span className="nav-text">Sessions</span>
          <span className="nav-count">{String(activeSessionsCount).padStart(2, '0')}</span>
        </button>

        <button
          className={`nav-btn ${currentView === 'activity' ? 'active' : ''}`}
          onClick={() => onSetView('activity')}
          title="Activity & Runs"
        >
          <Activity />
          <span className="nav-text">Activity &amp; Runs</span>
        </button>

        <button
          className={`nav-btn ${currentView === 'tools' ? 'active' : ''}`}
          onClick={() => onSetView('tools')}
          title="Tools"
        >
          <Blocks />
          <span className="nav-text">Tools</span>
        </button>

        <button
          className={`nav-btn ${currentView === 'automations' ? 'active' : ''}`}
          onClick={() => onSetView('automations')}
          title="Automations"
        >
          <CalendarClock />
          <span className="nav-text">Automations</span>
          <span className="nav-count">3</span>
        </button>

        <div className="nav-label" style={{ marginTop: '12px' }}>Configure</div>
        <button
          className={`nav-btn ${currentView === 'settings' ? 'active' : ''}`}
          onClick={() => onSetView('settings')}
          title="Settings"
        >
          <Settings2 />
          <span className="nav-text">Settings</span>
        </button>
      </nav>

      {/* Real Workspace Card & Profile */}
      <div className="sidebar-bottom">
        <div className="workspace-card">
          <div className="workspace-top">
            <span className={`dot ${runState === 'running' ? 'running' : ''}`} />
            <span>{runState === 'running' ? `Step ${stepCount} running` : tabHostname}</span>
          </div>
          <p title={activeTab?.title || activeTab?.url || 'Active browser session'}>
            {activeTab?.title || 'Attached to active Edge tab. Direct CDP and DOM automation.'}
          </p>
          <div className="mini-meter">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="profile">
          <div className="avatar">DB</div>
          <div className="profile-copy">
            <div className="profile-name">Deep Browser</div>
            <div className="profile-meta">v1.0 Local Agent</div>
          </div>
          <button
            className="more-btn"
            onClick={onOpenSettings}
            aria-label="Workspace settings"
            title="Open Settings"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};
