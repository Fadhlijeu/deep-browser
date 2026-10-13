import React, { useState } from 'react';
import { Bot, Clock, Copy, Check, ChevronRight, Brain, AlertCircle } from 'lucide-react';
import { ChatMessage } from '../../types';
import { ToolStepCard } from './ToolStepCard';
import { HitlApprovalCard } from './HitlApprovalCard';
import { MarkdownRenderer } from './MarkdownRenderer';

interface AssistantMessageProps {
  message: ChatMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [thoughtOpen, setThoughtOpen] = useState(false);
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

        {/* Real-time Execution Steps Accordion */}
        {steps.length > 0 && (
          <div className="timeline-accordion">
            <div className="timeline-accordion-header" onClick={() => setTimelineOpen(!timelineOpen)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ChevronRight
                  size={13}
                  style={{
                    transform: timelineOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
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

        {/* Thought / Reasoning Block (Collapsed by default for a clean, compact view) */}
        {message.thought && (
          <div className="thought-accordion">
            <div
              className="thought-accordion-header"
              onClick={() => setThoughtOpen(!thoughtOpen)}
            >
              <ChevronRight
                size={13}
                style={{
                  transform: thoughtOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
              <Brain size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />
              <span>Penalaran Agen (Reasoning)</span>
            </div>
            {thoughtOpen && (
              <div className="thought-accordion-body">
                {message.thought}
              </div>
            )}
          </div>
        )}

        {/* User-Friendly Response Body */}
        {message.text && (
          <div style={{ marginTop: '2px' }}>
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
