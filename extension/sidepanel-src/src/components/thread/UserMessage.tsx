import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
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

