export type WorkflowNodeType = 'request' | 'manager' | 'agent' | 'synthesis';
export type WorkflowNodeStatus = 'queued' | 'thinking' | 'complete' | 'error';
export type RunStatus = 'idle' | 'planning' | 'executing' | 'critiquing' | 'synthesizing' | 'complete' | 'error';
export type RunMode = 'automatic' | 'authored';
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type EvidenceProvider = 'manual' | 'tavily' | 'exa' | 'brave' | 'bing' | 'model' | 'knowledge';
export type ClaimStatus = 'unverified' | 'needs-research' | 'supported' | 'assumption';
export type EvidencePolicyStatus = 'not-required' | 'required' | 'satisfied' | 'missing';
export type EvidenceCategory = 'research' | 'news' | 'forecast' | 'competitive' | 'culture' | 'strategy';

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
  fullText?: string;
  summary?: string;
  chunks?: SourceChunk[];
  query?: string;
  category?: EvidenceCategory;
  publishedDate?: string;
  provider: EvidenceProvider;
  usedBy?: string;
  timestamp: string;
}

export interface SourceChunk {
  id: string;
  text: string;
  index: number;
}

export interface ClaimSourceMatch {
  claimId: string;
  sourceId: string;
  chunkId?: string;
  score: number;
  quote: string;
  verdict: 'supports' | 'contradicts' | 'related';
}

export interface ResearchQuery {
  id: string;
  query: string;
  category: EvidenceCategory;
  reason: string;
}

export interface ResearchBrief {
  id: string;
  generatedAt: string;
  queries: ResearchQuery[];
  sourceIds: string[];
  currentSignals: string[];
  forecastSignals: string[];
  competitiveSignals: string[];
  caveats: string[];
}

export interface DeliverableSection {
  id: string;
  title: string;
  body: string;
  status: 'draft' | 'accepted' | 'needs-revision';
  sourceIds: string[];
}

export interface EvaluationScorecard {
  evidenceCoverage: number;
  sourceQuality: number;
  claimSupport: number;
  strategicSharpness: number;
  creativeOriginality: number;
  actionability: number;
  consistency: number;
  overall: number;
  notes: string[];
}

export interface ProjectMemorySnapshot {
  id: string;
  title: string;
  objective: string;
  createdAt: string;
  updatedAt: string;
  acceptedClaimIds: string[];
  rejectedClaimIds: string[];
  sourceIds: string[];
  deliverableSectionIds: string[];
}

export interface EvidenceClaim {
  id: string;
  claim: string;
  sourceIds: string[];
  confidence: ConfidenceLevel;
  status?: ClaimStatus;
  usedBy?: string;
  timestamp: string;
}

export interface FactualClaim {
  id: string;
  text: string;
  status: ClaimStatus;
  reason: string;
  sourceIds: string[];
  matches?: ClaimSourceMatch[];
  confidence: ConfidenceLevel;
}

export interface EvidencePolicy {
  required: boolean;
  status: EvidencePolicyStatus;
  reasons: string[];
  requiredToolIds: string[];
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

export interface ProjectLibrary {
  id: string;
  name: string;
  updatedAt: string;
  memories: ProjectMemorySnapshot[];
  sources: SourceRecord[];
  acceptedClaims: FactualClaim[];
  rejectedClaims: FactualClaim[];
  openQuestions: string[];
  deliverableSections: DeliverableSection[];
  runIds: string[];
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
  researchBrief?: ResearchBrief;
  deliverableSections: DeliverableSection[];
  scorecard?: EvaluationScorecard;
  projectMemory?: ProjectMemorySnapshot;
  projectLibrary?: ProjectLibrary;
  evidencePolicy: EvidencePolicy;
  factualClaims: FactualClaim[];
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
