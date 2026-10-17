import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Clock, Copy, Check, ChevronRight, Brain, AlertCircle, Video, Download, BookmarkPlus, CheckCheck } from 'lucide-react';
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

  const { displayedText, isTyping } = useTypewriter(thought, {
    isStreaming,
    immediate: !isStreaming,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText]);

  return (
    <div className="info-card" style={{ marginBottom: '8px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Brain size={13} color="var(--accent)" />
          <span style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--ink)' }}>Agent Reasoning</span>
          {isTyping && <span className="status running" style={{ padding: '2px 5px', fontSize: '8px' }}>thinking...</span>}
        </div>
        <ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </div>
      {open && (
        <div ref={scrollRef} style={{ fontSize: '11px', lineHeight: 1.6, color: 'var(--muted)', marginTop: '8px', whiteSpace: 'pre-wrap' }}>
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

  const { displayedText: displayedMessageText, isTyping: isMessageTyping } = useTypewriter(
    message.text || '',
    {
      isStreaming: isRunning,
      immediate: !isCurrentMessage,
    }
  );

  const [isOpen, setIsOpen] = useState(isRunning);
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
          title: message.text?.slice(0, 32) || 'Workflow Skill',
          description: `Extracted workflow from run ${message.id}`,
          task: message.text || 'Workflow step automation',
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
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="message assistant" data-message-id={message.id}>
      <div className="message-avatar">
        <Sparkles size={15} />
      </div>

      <div className="message-main">
        {/* Meta Bar */}
        <div className="message-meta">
          <span>Deep Browser Copilot</span>
          <span>·</span>
          <span>{timeStr}</span>
          {message.modelName && <span className="pill">{message.modelName}</span>}
        </div>

        {/* Message Content Container */}
        <div className="message-content">
          {/* Real-time Tool Steps & Reasoning Accordion */}
          {hasActivities && (
            <div className="info-card" style={{ marginBottom: '10px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => setIsOpen(!isOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  <strong style={{ fontSize: '11px', color: 'var(--ink)' }}>Execution Steps &amp; Reasoning</strong>
                  {isRunning && (
                    <div className="typing" style={{ padding: '0 4px' }}>
                      <i /><i /><i />
                    </div>
                  )}
                </div>
                <span className="tiny muted">
                  {isRunning ? 'Running...' : `${totalStepsCount} steps completed`}
                </span>
              </div>

              {isOpen && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                </div>
              )}
            </div>
          )}

          {/* HITL Review Card */}
          {message.hitl && <HitlApprovalCard hitl={message.hitl} />}

          {/* AI Judge Evaluation Card */}
          {message.judgeVerdict && <JudgeVerdictCard verdict={message.judgeVerdict} />}

          {/* Assistant Text Response */}
          {displayedMessageText && (
            <div style={{ marginTop: '6px' }}>
              {message.isError && (
                <div className="callout" style={{ marginBottom: '8px', background: 'var(--red-soft)', borderColor: '#e8c4bd', color: 'var(--red)' }}>
                  <AlertCircle size={14} />
                  <span>Failed to process request</span>
                </div>
              )}
              <MarkdownRenderer content={displayedMessageText} />
              {isMessageTyping && <span className="typewriter-cursor" />}
            </div>
          )}

          {/* Video Session Playback Card */}
          {message.recordedVideo && (
            <div className="info-card" style={{ marginTop: '10px', padding: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 650 }}>
                  <Video size={13} color="var(--red)" />
                  <span>Tab Session Recording ({message.recordedVideo.durationSeconds}s)</span>
                </div>
                <a
                  href={message.recordedVideo.url}
                  download={message.recordedVideo.fileName}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--blue)', fontSize: '10px', textDecoration: 'none' }}
                >
                  <Download size={11} /> Download
                </a>
              </div>
              <video src={message.recordedVideo.url} controls style={{ width: '100%', maxHeight: '240px', borderRadius: '6px', background: '#000' }} />
            </div>
          )}
        </div>

        {/* Action Buttons Below Message */}
        <div className="message-actions">
          <button onClick={copyText} title="Copy response">
            {copied ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {!isRunning && totalStepsCount > 0 && !message.isError && (
            <button onClick={handleSaveSkill} title="Save this verified workflow as a reusable skill">
              {skillSaved ? <CheckCheck size={12} color="var(--green)" /> : <BookmarkPlus size={12} />}
              <span>{skillSaved ? 'Saved as Skill' : 'Save as Skill'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
