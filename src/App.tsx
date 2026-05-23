import { useState, useEffect, useRef } from 'react';
import { Settings, Trash2, Sun, Moon } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Agent, ChatMessage, ModelProvider } from './services/coordinator';
import type { WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeUpdate } from './types/workflow';
import {
  INITIAL_AGENTS,
  loadAgentSystemPrompts,
  runAuthoredWorkflow,
  runMultiAgentPipeline
} from './services/coordinator';
import { AgentPanel } from './components/AgentPanel';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { OutputPanel } from './components/OutputPanel';
import { SettingsModal } from './components/SettingsModal';
import { EditProfileModal } from './components/EditProfileModal';

type WorkspaceView = 'canvas' | 'output';

const storageKeys = {
  messages: 'the_office_messages_v1',
  workflowNodes: 'the_office_workflow_nodes_v1',
  workflowEdges: 'the_office_workflow_edges_v1',
  finalOutputs: 'the_office_final_outputs_v1',
  workspaceView: 'the_office_workspace_view_v1'
};

const createAgentRecord = <T,>(agents: Agent[], valueFactory: (agent: Agent) => T): Record<string, T> => (
  agents.reduce<Record<string, T>>((record, agent) => {
    record[agent.id] = valueFactory(agent);
    return record;
  }, {})
);

const getCoordinator = (agents: Agent[]) => agents.find(agent => agent.isCoordinator) ?? agents[0];

const getSpecialists = (agents: Agent[]) => {
  const coordinator = getCoordinator(agents);
  return agents.filter(agent => agent.id !== coordinator?.id);
};

const loadStoredJson = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => (
    loadStoredJson(storageKeys.messages, createAgentRecord(INITIAL_AGENTS, () => []))
  ));
  const [thinking, setThinking] = useState<Record<string, boolean>>(() => createAgentRecord(INITIAL_AGENTS, () => false));
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowCanvasNode[]>(() => loadStoredJson(storageKeys.workflowNodes, []));
  const [workflowEdges, setWorkflowEdges] = useState<WorkflowCanvasEdge[]>(() => loadStoredJson(storageKeys.workflowEdges, []));
  const [finalOutputs, setFinalOutputs] = useState<ChatMessage[]>(() => loadStoredJson(storageKeys.finalOutputs, []));
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() => (localStorage.getItem(storageKeys.workspaceView) as WorkspaceView | null) || 'canvas');
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const manualNodeCounter = useRef(0);
  
  // Settings State (loaded from localStorage)
  const [provider, setProvider] = useState<ModelProvider>(() => (localStorage.getItem('model_provider') as ModelProvider | null) || 'gemini');
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem('model_name');
    if (saved) return saved;
    return 'gemini-3.5-flash';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Vellum Theme State (Light vs Dark)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Portrait Editing Modal State
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Sync Vellum theme attribute on mount and changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(storageKeys.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(storageKeys.workflowNodes, JSON.stringify(workflowNodes));
  }, [workflowNodes]);

  useEffect(() => {
    localStorage.setItem(storageKeys.workflowEdges, JSON.stringify(workflowEdges));
  }, [workflowEdges]);

  useEffect(() => {
    localStorage.setItem(storageKeys.finalOutputs, JSON.stringify(finalOutputs));
  }, [finalOutputs]);

  useEffect(() => {
    localStorage.setItem(storageKeys.workspaceView, workspaceView);
  }, [workspaceView]);


  // Load Agent profiles from docs/agents/*.md on mount
  useEffect(() => {
    const fetchPrompts = async () => {
      const loaded = await loadAgentSystemPrompts(INITIAL_AGENTS);
      
      // Load saved avatars from localStorage if available
      const updated = loaded.map(agent => {
        const savedAvatar = localStorage.getItem(`avatar_${agent.id}`);
        if (savedAvatar) {
          return { ...agent, avatar: savedAvatar };
        }
        return agent;
      });
      
      setAgents(updated);
      setMessages(prev => ({ ...createAgentRecord(updated, () => []), ...prev }));
      setThinking(prev => ({ ...createAgentRecord(updated, () => false), ...prev }));
    };
    fetchPrompts();
  }, []);

  const coordinator = getCoordinator(agents);
  const specialists = getSpecialists(agents);
  const profileAgent = profileAgentId ? agents.find(agent => agent.id === profileAgentId) : null;
  const selectedNode = selectedNodeId ? workflowNodes.find(node => node.id === selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? workflowEdges.find(edge => edge.id === selectedEdgeId) : null;

  // Update localStorage when setting values change
  const handleSaveSettings = (newProvider: ModelProvider, newModel: string) => {
    setProvider(newProvider);
    setModel(newModel);
    localStorage.setItem('model_provider', newProvider);
    localStorage.setItem('model_name', newModel);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  // Change individual agent portrait (local upload or link)
  const handleSavePortrait = (agentId: string, avatarUrl: string) => {
    if (avatarUrl) {
      localStorage.setItem(`avatar_${agentId}`, avatarUrl);
    } else {
      localStorage.removeItem(`avatar_${agentId}`);
    }
    setAgents(prev => prev.map(a => a.id === agentId ? { ...a, avatar: avatarUrl } : a));
    confetti({ particleCount: 20, spread: 45, origin: { y: 0.8 } });
  };

  // Handle message sending
  const handleSendMessage = async (text: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveAgent(coordinator.id);
    setWorkflowNodes([]);
    setWorkflowEdges([]);

    // Add user message to coordinator console
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'You (User)',
      role: 'user',
      text,
      timestamp
    };

    setMessages(prev => ({
      ...prev,
      [coordinator.id]: [...(prev[coordinator.id] || []), userMsg]
    }));

    const handleWorkflowPlan = (nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]) => {
      setWorkflowNodes(nodes);
      setWorkflowEdges(edges);
    };

    const handleWorkflowNodeUpdate = (nodeId: string, update: WorkflowNodeUpdate) => {
      setWorkflowNodes(prev => prev.map(node => node.id === nodeId ? { ...node, ...update } : node));
    };

    const handleWorkflowEdgeUpdate = (edgeId: string, update: Partial<WorkflowCanvasEdge>) => {
      setWorkflowEdges(prev => prev.map(edge => edge.id === edgeId ? { ...edge, ...update } : edge));
    };

    const handleFinalOutput = (message: ChatMessage) => {
      setFinalOutputs(prev => [...prev, message]);
      setWorkspaceView('output');
    };

    try {
      await runMultiAgentPipeline(
        text,
        agents,
        provider,
        model,
        (agentId, message) => {
          setMessages(prev => ({
            ...prev,
            [agentId]: [...(prev[agentId] || []), message]
          }));
          setActiveAgent(agentId);
        },
        (agentId, isThinking) => {
          setThinking(prev => ({ ...prev, [agentId]: isThinking }));
        },
        handleWorkflowPlan,
        handleWorkflowNodeUpdate,
        handleWorkflowEdgeUpdate,
        handleFinalOutput
      );

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } finally {
      setActiveAgent(null);
      setIsRunning(false);
    }
  };

  const handleClearChats = () => {
    if (isRunning) return;
    setMessages(createAgentRecord(agents, () => []));
    setThinking(createAgentRecord(agents, () => false));
    setWorkflowNodes([]);
    setWorkflowEdges([]);
    setFinalOutputs([]);
    setActiveAgent(null);
    setProfileAgentId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const createManualNodeId = (agentId: string) => {
    manualNodeCounter.current += 1;
    return `${agentId}-${manualNodeCounter.current.toString(36)}`;
  };

  const handleAgentDrop = (agentId: string, position: { x: number; y: number }) => {
    const agent = agents.find(item => item.id === agentId);
    if (!agent) return;

    const needsScaffold = workflowNodes.length === 0;
    const nodeId = createManualNodeId(agent.id);
    const requestNode: WorkflowCanvasNode = {
      id: 'request',
      type: 'request',
      label: 'User request',
      status: 'complete',
      output: getLatestUserRequest(),
      position: { x: position.x - 680, y: position.y }
    };
    const managerNode: WorkflowCanvasNode = {
      id: 'manager',
      type: 'manager',
      label: coordinator.name,
      status: 'complete',
      agentId: coordinator.id,
      output: 'Authored workflow',
      position: { x: position.x - 340, y: position.y }
    };
    const agentNode: WorkflowCanvasNode = {
      id: nodeId,
      type: 'agent',
      label: agent.name,
      status: 'queued',
      agentId: agent.id,
      prompt: `Contribute your ${agent.title} expertise to this workflow.`,
      position,
      manual: true
    };
    const synthesisNode: WorkflowCanvasNode = {
      id: 'synthesis',
      type: 'synthesis',
      label: 'Penny synthesis',
      status: 'queued',
      position: { x: position.x + 360, y: position.y }
    };

    setWorkflowNodes(prev => needsScaffold ? [requestNode, managerNode, agentNode, synthesisNode] : [...prev, agentNode]);
    setWorkflowEdges(prev => {
      const baseEdges = needsScaffold ? [{ id: 'request-manager', source: 'request', target: 'manager' }] : prev;
      return baseEdges;
    });
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setWorkspaceView('canvas');
  };

  const handleConnectNodes = (source: string, target: string) => {
    if (source === target) return;
    const edgeId = `${source}-${target}`;
    setWorkflowEdges(prev => prev.some(edge => edge.id === edgeId) ? prev : [...prev, { id: edgeId, source, target }]);
  };

  const handleSelectNode = (nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId) setSelectedEdgeId(null);
  };

  const handleSelectEdge = (edgeId: string | null) => {
    setSelectedEdgeId(edgeId);
    if (edgeId) setSelectedNodeId(null);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId || selectedNodeId === 'request' || selectedNodeId === 'manager' || selectedNodeId === 'synthesis') return;
    setWorkflowNodes(prev => prev.filter(node => node.id !== selectedNodeId));
    setWorkflowEdges(prev => prev.filter(edge => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const handleDuplicateSelectedNode = () => {
    if (!selectedNode || selectedNode.type !== 'agent' || !selectedNode.agentId) return;
    const nodeId = createManualNodeId(selectedNode.agentId);
    const duplicate: WorkflowCanvasNode = {
      ...selectedNode,
      id: nodeId,
      label: `${selectedNode.label} copy`,
      status: 'queued',
      output: undefined,
      manual: true,
      position: {
        x: (selectedNode.position?.x ?? 680) + 36,
        y: (selectedNode.position?.y ?? 80) + 36
      }
    };

    setWorkflowNodes(prev => [...prev, duplicate]);
    setWorkflowEdges(prev => [
      ...prev,
      { id: `manager-${nodeId}`, source: 'manager', target: nodeId },
      { id: `${nodeId}-synthesis`, source: nodeId, target: 'synthesis' }
    ]);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId || selectedEdgeId === 'request-manager') return;
    setWorkflowEdges(prev => prev.filter(edge => edge.id !== selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const handleNodePositionChange = (nodeId: string, position: { x: number; y: number }) => {
    setWorkflowNodes(prev => prev.map(node => node.id === nodeId ? { ...node, position } : node));
  };

  const handleSelectedNodePromptChange = (prompt: string) => {
    if (!selectedNodeId) return;
    setWorkflowNodes(prev => prev.map(node => node.id === selectedNodeId ? { ...node, prompt } : node));
  };

  const handleRunAuthoredFlow = async () => {
    if (isRunning || workflowNodes.filter(node => node.type === 'agent').length === 0) return;
    setIsRunning(true);
    setWorkspaceView('canvas');
    setWorkflowNodes(prev => prev.map(node => node.type === 'agent' || node.type === 'synthesis' ? { ...node, status: 'queued', output: undefined } : node));
    setWorkflowEdges(prev => prev.map(edge => ({ ...edge, active: false })));

    const requestText = getLatestUserRequest();
    try {
      await runAuthoredWorkflow(
        requestText,
        agents,
        provider,
        model,
        workflowNodes,
        workflowEdges,
        (agentId, message) => {
          setMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), message] }));
          setActiveAgent(agentId);
        },
        (agentId, isThinking) => setThinking(prev => ({ ...prev, [agentId]: isThinking })),
        (nodeId, update) => setWorkflowNodes(prev => prev.map(node => node.id === nodeId ? { ...node, ...update } : node)),
        (edgeId, update) => setWorkflowEdges(prev => prev.map(edge => edge.id === edgeId ? { ...edge, ...update } : edge)),
        (message) => {
          setFinalOutputs(prev => [...prev, message]);
          setWorkspaceView('output');
        }
      );
      confetti({ particleCount: 60, spread: 65, origin: { y: 0.65 } });
    } finally {
      setActiveAgent(null);
      setIsRunning(false);
    }
  };

  const getLatestUserRequest = () => {
    const latest = [...(messages[coordinator.id] || [])].reverse().find(message => message.role === 'user');
    return latest?.text || 'Run this authored workflow.';
  };

  return (
    <div className="app-container">
      {/* Main workspace: Penny plus workflow canvas */}
      <main className="workspace-grid">
        <div className="left-column">
          <div className="h-full relative">
            <AgentPanel
              agent={coordinator}
              messages={messages[coordinator.id] || []}
              isThinking={thinking[coordinator.id] || false}
              onSendMessage={handleSendMessage}
              isActive={activeAgent === coordinator.id}
              isCoordinating={isRunning && !thinking[coordinator.id]}
              onEditPortrait={() => setEditingAgent(coordinator)}
            />
          </div>
        </div>

        <section className="workspace-panel" aria-label="Workflow and output workspace">
          <div className="workspace-header">
            <div className="workspace-tabs" role="tablist" aria-label="Workspace views">
              <button
                className={`workspace-tab ${workspaceView === 'canvas' ? 'is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={workspaceView === 'canvas'}
                onClick={() => setWorkspaceView('canvas')}
              >
                Canvas
              </button>
              <button
                className={`workspace-tab ${workspaceView === 'output' ? 'is-active' : ''}`}
                type="button"
                role="tab"
                aria-selected={workspaceView === 'output'}
                onClick={() => setWorkspaceView('output')}
              >
                Output
              </button>
            </div>

          </div>

          <div className="workspace-tab-panel" role="tabpanel">
            {workspaceView === 'canvas' ? (
              <WorkflowCanvas
                agents={agents}
                nodes={workflowNodes}
                edges={workflowEdges}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                canRun={workflowNodes.filter(node => node.type === 'agent').length > 0}
                isRunning={isRunning}
                onAgentDrop={handleAgentDrop}
                onConnectNodes={handleConnectNodes}
                onNodeSelect={handleSelectNode}
                onEdgeSelect={handleSelectEdge}
                onDeleteEdge={handleDeleteSelectedEdge}
                onRunFlow={handleRunAuthoredFlow}
                onNodePositionChange={handleNodePositionChange}
              />
            ) : (
              <OutputPanel coordinator={coordinator} messages={finalOutputs} />
            )}
          </div>
        </section>
      </main>

      {/* Footer bar styled using Vellum navbar concept */}
      <footer className="footer-bar">
        <div className="badge badge--dot bg-slate-900/40" style={{ height: '28px', padding: '0 12px', borderRadius: 'var(--r-md)' }}>
          <span className="flex items-center gap-1 text-slate-300 font-medium">
            {provider} / {model}
          </span>
        </div>

        <div className="agent-roster" aria-label="Available specialists">
          {specialists.map(agent => (
            <button
              key={agent.id}
              className={`agent-roster__item ${agent.badgeClass}`}
              type="button"
              title={`${agent.name}: ${agent.title}`}
              aria-label={`Show profile for ${agent.name}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('application/x-agent-id', agent.id);
                event.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => setProfileAgentId(prev => prev === agent.id ? null : agent.id)}
            >
              <img className="agent-roster__avatar" src={agent.avatar} alt="" />
              <span className="agent-roster__text">
                <span className="agent-roster__name">{agent.name}</span>
                <span className="agent-roster__title">{agent.title}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: '8px' }}>
          {/* Theme Toggle */}
          <button 
            className="btn btn--secondary btn--icon"
            style={{ width: '36px', height: '36px' }}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <button className="btn btn--secondary btn--sm" onClick={handleClearChats} disabled={isRunning}>
            <Trash2 size={13} /> Clear Chats
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={13} /> Settings
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        provider={provider}
        model={model}
        onSave={handleSaveSettings}
      />

      {/* Agent Portrait Upload & URL Editor Modal */}
      <EditProfileModal
        key={editingAgent?.id ?? 'closed'}
        isOpen={editingAgent !== null}
        agent={editingAgent}
        onClose={() => setEditingAgent(null)}
        onSave={handleSavePortrait}
      />

      {profileAgent && (
        <div className="agent-profile-popover" role="dialog" aria-label={`${profileAgent.name} profile`}>
          <button className="agent-profile-popover__close" type="button" onClick={() => setProfileAgentId(null)} aria-label="Close agent profile">×</button>
          <img className="agent-profile-popover__portrait" src={profileAgent.avatar} alt="" />
          <div className="agent-profile-popover__content">
            <h2 className="agent-profile-popover__name">{profileAgent.name}</h2>
            <p className="agent-profile-popover__title">{profileAgent.title}</p>
            <p className="agent-profile-popover__approach">{getAgentApproach(profileAgent)}</p>
          </div>
        </div>
      )}

      {selectedNode && selectedNode.type === 'agent' && (
        <div className="node-editor" role="dialog" aria-label="Edit workflow node">
          <div className="node-editor__header">
            <div>
              <div className="node-editor__eyebrow">Workflow step</div>
              <h2 className="node-editor__title">{selectedNode.label}</h2>
            </div>
            <button className="node-editor__close" type="button" onClick={() => setSelectedNodeId(null)} aria-label="Close node editor">×</button>
          </div>
          <label className="node-editor__label" htmlFor="node-prompt">Prompt</label>
          <textarea
            id="node-prompt"
            className="node-editor__textarea"
            value={selectedNode.prompt || ''}
            onChange={(event) => handleSelectedNodePromptChange(event.target.value)}
          />
          <div className="node-editor__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleDuplicateSelectedNode}>Duplicate</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSelectedNodeId(null)}>Done</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={handleDeleteSelectedNode}>Delete node</button>
          </div>
        </div>
      )}

      {selectedEdge && (
        <div className="edge-editor" role="dialog" aria-label="Edit workflow connection">
          <div className="edge-editor__title">Connection</div>
          <div className="edge-editor__meta">{selectedEdge.source} → {selectedEdge.target}</div>
          <div className="node-editor__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setSelectedEdgeId(null)}>Done</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={handleDeleteSelectedEdge} disabled={selectedEdge.id === 'request-manager'}>Delete edge</button>
          </div>
        </div>
      )}
    </div>
  );
}

function getAgentApproach(agent: Agent) {
  const prompt = agent.systemPrompt || '';
  const expertMatch = prompt.match(/### Expert Foundation\n([\s\S]*?)(?=\n### |$)/);
  const workingMatch = prompt.match(/### Working Guidelines\n([\s\S]*?)(?=\n### |$)/);
  const source = expertMatch?.[1] || workingMatch?.[1] || agent.mockFocus || `${agent.name} brings ${agent.title.toLowerCase()} expertise to the team.`;
  return source
    .replace(/[-*#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default App;
