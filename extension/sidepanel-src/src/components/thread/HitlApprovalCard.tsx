import React from 'react';
import { HitlInteraction } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface HitlApprovalCardProps {
  hitl: HitlInteraction;
}

export const HitlApprovalCard: React.FC<HitlApprovalCardProps> = ({ hitl }) => {
  const handleApprove = () => {
    sidepanelStore.respondHitl(hitl.id, true);
  };

  const handleReject = () => {
    sidepanelStore.respondHitl(hitl.id, false);
  };

  const handleChoice = (optionId: string) => {
    sidepanelStore.respondHitl(hitl.id, optionId);
  };

  return (
    <div className="hitl-card">
      <div className="hitl-header">
        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>shield</span>
        <span>Human-in-the-Loop Review</span>
      </div>

      <div className="hitl-question">{hitl.question}</div>

      <div className="hitl-actions">
        {hitl.options && hitl.options.length > 0 ? (
          hitl.options.map((opt) => (
            <button
              key={opt.id}
              className="btn-secondary"
              onClick={() => handleChoice(opt.id)}
            >
              {opt.label}
            </button>
          ))
        ) : (
          <>
            <button className="btn-primary" onClick={handleApprove}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
              Setujui & Jalankan
            </button>
            <button
              className="btn-ghost"
              onClick={handleReject}
              style={{ color: 'var(--status-error)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
              Tolak
            </button>
          </>
        )}
      </div>
    </div>
  );
};
