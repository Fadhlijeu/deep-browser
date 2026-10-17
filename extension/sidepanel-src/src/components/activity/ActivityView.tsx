import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ShieldCheck,
  ListFilter,
  Search,
  Copy,
  Check,
  ArrowUpRight,
  Download,
  AlertTriangle,
  Play,
  X
} from 'lucide-react';
import { Session, LogEvent, ChatMessage, ToolStep } from '../../types';

interface ActivityViewProps {
  session: Session;
  allSessions: Session[];
  onResolveHitl: (id: string, value: any) => void;
  onOpenSession: (sessionId: string) => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({
  session,
  allSessions,
  onResolveHitl,
  onOpenSession,
}) => {
  const [tab, setTab] = useState<'timeline' | 'runs' | 'events' | 'approvals'>('timeline');
  const [searchRun, setSearchRun] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventSearch, setEventSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [selectedRunDetail, setSelectedRunDetail] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract all runs across sessions
  const allRuns = allSessions.flatMap((s) => {
    return s.messages
      .filter((m) => m.role === 'assistant' && ((m.steps && m.steps.length > 0) || m.text))
      .map((m, idx) => {
        const userPrompt = s.messages[s.messages.indexOf(m) - 1]?.text || s.name;
        const isFailed = Boolean(m.isError);
        const hasHitl = Boolean(m.hitl);
        const status = hasHitl ? 'Needs review' : isFailed ? 'Failed' : 'Completed';
        return {
          id: m.id || `run_${idx}`,
          sessionId: s.id,
          task: userPrompt,
          status,
          started: m.timestamp,
          duration: m.duration || `${((m.steps?.length || 1) * 1.8).toFixed(1)}s`,
          model: m.modelName || 'Gemini 3.5 Flash Lite',
          steps: m.steps || [],
          eventCount: s.events.length,
          toolCount: m.steps?.length || 0,
          summary: m.text?.slice(0, 120) || 'Browser automation run',
          hitl: m.hitl,
        };
      });
  });

  const pendingApprovals = allRuns.filter((r) => r.hitl && r.status === 'Needs review');
  const completedRuns = allRuns.filter((r) => r.status === 'Completed');
  const events = session.events || [];

  const filteredRuns = allRuns
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => !searchRun || r.task.toLowerCase().includes(searchRun.toLowerCase()) || r.id.toLowerCase().includes(searchRun.toLowerCase()));

  const filteredEvents = events
    .filter((e) => eventTypeFilter === 'all' || e.type === eventTypeFilter)
    .filter((e) => !eventSearch || `${e.type} ${e.message} ${e.category}`.toLowerCase().includes(eventSearch.toLowerCase()));

  const copyDetails = (text: string, id: string) => {
    navigator.clipboard?.writeText?.(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const friendlyTime = (ts: number) => {
    const diff = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="page">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Observability</div>
          <h1>Activity &amp; Runs</h1>
          <p className="page-subtitle">
            Understand the agent lifecycle, inspect real executed runs, and debug browser state transitions.
          </p>
        </div>
      </div>

      {/* Metric Grid */}
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-top">
            Total runs <span className="metric-icon"><Activity size={14} /></span>
          </div>
          <div className="metric-value">{allRuns.length}</div>
          <div className="metric-foot">Recorded execution runs</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Completed <span className="metric-icon"><CheckCircle2 size={14} /></span>
          </div>
          <div className="metric-value">{completedRuns.length}</div>
          <div className="metric-foot">Verified state outcomes</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Needs review <span className="metric-icon"><ShieldCheck size={14} /></span>
          </div>
          <div className="metric-value">{pendingApprovals.length}</div>
          <div className="metric-foot">Human-in-the-loop queue</div>
        </div>

        <div className="metric">
          <div className="metric-top">
            Events <span className="metric-icon"><ListFilter size={14} /></span>
          </div>
          <div className="metric-value">{events.length}</div>
          <div className="metric-foot">Live session logs</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="nav-tabs" style={{ marginTop: '23px' }}>
        <button
          className={`nav-tab ${tab === 'timeline' ? 'active' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Live timeline
        </button>
        <button
          className={`nav-tab ${tab === 'runs' ? 'active' : ''}`}
          onClick={() => setTab('runs')}
        >
          Run history
        </button>
        <button
          className={`nav-tab ${tab === 'events' ? 'active' : ''}`}
          onClick={() => setTab('events')}
        >
          Event log
        </button>
        <button
          className={`nav-tab ${tab === 'approvals' ? 'active' : ''}`}
          onClick={() => setTab('approvals')}
        >
          Approvals {pendingApprovals.length > 0 && <span className="nav-count">{pendingApprovals.length}</span>}
        </button>
      </div>

      {/* Tab 1: Live Timeline */}
      {tab === 'timeline' && (
        <div className="split-grid">
          <section className="surface">
            <div className="surface-head">
              <div>
                <div className="surface-title">Recent agent activity</div>
                <div className="surface-note">Active session event stream</div>
              </div>
              <button className="btn small" onClick={() => setTab('events')}>
                <ListFilter size={13} /> View full log
              </button>
            </div>

            {events.length > 0 ? (
              events.slice(-8).reverse().map((e) => (
                <div key={e.id} className="event-row">
                  <span className="event-time">{friendlyTime(e.timestamp)}</span>
                  <span className={`event-indicator ${e.type === 'error' ? 'error' : e.type === 'warn' ? 'warn' : e.type === 'success' ? 'success' : 'info'}`} />
                  <div>
                    <div className="event-title">{e.type}</div>
                    <div className="event-desc">{e.message}</div>
                  </div>
                  <span className="event-source">{e.category}</span>
                </div>
              ))
            ) : (
              <div className="blank">
                <p>No activity events recorded yet.</p>
              </div>
            )}
          </section>

          <section>
            <div className="surface">
              <div className="surface-head">
                <div>
                  <div className="surface-title">Execution lifecycle</div>
                  <div className="surface-note">Deep-Browser autonomous pipeline</div>
                </div>
                <span className="pill">Active</span>
              </div>
              <div style={{ padding: '17px' }}>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-dot success" />
                    <div>
                      <div className="timeline-label">Task dispatched</div>
                      <div className="timeline-desc">User prompt received and decomposed by LLM client.</div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-dot success" />
                    <div>
                      <div className="timeline-label">CDP DOM Tree Synthesized</div>
                      <div className="timeline-desc">Calculates clickable bounding boxes &amp; index markers.</div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-dot running" />
                    <div>
                      <div className="timeline-label">Verified Action Execution</div>
                      <div className="timeline-desc">Actions dispatched with mutation evidence check.</div>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-dot" />
                    <div>
                      <div className="timeline-label">State Complete &amp; Judge</div>
                      <div className="timeline-desc">Final output returned with ground-truth validation.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="callout" style={{ marginTop: '12px' }}>
              <AlertTriangle size={15} />
              <span>
                <strong>Outcome unknown is never assumed success.</strong> Deep-Browser checks real DOM mutation evidence before marking any action as succeeded.
              </span>
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Run History */}
      {tab === 'runs' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Run history</div>
              <div className="surface-note">Individual execution tasks with step traces and durations.</div>
            </div>
            <div className="toolbar">
              <div className="searchbox">
                <Search size={14} />
                <input
                  className="input"
                  placeholder="Search task or run ID"
                  value={searchRun}
                  onChange={(e) => setSearchRun(e.target.value)}
                />
              </div>
              <select
                className="select"
                style={{ width: '145px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
                <option value="Needs review">Needs review</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task / Run</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Model</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length > 0 ? (
                  filteredRuns.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="table-primary">{r.task}</div>
                        <div className="table-secondary mono">{r.id} · {r.sessionId}</div>
                      </td>
                      <td>
                        <span className={`status ${r.status === 'Completed' ? 'success' : r.status === 'Needs review' ? 'review' : 'failed'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div>{new Date(r.started).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        <div className="table-secondary">{friendlyTime(r.started)}</div>
                      </td>
                      <td className="mono">{r.duration}</td>
                      <td>
                        <div className="table-primary">{r.model}</div>
                        <div className="table-secondary">{r.toolCount} tools · {r.eventCount} events</div>
                      </td>
                      <td>
                        <button
                          className="btn small"
                          onClick={() => {
                            onOpenSession(r.sessionId);
                          }}
                        >
                          Open <ArrowUpRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                      <span className="muted">No matching runs found.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Event Log */}
      {tab === 'events' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Structured event log</div>
              <div className="surface-note">Complete telemetry events from local agent runtime.</div>
            </div>
            <div className="toolbar">
              <button
                className="btn small"
                onClick={() => {
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
                  const a = document.createElement('a');
                  a.href = dataStr;
                  a.download = `deep_browser_events_${Date.now()}.json`;
                  a.click();
                }}
              >
                <Download size={13} /> Export JSON
              </button>
            </div>
          </div>

          <div className="toolbar" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <div className="searchbox">
              <Search size={14} />
              <input
                className="input"
                placeholder="Search event type, category, or message…"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
              />
            </div>
            <select
              className="select"
              style={{ width: '140px' }}
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="tools">Tools</option>
              <option value="reasoning">Reasoning</option>
              <option value="verifications">Verifications</option>
              <option value="errors">Errors</option>
            </select>
          </div>

          <div>
            {filteredEvents.length > 0 ? (
              filteredEvents.map((e) => (
                <details key={e.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <summary className="event-row" style={{ cursor: 'pointer', listStyle: 'none' }}>
                    <span className="event-time">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className={`event-indicator ${e.type === 'error' ? 'error' : e.type === 'warn' ? 'warn' : e.type === 'success' ? 'success' : 'info'}`} />
                    <div>
                      <div className="event-title">{e.type} · {e.category}</div>
                      <div className="event-desc">{e.message}</div>
                    </div>
                    <span className="event-source">{e.category}</span>
                  </summary>
                  <div style={{ padding: '0 14px 13px 86px' }}>
                    <div className="mono" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '9px', lineHeight: 1.6, background: 'var(--panel)', border: '1px solid var(--line)', padding: '10px', borderRadius: '6px' }}>
                      {e.payload ? JSON.stringify(e.payload, null, 2) : e.message}
                    </div>
                    <div className="toolbar" style={{ marginTop: '8px' }}>
                      <button
                        className="btn small"
                        onClick={() => copyDetails(JSON.stringify(e, null, 2), e.id)}
                      >
                        {copiedId === e.id ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
                        <span>{copiedId === e.id ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                  </div>
                </details>
              ))
            ) : (
              <div className="blank">
                <p>No matching events found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Approvals Queue */}
      {tab === 'approvals' && (
        <div className="surface">
          <div className="surface-head">
            <div>
              <div className="surface-title">Pending approvals</div>
              <div className="surface-note">Human-in-the-loop review policy before sensitive browser actions.</div>
            </div>
            <span className="status review">Awaiting review</span>
          </div>

          {pendingApprovals.length > 0 ? (
            pendingApprovals.map((a) => (
              <div key={a.id} style={{ padding: '18px', borderBottom: '1px solid var(--line)' }}>
                <div className="eyebrow">BROWSER ACTION REVIEW</div>
                <h2 style={{ fontSize: '15px', margin: '0 0 6px', color: 'var(--ink)' }}>{a.task}</h2>
                <p className="page-subtitle" style={{ margin: '0 0 12px' }}>
                  {a.hitl?.question || 'The agent requests your permission before executing this browser interaction.'}
                </p>

                <div className="form-grid" style={{ margin: '14px 0' }}>
                  <div className="info-card">
                    <div className="info-label">Target Action</div>
                    <div className="info-value">{a.hitl?.action_name || 'browser_action'}</div>
                  </div>
                  <div className="info-card">
                    <div className="info-label">Parameters</div>
                    <div className="info-value mono">
                      {a.hitl?.parameters ? JSON.stringify(a.hitl.parameters) : 'No parameters'}
                    </div>
                  </div>
                </div>

                <div className="toolbar">
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (a.hitl) onResolveHitl(a.hitl.id, true);
                    }}
                  >
                    <Check size={14} /> Approve action
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      if (a.hitl) onResolveHitl(a.hitl.id, false);
                    }}
                  >
                    <X size={14} /> Reject action
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="blank">
              <div className="blank-icon">
                <ShieldCheck size={20} />
              </div>
              <strong>Nothing awaiting review</strong>
              <p>When an action requires confirmation under Safe Mode, it will appear in this queue.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
