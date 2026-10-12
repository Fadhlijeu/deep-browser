import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { Session, ModelDef, PresetId, ExecutionMode } from '../../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { EmptyState } from './EmptyState';
import { Composer } from './Composer';

interface AssistantThreadProps {
  session: Session;
  runState: string;
  selectedModel: ModelDef;
  selectedPreset: PresetId;
  selectedMode: ExecutionMode;
  onSendMessage: (text: string) => void;
  onCancelRun: () => void;
  onOpenModels: () => void;
  onOpenSettings: () => void;
}

export const AssistantThread: React.FC<AssistantThreadProps> = ({
  session,
  runState,
  selectedModel,
  selectedPreset,
  selectedMode,
  onSendMessage,
  onCancelRun,
  onOpenModels,
  onOpenSettings,
}) => {
  const [composerPrompt, setComposerPrompt] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on message or step updates
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [session.messages, session.messages[session.messages.length - 1]?.steps?.length]);

  // Convert custom session messages to assistant-ui compatible ThreadMessageLike
  const auiMessages = useMemo(() => {
    return session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: new Date(m.timestamp),
      content: [{ type: 'text' as const, text: m.text }],
    }));
  }, [session.messages]);

  // Bind assistant-ui external store runtime
  const runtime = useExternalStoreRuntime({
    messages: auiMessages,
    isRunning: runState === 'running',
    onNew: (msg) => {
      const textContent = msg.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');
      onSendMessage(textContent);
    },
    onCancel: () => {
      onCancelRun();
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="thread-container">
        {/* Responsive message viewport */}
        <ThreadPrimitive.Viewport className="thread-viewport" ref={viewportRef}>
          {session.messages.length === 0 ? (
            <EmptyState onSelectPrompt={(p) => setComposerPrompt(p)} />
          ) : (
            session.messages.map((m) => (
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage key={m.id} message={m} />
              )
            ))
          )}
        </ThreadPrimitive.Viewport>

        {/* Responsive bottom composer */}
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
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
};
