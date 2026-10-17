import React, { useState, useRef, useEffect } from 'react';
import { Bot, Clock, Copy, Check, ChevronRight, Brain, AlertCircle, Video, Download, BookmarkPlus, CheckCheck } from 'lucide-react';
import { ChatMessage } from '../../types';
import { ToolStepCard } from './ToolStepCard';
import { HitlApprovalCard } from './HitlApprovalCard';
import { JudgeVerdictCard } from './JudgeVerdictCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTypewriter } from '../../hooks/useTypewriter';

interface ReasoningItemProps {
  thought: string;
  isStreaming?: boolean;
}

const ReasoningItem: React.FC<ReasoningItemProps> = ({ thought, isStreaming = false }) => {
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dynamic accelerating typewriter with fade-in
  const { displayedText, isTyping } = useTypewriter(thought, {
    isStreaming,
    immediate: !isStreaming,
  });

  // Auto-scroll reasoning container to bottom as new tokens arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText]);

  return (
    <div className="activity-reasoning-item">
      <div className="activity-reasoning-header" onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Brain size={12} style={{ color: '#a78bfa', flexShrink: 0 }} />
          <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Penalaran Agen (Reasoning)
          </span>
          {isTyping && (
            <span className="reasoning-typing-pill">menalar...</span>
          )}
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </div>
      {open && (
        <div ref={scrollRef} className={`activity-reasoning-body ${isTyping ? 'typing-fade-in' : ''}`}>
          {displayedText}
          {isTyping && <span className="typewriter-cursor" />}
        </div>
      )}
    </div>
  );
};

interface AssistantMessageProps {
  message: ChatMessage;
  isCurrentMessage?: boolean;
  runState?: string;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isCurrentMessage = false,
  runState = 'idle',
}) => {
  const isRunning = isCurrentMessage && runState === 'running';

  // Dynamic accelerating typewriter with fade-in for normal response writing
  const { displayedText: displayedMessageText, isTyping: isMessageTyping } = useTypewriter(
    message.text || '',
    {
      isStreaming: isRunning,
      immediate: !isCurrentMessage,
    }
  );

  // State for unified activity accordion:
  // While running, open by default; once finished, auto-collapse so only final text is shown!
  const [userToggle, setUserToggle] = useState<boolean | null>(null);
  const isOpen = userToggle !== null ? userToggle : isRunning;

  const [copied, setCopied] = useState(false);
  const [skillSaved, setSkillSaved] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveSkill = async () => {
    try {
      const skillMgr = (window as any).SkillManager;
      if (skillMgr && skillMgr.recordRunToSkill) {
        await skillMgr.recordRunToSkill({
          title: message.text?.slice(0, 32) || 'Skill Alur Browser',
          description: `Otomatisasi langkah dari pesan ${message.id}`,
          task: message.text || 'Otomatisasi langkah',
          history: message.steps || [],
        });
        setSkillSaved(true);
        setTimeout(() => setSkillSaved(false), 3000);
      }
    } catch (e) {
      console.error('[SaveSkill Error]', e);
    }
  };

  const activities = message.activities || [];
  const steps = message.steps || [];
  const hasActivities = activities.length > 0 || steps.length > 0 || Boolean(message.thought);
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;

  return (
    <div className="assistant-message-row">
      <div className="assistant-card">
        {/* Run Metadata Strip */}
        <div className="assistant-meta-strip">
          <span className="meta-chip">
            <Bot size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <strong>{message.modelName || 'Deep Browser'}</strong>
          </span>
          <span className="meta-chip">
            <Clock size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
          <button
            className="icon-btn"
            onClick={copyText}
            title="Salin Jawaban"
            style={{ width: '20px', height: '20px', marginLeft: 'auto' }}
          >
            {copied ? (
              <Check size={12} style={{ color: 'var(--status-success)' }} />
            ) : (
              <Copy size={12} style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>
        </div>

        {/* Unified Real-time Interleaved Steps & Reasoning Accordion */}
        {hasActivities && (
          <div className="timeline-accordion">
            <div
              className="timeline-accordion-header"
              onClick={() => setUserToggle(!isOpen)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ChevronRight
                  size={13}
                  style={{
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600 }}>Langkah & Penalaran Browser</span>
                {isRunning && (
                  <div className="sleek-pulse-indicator" style={{ marginLeft: '6px' }}>
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                {isRunning ? 'Sedang Berjalan...' : `${totalStepsCount} langkah selesai`}
              </span>
            </div>

            {isOpen && (
              <div className="timeline-steps-list">
                {activities.length > 0 ? (
                  activities.map((act) => {
                    if (act.type === 'step' && act.step) {
                      return <ToolStepCard key={act.id} step={act.step} />;
                    }
                    if (act.type === 'reasoning' && act.thought) {
                      return <ReasoningItem key={act.id} thought={act.thought} isStreaming={isRunning} />;
                    }
                    return null;
                  })
                ) : (
                  <>
                    {steps.map((st) => (
                      <ToolStepCard key={st.id} step={st} />
                    ))}
                    {message.thought && (
                      <ReasoningItem thought={message.thought} isStreaming={isRunning} />
                    )}
                  </>
                )}

                {/* Sleek Minimal Monochrome Progress Indicator */}
                {isRunning && (
                  <div className="activity-loading-item">
                    <div className="sleek-pulse-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span>Mengeksekusi tindakan browser...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HITL Review Card */}
        {message.hitl && (
          <HitlApprovalCard hitl={message.hitl} />
        )}

        {/* AI Judge Evaluation Card */}
        {message.judgeVerdict && (
          <JudgeVerdictCard verdict={message.judgeVerdict} />
        )}

        {/* User-Friendly Response Body */}
        {displayedMessageText && (
          <div style={{ marginTop: '4px' }}>
            {message.isError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--status-error)', fontWeight: 600, marginBottom: '4px' }}>
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>Gagal Memproses Permintaan</span>
              </div>
            )}
            <div className={`markdown-body ${isMessageTyping ? 'typing-fade-in' : ''}`}>
              <MarkdownRenderer content={displayedMessageText} />
              {isMessageTyping && <span className="typewriter-cursor" />}
            </div>
          </div>
        )}

        {/* Video Session Playback Card */}
        {message.recordedVideo && (
          <div className="video-preview-card">
            <div className="video-preview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Video size={12} style={{ color: '#ef4444' }} />
                <span style={{ fontWeight: 600 }}>Rekaman Video Sesi ({message.recordedVideo.durationSeconds}s)</span>
              </div>
              <a
                href={message.recordedVideo.url}
                download={message.recordedVideo.fileName}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#60a5fa', textDecoration: 'none', fontSize: '10.5px' }}
                title="Unduh rekaman video WebM"
              >
                <Download size={11} /> Unduh
              </a>
            </div>
            <video src={message.recordedVideo.url} controls className="video-preview-player" />
          </div>
        )}

        {/* One-Click Save as Skill Button */}
        {!isRunning && totalStepsCount > 0 && !message.isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              className="save-skill-btn"
              onClick={handleSaveSkill}
              title="Simpan alur kerja ini sebagai skill lokal yang bisa dipakai ulang"
            >
              {skillSaved ? (
                <>
                  <CheckCheck size={12} style={{ color: '#34d399' }} />
                  <span>Tersimpan sebagai Skill!</span>
                </>
              ) : (
                <>
                  <BookmarkPlus size={12} />
                  <span>Simpan Alur sebagai Skill</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
