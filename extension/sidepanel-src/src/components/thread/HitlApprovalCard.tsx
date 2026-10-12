import React, { useState, useEffect, useRef } from 'react';
import { HitlInteraction } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface HitlApprovalCardProps {
  hitl: HitlInteraction;
}

export const HitlApprovalCard: React.FC<HitlApprovalCardProps> = ({ hitl }) => {
  const type = hitl.type || (hitl.options && hitl.options.length > 0 ? 'choice' : 'approval');

  // Text input state
  const [textVal, setTextVal] = useState<string>(String(hitl.defaultValue || ''));
  // Number input state
  const [numVal, setNumVal] = useState<number>(typeof hitl.defaultValue === 'number' ? hitl.defaultValue : 1);
  // Multi-choice state
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  // Edit mode for approval
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editFeedback, setEditFeedback] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (type === 'text_input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [type]);

  const handleApprove = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, true);
  };

  const handleReject = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, 'reject');
  };

  const handleEditSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, { action: 'edit', feedback: editFeedback || 'User requested change.' });
  };

  const handleChoice = (optionId: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, optionId);
  };

  const handleMultiChoiceSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, selectedChoices);
  };

  const toggleMultiChoice = (id: string) => {
    setSelectedChoices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleTextSubmit = () => {
    if (!textVal.trim() || isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, textVal.trim());
  };

  const handleNumberSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, numVal);
  };

  const handleWaitingResume = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    sidepanelStore.respondHitl(hitl.id, true);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (type === 'confirm') {
          e.preventDefault();
          sidepanelStore.respondHitl(hitl.id, false);
        } else if (isEditing) {
          setIsEditing(false);
        }
        return;
      }

      if (isInputFocused) return;

      if (type === 'confirm') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApprove();
        }
      } else if (type === 'approval') {
        if (e.key.toLowerCase() === 'a' || e.key === 'Enter') {
          e.preventDefault();
          handleApprove();
        } else if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          handleReject();
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          setIsEditing(true);
        }
      } else if (type === 'choice' && hitl.options) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= hitl.options.length) {
          const opt = hitl.options[num - 1];
          if (opt) {
            e.preventDefault();
            handleChoice(opt.id);
          }
        }
      } else if (type === 'waiting') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleWaitingResume();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hitl, type, isEditing, editFeedback, textVal, numVal]);

  const getHeaderIcon = () => {
    switch (type) {
      case 'choice': return 'help';
      case 'multi_choice': return 'checklist';
      case 'confirm': return 'help_center';
      case 'text_input': return 'edit_note';
      case 'number_input': return 'pin';
      case 'waiting': return 'hourglass_top';
      case 'approval':
      default: return 'shield';
    }
  };

  const getHeaderTitle = () => {
    switch (type) {
      case 'choice': return 'Pilih Opsi';
      case 'multi_choice': return 'Pilih Beberapa Opsi';
      case 'confirm': return 'Konfirmasi Tindakan';
      case 'text_input': return 'Input Pengguna Diperlukan';
      case 'number_input': return 'Masukkan Nilai Numerik';
      case 'waiting': return 'Menunggu Tindakan Manual';
      case 'approval':
      default: return 'Human-in-the-Loop Review';
    }
  };

  return (
    <div className="hitl-card" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="hitl-header">
        <div className="hitl-header-badge">
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{getHeaderIcon()}</span>
          <span>{getHeaderTitle()}</span>
          {type === 'waiting' && <span className="hitl-pulse-dot" />}
        </div>
        <span className="hitl-type-tag">{type}</span>
      </div>

      {/* Question / Title */}
      <div className="hitl-question">{hitl.question}</div>

      {/* Description if present */}
      {hitl.description && <div className="hitl-desc">{hitl.description}</div>}

      {/* Widget Specific Body */}
      {/* 1. Choice */}
      {type === 'choice' && hitl.options && hitl.options.length > 0 && (
        <div className="hitl-options-list" role="radiogroup">
          {hitl.options.map((opt, idx) => (
            <button
              key={opt.id}
              className="hitl-choice-btn"
              onClick={() => handleChoice(opt.id)}
              title={`Tekan tombol ${idx + 1}`}
            >
              <span className="hitl-choice-key">{idx + 1}</span>
              <div className="hitl-choice-content">
                <div className="hitl-choice-label">{opt.label}</div>
                {opt.description && <div className="hitl-choice-sub">{opt.description}</div>}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '15px', color: 'var(--text-tertiary)' }}>chevron_right</span>
            </button>
          ))}
        </div>
      )}

      {/* 2. Multi Choice */}
      {type === 'multi_choice' && hitl.options && hitl.options.length > 0 && (
        <div className="hitl-options-list">
          {hitl.options.map((opt) => {
            const checked = selectedChoices.includes(opt.id);
            return (
              <label key={opt.id} className="hitl-checkbox-row">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMultiChoice(opt.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontWeight: checked ? 600 : 400 }}>{opt.label}</span>
                {opt.description && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{opt.description}</span>}
              </label>
            );
          })}
          <div className="hitl-actions" style={{ marginTop: '6px' }}>
            <button
              className="btn-primary"
              onClick={handleMultiChoiceSubmit}
              disabled={selectedChoices.length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
              Lanjutkan ({selectedChoices.length} Dipilih)
            </button>
          </div>
        </div>
      )}

      {/* 3. Confirm */}
      {type === 'confirm' && (
        <div className="hitl-actions">
          <button className="btn-primary" onClick={handleApprove}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
            Ya, Lanjutkan (Enter)
          </button>
          <button className="btn-ghost" onClick={() => sidepanelStore.respondHitl(hitl.id, false)} style={{ color: 'var(--status-error)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
            Batal (Esc)
          </button>
        </div>
      )}

      {/* 4. Text Input */}
      {type === 'text_input' && (
        <div>
          <div className="hitl-text-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="hitl-input"
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTextSubmit();
                }
              }}
              placeholder={hitl.description || 'Ketik respon atau masukkan data di sini...'}
            />
            <button className="btn-primary" onClick={handleTextSubmit} disabled={!textVal.trim()}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>send</span>
              Kirim
            </button>
          </div>
        </div>
      )}

      {/* 5. Number Input */}
      {type === 'number_input' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="hitl-number-box">
            <button className="hitl-num-btn" onClick={() => setNumVal((v) => Math.max(0, v - 1))}>-</button>
            <span className="hitl-num-val">{numVal}</span>
            <button className="hitl-num-btn" onClick={() => setNumVal((v) => v + 1)}>+</button>
          </div>
          <button className="btn-primary" onClick={handleNumberSubmit}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
            Lanjutkan
          </button>
        </div>
      )}

      {/* 6. Approval (Proposal Review) */}
      {type === 'approval' && (
        <div>
          {hitl.action_name && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Aksi yang Diusulkan: <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{hitl.action_name}</strong>
            </div>
          )}
          {hitl.parameters && (
            <pre className="hitl-code-preview">
              {JSON.stringify(hitl.parameters, null, 2)}
            </pre>
          )}

          {isEditing ? (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                className="hitl-input"
                placeholder="Berikan instruksi modifikasi / perubahan..."
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit();
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn-primary" onClick={handleEditSubmit}>
                  Kirim Perubahan
                </button>
                <button className="btn-ghost" onClick={() => setIsEditing(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="hitl-actions">
              <button className="btn-primary" onClick={handleApprove} title="Shortcut: A atau Enter">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check</span>
                Setujui (A)
              </button>
              <button className="btn-ghost" onClick={handleReject} style={{ color: 'var(--status-error)' }} title="Shortcut: R">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>close</span>
                Tolak (R)
              </button>
              <button className="btn-secondary" onClick={() => setIsEditing(true)} title="Shortcut: E">
                <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>edit</span>
                Ubah (E)
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. Waiting (Manual CAPTCHA / Action) */}
      {type === 'waiting' && (
        <div className="hitl-actions">
          <button className="btn-primary" onClick={handleWaitingResume} style={{ background: 'var(--status-warning)', borderColor: 'var(--status-warning)', color: '#000' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>play_arrow</span>
            Saya Sudah Selesai, Lanjutkan (Enter)
          </button>
        </div>
      )}
    </div>
  );
};
