export type WorkflowNodeType = 'request' | 'manager' | 'agent' | 'synthesis';
export type WorkflowNodeStatus = 'queued' | 'thinking' | 'complete' | 'error';
export type RunStatus = 'idle' | 'planning' | 'executing' | 'critiquing' | 'synthesizing' | 'complete' | 'error';
export type RunMode = 'automatic' | 'authored';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type EvidenceProvider = 'manual' | 'tavily' | 'exa' | 'brave' | 'bing' | 'model' | 'knowledge';

export interface WorkflowCanvasNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  status: WorkflowNodeStatus;
  agentId?: string;
  prompt?: string;
  output?: string;
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

export interface SourceRecord {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  query?: string;
  provider: EvidenceProvider;
  usedBy?: string;
  timestamp: string;
}

export interface EvidenceClaim {
  id: string;
  claim: string;
  sourceIds: string[];
  confidence: ConfidenceLevel;
  usedBy?: string;
  timestamp: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  body: string;
  kind: 'manual' | 'source' | 'agent-output' | 'decision';
  sourceId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ToolCallRecord {
  id: string;
  toolId: string;
  toolName: string;
  requestedBy: string;
  input: string;
  status: 'queued' | 'running' | 'complete' | 'error';
  outputSummary?: string;
  sourceIds?: string[];
  timestamp: string;
}

export interface ExecutionTraceRecord {
  id: string;
  runId: string;
  type: 'plan' | 'step-start' | 'tool-call' | 'step-complete' | 'critique' | 'replan' | 'synthesis' | 'error';
  title: string;
  detail: string;
  agentId?: string;
  nodeId?: string;
  timestamp: string;
}

export interface RunEvaluation {
  id: string;
  reviewer: 'penny' | 'user' | 'system';
  rating?: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  nextActions: string[];
  timestamp: string;
}

export interface RunState {
  id: string;
  objective: string;
  mode: RunMode;
  status: RunStatus;
  provider: string;
  model: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  activeStepId?: string;
  summary?: string;
  confidence: ConfidenceLevel;
  assumptions: string[];
  openQuestions: string[];
  decisions: string[];
  risks: string[];
  conflicts: string[];
  evidenceClaimIds: string[];
  knowledgeItemIds: string[];
  toolCalls: ToolCallRecord[];
  traces: ExecutionTraceRecord[];
  evaluations: RunEvaluation[];
}
