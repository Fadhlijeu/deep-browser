import React, { useState } from 'react';
import { Copy, Check, FileText, Pencil } from 'lucide-react';
import { ChatMessage } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (text: string) => void;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, onEdit }) => {
  const [copied, setCopied] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="message user" data-message-id={message.id}>
      <div className="message-avatar">DB</div>
      <div className="message-main">
        <div className="message-meta">
          <span>You</span>
          <span>·</span>
          <span>{timeStr}</span>
        </div>

        <div className="message-content">
          <MarkdownRenderer content={message.text} />

          {message.stagedFiles && message.stagedFiles.length > 0 && (
            <div className="toolbar" style={{ marginTop: '8px', justifyContent: 'flex-end' }}>
              {message.stagedFiles.map((f) => (
                <span key={f.id} className="pill">
                  <FileText size={10} />
                  <span>{f.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="message-actions">
          {onEdit && (
            <button onClick={() => onEdit(message.text)} title="Edit and resend prompt">
              <Pencil size={11} />
              <span>Edit &amp; resend</span>
            </button>
          )}
          <button onClick={copyText} title="Copy message">
            {copied ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
