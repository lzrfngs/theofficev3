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
