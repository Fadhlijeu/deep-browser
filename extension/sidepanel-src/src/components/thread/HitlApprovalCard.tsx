import React, { useState, useEffect, useRef } from 'react';
import {
  HelpCircle,
  ListChecks,
  ShieldAlert,
  Edit3,
  Hash,
  Hourglass,
  Check,
  X,
  Send,
  ChevronRight,
} from 'lucide-react';
import { HitlInteraction } from '../../types';
import { sidepanelStore } from '../../state/sidepanelStore';

interface HitlApprovalCardProps {
  hitl: HitlInteraction;
}

export const HitlApprovalCard: React.FC<HitlApprovalCardProps> = ({ hitl }) => {
  const type = hitl.type || (hitl.options && hitl.options.length > 0 ? 'choice' : 'approval');

  const [textVal, setTextVal] = useState<string>(String(hitl.defaultValue || ''));
  const [numVal, setNumVal] = useState<number>(typeof hitl.defaultValue === 'number' ? hitl.defaultValue : 1);
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
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

  const getHeaderIcon = () => {
    switch (type) {
      case 'choice': return <HelpCircle size={15} />;
      case 'multi_choice': return <ListChecks size={15} />;
      case 'confirm': return <HelpCircle size={15} />;
      case 'text_input': return <Edit3 size={15} />;
      case 'number_input': return <Hash size={15} />;
      case 'waiting': return <Hourglass size={15} />;
      case 'approval':
      default: return <ShieldAlert size={15} />;
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
      default: return 'Review Konfirmasi Diperlukan';
    }
  };

  return (
    <div className="hitl-card" role="dialog" aria-modal="true">
      {/* Header */}
      <div className="hitl-header">
        <div className="hitl-header-badge">
          {getHeaderIcon()}
          <span>{getHeaderTitle()}</span>
          {type === 'waiting' && <span className="status running" style={{ padding: '1px 5px', fontSize: '8px' }}>Menunggu</span>}
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
              type="button"
              className="hitl-choice-btn"
              onClick={() => handleChoice(opt.id)}
              disabled={isSubmitting}
            >
              <span className="hitl-choice-key">{idx + 1}</span>
              <div className="hitl-choice-content">
                <div className="hitl-choice-label">{opt.label}</div>
                {opt.description && <div className="hitl-choice-sub">{opt.description}</div>}
              </div>
              <ChevronRight size={14} color="var(--muted)" />
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
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMultiChoice(opt.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span style={{ fontWeight: checked ? 650 : 400, color: 'var(--ink)' }}>{opt.label}</span>
                {opt.description && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: 'auto' }}>{opt.description}</span>}
              </label>
            );
          })}
          <div className="hitl-actions" style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="btn primary small"
              onClick={handleMultiChoiceSubmit}
              disabled={selectedChoices.length === 0 || isSubmitting}
            >
              <Check size={12} />
              Lanjutkan ({selectedChoices.length} Dipilih)
            </button>
          </div>
        </div>
      )}

      {/* 3. Confirm */}
      {type === 'confirm' && (
        <div className="hitl-actions">
          <button type="button" className="btn primary small" onClick={handleApprove} disabled={isSubmitting}>
            <Check size={12} />
            Ya, Lanjutkan
          </button>
          <button type="button" className="btn danger small" onClick={() => sidepanelStore.respondHitl(hitl.id, false)} disabled={isSubmitting}>
            <X size={12} />
            Batal
          </button>
        </div>
      )}

      {/* 4. Text Input */}
      {type === 'text_input' && (
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
            disabled={isSubmitting}
          />
          <button
            type="button"
            className="btn primary"
            onClick={handleTextSubmit}
            disabled={!textVal.trim() || isSubmitting}
            style={{ padding: '8px 14px' }}
          >
            <Send size={12} />
            <span>Kirim</span>
          </button>
        </div>
      )}

      {/* 5. Number Input */}
      {type === 'number_input' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--bg)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setNumVal((v) => Math.max(0, v - 1))}
              style={{ border: 0, background: 'transparent', padding: '6px 10px', cursor: 'pointer', color: 'var(--ink)' }}
            >
              -
            </button>
            <span style={{ padding: '0 8px', fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 700, color: 'var(--ink)' }}>
              {numVal}
            </span>
            <button
              type="button"
              onClick={() => setNumVal((v) => v + 1)}
              style={{ border: 0, background: 'transparent', padding: '6px 10px', cursor: 'pointer', color: 'var(--ink)' }}
            >
              +
            </button>
          </div>
          <button type="button" className="btn primary small" onClick={handleNumberSubmit} disabled={isSubmitting}>
            <Check size={12} />
            Lanjutkan
          </button>
        </div>
      )}

      {/* 6. Approval (Proposal Review) */}
      {type === 'approval' && (
        <div>
          {hitl.action_name && (
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px' }}>
              Aksi yang Diusulkan: <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{hitl.action_name}</strong>
            </div>
          )}

          {hitl.parameters && (
            <pre style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '10px',
              fontFamily: 'var(--mono)',
              color: 'var(--ink)',
              maxHeight: '120px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              margin: '0 0 10px',
            }}>
              {JSON.stringify(hitl.parameters, null, 2)}
            </pre>
          )}

          {isEditing ? (
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                className="input"
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                placeholder="Tulis instruksi modifikasi atau koreksi..."
                style={{ fontSize: '11px', marginBottom: '8px' }}
              />
              <div className="hitl-actions">
                <button type="button" className="btn primary small" onClick={handleEditSubmit} disabled={isSubmitting}>
                  <Check size={12} /> Kirim Koreksi
                </button>
                <button type="button" className="btn ghost small" onClick={() => setIsEditing(false)}>
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="hitl-actions">
              <button type="button" className="btn primary small" onClick={handleApprove} disabled={isSubmitting}>
                <Check size={12} /> Setujui &amp; Jalankan
              </button>
              <button type="button" className="btn small" onClick={() => setIsEditing(true)} disabled={isSubmitting}>
                <Edit3 size={12} /> Edit Parameter
              </button>
              <button type="button" className="btn danger small" onClick={handleReject} disabled={isSubmitting}>
                <X size={12} /> Tolak Aksi
              </button>
            </div>
          )}
        </div>
      )}

      {/* 7. Waiting Manual Action */}
      {type === 'waiting' && (
        <div className="hitl-actions">
          <button type="button" className="btn primary small" onClick={handleWaitingResume} disabled={isSubmitting}>
            <Check size={12} />
            Saya Telah Selesai, Lanjutkan
          </button>
        </div>
      )}
    </div>
  );
};
