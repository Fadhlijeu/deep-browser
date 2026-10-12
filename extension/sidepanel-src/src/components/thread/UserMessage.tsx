import React, { useState } from 'react';
import { ChatMessage } from '../../types';

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
        {message.text}
      </div>
      <div className="user-meta">
        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <button
          className="icon-btn"
          onClick={copyText}
          title="Salin Pesan"
          style={{ width: '16px', height: '16px', padding: 0 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {copied ? 'check' : 'content_copy'}
          </span>
        </button>
      </div>
    </div>
  );
};
