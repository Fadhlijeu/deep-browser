import React, { useState } from 'react';
import { ToolStep } from '../../types';

interface ToolStepCardProps {
  step: ToolStep;
}

export const ToolStepCard: React.FC<ToolStepCardProps> = ({ step }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPayload = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(JSON.stringify(step, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="tool-step-card">
      <div className="tool-step-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tool-step-left">
          <span className="material-symbols-outlined tool-step-icon">{step.icon}</span>
          <span className="tool-step-name" title={step.name}>{step.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {step.duration && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{step.duration}</span>}
          <span className={`tool-status-tag ${step.status}`}>{step.status}</span>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="tool-step-details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-tertiary)' }}>
              Waktu: {new Date(step.timestamp).toLocaleTimeString()}
            </span>
            <button className="icon-btn" onClick={copyPayload} title="Salin Payload" style={{ width: '20px', height: '20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>

          {step.args && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Argumen:</span>
              <pre style={{ margin: '2px 0', padding: '4px', background: 'var(--bg-subtle)', borderRadius: '3px' }}>
                {JSON.stringify(step.args, null, 2)}
              </pre>
            </div>
          )}

          {step.result !== undefined && (
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Hasil:</span>
              <pre style={{ margin: '2px 0', padding: '4px', background: 'var(--bg-subtle)', borderRadius: '3px' }}>
                {JSON.stringify(step.result, null, 2)}
              </pre>
            </div>
          )}

          {step.verification && (
            <div className="tool-verification-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
              <span>Bukti Terverifikasi: {JSON.stringify(step.verification)}</span>
            </div>
          )}

          {step.error && (
            <div style={{ color: 'var(--status-error)', fontWeight: 500 }}>
              Error: {step.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
