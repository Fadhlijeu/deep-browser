import React, { useState } from 'react';
import { Copy, Check, Paperclip } from 'lucide-react';
import { ChatMessage } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface UserMessageProps {
  message: ChatMessage;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="user-message-row">
      {message.stagedFiles && message.stagedFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px', justifyContent: 'flex-end' }}>
          {message.stagedFiles.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                fontSize: '10.5px',
                color: '#93c5fd',
              }}
            >
              <Paperclip size={10} />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="user-bubble">
        <MarkdownRenderer content={message.text} />
      </div>
      <div className="user-meta">
        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <button
          className="icon-btn"
          onClick={copyText}
          title="Salin Pesan"
          style={{ width: '18px', height: '18px', padding: 0 }}
        >
          {copied ? (
            <Check size={11} style={{ color: 'var(--status-success)' }} />
          ) : (
            <Copy size={11} style={{ color: 'var(--text-tertiary)' }} />
          )}
        </button>
      </div>
    </div>
  );
};

