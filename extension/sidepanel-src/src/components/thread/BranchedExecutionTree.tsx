import React, { useState } from 'react';
import { Eye, MousePointer, ShieldCheck, Sparkles, ChevronRight, Copy, Check, Terminal } from 'lucide-react';
import { ToolStep } from '../../types';

interface BranchedExecutionTreeProps {
  steps: ToolStep[];
  isExecuting?: boolean;
}

export const BranchedExecutionTree: React.FC<BranchedExecutionTreeProps> = ({ steps, isExecuting }) => {
  // If no step is explicitly selected, default to the currently running step or the last step
  const runningIndex = steps.findIndex((s) => s.status === 'running');
  const defaultActiveIndex = runningIndex !== -1 ? runningIndex : Math.max(0, steps.length - 1);

  const [activeStepIndex, setActiveStepIndex] = useState<number>(defaultActiveIndex);
  const [openDrawerIndex, setOpenDrawerIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!steps || steps.length === 0) return null;

  const ROW_HEIGHT = 38;
  const START_Y = 24;
  const RADIUS = 10;
  const TARGET_X = 34;
  const SPINE_X = 14;

  const totalHeight = Math.max(156, steps.length * ROW_HEIGHT + 16);
  const lastArcStart = START_Y + (steps.length - 1) * ROW_HEIGHT - RADIUS;

  // Icon mapping according to tool intent
  const getStepIcon = (name: string, index: number) => {
    const lower = name.toLowerCase();
    if (lower.includes('observe') || lower.includes('inspect') || lower.includes('dom') || lower.includes('read') || index === 0) {
      return <Eye size={13} />;
    }
    if (lower.includes('act') || lower.includes('click') || lower.includes('type') || lower.includes('scroll') || index === 1) {
      return <MousePointer size={13} />;
    }
    if (lower.includes('verify') || lower.includes('evidence') || lower.includes('validate') || index === 2) {
      return <ShieldCheck size={13} />;
    }
    if (lower.includes('synthesize') || lower.includes('answer') || lower.includes('final') || index === 3) {
      return <Sparkles size={13} />;
    }
    return <Terminal size={13} />;
  };

  const handleCopyPayload = (step: ToolStep, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(JSON.stringify(step, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <nav className="branched-menu" style={{ width: '100%', margin: '4px 0' }}>
      <div className="branched-menu__section">
        <input type="checkbox" id="exec-tree-sec" className="sec-toggle" defaultChecked />
        <span className="branched-menu__marker" aria-hidden="true"></span>
        <label htmlFor="exec-tree-sec" className="branched-menu__head">
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#ffffff' }}>●</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
              Pohon Tindakan Terverifikasi
            </span>
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {activeStepIndex + 1} / {steps.length} {steps[activeStepIndex]?.name || ''}
          </span>
        </label>

        <div className="branched-menu__body" style={{ gridTemplateRows: '1fr' }}>
          <div className="branched-menu__fold">
            <div className="branched-menu__tree" style={{ minHeight: `${totalHeight}px` }}>
              {/* Continuous Curved SVG Vector Spine & Branch Reach Lines */}
              <svg
                className="branched-menu__lines"
                width="44"
                height={totalHeight}
                style={{ opacity: 1, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
                aria-hidden="true"
              >
                {/* Base vertical spine */}
                <path
                  className="branched-menu__base"
                  d={`M ${SPINE_X} 0 V ${lastArcStart}`}
                  style={{ stroke: 'var(--border-subtle)', strokeWidth: 2, fill: 'none' }}
                />

                {/* Curved branches outlines for each node */}
                {steps.map((_, i) => {
                  const centerY = START_Y + i * ROW_HEIGHT;
                  const arcStart = centerY - RADIUS;
                  return (
                    <path
                      key={`base-${i}`}
                      className="branched-menu__base"
                      d={`M ${SPINE_X} ${arcStart} A ${RADIUS} ${RADIUS} 0 0 0 ${SPINE_X + RADIUS} ${centerY} H ${TARGET_X}`}
                      style={{ stroke: 'var(--border-subtle)', strokeWidth: 2, fill: 'none' }}
                    />
                  );
                })}

                {/* Dynamic animated reach highlight paths */}
                {steps.map((_, i) => {
                  const centerY = START_Y + i * ROW_HEIGHT;
                  const arcStart = centerY - RADIUS;
                  const pathLength = arcStart + (Math.PI * RADIUS) / 2 + (TARGET_X - (SPINE_X + RADIUS));
                  const isActive = i === activeStepIndex;

                  return (
                    <path
                      key={`reach-${i}`}
                      className="branched-menu__reach"
                      d={`M ${SPINE_X} 0 V ${arcStart} A ${RADIUS} ${RADIUS} 0 0 0 ${SPINE_X + RADIUS} ${centerY} H ${TARGET_X}`}
                      style={{
                        stroke: '#ffffff',
                        strokeWidth: 2,
                        fill: 'none',
                        filter: isActive ? 'drop-shadow(0 0 5px rgba(255, 255, 255, 0.75))' : 'none',
                        strokeDasharray: `${pathLength.toFixed(2)}`,
                        strokeDashoffset: isActive ? '0' : `${pathLength.toFixed(2)}`,
                        transition: 'stroke-dashoffset 420ms cubic-bezier(0.23, 1, 0.32, 1)',
                      }}
                    />
                  );
                })}
              </svg>

              {/* Step Items Stack */}
              {steps.map((step, i) => {
                const isActive = i === activeStepIndex;
                const isDrawerOpen = openDrawerIndex === i;

                return (
                  <div key={step.id || i} className="branched-menu__item-wrapper">
                    <input
                      type="radio"
                      name="branched-tree-selection"
                      id={`tree-step-radio-${i}`}
                      className="item-radio"
                      checked={isActive}
                      onChange={() => setActiveStepIndex(i)}
                    />
                    <label
                      htmlFor={`tree-step-radio-${i}`}
                      className="branched-menu__item"
                      onClick={() => {
                        setActiveStepIndex(i);
                        setOpenDrawerIndex(isDrawerOpen ? null : i);
                      }}
                      style={{
                        height: `${ROW_HEIGHT}px`,
                        paddingLeft: '44px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        borderRadius: '8px',
                        textShadow: isActive ? '0 0 10px rgba(255, 255, 255, 0.4)' : 'none',
                        transition: 'all 200ms ease',
                      }}
                    >
                      <span
                        className="branched-menu__icon"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isActive ? '#ffffff' : 'inherit',
                          transform: isActive ? 'scale(1.15)' : 'none',
                          filter: isActive ? 'drop-shadow(0 0 6px rgba(255, 255, 255, 0.8))' : 'none',
                          transition: 'transform 200ms ease, color 200ms ease',
                        }}
                      >
                        {getStepIcon(step.name, i)}
                      </span>
                      <span
                        className="branched-menu__label"
                        style={{
                          fontSize: '13px',
                          letterSpacing: '-0.01em',
                          fontFamily: 'var(--font-sans)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {i + 1}. {step.name}
                      </span>
                      <ChevronRight
                        size={12}
                        style={{
                          marginLeft: 'auto',
                          color: 'var(--text-tertiary)',
                          transform: isDrawerOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform 200ms ease',
                        }}
                      />
                    </label>

                    {/* Expandable Technical Details Drawer */}
                    {isDrawerOpen && (
                      <div
                        className="item-detail-drawer"
                        style={{
                          display: 'block',
                          marginLeft: '44px',
                          marginRight: '8px',
                          marginBottom: '8px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '11.5px',
                          lineHeight: 1.5,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
                            Rincian Langkah Eksekusi
                          </span>
                          <button
                            className="icon-btn"
                            onClick={(e) => handleCopyPayload(step, i, e)}
                            title="Salin Payload Langkah"
                            style={{ width: '20px', height: '20px' }}
                          >
                            {copiedIndex === i ? (
                              <Check size={12} style={{ color: 'var(--status-success)' }} />
                            ) : (
                              <Copy size={12} style={{ color: 'var(--text-secondary)' }} />
                            )}
                          </button>
                        </div>

                        {step.args && (
                          <div style={{ marginBottom: '6px' }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '10.5px' }}>Argumen:</div>
                            <pre
                              style={{
                                margin: '2px 0',
                                padding: '6px',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-secondary)',
                                overflowX: 'auto',
                              }}
                            >
                              {typeof step.args === 'string' ? step.args : JSON.stringify(step.args, null, 2)}
                            </pre>
                          </div>
                        )}

                        {step.verification && (
                          <div
                            style={{
                              padding: '6px 8px',
                              background: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              borderRadius: '4px',
                              color: 'var(--status-success)',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <ShieldCheck size={12} />
                            <span>Bukti Terverifikasi: {JSON.stringify(step.verification)}</span>
                          </div>
                        )}

                        {step.error && (
                          <div style={{ color: 'var(--status-error)', fontWeight: 500, marginTop: '4px' }}>
                            Error: {step.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
