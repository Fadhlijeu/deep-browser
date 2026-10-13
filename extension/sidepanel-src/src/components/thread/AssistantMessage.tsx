import React, { useState, useRef, useEffect } from 'react';
import { Bot, Clock, Copy, Check, ChevronRight, Brain, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../../types';
import { ToolStepCard } from './ToolStepCard';
import { HitlApprovalCard } from './HitlApprovalCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ReasoningItemProps {
  thought: string;
  isStreaming?: boolean;
}

const ReasoningItem: React.FC<ReasoningItemProps> = ({ thought }) => {
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll reasoning container to bottom as new tokens arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thought]);

  return (
    <div className="activity-reasoning-item">
      <div className="activity-reasoning-header" onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Brain size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Penalaran Agen (Reasoning)
          </span>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      {open && (
        <div ref={scrollRef} className="activity-reasoning-body">
          {thought}
        </div>
      )}
    </div>
  );
};

interface AssistantMessageProps {
  message: ChatMessage;
  isCurrentMessage?: boolean;
  runState?: string;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isCurrentMessage = false,
  runState = 'idle',
}) => {
  const isRunning = isCurrentMessage && runState === 'running';

  // State for unified activity accordion:
  // While running, open by default; once finished, auto-collapse so only final text is shown!
  const [userToggle, setUserToggle] = useState<boolean | null>(null);
  const isOpen = userToggle !== null ? userToggle : isRunning;

  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const activities = message.activities || [];
  const steps = message.steps || [];
  const hasActivities = activities.length > 0 || steps.length > 0 || Boolean(message.thought);
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;

  return (
    <div className="assistant-message-row">
      <div className="assistant-card">
        {/* Run Metadata Strip */}
        <div className="assistant-meta-strip">
          <span className="meta-chip">
            <Bot size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <strong>{message.modelName || 'Deep Browser'}</strong>
          </span>
          <span className="meta-chip">
            <Clock size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
          <button
            className="icon-btn"
            onClick={copyText}
            title="Salin Jawaban"
            style={{ width: '20px', height: '20px', marginLeft: 'auto' }}
          >
            {copied ? (
              <Check size={12} style={{ color: 'var(--status-success)' }} />
            ) : (
              <Copy size={12} style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>
        </div>

        {/* Unified Real-time Interleaved Steps & Reasoning Accordion */}
        {hasActivities && (
          <div className="timeline-accordion">
            <div
              className="timeline-accordion-header"
              onClick={() => setUserToggle(!isOpen)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ChevronRight
                  size={13}
                  style={{
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>Langkah & Penalaran Browser</span>
                {isRunning && (
                  <div className="sleek-pulse-indicator" style={{ marginLeft: '6px' }}>
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {isRunning ? 'Sedang Berjalan...' : `${totalStepsCount} langkah selesai`}
              </span>
            </div>

            {isOpen && (
              <div className="timeline-steps-list">
                {activities.length > 0 ? (
                  activities.map((act) => {
                    if (act.type === 'step' && act.step) {
                      return <ToolStepCard key={act.id} step={act.step} />;
                    }
                    if (act.type === 'reasoning' && act.thought) {
                      return <ReasoningItem key={act.id} thought={act.thought} isStreaming={isRunning} />;
                    }
                    return null;
                  })
                ) : (
                  <>
                    {steps.map((st) => (
                      <ToolStepCard key={st.id} step={st} />
                    ))}
                    {message.thought && (
                      <ReasoningItem thought={message.thought} isStreaming={isRunning} />
                    )}
                  </>
                )}

                {/* Sleek Minimal Monochrome Progress Indicator */}
                {isRunning && (
                  <div className="activity-loading-item">
                    <div className="sleek-pulse-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Mengeksekusi tindakan browser...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HITL Review Card */}
        {message.hitl && (
          <HitlApprovalCard hitl={message.hitl} />
        )}

        {/* User-Friendly Response Body */}
        {message.text && (
          <div style={{ marginTop: '4px' }}>
            {message.isError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--status-error)', fontWeight: 600, marginBottom: '4px' }}>
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>Gagal Memproses Permintaan</span>
              </div>
            )}
            <div className="markdown-body">
              <MarkdownRenderer content={message.text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
