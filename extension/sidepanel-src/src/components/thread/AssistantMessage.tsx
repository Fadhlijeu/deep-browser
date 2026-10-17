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
  Brain,
  ChevronRight,
  Compass,
  Search,
  MousePointer,
  Edit3,
  FileText,
  ArrowDown,
  Eye,
  Terminal,
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

// 1. Tool Call Eventlog Item in Chat Stream
const ToolCallItem: React.FC<{ step: ToolStep }> = ({ step }) => {
  const [open, setOpen] = useState(false);

  const getToolIcon = (name: string, iconStr?: string) => {
    const n = (name || iconStr || '').toLowerCase();
    if (n.includes('nav') || n.includes('buka') || n.includes('url')) return <Compass size={12} />;
    if (n.includes('search') || n.includes('cari')) return <Search size={12} />;
    if (n.includes('click') || n.includes('klik') || n.includes('touch')) return <MousePointer size={12} />;
    if (n.includes('type') || n.includes('input') || n.includes('ketik')) return <Edit3 size={12} />;
    if (n.includes('extract') || n.includes('ekstrak') || n.includes('pdf')) return <FileText size={12} />;
    if (n.includes('scroll')) return <ArrowDown size={12} />;
    if (n.includes('obs') || n.includes('baca') || n.includes('lihat')) return <Eye size={12} />;
    return <Terminal size={12} />;
  };

  const hasDetail = Boolean(step.args || step.result || step.error || step.verification);

  return (
    <div className="chat-tool-eventlog">
      <div className="chat-tool-head" onClick={() => hasDetail && setOpen(!open)}>
        <span className="chat-tool-icon">{getToolIcon(step.name, step.icon)}</span>
        <span className="chat-tool-name" title={step.name}>{step.name}</span>
        {step.duration && <span className="chat-tool-duration">{step.duration}</span>}
        <span className={`status ${step.status === 'succeeded' ? 'success' : step.status === 'failed' ? 'failed' : 'running'}`}>
          {step.status === 'succeeded' ? 'succeeded' : step.status === 'failed' ? 'failed' : 'running'}
        </span>
        {hasDetail && (
          <ChevronRight size={11} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--muted)' }} />
        )}
      </div>
      {open && hasDetail && (
        <pre className="chat-tool-detail mono">
          {JSON.stringify(step.args || step.result || { error: step.error, verification: step.verification }, null, 2)}
        </pre>
      )}
    </div>
  );
};

// 2. AI Reasoning Eventlog Block (Unshow)
const ReasoningBlock: React.FC<{ thought: string; isStreaming?: boolean }> = ({ thought, isStreaming }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="chat-reasoning-eventlog">
      <div className="chat-reasoning-head" onClick={() => setOpen(!open)}>
        <div className="chat-reasoning-title">
          <Brain size={13} color="var(--accent)" />
          <span>AI Reasoning</span>
          {isStreaming && <span className="status running" style={{ padding: '1px 5px', fontSize: '8px' }}>thinking...</span>}
        </div>
        <span className="chat-reasoning-sub">
          {open ? 'Sembunyikan' : 'Lihat pemikiran'}
        </span>
        <ChevronRight size={12} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--muted)' }} />
      </div>
      {open && (
        <div className="chat-reasoning-body">
          <MarkdownRenderer content={thought} />
        </div>
      )}
    </div>
  );
};

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isCurrentMessage = false,
  runState = 'idle',
  onRegenerate,
  onToggleInspector,
}) => {
  const isRunning = isCurrentMessage && runState === 'running';

  // Fallback text if there are no activities and message text is empty
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
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="message assistant" data-message-id={message.id}>
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

          {/* 1. Dynamic Activities Stream (Show narrative, Unshow reasoning, Tool calls eventlog) */}
          {hasActivities ? (
            activities.map((act) => {
              if (act.type === 'narrative' && act.text) {
                return (
                  <div key={act.id} className="chat-show-narrative">
                    <MarkdownRenderer content={act.text} />
                  </div>
                );
              }
              if (act.type === 'reasoning' && act.thought) {
                return (
                  <ReasoningBlock key={act.id} thought={act.thought} isStreaming={isRunning} />
                );
              }
              if (act.type === 'step' && act.step) {
                return (
                  <ToolCallItem key={act.id} step={act.step} />
                );
              }
              return null;
            })
          ) : (
            <>
              {/* Fallback for legacy messages: reasoning block if thought exists */}
              {message.thought && (
                <ReasoningBlock thought={message.thought} isStreaming={isRunning} />
              )}
              {/* Fallback for legacy messages: tool calls if steps exist */}
              {steps.map((st) => (
                <ToolCallItem key={st.id} step={st} />
              ))}
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
