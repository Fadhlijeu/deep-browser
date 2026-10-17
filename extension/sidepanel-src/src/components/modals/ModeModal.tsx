import React from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { ExecutionMode } from '../../types';

interface ModeModalProps {
  isOpen: boolean;
  selectedMode: ExecutionMode;
  onSelectMode: (mode: ExecutionMode) => void;
  onClose: () => void;
}

interface ModeDef {
  id: ExecutionMode;
  name: string;
  description: string;
}

const MODES: ModeDef[] = [
  {
    id: 'agent_decide',
    name: 'Agent Decide',
    description: 'Follow configured decision policy. Actions may proceed autonomously or request review based on action risk.',
  },
  {
    id: 'auto',
    name: 'Always Proceed',
    description: 'Proceed within configured capabilities and permissions. Built-in security controls remain active.',
  },
  {
    id: 'hitl',
    name: 'Request Review',
    description: 'Request human review before sensitive actions that need approval (forms, deletes, messages, payments).',
  },
];

export const ModeModal: React.FC<ModeModalProps> = ({
  isOpen,
  selectedMode,
  onSelectMode,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modeModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Head */}
        <div className="modal-head">
          <div>
            <div className="modal-title" id="modeModalTitle">Agent execution mode</div>
            <div className="modal-sub">
              Choose how the autonomous agent handles decisions and review gates.
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          <div className="mode-options">
            {MODES.map((m) => {
              const isActive = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`mode-option ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectMode(m.id)}
                >
                  <span className="radio-mark" />
                  <div>
                    <strong>{m.name}</strong>
                    <p>{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="callout" style={{ marginTop: '14px' }}>
            <ShieldCheck size={16} />
            <span>
              Always Proceed does not bypass critical security controls. Destructive actions will still be flagged before execution.
            </span>
          </div>
        </div>

        {/* Foot */}
        <div className="modal-foot">
          <span className="muted tiny">Applies immediately to the active session.</span>
          <div className="modal-foot-right">
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
