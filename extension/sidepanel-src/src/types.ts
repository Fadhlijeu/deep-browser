export interface ModelDef {
  id: string;
  name: string;
  icon: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'custom_openai' | 'ollama';
  modelId: string;
  baseUrl?: string;
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
}

export interface HitlInteraction {
  id: string;
  type: 'approval' | 'confirm' | 'choice' | 'text_input' | 'waiting';
  question: string;
  options?: HitlOption[];
  defaultValue?: string | boolean;
  isMultiSelect?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  steps?: ToolStep[];
  modelName?: string;
  preset?: string;
  isError?: boolean;
  hitl?: HitlInteraction;
  duration?: string;
}

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  messages: ChatMessage[];
  events: LogEvent[];
}

export interface TabItem {
  id: number;
  title: string;
  url: string;
  active: boolean;
  favIconUrl?: string;
}

export type RunState = 'idle' | 'running' | 'paused' | 'error' | 'done';

export type PresetId = 'default' | 'research' | 'data_extraction' | 'form_filling' | 'read_only';

export type ExecutionMode = 'agent_decide' | 'auto' | 'hitl';

export interface LogEvent {
  id: string;
  timestamp: number;
  type: string;
  category: 'all' | 'tools' | 'approvals' | 'errors' | 'verifications';
  message: string;
  payload?: unknown;
}
