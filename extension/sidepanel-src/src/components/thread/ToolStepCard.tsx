import React, { useState } from 'react';
import { ToolStep } from '../../types';

interface ToolStepCardProps {
  step: ToolStep;
  defaultOpen?: boolean;
}

export function normalizeImageSrc(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const s = val.trim();
  if (!s || s === 'Captured' || s === 'OK') return null;
  if (s.startsWith('data:image') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) {
    return s;
  }
  // Check if it's base64 (PNG starts with iVBOR, JPEG with /9j/, WebP with UklG, or raw base64 string)
  if (s.startsWith('iVBOR') || s.startsWith('/9j/') || s.startsWith('UklG') || (s.length > 50 && !s.includes(' ') && !s.includes('\n'))) {
    return `data:image/png;base64,${s}`;
  }
  return null;
}

export const ToolStepCard: React.FC<ToolStepCardProps> = ({ step }) => {
  // Always default to false - step details remain collapsed unless explicitly clicked
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  // Extract screenshot image data if present
  const resultObj = step.result && typeof step.result === 'object' ? (step.result as any) : null;
  const rawCandidate = resultObj?.screenshotDataUrl || resultObj?.screenshot || (typeof step.result === 'string' ? step.result : null);
  const screenshotImgSrc = normalizeImageSrc(rawCandidate);
  const hasScreenshotImage = Boolean(screenshotImgSrc);

  const copyPayload = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(JSON.stringify(step, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Filter huge base64 data out of the JSON snippet display so user sees clean JSON
  const getCleanResult = () => {
    if (!step.result) return undefined;
    if (typeof step.result === 'string' && normalizeImageSrc(step.result)) {
      return { screenshot: '[Gambar Tangkapan Layar Viewport]' };
    }
    if (typeof step.result === 'object') {
      const copy: any = { ...step.result };
      if (copy.screenshotDataUrl && normalizeImageSrc(copy.screenshotDataUrl)) {
        copy.screenshotDataUrl = '[Gambar Tangkapan Layar Viewport]';
      }
      if (copy.screenshot && normalizeImageSrc(copy.screenshot)) {
        copy.screenshot = '[Gambar Tangkapan Layar Viewport]';
      }
      return copy;
    }
    return step.result;
  };

  return (
    <div className={`tool-step-card ${step.status === 'running' ? 'is-running' : ''}`}>
      <div className="tool-step-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="tool-step-left">
          <span className="material-symbols-outlined tool-step-icon">{step.icon}</span>
          <span className="tool-step-name" title={step.name}>{step.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {step.duration && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{step.duration}</span>}
          <span className={`tool-status-tag ${step.status}`}>
            {step.status === 'running' && <span className="sleek-micro-spinner" />}
            {step.status}
          </span>
          <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="tool-step-details">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
              Waktu: {new Date(step.timestamp).toLocaleTimeString()}
            </span>
            <button className="icon-btn" onClick={copyPayload} title="Salin Payload" style={{ width: '20px', height: '20px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                {copied ? 'check' : 'content_copy'}
              </span>
            </button>
          </div>

          {/* Screenshot Visual Image Preview */}
          {hasScreenshotImage && screenshotImgSrc && (
            <div className="tool-screenshot-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Tangkapan Layar Viewport
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={(e) => { e.stopPropagation(); setShowImageModal(true); }}
                  style={{ fontSize: '10px', padding: '2px 5px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>zoom_in</span>
                  <span>Perbesar</span>
                </button>
              </div>
              <div
                className="tool-screenshot-preview"
                onClick={(e) => { e.stopPropagation(); setShowImageModal(true); }}
                title="Klik untuk memperbesar gambar"
              >
                <img
                  src={screenshotImgSrc}
                  alt="Tangkapan layar viewport"
                  className="tool-screenshot-img"
                />
              </div>
            </div>
          )}

          {step.args && (
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Argumen:</span>
              <pre style={{ margin: '2px 0', padding: '4px', background: 'var(--bg-subtle)', borderRadius: '3px', fontSize: '9.5px', overflowX: 'auto' }}>
                {JSON.stringify(step.args, null, 2)}
              </pre>
            </div>
          )}

          {step.result !== undefined && (
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Hasil:</span>
              <pre style={{ margin: '2px 0', padding: '4px', background: 'var(--bg-subtle)', borderRadius: '3px', fontSize: '9.5px', overflowX: 'auto' }}>
                {JSON.stringify(getCleanResult(), null, 2)}
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
            <div style={{ color: 'var(--status-error)', fontSize: '10.5px', fontWeight: 500 }}>
              Error: {step.error}
            </div>
          )}
        </div>
      )}

      {/* Lightbox Modal for Full View Screenshot */}
      {showImageModal && hasScreenshotImage && screenshotImgSrc && (
        <div className="modal-backdrop" onClick={() => setShowImageModal(false)} style={{ zIndex: 9999 }}>
          <div className="screenshot-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="screenshot-modal-header">
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Tangkapan Layar Viewport</span>
              <button className="icon-btn" onClick={() => setShowImageModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
            <div className="screenshot-modal-body">
              <img src={screenshotImgSrc} alt="Full Screenshot Preview" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
