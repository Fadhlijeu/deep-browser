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
  type: 'step' | 'reasoning';
  timestamp: number;
  step?: ToolStep;
  thought?: string;
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
  windowId?: number;
}

export type RunState = 'idle' | 'running' | 'paused' | 'error' | 'done';

export type ViewType = 'chat' | 'logs';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'standalone';

export type ConnectionMode = 'auto' | 'standalone' | 'daemon';

export type PresetId = 'default' | 'research' | 'data_extraction' | 'form_filling' | 'read_only';

export type ExecutionMode = 'agent_decide' | 'auto' | 'hitl';

export type LogCategory = 'all' | 'tools' | 'reasoning' | 'observations' | 'verifications' | 'approvals' | 'errors';

export interface LogEvent {
  id: string;
  timestamp: number;
  type: string;
  step?: number;
  category: LogCategory;
  message: string;
  payload?: unknown;
}

