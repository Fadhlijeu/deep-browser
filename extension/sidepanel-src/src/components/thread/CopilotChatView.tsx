import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, PanelTop, MoreHorizontal, X, ArrowUpRight } from 'lucide-react';
import { Session, ModelDef, PresetId, ExecutionMode, RunState } from '../../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { Composer } from './Composer';
import { ExecutionInspector } from './ExecutionInspector';

import { sidepanelStore } from '../../state/sidepanelStore';

interface CopilotChatViewProps {
  session: Session;
  runState: RunState;
  selectedModel: ModelDef;
  selectedPreset: PresetId;
  selectedMode: ExecutionMode;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onSendMessage: (text: string) => void;
  onCancelRun: () => void;
  onOpenModels: () => void;
  onOpenSettings: () => void;
  onOpenSessionMenu?: () => void;
}

export const CopilotChatView: React.FC<CopilotChatViewProps> = ({
  session,
  runState,
  selectedModel,
  selectedPreset,
  selectedMode,
  isInspectorOpen,
  onToggleInspector,
  onSendMessage,
  onCancelRun,
  onOpenModels,
  onOpenSettings,
  onOpenSessionMenu,
}) => {
  const [composerPrompt, setComposerPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message or step
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.messages, session.messages[session.messages.length - 1]?.steps?.length]);

  return (
    <div className="chat-layout">
      <section className="chat-center">
        {/* Messages Feed (No redundant secondary header, maximum vertical space for chat) */}
        <div className="messages" id="messages">
          {session.messages.length === 0 ? (
            <EmptyState onSelectPrompt={(p) => setComposerPrompt(p)} />
          ) : (
            <>
              {session.messages.map((m, idx) =>
                m.role === 'user' ? (
                  <UserMessage
                    key={m.id}
                    message={m}
                    onEdit={(text) => setComposerPrompt(text)}
                  />
                ) : (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    isCurrentMessage={idx === session.messages.length - 1}
                    runState={runState}
                    onRegenerate={() => sidepanelStore.regenerate()}
                    onToggleInspector={onToggleInspector}
                  />
                )
              )}

              {/* Running Status Typing Bubble */}
              {runState === 'running' && !session.messages[session.messages.length - 1]?.text && (
                <div className="message assistant">
                  <div className="message-avatar">
                    <Sparkles size={15} />
                  </div>
                  <div className="message-main">
                    <div className="message-meta">
                      <span>Deep Browser Copilot</span>
                      <span>·</span>
                      <span>Active</span>
                    </div>
                    <div className="typing">
                      <i /><i /><i />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Executing browser task…</span>
                      <button className="btn ghost small" onClick={onCancelRun}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Composer */}
        <Composer
          runState={runState}
          selectedPreset={selectedPreset}
          selectedMode={selectedMode}
          selectedModel={selectedModel}
          onSend={onSendMessage}
          onCancel={onCancelRun}
          onOpenModels={onOpenModels}
          onOpenSettings={onOpenSettings}
          initialPrompt={composerPrompt}
        />
      </section>

      {/* Right-hand Collapsible Execution Inspector */}
      {isInspectorOpen && (
        <ExecutionInspector
          session={session}
          runState={runState}
          selectedModel={selectedModel}
          onClose={onToggleInspector}
        />
      )}
    </div>
  );
};
