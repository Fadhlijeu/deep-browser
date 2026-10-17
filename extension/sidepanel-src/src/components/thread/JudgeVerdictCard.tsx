import React, { useState } from 'react';
import { Scale, CheckCircle2, XCircle, ChevronDown, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';

interface JudgeVerdictProps {
  verdict: {
    verdict: boolean;
    score?: number;
    confidence?: number;
    reasoning?: string;
    failureReasons?: string[];
    task?: string;
    finalResult?: string;
    formattedSteps?: string[];
    model?: string;
    groundTruth?: string;
  };
}

export const JudgeVerdictCard: React.FC<JudgeVerdictProps> = ({ verdict }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isValid = Boolean(verdict.verdict);

  const confidencePct = typeof verdict.confidence === 'number'
    ? `${Math.round(verdict.confidence * 100)}%`
    : (verdict.score !== undefined ? `${Math.round(verdict.score * 100)}%` : null);

  // Normalize failure reasons safely (supports string[], string, or failure_reason)
  const rawFailureReasons = verdict.failureReasons || (verdict as any).failure_reason;
  const failureReasonsList: string[] = Array.isArray(rawFailureReasons)
    ? rawFailureReasons.filter(Boolean).map(String)
    : (rawFailureReasons ? [String(rawFailureReasons)] : []);

  // Normalize formatted steps safely (supports string[], multiline string, or empty)
  const formattedStepsList: string[] = Array.isArray(verdict.formattedSteps)
    ? verdict.formattedSteps.filter(Boolean).map(String)
    : (typeof verdict.formattedSteps === 'string'
      ? (verdict.formattedSteps as string).split('\n').map((s) => s.trim()).filter(Boolean)
      : []);

  return (
    <div
      style={{
        marginTop: '8px',
        marginBottom: '6px',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${isValid ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
        background: isValid ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)',
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Header Row */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          cursor: 'pointer',
          background: isValid ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Scale size={14} style={{ color: isValid ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
            AI Judge Evaluation
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '10px',
              background: isValid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: isValid ? '#4ade80' : '#f87171',
            }}
          >
            {isValid ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
            <span>{isValid ? 'VALID (BERHASIL)' : 'INVALID (BELUM MEMENUHI)'}</span>
          </span>
          {confidencePct && (
            <span style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              ({confidencePct})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {verdict.model && (
            <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', background: 'var(--bg-base)', padding: '1px 5px', borderRadius: '4px' }}>
              {verdict.model}
            </span>
          )}
          {isOpen ? <ChevronDown size={13} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={13} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </div>

      {/* Collapsible Details */}
      {isOpen && (
        <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
          {/* Reasoning / Explanation */}
          {verdict.reasoning && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                <Sparkles size={11} style={{ color: isValid ? '#22c55e' : '#ef4444' }} />
                <span>Penalaran Evaluator:</span>
              </div>
              <div
                style={{
                  background: 'var(--bg-base)',
                  padding: '7px 9px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                  fontSize: '10.5px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {verdict.reasoning}
              </div>
            </div>
          )}

          {/* Failure Reasons if any */}
          {failureReasonsList.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, color: '#f87171', marginBottom: '3px' }}>
                <AlertCircle size={11} />
                <span>Penyebab Ketidaksesuaian:</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>
                {failureReasonsList.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Evaluated Steps Trajectory Summary */}
          {formattedStepsList.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                Trajektori Langkah yang Dievaluasi ({formattedStepsList.length} langkah):
              </div>
              <div
                style={{
                  maxHeight: '130px',
                  overflowY: 'auto',
                  background: 'var(--bg-base)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '9.5px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                {formattedStepsList.map((st, i) => (
                  <div key={i} style={{ whiteSpace: 'pre-wrap' }}>
                    {st}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evaluated Task & Result Context */}
          {verdict.task && (
            <div style={{ fontSize: '9.5px', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '5px' }}>
              <span style={{ fontWeight: 600 }}>Tugas Target:</span> {verdict.task}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
