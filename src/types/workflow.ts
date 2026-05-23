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
}

export interface WorkflowCanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export type WorkflowNodeUpdate = Partial<Omit<WorkflowCanvasNode, 'id'>>;
