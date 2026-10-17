import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Video,
  Download,
  BookmarkPlus,
  CheckCheck,
  RefreshCw,
  Activity
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { HitlApprovalCard } from './HitlApprovalCard';
import { JudgeVerdictCard } from './JudgeVerdictCard';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useTypewriter } from '../../hooks/useTypewriter';

interface AssistantMessageProps {
  message: ChatMessage;
  isCurrentMessage?: boolean;
  runState?: string;
  onRegenerate?: () => void;
  onToggleInspector?: () => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isCurrentMessage = false,
  runState = 'idle',
  onRegenerate,
  onToggleInspector,
}) => {
  const isRunning = isCurrentMessage && runState === 'running';

  // Determine text to show: real text > reasoning thought > fallback
  const rawContent = message.text || message.thought || (isRunning ? 'Memproses navigasi dan automasi browser...' : 'Halo! Ada yang bisa saya bantu dengan browser Anda hari ini?');

  const { displayedText, isTyping } = useTypewriter(
    rawContent,
    {
      isStreaming: isRunning,
      immediate: !isCurrentMessage,
    }
  );

  const [copied, setCopied] = useState(false);
  const [skillSaved, setSkillSaved] = useState(false);

  const copyText = () => {
    navigator.clipboard?.writeText?.(message.text || rawContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveSkill = async () => {
    try {
      const skillMgr = (window as any).SkillManager;
      if (skillMgr && skillMgr.recordRunToSkill) {
        await skillMgr.recordRunToSkill({
          title: (message.text || rawContent).slice(0, 32) || 'Workflow Skill',
          description: `Extracted workflow from run ${message.id}`,
          task: message.text || rawContent,
          history: message.steps || [],
        });
        setSkillSaved(true);
        setTimeout(() => setSkillSaved(false), 3000);
      }
    } catch (e) {
      console.error('[SaveSkill Error]', e);
    }
  };

  const steps = message.steps || [];
  const activities = message.activities || [];
  const totalStepsCount = steps.length || activities.filter((a) => a.type === 'step').length;
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <article className="message assistant" data-message-id={message.id}>
      {/* Avatar */}
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

        {/* Message Content: Clean borderless canvas text matching prototype */}
        <div className="message-content">
          {message.isError && (
            <div
              className="callout"
              style={{
                marginBottom: '8px',
                background: 'var(--red-soft)',
                borderColor: '#e8c4bd',
                color: 'var(--red)',
              }}
            >
              <AlertCircle size={14} />
              <span>{message.error || message.text || 'Gagal memproses permintaan.'}</span>
            </div>
          )}

          {/* HITL Review Inline Card */}
          {message.hitl && <HitlApprovalCard hitl={message.hitl} />}

          {/* AI Judge Evaluation Card */}
          {message.judgeVerdict && <JudgeVerdictCard verdict={message.judgeVerdict} />}

          {/* Pure Markdown Body */}
          <div style={{ marginTop: '2px' }}>
            <MarkdownRenderer content={displayedText} />
            {isTyping && <span className="typewriter-cursor" />}
          </div>

          {/* Video Session Playback Card */}
          {message.recordedVideo && (
            <div className="info-card" style={{ marginTop: '10px', padding: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 650 }}>
                  <Video size={13} color="var(--red)" />
                  <span>Tab Session Recording ({message.recordedVideo.durationSeconds}s)</span>
                </div>
                <a
                  href={message.recordedVideo.url}
                  download={message.recordedVideo.fileName}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--blue)',
                    fontSize: '10px',
                    textDecoration: 'none',
                  }}
                >
                  <Download size={11} /> Download
                </a>
              </div>
              <video
                src={message.recordedVideo.url}
                controls
                style={{ width: '100%', maxHeight: '240px', borderRadius: '6px', background: '#000' }}
              />
            </div>
          )}
        </div>

        {/* Action Buttons Below Message: Copy, Regenerate, Trace, Save as Skill */}
        <div className="message-actions">
          <button onClick={copyText} title="Copy response">
            {copied ? <Check size={11} color="var(--green)" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {onRegenerate && !isRunning && (
            <button onClick={onRegenerate} title="Regenerate this response">
              <RefreshCw size={11} />
              <span>Regenerate</span>
            </button>
          )}

          {onToggleInspector && (
            <button onClick={onToggleInspector} title="View execution trace and reasoning steps">
              <Activity size={11} />
              <span>Trace</span>
            </button>
          )}

          {!isRunning && totalStepsCount > 0 && !message.isError && (
            <button onClick={handleSaveSkill} title="Save this verified workflow as a reusable skill">
              {skillSaved ? <CheckCheck size={11} color="var(--green)" /> : <BookmarkPlus size={11} />}
              <span>{skillSaved ? 'Saved as Skill' : 'Save as Skill'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
