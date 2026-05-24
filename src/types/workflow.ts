export type WorkflowNodeType = 'request' | 'manager' | 'agent' | 'synthesis';
export type WorkflowNodeStatus = 'queued' | 'thinking' | 'complete' | 'error';

export interface WorkflowCanvasNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  status: WorkflowNodeStatus;
  agentId?: string;
  prompt?: string;
  output?: string;
  provider?: WorkflowModelProvider;
  model?: string;
  position?: { x: number; y: number };
  manual?: boolean;
}

export interface WorkflowCanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  active?: boolean;
}

export type WorkflowNodeUpdate = Partial<Omit<WorkflowCanvasNode, 'id'>>;

export type WorkflowModelProvider = 'gemini' | 'openai' | 'anthropic' | 'azure-openai' | 'github-models';

export interface SourceRecord {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  query?: string;
  provider: 'manual' | 'tavily' | 'exa' | 'brave' | 'bing' | 'model';
  usedBy?: string;
  timestamp: string;
}

export interface RunStateMemory {
  objective: string;
  assumptions: string[];
  evidence: string[];
  conflicts: string[];
  unansweredQuestions: string[];
  decisions: string[];
  stepOutputs: Record<string, string[]>;
  stepSummaries: Record<string, string>;
  sources: SourceRecord[];
}
