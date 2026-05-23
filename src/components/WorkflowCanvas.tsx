import React, { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Agent } from '../services/coordinator';
import type { WorkflowCanvasEdge, WorkflowCanvasNode } from '../types/workflow';

interface WorkflowCanvasProps {
  agents: Agent[];
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  canRun?: boolean;
  isRunning?: boolean;
  onAgentDrop?: (agentId: string, position: { x: number; y: number }) => void;
  onConnectNodes?: (source: string, target: string) => void;
  onNodeSelect?: (nodeId: string | null) => void;
  onEdgeSelect?: (edgeId: string | null) => void;
  onDeleteEdge?: () => void;
  onRunFlow?: () => void;
  onNodePositionChange?: (nodeId: string, position: { x: number; y: number }) => void;
}

const statusLabels: Record<WorkflowCanvasNode['status'], string> = {
  queued: 'queued',
  thinking: 'thinking',
  complete: 'complete',
  error: 'error'
};

interface WorkflowNodeData extends Record<string, unknown> {
  workflowNode: WorkflowCanvasNode;
  agent?: Agent;
}

const WorkflowNode: React.FC<NodeProps<Node<WorkflowNodeData>>> = ({ data }) => {
  const { workflowNode, agent } = data;
  const isAgent = workflowNode.type === 'agent';

  const agentClass = agent?.badgeClass ?? '';

  return (
    <div className={`workflow-node ${agentClass} workflow-node--${workflowNode.type} workflow-node--${workflowNode.status}`}>
      <Handle className="workflow-node__handle workflow-node__handle--target" type="target" position={Position.Left} id="input" />
      <Handle className="workflow-node__handle workflow-node__handle--source" type="source" position={Position.Right} id="output" />

      <div className="workflow-node__header">
        {isAgent && agent?.avatar ? (
          <img className="workflow-node__avatar" src={agent.avatar} alt="" />
        ) : (
          <div className="workflow-node__mark" aria-hidden="true" />
        )}
        <div className="workflow-node__title-group">
          <div className="workflow-node__label">{workflowNode.label}</div>
          {agent && <div className="workflow-node__role">{agent.title}</div>}
        </div>
      </div>

      <div className="workflow-node__status">
        <span className="workflow-node__status-dot" />
        {statusLabels[workflowNode.status]}
      </div>

      {workflowNode.prompt && (
        <p className="workflow-node__prompt">{workflowNode.prompt}</p>
      )}

      {workflowNode.output && (
        <p className="workflow-node__output">{workflowNode.output}</p>
      )}

      {workflowNode.manual && <span className="workflow-node__manual">custom</span>}
    </div>
  );
};

const nodeTypes = {
  workflow: WorkflowNode
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = (props) => (
  <ReactFlowProvider>
    <WorkflowCanvasInner {...props} />
  </ReactFlowProvider>
);

const WorkflowCanvasInner: React.FC<WorkflowCanvasProps> = ({ agents, nodes, edges, selectedNodeId, selectedEdgeId, canRun = false, isRunning = false, onAgentDrop, onConnectNodes, onNodeSelect, onEdgeSelect, onDeleteEdge, onRunFlow, onNodePositionChange }) => {
  const agentMap = useMemo(() => new Map(agents.map(agent => [agent.id, agent])), [agents]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const isSettled = nodes.length > 0 && nodes.every(node => node.status === 'complete' || node.status === 'error');

  useEffect(() => {
    setFlowNodes(previousNodes => {
      const previousById = new Map(previousNodes.map(node => [node.id, node]));

      return nodes.map((node) => {
        const previous = previousById.get(node.id);
        return {
          id: node.id,
          type: 'workflow',
          selected: node.id === selectedNodeId,
          position: previous?.position ?? node.position ?? getNodePosition(node, nodes),
          data: {
            workflowNode: node,
            agent: node.agentId ? agentMap.get(node.agentId) : undefined
          }
        };
      });
    });
  }, [agentMap, nodes, selectedNodeId, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: 'output',
        targetHandle: 'input',
        label: edge.label,
        selected: edge.id === selectedEdgeId,
        animated: !!edge.active && !isSettled,
        className: `workflow-edge ${edge.active ? 'workflow-edge--active' : ''} ${edge.id === selectedEdgeId ? 'workflow-edge--selected' : ''}`,
        markerEnd: {
          type: MarkerType.ArrowClosed
        }
      }))
    );
  }, [edges, isSettled, selectedEdgeId, setFlowEdges]);

  if (nodes.length === 0) {
    return (
      <section
        className="workflow-canvas workflow-canvas--empty"
        aria-label="Workflow canvas"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const agentId = event.dataTransfer.getData('application/x-agent-id');
          if (!agentId) return;
          onAgentDrop?.(agentId, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
      >
        <div className="workflow-canvas__toolbar" aria-label="Canvas actions">
          <button className="btn btn--primary btn--sm" type="button" onClick={onRunFlow} disabled={!canRun || isRunning}>Run flow</button>
        </div>
        <div className="workflow-canvas__empty">
          <div className="workflow-canvas__empty-title">Canvas ready</div>
          <div className="workflow-canvas__empty-copy">Give Penny a task and she will assemble the right team here.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="workflow-canvas" aria-label="Workflow canvas">
      <div className="workflow-canvas__toolbar" aria-label="Canvas actions">
        {selectedEdgeId && selectedEdgeId !== 'request-manager' && (
          <button className="btn btn--danger btn--sm" type="button" onClick={onDeleteEdge}>Delete connection</button>
        )}
        <button className="btn btn--primary btn--sm" type="button" onClick={onRunFlow} disabled={!canRun || isRunning}>Run flow</button>
      </div>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection: Connection) => {
          if (connection.source && connection.target) onConnectNodes?.(connection.source, connection.target);
        }}
        onNodeClick={(_, node) => onNodeSelect?.(node.id)}
        onEdgeClick={(_, edge) => {
          onNodeSelect?.(null);
          onEdgeSelect?.(edge.id);
        }}
        onPaneClick={() => {
          onNodeSelect?.(null);
          onEdgeSelect?.(null);
        }}
        onNodeDragStop={(_, node) => onNodePositionChange?.(node.id, node.position)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const agentId = event.dataTransfer.getData('application/x-agent-id');
          if (!agentId) return;
          onAgentDrop?.(agentId, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable
        elementsSelectable
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1.2} color="var(--line-2)" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} bgColor="var(--surface-1)" maskColor="oklch(0 0 0 / 0.18)" />
      </ReactFlow>
    </section>
  );
};

function getNodePosition(node: WorkflowCanvasNode, nodes: WorkflowCanvasNode[]) {
  const agentNodes = nodes.filter(item => item.type === 'agent');
  const rows = Math.min(agentNodes.length, 3);
  const agentColumns = Math.max(1, Math.ceil(agentNodes.length / 3));
  const centerY = rows <= 1 ? 180 : 110 + (rows - 1) * 145;

  if (node.type === 'request') return { x: 0, y: centerY };
  if (node.type === 'manager') return { x: 320, y: centerY };
  if (node.type === 'synthesis') return { x: 760 + agentColumns * 360, y: centerY };

  const agentIndex = Math.max(0, agentNodes.findIndex(item => item.id === node.id));
  const column = Math.floor(agentIndex / 3);
  const row = agentIndex % 3;

  return {
    x: 680 + column * 360,
    y: 40 + row * 290
  };
}
