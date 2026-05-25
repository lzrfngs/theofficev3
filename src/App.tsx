import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { Download, Settings, Trash2, Sun, Moon, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Agent, ChatMessage, ModelProvider } from './services/coordinator';
import type { EvidenceClaim, ExecutionTraceRecord, KnowledgeItem, RunEvaluation, RunState, SourceRecord, WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeUpdate } from './types/workflow';
import {
  INITIAL_AGENTS,
  loadAgentSystemPrompts,
  runAuthoredWorkflow,
  runMultiAgentPipeline
} from './services/coordinator';
import { AgentPanel } from './components/AgentPanel';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { OutputPanel } from './components/OutputPanel';
import { SourcesPanel } from './components/SourcesPanel';
import { IntelligencePanel } from './components/IntelligencePanel';
import { SettingsModal } from './components/SettingsModal';
import { EditProfileModal } from './components/EditProfileModal';

type WorkspaceView = 'canvas' | 'output' | 'sources' | 'intelligence';

const storageKeys = {
  messages: 'the_office_messages_v1',
  workflowNodes: 'the_office_workflow_nodes_v1',
  workflowEdges: 'the_office_workflow_edges_v1',
  finalOutputs: 'the_office_final_outputs_v1',
  sources: 'the_office_sources_v1',
  runState: 'the_office_run_state_v1',
  traces: 'the_office_traces_v1',
  evidenceClaims: 'the_office_evidence_claims_v1',
  knowledgeItems: 'the_office_knowledge_items_v1',
  stepModelOverrides: 'the_office_step_model_overrides_v1',
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
  const [sources, setSources] = useState<SourceRecord[]>(() => loadStoredJson(storageKeys.sources, []));
  const [runState, setRunState] = useState<RunState | null>(() => loadStoredJson<RunState | null>(storageKeys.runState, null));
  const [traces, setTraces] = useState<ExecutionTraceRecord[]>(() => loadStoredJson(storageKeys.traces, []));
  const [evidenceClaims, setEvidenceClaims] = useState<EvidenceClaim[]>(() => loadStoredJson(storageKeys.evidenceClaims, []));
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(() => loadStoredJson(storageKeys.knowledgeItems, []));
  const [stepModelOverrides, setStepModelOverrides] = useState<Record<string, string>>(() => loadStoredJson(storageKeys.stepModelOverrides, {}));
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>(() => (localStorage.getItem(storageKeys.workspaceView) as WorkspaceView | null) || 'canvas');
  const [profileAgentId, setProfileAgentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const manualNodeCounter = useRef(0);
  const manualSourceCounter = useRef(0);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  
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
    localStorage.setItem(storageKeys.sources, JSON.stringify(sources));
  }, [sources]);

  useEffect(() => {
    localStorage.setItem(storageKeys.runState, JSON.stringify(runState));
  }, [runState]);

  useEffect(() => {
    localStorage.setItem(storageKeys.traces, JSON.stringify(traces));
  }, [traces]);

  useEffect(() => {
    localStorage.setItem(storageKeys.evidenceClaims, JSON.stringify(evidenceClaims));
  }, [evidenceClaims]);

  useEffect(() => {
    localStorage.setItem(storageKeys.knowledgeItems, JSON.stringify(knowledgeItems));
  }, [knowledgeItems]);

  useEffect(() => {
    localStorage.setItem(storageKeys.stepModelOverrides, JSON.stringify(stepModelOverrides));
  }, [stepModelOverrides]);

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

  const appendUniqueById = <T extends { id: string }>(setter: Dispatch<SetStateAction<T[]>>, items: T[]) => {
    setter(prev => {
      const known = new Set(prev.map(item => item.id));
      return [...prev, ...items.filter(item => !known.has(item.id))];
    });
  };

  const runtimeCallbacks = {
    onRunState: (state: RunState) => setRunState(state),
    onTrace: (trace: ExecutionTraceRecord) => appendUniqueById(setTraces, [trace]),
    onEvidenceClaims: (claims: EvidenceClaim[]) => appendUniqueById(setEvidenceClaims, claims),
    onKnowledgeItems: (items: KnowledgeItem[]) => appendUniqueById(setKnowledgeItems, items),
    stepModelOverrides
  };

  // Update localStorage when setting values change
  const handleSaveSettings = (newProvider: ModelProvider, newModel: string, newStepModelOverrides: Record<string, string>) => {
    setProvider(newProvider);
    setModel(newModel);
    setStepModelOverrides(newStepModelOverrides);
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
    const hasAuthoredFlow = workflowNodes.some(node => node.type === 'agent');
    setIsRunning(true);
    setActiveAgent(coordinator.id);

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

    const handleSources = (newSources: SourceRecord[]) => {
      setSources(prev => [...prev, ...newSources]);
    };

    try {
      if (hasAuthoredFlow) {
        setWorkflowNodes(prev => prev.map(node => node.id === 'request' ? { ...node, output: text } : node));
        await runAuthoredWorkflow(
          text,
          agents,
          provider,
          model,
          workflowNodes.map(node => node.id === 'request' ? { ...node, output: text } : node),
          workflowEdges,
          (agentId, message) => {
            setMessages(prev => ({ ...prev, [agentId]: [...(prev[agentId] || []), message] }));
            setActiveAgent(agentId);
          },
          (agentId, isThinking) => setThinking(prev => ({ ...prev, [agentId]: isThinking })),
          handleWorkflowNodeUpdate,
          handleWorkflowEdgeUpdate,
          handleFinalOutput,
          handleSources,
          sources,
          runtimeCallbacks
        );
      } else {
        setWorkflowNodes([]);
        setWorkflowEdges([]);
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
          handleFinalOutput,
          handleSources,
          sources,
          runtimeCallbacks
        );
      }

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
    setSources([]);
    setRunState(null);
    setTraces([]);
    setEvidenceClaims([]);
    setKnowledgeItems([]);
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

  const handleResetSelectedNode = () => {
    if (!selectedNodeId || selectedNodeId === 'request' || selectedNodeId === 'manager') return;
    setWorkflowNodes(prev => prev.map(node => node.id === selectedNodeId ? { ...node, status: 'queued', output: undefined } : node));
    setWorkflowEdges(prev => prev.map(edge => edge.source === selectedNodeId || edge.target === selectedNodeId ? { ...edge, active: false } : edge));
  };

  const handleUseSelectedOutputAsSource = () => {
    if (!selectedNode?.output) return;
    handleAddManualSource({
      title: `${selectedNode.label} output`,
      snippet: selectedNode.output,
      query: 'workflow output',
      usedBy: 'Workflow'
    });
    setWorkspaceView('sources');
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
        },
        (newSources) => setSources(prev => [...prev, ...newSources]),
        sources,
        runtimeCallbacks
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

  const handleAddManualSource = (source: Omit<SourceRecord, 'id' | 'timestamp' | 'provider'>) => {
    manualSourceCounter.current += 1;
    const timestamp = new Date().toISOString();
    const sourceRecord: SourceRecord = {
      ...source,
      id: `manual-${manualSourceCounter.current.toString(36)}`,
      provider: 'manual',
      timestamp
    };
    setSources(prev => [...prev, sourceRecord]);
    appendUniqueById(setKnowledgeItems, [{
      id: `knowledge-${sourceRecord.id}`,
      title: sourceRecord.title,
      body: sourceRecord.snippet,
      kind: 'manual',
      sourceId: sourceRecord.id,
      tags: ['manual', sourceRecord.usedBy || 'User'],
      createdAt: timestamp,
      updatedAt: timestamp
    }]);
    appendUniqueById(setEvidenceClaims, [{
      id: `claim-${sourceRecord.id}`,
      claim: sourceRecord.snippet || sourceRecord.title,
      sourceIds: [sourceRecord.id],
      confidence: 'medium',
      usedBy: 'User',
      timestamp
    }]);
  };

  const handleClearRuntimeState = () => {
    if (isRunning) return;
    setRunState(null);
    setTraces([]);
    setEvidenceClaims([]);
    setKnowledgeItems([]);
  };

  const handleRateRun = (rating: number) => {
    if (!runState) return;
    const evaluation: RunEvaluation = {
      id: `user-eval-${Date.now().toString(36)}`,
      reviewer: 'user',
      rating,
      summary: `User rated this run ${rating}/5.`,
      strengths: [],
      gaps: [],
      nextActions: [],
      timestamp: new Date().toISOString()
    };
    setRunState(prev => prev ? { ...prev, evaluations: [...prev.evaluations, evaluation], updatedAt: evaluation.timestamp } : prev);
  };

  const handleExportWorkspace = () => {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      messages,
      workflowNodes,
      workflowEdges,
      finalOutputs,
      sources,
      runState,
      traces,
      evidenceClaims,
      knowledgeItems,
      stepModelOverrides
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `the-office-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkspace = async (file: File | null) => {
    if (!file || isRunning) return;
    try {
      const snapshot = JSON.parse(await file.text()) as Partial<{
        messages: Record<string, ChatMessage[]>;
        workflowNodes: WorkflowCanvasNode[];
        workflowEdges: WorkflowCanvasEdge[];
        finalOutputs: ChatMessage[];
        sources: SourceRecord[];
        runState: RunState | null;
        traces: ExecutionTraceRecord[];
        evidenceClaims: EvidenceClaim[];
        knowledgeItems: KnowledgeItem[];
        stepModelOverrides: Record<string, string>;
      }>;
      if (snapshot.messages) setMessages(snapshot.messages);
      if (snapshot.workflowNodes) setWorkflowNodes(snapshot.workflowNodes);
      if (snapshot.workflowEdges) setWorkflowEdges(snapshot.workflowEdges);
      if (snapshot.finalOutputs) setFinalOutputs(snapshot.finalOutputs);
      if (snapshot.sources) setSources(snapshot.sources);
      if ('runState' in snapshot) setRunState(snapshot.runState ?? null);
      if (snapshot.traces) setTraces(snapshot.traces);
      if (snapshot.evidenceClaims) setEvidenceClaims(snapshot.evidenceClaims);
      if (snapshot.knowledgeItems) setKnowledgeItems(snapshot.knowledgeItems);
      if (snapshot.stepModelOverrides) setStepModelOverrides(snapshot.stepModelOverrides);
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.75 } });
    } catch (error) {
      console.error('Failed to import workspace snapshot', error);
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
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
            <div className="workspace-tabs" aria-label="Workspace views">
              <button
                className={`workspace-tab ${workspaceView === 'canvas' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setWorkspaceView('canvas')}
              >
                Canvas
              </button>
              <button
                className={`workspace-tab ${workspaceView === 'output' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setWorkspaceView('output')}
              >
                Output
              </button>
              <button
                className={`workspace-tab ${workspaceView === 'sources' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setWorkspaceView('sources')}
              >
                Sources
              </button>
              <button
                className={`workspace-tab ${workspaceView === 'intelligence' ? 'is-active' : ''}`}
                type="button"
                onClick={() => setWorkspaceView('intelligence')}
              >
                Run
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
            ) : workspaceView === 'output' ? (
              <OutputPanel coordinator={coordinator} messages={finalOutputs} />
            ) : workspaceView === 'sources' ? (
              <SourcesPanel sources={sources} onAddSource={handleAddManualSource} onClearSources={() => setSources([])} />
            ) : (
              <IntelligencePanel
                runState={runState}
                evidenceClaims={evidenceClaims}
                knowledgeItems={knowledgeItems}
                traces={traces}
                onClear={handleClearRuntimeState}
                onRateRun={handleRateRun}
              />
            )}
          </div>
        </section>
      </main>

      {/* Footer bar styled using Vellum navbar concept */}
      <footer className="footer-bar">
        <div className="workspace-model-badge badge badge--dot bg-slate-900/40">
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

        <div className="footer-actions row">
          <input
            ref={importFileRef}
            type="file"
            accept="application/json"
            className="hidden"
            title="Import workspace snapshot"
            onChange={(event) => handleImportWorkspace(event.target.files?.[0] ?? null)}
          />
          <button className="btn btn--secondary btn--sm" onClick={() => importFileRef.current?.click()} disabled={isRunning} title="Import workspace snapshot">
            <Upload size={13} /> Import
          </button>
          <button className="btn btn--secondary btn--sm" onClick={handleExportWorkspace} title="Export workspace snapshot">
            <Download size={13} /> Export
          </button>
          {/* Theme Toggle */}
          <button 
            className="btn btn--secondary btn--icon theme-toggle-button"
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
        agents={agents}
        stepModelOverrides={stepModelOverrides}
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
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleDuplicateSelectedNode}>Branch</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleResetSelectedNode}>Reset</button>
            <button type="button" className="btn btn--secondary btn--sm" onClick={handleUseSelectedOutputAsSource} disabled={!selectedNode.output}>Save source</button>
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
