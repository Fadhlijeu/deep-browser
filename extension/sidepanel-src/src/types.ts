export interface ModelDef {
  id: string;
  name: string;
  icon: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'custom_openai' | 'ollama';
  modelId: string;
  baseUrl?: string;
  category?: string;
  rpm?: string | number;
  tpm?: string | number;
  rpd?: string | number;
}

export interface ToolStep {
  id: string;
  name: string;
  icon: string;
  duration?: string;
  status: 'running' | 'succeeded' | 'failed';
  args?: Record<string, unknown>;
  result?: unknown;
  verification?: Record<string, unknown> | null;
  error?: string;
  timestamp: number;
}

export interface HitlOption {
  id: string;
  label: string;
  description?: string;
  index?: number;
}

export interface HitlInteraction {
  id: string;
  type: 'approval' | 'confirm' | 'choice' | 'multi_choice' | 'text_input' | 'number_input' | 'waiting';
  question: string;
  description?: string;
  action_name?: string;
  parameters?: Record<string, unknown>;
  options?: HitlOption[];
  defaultValue?: string | boolean | number;
  isMultiSelect?: boolean;
}

export interface ActivityItem {
  id: string;
  type: 'step' | 'reasoning' | 'narrative';
  timestamp: number;
  step?: ToolStep;
  thought?: string;
  text?: string;
}

export interface StagedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  base64?: string;
  dataUrl?: string;
}

export interface RecordedVideo {
  url: string;
  fileName: string;
  durationSeconds: number;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  thought?: string;
  timestamp: number;
  steps?: ToolStep[];
  activities?: ActivityItem[];
  modelName?: string;
  preset?: string;
  isError?: boolean;
  hitl?: HitlInteraction;
  duration?: string;
  stagedFiles?: StagedFile[];
  recordedVideo?: RecordedVideo;
  judgeVerdict?: {
    verdict: boolean;
    score?: number;
    confidence?: number;
    reasoning?: string;
    failureReasons?: string[];
    task?: string;
    finalResult?: string;
    formattedSteps?: string[];
    model?: string;
    groundTruth?: string;
  };
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  pinned?: boolean;
  archived?: boolean;
  messages: ChatMessage[];
  events: LogEvent[];
}

export interface TabItem {
  id: number;
  title: string;
  url: string;
  active: boolean;
  favIconUrl?: string;
  windowId?: number;
}

export type RunState = 'idle' | 'running' | 'paused' | 'error' | 'done';

export type ViewType = 'chat' | 'sessions' | 'activity' | 'tools' | 'skills' | 'automations' | 'settings';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'standalone';

export type ConnectionMode = 'auto' | 'standalone' | 'daemon';

export type PresetId = 'default' | 'research' | 'data_extraction' | 'form_filling' | 'read_only';

export type ExecutionMode = 'agent_decide' | 'auto' | 'hitl';

export type LogCategory = 'all' | 'tools' | 'reasoning' | 'observations' | 'verifications' | 'approvals' | 'waiting' | 'errors';

export interface LogEvent {
  id: string;
  timestamp: number;
  type: string;
  step?: number;
  category: LogCategory;
  message: string;
  payload?: unknown;
  runId?: string;
  sessionId?: string;
  tabId?: number;
}

