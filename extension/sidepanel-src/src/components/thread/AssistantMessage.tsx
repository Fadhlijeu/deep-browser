import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { ToolStepCard } from './ToolStepCard';
import { HitlApprovalCard } from './HitlApprovalCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AssistantMessageProps {
  message: ChatMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [thoughtOpen, setThoughtOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const steps = message.steps || [];

  return (
    <div className="assistant-message-row">
      <div className="assistant-card">
        {/* Run Metadata Strip */}
        <div className="assistant-meta-strip">
          <span className="meta-chip">
            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--accent)' }}>bolt</span>
            <strong>{message.modelName || 'Deep Browser'}</strong>
          </span>
          <span className="meta-chip">
            <span className="material-symbols-outlined" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>schedule</span>
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
          {message.preset && (
            <span className="meta-chip preset-chip">
              {message.preset.toUpperCase()}
            </span>
          )}
          <button
            className="icon-btn"
            onClick={copyText}
            title="Salin Jawaban"
            style={{ width: '18px', height: '18px', marginLeft: 'auto' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
        </div>

        {/* Execution Timeline Accordion (Collapsed by default so user sees the answer first) */}
        {steps.length > 0 && (
          <div className="timeline-accordion">
            <div className="timeline-accordion-header" onClick={() => setTimelineOpen(!timelineOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', transform: timelineOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                  chevron_right
                </span>
                <span>Langkah Tindakan Browser</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {steps.length} langkah
              </span>
            </div>

            {timelineOpen && (
              <div className="timeline-steps-list">
                {steps.map((st) => (
                  <ToolStepCard key={st.id} step={st} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* HITL Review Card */}
        {message.hitl && (
          <HitlApprovalCard hitl={message.hitl} />
        )}

        {/* Thought / Reasoning Block */}
        {message.thought && (
          <div className="thought-accordion" style={{ margin: '6px 0', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.05)', overflow: 'hidden' }}>
            <div
              onClick={() => setThoughtOpen(!thoughtOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', cursor: 'pointer', fontSize: '11px', color: '#a78bfa', fontWeight: 600, userSelect: 'none' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px', transform: thoughtOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                chevron_right
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>psychology</span>
              <span>Penalaran Agen (Reasoning)</span>
            </div>
            {thoughtOpen && (
              <div style={{ padding: '6px 10px 8px 10px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', borderTop: '1px solid rgba(139, 92, 246, 0.15)', maxHeight: '180px', overflowY: 'auto' }}>
                {message.thought}
              </div>
            )}
          </div>
        )}

        {/* User-Friendly Response Body */}
        {message.text && (
          <div style={{ marginTop: '2px' }}>
            {message.isError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--status-error)', fontWeight: 600, marginBottom: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>error</span>
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
