import React, { useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  useEdgesState,
  useNodesState,
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
    </div>
  );
};

const nodeTypes = {
  workflow: WorkflowNode
};

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ agents, nodes, edges }) => {
  const agentMap = useMemo(() => new Map(agents.map(agent => [agent.id, agent])), [agents]);
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setFlowNodes(previousNodes => {
      const previousById = new Map(previousNodes.map(node => [node.id, node]));

      return nodes.map((node) => {
        const previous = previousById.get(node.id);
        return {
          id: node.id,
          type: 'workflow',
          position: previous?.position ?? getNodePosition(node, nodes),
          data: {
            workflowNode: node,
            agent: node.agentId ? agentMap.get(node.agentId) : undefined
          }
        };
      });
    });
  }, [agentMap, nodes, setFlowNodes]);

  useEffect(() => {
    setFlowEdges(edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: 'output',
        targetHandle: 'input',
        label: edge.label,
        animated: true,
        className: 'workflow-edge',
        markerEnd: {
          type: MarkerType.ArrowClosed
        }
      }))
    );
  }, [edges, setFlowEdges]);

  if (nodes.length === 0) {
    return (
      <section className="workflow-canvas workflow-canvas--empty" aria-label="Workflow canvas">
        <div className="workflow-canvas__empty">
          <div className="workflow-canvas__empty-title">Canvas ready</div>
          <div className="workflow-canvas__empty-copy">Give Penny a task and she will assemble the right team here.</div>
        </div>
      </section>
    );
  }

  return (
    <section className="workflow-canvas" aria-label="Workflow canvas">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
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
  const agentColumns = Math.max(1, Math.ceil(agentNodes.length / 4));
  const centerY = Math.max(180, 70 + Math.min(agentNodes.length, 4) * 105);

  if (node.type === 'request') return { x: 0, y: centerY };
  if (node.type === 'manager') return { x: 320, y: centerY };
  if (node.type === 'synthesis') return { x: 760 + agentColumns * 360, y: centerY };

  const agentIndex = Math.max(0, agentNodes.findIndex(item => item.id === node.id));
  const column = Math.floor(agentIndex / 4);
  const row = agentIndex % 4;

  return {
    x: 680 + column * 360,
    y: 40 + row * 230
  };
}
