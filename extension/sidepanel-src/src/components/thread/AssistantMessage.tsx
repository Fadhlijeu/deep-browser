import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Video,
  Download,
  BookmarkPlus,
  CheckCheck,
  RefreshCw,
  Activity,
  ChevronRight,
  ChevronDown,
  Terminal,
  Maximize2,
  X,
  Camera,
  Layers,
  Compass,
  Search,
  MousePointer,
  Edit3,
  FileText,
  ArrowDown,
  Eye,
  Scale,
} from 'lucide-react';
import { ChatMessage, ToolStep, ActivityItem } from '../../types';
import { HitlApprovalCard } from './HitlApprovalCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTypewriter } from '../../hooks/useTypewriter';

interface AssistantMessageProps {
  message: ChatMessage;
  isCurrentMessage?: boolean;
  runState?: string;
  onRegenerate?: () => void;
  onToggleInspector?: () => void;
}

// ─── Screenshot Data Extractor ───────────────────────────────────────────────
const getScreenshotUrl = (step: ToolStep): string | null => {
  const res = step.result as any;
  const args = step.args as any;
  const sc =
    res?.screenshot ||
    res?.dataUrl ||
    res?.screenshotDataUrl ||
    args?.screenshot;
  if (!sc || typeof sc !== 'string' || sc === 'Captured') return null;
  if (sc.startsWith('data:image')) return sc;
  if (sc.startsWith('http://') || sc.startsWith('https://') || sc.startsWith('blob:')) return sc;
  return `data:image/png;base64,${sc}`;
};

// ─── Fullscreen Screenshot Lightbox Modal ────────────────────────────────────
const ScreenshotModal: React.FC<{
  imageUrl: string;
  title: string;
  onClose: () => void;
}> = ({ imageUrl, title, onClose }) => {
  return (
    <div className="screenshot-modal-overlay" onClick={onClose}>
      <div className="screenshot-modal-head" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={14} color="var(--accent)" />
          <strong>{title || 'Tangkapan Layar Browser'}</strong>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={imageUrl}
            download={`screenshot_${Date.now()}.png`}
            className="btn small"
            style={{ color: '#fff', borderColor: '#444', background: '#222' }}
          >
            <Download size={12} /> Unduh Gambar
          </a>
          <button
            type="button"
            className="btn small"
            onClick={onClose}
            style={{ color: '#fff', borderColor: '#444', background: '#222' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="screenshot-modal-body" onClick={(e) => e.stopPropagation()}>
        <img src={imageUrl} alt={title || 'Viewport capture'} />
      </div>
    </div>
  );
};

// ─── Format Master Elapsed Duration Helper ────────────────────────────────────
const getMasterDuration = (steps: ToolStep[], isRunning: boolean): string => {
  if (isRunning) return 'Working...';

  let totalMs = 0;
  for (const s of steps) {
    if (s.duration) {
      if (s.duration.endsWith('ms')) {
        totalMs += parseFloat(s.duration) || 0;
      } else if (s.duration.endsWith('s')) {
        totalMs += (parseFloat(s.duration) || 0) * 1000;
      }
    }
  }

  if (totalMs <= 0) {
    const count = steps.length;
    if (count === 0) return 'Worked';
    totalMs = count * 900;
  }

  const totalSec = Math.round(totalMs / 1000);
  if (totalSec < 1) return 'Worked for <1s';
  if (totalSec < 60) return `Worked for ${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const remSec = totalSec % 60;
  return `Worked for ${mins}m ${remSec}s`;
};

// ─── Minimal Syntax-Highlighted JSON Viewer (Matches User Photo) ─────────────
const JsonViewer: React.FC<{ data: unknown }> = ({ data }) => {
  const jsonStr = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const highlightedHtml = useMemo(() => {
    const escaped = jsonStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  }, [jsonStr]);

  return (
    <pre
      className="chat-trace-json"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  );
};

// ─── Tool Icon Helper ────────────────────────────────────────────────────────
const getToolIcon = (name: string, iconStr?: string) => {
  const n = (name || iconStr || '').toLowerCase();
  if (n.includes('layar') || n.includes('screenshot') || n.includes('camera')) return <Camera size={11} />;
  if (n.includes('nav') || n.includes('buka') || n.includes('url') || n.includes('goto')) return <Compass size={11} />;
  if (n.includes('search') || n.includes('cari')) return <Search size={11} />;
  if (n.includes('click') || n.includes('klik') || n.includes('touch') || n.includes('press')) return <MousePointer size={11} />;
  if (n.includes('type') || n.includes('input') || n.includes('ketik')) return <Edit3 size={11} />;
  if (n.includes('scroll')) return <ArrowDown size={11} />;
  if (n.includes('extract') || n.includes('ekstrak') || n.includes('pdf')) return <FileText size={11} />;
  if (n.includes('obs') || n.includes('baca') || n.includes('lihat')) return <Eye size={11} />;
  return <Terminal size={11} />;
};

// ─── Single Minimal Trace Tool Item (No ms, No status pill, No cards) ───────
const TraceToolItem: React.FC<{
  step: ToolStep;
  onViewScreenshot: (url: string, title: string) => void;
}> = ({ step, onViewScreenshot }) => {
  const [open, setOpen] = useState(false);
  const scUrl = getScreenshotUrl(step);

  const detailData = useMemo(() => {
    if (step.args && !step.result && !step.error && !step.verification) {
      return step.args;
    }
    const payload: Record<string, unknown> = {};
    if (step.args && Object.keys(step.args).length > 0) {
      payload.args = step.args;
    }
    if (step.result !== undefined && step.result !== null) {
      payload.result =
        typeof step.result === 'object' && (step.result as any)?.screenshot
          ? { ...(step.result as any), screenshot: '[Viewport Screenshot]' }
          : step.result;
    }
    if (step.verification) payload.verification = step.verification;
    if (step.error) payload.error = step.error;
    return Object.keys(payload).length > 0 ? payload : null;
  }, [step]);

  const hasDetail = Boolean(detailData || scUrl);

  return (
    <div className="trace-item">
      <button
        type="button"
        className="trace-item-trigger"
        onClick={() => hasDetail && setOpen(!open)}
        disabled={!hasDetail}
      >
        <span className="trace-icon">
          {getToolIcon(step.name, step.icon)}
        </span>
        <span className="trace-item-title">{step.name}</span>
        {hasDetail && (
          <ChevronDown
            size={11}
            className={`trace-item-chevron ${open ? 'open' : ''}`}
          />
        )}
      </button>

      {open && hasDetail && (
        <div className="trace-item-detail">
          {scUrl && (
            <div
              className="chat-screenshot-thumb-wrap"
              onClick={(e) => {
                e.stopPropagation();
                onViewScreenshot(scUrl, step.name);
              }}
              style={{ borderRadius: '4px', maxHeight: '120px', maxWidth: '240px', margin: '2px 0 4px 14px' }}
            >
              <img src={scUrl} alt={step.name} className="chat-screenshot-thumb" />
              <span className="chat-screenshot-badge">
                <Maximize2 size={9} /> Buka gambar
              </span>
            </div>
          )}

          {detailData && <JsonViewer data={detailData} />}
        </div>
      )}
    </div>
  );
};

// ─── Single Minimal Trace Reasoning Item ─────────────────────────────────────
const TraceReasoningItem: React.FC<{
  thought: string;
}> = ({ thought }) => {
  const [open, setOpen] = useState(false);
  const thoughtText = (thought || '').trim();

  const title = useMemo(() => {
    if (!thoughtText) return 'Reasoning process';
    const firstLine = thoughtText.split(/\r?\n/)[0].replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
    if (firstLine.length > 0 && firstLine.length <= 70) {
      return firstLine;
    }
    return 'Reasoning process';
  }, [thoughtText]);

  return (
    <div className="trace-item">
      <button
        type="button"
        className="trace-item-trigger"
        onClick={() => setOpen(!open)}
      >
        <span className="trace-icon">
          <Sparkles size={11} />
        </span>
        <span className="trace-item-title">{title}</span>
        <ChevronDown
          size={11}
          className={`trace-item-chevron ${open ? 'open' : ''}`}
        />
      </button>

      {open && (
        <div className="trace-item-detail">
          <div className="chat-reasoning-markdown">
            <MarkdownRenderer content={thoughtText} />
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Minimal Trace Judge Item ───────────────────────────────────────────────
const TraceJudgeItem: React.FC<{ verdict: any }> = ({ verdict }) => {
  const [open, setOpen] = useState(false);
  const isValid = Boolean(verdict.verdict);

  return (
    <div className="trace-item">
      <button
        type="button"
        className="trace-item-trigger"
        onClick={() => setOpen(!open)}
      >
        <span className="trace-icon">
          <Scale size={11} color={isValid ? 'var(--green)' : 'var(--red)'} />
        </span>
        <span className="trace-item-title">
          {isValid ? 'AI Judge Verification: Valid' : 'AI Judge Verification: Needs Attention'}
        </span>
        <ChevronDown
          size={11}
          className={`trace-item-chevron ${open ? 'open' : ''}`}
        />
      </button>

      {open && (
        <div className="trace-item-detail">
          <JsonViewer data={verdict} />
        </div>
      )}
    </div>
  );
};

// ─── Master Trace Group Container ("Worked for 1m 55s ∨" / "Working... ∨") ───
const TraceMasterGroup: React.FC<{
  isRunning: boolean;
  steps: ToolStep[];
  children: React.ReactNode;
}> = ({ isRunning, steps, children }) => {
  const [open, setOpen] = useState(isRunning);
  const [hasUserToggled, setHasUserToggled] = useState(false);

  useEffect(() => {
    if (!isRunning && !hasUserToggled) {
      setOpen(false);
    }
  }, [isRunning, hasUserToggled]);

  const handleToggle = () => {
    setHasUserToggled(true);
    setOpen((prev) => !prev);
  };

  const label = useMemo(() => {
    return getMasterDuration(steps, isRunning);
  }, [steps, isRunning]);

  return (
    <div className="chat-trace-section">
      <button
        type="button"
        className="chat-trace-master-trigger"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          size={12}
          className={`chat-trace-chevron ${open ? 'open' : ''}`}
        />
      </button>

      {open && <div className="chat-trace-body">{children}</div>}
    </div>
  );
};

// ─── Grouping Helper for Activities ──────────────────────────────────────────
interface TraceItemDef {
  type: 'reasoning' | 'tool';
  step?: ToolStep;
  thoughtText?: string;
  id: string;
}

interface ActivityGroup {
  type: 'narrative' | 'trace';
  narrativeText?: string;
  traceItems?: TraceItemDef[];
  steps?: ToolStep[];
  id: string;
}

const groupActivities = (activities: ActivityItem[]): ActivityGroup[] => {
  const groups: ActivityGroup[] = [];
  let currentTraceItems: TraceItemDef[] = [];
  let currentSteps: ToolStep[] = [];

  const flushTrace = () => {
    if (currentTraceItems.length > 0) {
      groups.push({
        type: 'trace',
        traceItems: [...currentTraceItems],
        steps: [...currentSteps],
        id: 'trace_' + currentTraceItems[0].id,
      });
      currentTraceItems = [];
      currentSteps = [];
    }
  };

  for (const act of activities) {
    if (act.type === 'step' && act.step) {
      currentSteps.push(act.step);
      currentTraceItems.push({
        type: 'tool',
        step: act.step,
        id: act.id || act.step.id,
      });
    } else if (act.type === 'reasoning' && act.thought) {
      currentTraceItems.push({
        type: 'reasoning',
        thoughtText: act.thought,
        id: act.id,
      });
    } else if (act.type === 'narrative' && act.text) {
      flushTrace();
      groups.push({
        type: 'narrative',
        narrativeText: act.text,
        id: act.id,
      });
    }
  }

  flushTrace();
  return groups;
};

// ─── Main AssistantMessage Component ─────────────────────────────────────────
export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isCurrentMessage = false,
  runState = 'idle',
  onRegenerate,
  onToggleInspector,
}) => {
  const isRunning = isCurrentMessage && runState === 'running';

  const rawFallback = message.text || (isRunning ? 'Memproses navigasi dan automasi browser...' : 'Halo! Ada yang bisa saya bantu dengan browser Anda hari ini?');

  const { displayedText, isTyping } = useTypewriter(
    rawFallback,
    {
      isStreaming: isRunning,
      immediate: !isCurrentMessage,
    }
  );

  const [copied, setCopied] = useState(false);
  const [skillSaved, setSkillSaved] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text || rawFallback);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveSkill = async () => {
    try {
      const skillMgr = (window as any).SkillManager;
      if (skillMgr && skillMgr.recordRunToSkill) {
        await skillMgr.recordRunToSkill({
          title: (message.text || rawFallback).slice(0, 32) || 'Workflow Skill',
          description: `Extracted workflow from run ${message.id}`,
          task: message.text || rawFallback,
          history: message.steps || [],
        });
        setSkillSaved(true);
        setTimeout(() => setSkillSaved(false), 3000);
      }
    } catch (e) {
      console.error('[SaveSkill Error]', e);
    }
  };

  const steps = message.steps || [];
  const activities: ActivityItem[] = message.activities || [];
  const hasActivities = activities.length > 0;
  const grouped = hasActivities ? groupActivities(activities) : [];
  const lastTraceGroupIndex = grouped.map((g) => g.type).lastIndexOf('trace');
  const hasTraceGroup = lastTraceGroupIndex !== -1;
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;

  return (
    <article className="message assistant" data-message-id={message.id}>
      {/* Lightbox Modal for Screenshots */}
      {modalImage && (
        <ScreenshotModal
          imageUrl={modalImage}
          title={modalTitle}
          onClose={() => setModalImage(null)}
        />
      )}

      {/* Avatar */}
      <div className="message-avatar">
        <Sparkles size={15} />
      </div>

      <div className="message-main">
        {/* Message Content: Clean stream alternating Show, Unshow, Toolcalls, and UI Widgets */}
        <div className="message-content">
          {message.isError && (
            <div
              className="callout"
              style={{
                marginBottom: '8px',
                background: 'var(--red-soft)',
                borderColor: '#e8c4bd',
                color: 'var(--red)',
              }}
            >
              <AlertCircle size={14} />
              <span>{message.text || 'Gagal memproses permintaan.'}</span>
            </div>
          )}

          {/* 1. Dynamic Activities Stream: Alternating Show Narrative and Unshow Minimal Traces */}
          {hasActivities ? (
            grouped.map((grp, grpIdx) => {
              if (grp.type === 'narrative' && grp.narrativeText) {
                return (
                  <div key={grp.id} className="chat-show-narrative">
                    <MarkdownRenderer content={grp.narrativeText} />
                  </div>
                );
              }
              if (grp.type === 'trace') {
                return (
                  <TraceMasterGroup
                    key={grp.id}
                    isRunning={isRunning}
                    steps={grp.steps || []}
                  >
                    {grp.traceItems?.map((tItem) => {
                      if (tItem.type === 'reasoning' && tItem.thoughtText) {
                        return (
                          <TraceReasoningItem
                            key={tItem.id}
                            thought={tItem.thoughtText}
                          />
                        );
                      }
                      if (tItem.type === 'tool' && tItem.step) {
                        return (
                          <TraceToolItem
                            key={tItem.id}
                            step={tItem.step}
                            onViewScreenshot={(url, title) => {
                              setModalImage(url);
                              setModalTitle(title);
                            }}
                          />
                        );
                      }
                      return null;
                    })}
                    {/* Include Judge verdict inside the last trace section if present */}
                    {grpIdx === lastTraceGroupIndex && message.judgeVerdict && (
                      <TraceJudgeItem verdict={message.judgeVerdict} />
                    )}
                  </TraceMasterGroup>
                );
              }
              return null;
            })
          ) : (
            <>
              {/* Fallback for legacy messages with raw steps / thought / judgeVerdict */}
              {(steps.length > 0 || message.thought || message.judgeVerdict) && (
                <TraceMasterGroup isRunning={isRunning} steps={steps}>
                  {message.thought && <TraceReasoningItem thought={message.thought} />}
                  {steps.map((st) => (
                    <TraceToolItem
                      key={st.id}
                      step={st}
                      onViewScreenshot={(url, title) => {
                        setModalImage(url);
                        setModalTitle(title);
                      }}
                    />
                  ))}
                  {message.judgeVerdict && <TraceJudgeItem verdict={message.judgeVerdict} />}
                </TraceMasterGroup>
              )}
            </>
          )}

          {/* If there were activities but no trace group (e.g. only narrative) and there is a judge verdict */}
          {hasActivities && !hasTraceGroup && message.judgeVerdict && (
            <TraceMasterGroup isRunning={false} steps={[]}>
              <TraceJudgeItem verdict={message.judgeVerdict} />
            </TraceMasterGroup>
          )}

          {/* 2. Interactive UI Widget (HITL: AskForm, choices, approvals) - never collapsed, always accessible */}
          {message.hitl && <HitlApprovalCard hitl={message.hitl} />}

          {/* 4. Final Text / Response (Show) */}
          {message.text ? (
            <div className="chat-show-narrative" style={{ marginTop: hasActivities ? '8px' : '2px' }}>
              <MarkdownRenderer content={message.text} />
              {isTyping && <span className="typewriter-cursor" />}
            </div>
          ) : !hasActivities ? (
            <div className="chat-show-narrative" style={{ marginTop: '2px' }}>
              <MarkdownRenderer content={displayedText} />
              {isTyping && <span className="typewriter-cursor" />}
            </div>
          ) : null}

          {/* 5. Video Session Playback Card */}
          {message.recordedVideo && (
            <div className="info-card" style={{ marginTop: '10px', padding: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 650 }}>
                  <Video size={13} color="var(--red)" />
                  <span>Tab Session Recording ({message.recordedVideo.durationSeconds}s)</span>
                </div>
                <a
                  href={message.recordedVideo.url}
                  download={message.recordedVideo.fileName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--blue)',
                    fontSize: '10px',
                    textDecoration: 'none',
                  }}
                >
                  <Download size={11} /> Download
                </a>
              </div>
              <video
                src={message.recordedVideo.url}
                controls
                style={{ width: '100%', maxHeight: '240px', borderRadius: '6px', background: '#000' }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Below Message: Copy, Regenerate, Trace, Save as Skill */}
        <div className="message-actions">
          <button onClick={copyText} title="Copy response">
            {copied ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {onRegenerate && !isRunning && (
            <button onClick={onRegenerate} title="Regenerate this response">
              <RefreshCw size={11} />
              <span>Regenerate</span>
            </button>
          )}

          {onToggleInspector && (
            <button onClick={onToggleInspector} title="View execution trace and reasoning steps">
              <Activity size={11} />
              <span>Trace</span>
            </button>
          )}

          {!isRunning && totalStepsCount > 0 && !message.isError && (
            <button onClick={handleSaveSkill} title="Save this verified workflow as a reusable skill">
              {skillSaved ? <CheckCheck size={11} color="var(--green)" /> : <BookmarkPlus size={11} />}
              <span>{skillSaved ? 'Saved as Skill' : 'Save as Skill'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
