import React, { useState } from 'react';
import { X, ArrowUpRight, CheckCircle2, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { Session, ToolStep, ModelDef, RunState, LogEvent } from '../../types';

interface ExecutionInspectorProps {
  session: Session;
  runState: RunState;
  selectedModel: ModelDef;
  onClose: () => void;
}

export const ExecutionInspector: React.FC<ExecutionInspectorProps> = ({
  session,
  runState,
  selectedModel,
  onClose,
}) => {
  const [tab, setTab] = useState<'timeline' | 'plan' | 'events'>('timeline');

  // Find most recent assistant message with steps
  const lastAssistantMsg = [...session.messages].reverse().find((m) => m.role === 'assistant');
  const steps: ToolStep[] = lastAssistantMsg?.steps || [];
  const events: LogEvent[] = session.events || [];

  const runId = lastAssistantMsg?.id || 'idle';
  const taskPrompt = [...session.messages].reverse().find((m) => m.role === 'user')?.text || session.name;

  return (
    <aside className="chat-inspector">
      <div className="inspector-head">
        <div>
          <strong>Execution inspector</strong>
          <div className="surface-note">Live CDP &amp; telemetry</div>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close inspector">
          <X size={15} />
        </button>
      </div>

      <div className="inspector-tabs">
        <button
          className={`inspector-tab ${tab === 'timeline' ? 'active' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`inspector-tab ${tab === 'plan' ? 'active' : ''}`}
          onClick={() => setTab('plan')}
        >
          Plan
        </button>
        <button
          className={`inspector-tab ${tab === 'events' ? 'active' : ''}`}
          onClick={() => setTab('events')}
        >
          Events
        </button>
      </div>

      <div className="inspector-body">
        {tab === 'timeline' && (
          <>
            <div className="info-card">
              <div className="info-label">Current execution</div>
              <div className="info-value mono">{runId}</div>
              <div style={{ marginTop: '8px' }}>
                <span className={`status ${runState === 'running' ? 'running' : runState === 'error' ? 'failed' : 'success'}`}>
                  {runState === 'running' ? 'Running' : runState === 'error' ? 'Failed' : 'Ready'}
                </span>
              </div>
              <div className="info-sub" title={taskPrompt}>
                {taskPrompt.length > 70 ? taskPrompt.slice(0, 70) + '...' : taskPrompt}
              </div>
              <div className="rule" />
              <div className="key-value">
                <span className="key">Model</span>
                <span className="value">{selectedModel.name}</span>
              </div>
              <div className="key-value">
                <span className="key">Tool steps</span>
                <span className="value">{steps.length}</span>
              </div>
              <div className="key-value">
                <span className="key">Events</span>
                <span className="value">{events.length}</span>
              </div>
            </div>

            {steps.length > 0 ? (
              <div className="timeline">
                {steps.map((st, i) => (
                  <div key={st.id || i} className="timeline-item">
                    <div className={`timeline-dot ${st.status === 'succeeded' ? 'success' : st.status === 'running' ? 'running' : 'failed'}`} />
                    <div>
                      <div className="timeline-label">{st.name}</div>
                      <div className="timeline-desc">
                        {st.args ? JSON.stringify(st.args).slice(0, 90) : 'Dispatched browser action'}
                      </div>
                      {st.duration && <div className="timeline-time">{st.duration}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-inline" style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
                No tool steps recorded for this message yet.
              </div>
            )}
          </>
        )}

        {tab === 'plan' && (
          <div>
            <div className="info-card">
              <div className="info-label">Autonomous strategy</div>
              <div className="info-value">Goal Decomposition</div>
              <div className="info-sub">Real-time dynamic plan adaptation based on DOM mutations.</div>
            </div>

            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-dot success" />
                <div>
                  <div className="timeline-label">1. DOM Tree Inspection</div>
                  <div className="timeline-desc">Evaluate interactive elements &amp; calculate bounding boxes</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className={`timeline-dot ${runState === 'running' ? 'running' : 'success'}`} />
                <div>
                  <div className="timeline-label">2. Action Verification</div>
                  <div className="timeline-desc">Execute synthesized CDP action and verify DOM mutation</div>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-dot" />
                <div>
                  <div className="timeline-label">3. Ground-truth Evaluation</div>
                  <div className="timeline-desc">Confirm state transition matches user intent</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'events' && (
          <div>
            {events.length > 0 ? (
              events.slice(-12).reverse().map((e) => (
                <div key={e.id} className="event-row" style={{ gridTemplateColumns: '8px minmax(0,1fr)', padding: '9px 0' }}>
                  <span className={`event-indicator ${e.type === 'error' ? 'error' : e.type === 'warn' ? 'warn' : e.type === 'success' ? 'success' : 'info'}`} />
                  <div>
                    <div className="event-title">{e.type}</div>
                    <div className="event-desc">{e.message}</div>
                    <div className="timeline-time">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {e.category}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-inline" style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
                No events recorded in this session.
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
