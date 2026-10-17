import React, { useState } from 'react';
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
} from 'lucide-react';
import { ChatMessage, ToolStep, ActivityItem } from '../../types';
import { HitlApprovalCard } from './HitlApprovalCard';
import { JudgeVerdictCard } from './JudgeVerdictCard';
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

// ─── Single Sleek Tool Call Item ─────────────────────────────────────────────
const ToolCallItem: React.FC<{
  step: ToolStep;
  onViewScreenshot: (url: string, title: string) => void;
}> = ({ step, onViewScreenshot }) => {
  const [open, setOpen] = useState(false);
  const scUrl = getScreenshotUrl(step);
  const hasDetail = Boolean(step.args || step.result || step.error || step.verification || scUrl);

  const getToolIcon = (name: string, iconStr?: string) => {
    const n = (name || iconStr || '').toLowerCase();
    if (scUrl || n.includes('layar') || n.includes('screenshot')) return <Camera size={11} />;
    if (n.includes('nav') || n.includes('buka') || n.includes('url')) return <Compass size={11} />;
    if (n.includes('search') || n.includes('cari')) return <Search size={11} />;
    if (n.includes('click') || n.includes('klik') || n.includes('touch')) return <MousePointer size={11} />;
    if (n.includes('type') || n.includes('input') || n.includes('ketik')) return <Edit3 size={11} />;
    if (n.includes('extract') || n.includes('ekstrak') || n.includes('pdf')) return <FileText size={11} />;
    if (n.includes('scroll')) return <ArrowDown size={11} />;
    if (n.includes('obs') || n.includes('baca') || n.includes('lihat')) return <Eye size={11} />;
    return <Terminal size={11} />;
  };

  return (
    <div style={{ margin: '3px 0' }}>
      <div
        className={`chat-tool-pill ${step.status === 'running' ? 'is-running' : step.status === 'failed' ? 'is-failed' : 'is-success'}`}
        onClick={() => hasDetail && setOpen(!open)}
        onKeyDown={(event) => {
          if (hasDetail && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? open : undefined}
        title={step.name}
      >
        <span className="tool-prompt-icon">&gt;_</span>
        <span style={{ display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
          {getToolIcon(step.name, step.icon)}
        </span>
        <span className="tool-title">{step.name}</span>
        <div className="tool-meta">
          {step.duration && <span>{step.duration}</span>}
          <span className={`status ${step.status === 'succeeded' ? 'success' : step.status === 'failed' ? 'failed' : 'running'}`}>
            {step.status === 'succeeded' ? 'succeeded' : step.status === 'failed' ? 'failed' : 'running'}
          </span>
          {hasDetail && (
            <ChevronRight
              size={11}
              style={{
                transform: open ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
                color: 'var(--muted)',
              }}
            />
          )}
        </div>
      </div>

      {open && hasDetail && (
        <div
          style={{
            margin: '2px 0 6px 14px',
            padding: '8px',
            border: '1px solid var(--line)',
            borderRadius: '6px',
            background: 'var(--paper)',
          }}
        >
          {scUrl && (
            <div style={{ marginBottom: '8px' }}>
              <div
                className="chat-screenshot-thumb-wrap"
                onClick={() => onViewScreenshot(scUrl, step.name)}
                style={{ borderRadius: '6px', maxHeight: '160px' }}
              >
                <img src={scUrl} alt={step.name} className="chat-screenshot-thumb" />
                <span className="chat-screenshot-badge">
                  <Maximize2 size={10} /> Klik untuk perbesar
                </span>
              </div>
            </div>
          )}

          {(step.args || step.result || step.error || step.verification) && (
            <pre className="chat-tool-detail mono">
              {JSON.stringify(
                {
                  args: step.args,
                  result: typeof step.result === 'object' && (step.result as any)?.screenshot ? { ...(step.result as any), screenshot: '[Base64 Viewport Image]' } : step.result,
                  verification: step.verification,
                  error: step.error,
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Consecutive Screenshots Gallery ─────────────────────────────────────────
const ScreenshotScanGallery: React.FC<{
  steps: ToolStep[];
  onViewScreenshot: (url: string, title: string) => void;
}> = ({ steps, onViewScreenshot }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="chat-screenshot-card">
      <div
        className="chat-tool-group-header"
        onClick={() => setOpen(!open)}
        title="Buka / tutup galeri hasil pemindaian layar"
      >
        <div className="chat-tool-group-title">
          <Camera size={13} color="var(--accent)" />
          <span>Pemindaian Layar ({steps.length} Tangkapan Viewport)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9.5px', color: 'var(--muted)' }}>
            {open ? 'Tutup galeri' : `Buka (${steps.length})`}
          </span>
          <ChevronRight
            size={11}
            style={{
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              color: 'var(--muted)',
            }}
          />
        </div>
      </div>

      {open && (
        <div style={{ padding: '8px 10px', background: 'var(--panel)' }}>
          <div className="screenshot-gallery-row">
            {steps.map((st, idx) => {
              const url = getScreenshotUrl(st);
              const scrollPct = (st.result as any)?.scroll_percentage ?? Math.round((idx / Math.max(1, steps.length - 1)) * 100);
              return (
                <div
                  key={st.id || idx}
                  className="screenshot-gallery-item"
                  onClick={() => url && onViewScreenshot(url, `${st.name} (${scrollPct}%)`)}
                  title="Klik untuk melihat resolusi penuh"
                >
                  {url ? (
                    <img src={url} alt={`Scan ${scrollPct}%`} />
                  ) : (
                    <div style={{ height: '90px', display: 'grid', placeItems: 'center', background: '#222', color: '#888', fontSize: '10px' }}>
                      Memproses...
                    </div>
                  )}
                  <div className="label">{scrollPct}% scrolled</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Group of Consecutive Tools with Open/Close Toggle ──────────────────────
const ToolStepsGroup: React.FC<{
  steps: ToolStep[];
  onViewScreenshot: (url: string, title: string) => void;
}> = ({ steps, onViewScreenshot }) => {
  // If all are screenshots, render the visual gallery
  const allScreenshots = steps.every((s) => Boolean(getScreenshotUrl(s)) || s.name.toLowerCase().includes('tangkapan layar'));
  if (allScreenshots && steps.length >= 2) {
    return <ScreenshotScanGallery steps={steps} onViewScreenshot={onViewScreenshot} />;
  }

  // If only 1 step, render single pill directly
  if (steps.length === 1) {
    return <ToolCallItem step={steps[0]} onViewScreenshot={onViewScreenshot} />;
  }

  // Multi-step collapsible container
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-tool-group">
      <button
        type="button"
        className="chat-tool-group-header"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Buka / tutup daftar aksi browser"
      >
        <div className="chat-tool-group-title">
          <span className="tool-prompt-icon">&gt;_</span>
          <span>{steps.length} aksi browser dieksekusi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '9.5px', color: 'var(--muted)' }}>
            {open ? 'Tutup daftar' : `Buka (${steps.length} aksi)`}
          </span>
          <ChevronRight
            size={11}
            style={{
              transform: open ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
              color: 'var(--muted)',
            }}
          />
        </div>
      </button>

      {open && (
        <div className="chat-tool-group-body">
          {steps.map((st) => (
            <ToolCallItem
              key={st.id}
              step={st}
              onViewScreenshot={onViewScreenshot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── AI Reasoning Eventlog (Unshow) - Matches Image 1 & 2 "Worked for ... ∨" ──
const ReasoningBlock: React.FC<{
  thought: string;
  isStreaming?: boolean;
}> = ({ thought, isStreaming }) => {
  const [open, setOpen] = useState(false);
  const thoughtText = (thought || '').trim();
  const lineCount = thoughtText ? thoughtText.split(/\r?\n/).filter(Boolean).length : 0;

  return (
    <section className={`chat-reasoning-card ${isStreaming ? 'is-thinking' : 'is-ready'} ${open ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="chat-reasoning-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={open ? 'Ciutkan detail proses' : 'Lihat detail proses'}
      >
        <span className="chat-reasoning-icon" aria-hidden="true">
          <Sparkles size={15} />
        </span>
        <span className="chat-reasoning-copy">
          <span className="chat-reasoning-title">
            {isStreaming ? 'Sedang menganalisis' : 'Ringkasan proses'}
          </span>
          <span className="chat-reasoning-subtitle">
            {isStreaming ? 'Menyusun langkah berikutnya' : 'Konteks dan aktivitas agen'}
            {lineCount > 0 ? ` · ${lineCount} baris` : ''}
          </span>
        </span>
        <span className={`chat-reasoning-state ${isStreaming ? 'running' : 'complete'}`}>
          <span className="chat-reasoning-state-dot" />
          {isStreaming ? 'Berjalan' : 'Tersedia'}
        </span>
        <ChevronRight className="chat-reasoning-chevron" size={15} />
      </button>

      {open && (
        <div className="chat-reasoning-body">
          <div className="chat-reasoning-body-head">
            <span>DETAIL PROSES</span>
            <span>{lineCount} baris</span>
          </div>
          {thoughtText ? (
            <div className="chat-reasoning-text">
              <MarkdownRenderer content={thoughtText} />
            </div>
          ) : (
            <p className="chat-reasoning-empty">
              {isStreaming ? 'Detail proses akan muncul saat tersedia.' : 'Tidak ada detail proses yang direkam untuk aktivitas ini.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

// ─── Grouping Helper for Activities ──────────────────────────────────────────
interface ActivityGroup {
  type: 'narrative' | 'reasoning' | 'tools';
  narrativeText?: string;
  thoughtText?: string;
  steps?: ToolStep[];
  id: string;
}

const groupActivities = (activities: ActivityItem[]): ActivityGroup[] => {
  const groups: ActivityGroup[] = [];
  let currentToolSteps: ToolStep[] = [];

  const flushTools = () => {
    if (currentToolSteps.length > 0) {
      groups.push({
        type: 'tools',
        steps: [...currentToolSteps],
        id: 'grp_tools_' + currentToolSteps[0].id,
      });
      currentToolSteps = [];
    }
  };

  for (const act of activities) {
    if (act.type === 'step' && act.step) {
      currentToolSteps.push(act.step);
    } else {
      flushTools();
      if (act.type === 'narrative' && act.text) {
        groups.push({
          type: 'narrative',
          narrativeText: act.text,
          id: act.id,
        });
      } else if (act.type === 'reasoning' && act.thought) {
        groups.push({
          type: 'reasoning',
          thoughtText: act.thought,
          id: act.id,
        });
      }
    }
  }
  flushTools();
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
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
        {/* Meta Bar */}
        <div className="message-meta">
          <span>Deep Browser Copilot</span>
          <span>·</span>
          <span>{timeStr}</span>
          {message.modelName && <span className="pill">{message.modelName}</span>}
        </div>

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

          {/* Top reasoning if present on message and not yet in activities */}
          {!hasActivities && message.thought && (
            <ReasoningBlock thought={message.thought} isStreaming={isRunning} />
          )}

          {/* 1. Dynamic Activities Stream: Grouped tools, reasoning toggles, and show narrative */}
          {hasActivities ? (
            grouped.map((grp) => {
              if (grp.type === 'narrative' && grp.narrativeText) {
                return (
                  <div key={grp.id} className="chat-show-narrative">
                    <MarkdownRenderer content={grp.narrativeText} />
                  </div>
                );
              }
              if (grp.type === 'reasoning' && grp.thoughtText) {
                return (
                  <ReasoningBlock
                    key={grp.id}
                    thought={grp.thoughtText}
                    isStreaming={isRunning}
                  />
                );
              }
              if (grp.type === 'tools' && grp.steps && grp.steps.length > 0) {
                return (
                  <ToolStepsGroup
                    key={grp.id}
                    steps={grp.steps}
                    onViewScreenshot={(url, title) => {
                      setModalImage(url);
                      setModalTitle(title);
                    }}
                  />
                );
              }
              return null;
            })
          ) : (
            <>
              {/* Fallback for legacy messages with raw steps */}
              {steps.length > 0 && (
                <ToolStepsGroup
                  steps={steps}
                  onViewScreenshot={(url, title) => {
                    setModalImage(url);
                    setModalTitle(title);
                  }}
                />
              )}
            </>
          )}

          {/* 2. Interactive UI Widget (HITL: AskForm, choices, approvals) */}
          {message.hitl && <HitlApprovalCard hitl={message.hitl} />}

          {/* 3. AI Judge Evaluation Card (if audited) */}
          {message.judgeVerdict && <JudgeVerdictCard verdict={message.judgeVerdict} />}

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
