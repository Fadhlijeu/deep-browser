import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { ToolStepCard } from './ToolStepCard';
import { HitlApprovalCard } from './HitlApprovalCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AssistantMessageProps {
  message: ChatMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const [timelineOpen, setTimelineOpen] = useState(true);
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
        </div>

        {/* Execution Timeline Accordion */}
        {steps.length > 0 && (
          <div className="timeline-accordion">
            <div className="timeline-accordion-header" onClick={() => setTimelineOpen(!timelineOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', transform: timelineOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
                  chevron_right
                </span>
                <span>Execution Timeline</span>
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

        {/* Markdown Response Body */}
        {message.text && (
          <div style={{ marginTop: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: message.isError ? 'var(--status-error)' : 'var(--status-success)', fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                  {message.isError ? 'error' : 'check_circle'}
                </span>
                <span>{message.isError ? 'Gagal Dieksekusi' : 'Jawaban Akhir Agent'}</span>
              </div>
              <button
                className="icon-btn"
                onClick={copyText}
                title="Salin Jawaban"
                style={{ width: '20px', height: '20px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
            <div className="markdown-body">
              <MarkdownRenderer content={message.text} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
