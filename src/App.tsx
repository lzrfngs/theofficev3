import { useState, useEffect } from 'react';
import { Settings, Trash2, Sun, Moon } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { Agent, ChatMessage, ModelProvider } from './services/coordinator';
import type { WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeUpdate } from './types/workflow';
import {
  INITIAL_AGENTS,
  loadAgentSystemPrompts,
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

          <div className="workspace-tab-panel" role="tabpanel">
            {workspaceView === 'canvas' ? (
              <WorkflowCanvas agents={agents} nodes={workflowNodes} edges={workflowEdges} />
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
            <div className="agent-profile-popover__eyebrow">{profileAgent.role.replace(/_/g, ' ')}</div>
            <h2 className="agent-profile-popover__name">{profileAgent.name}</h2>
            <p className="agent-profile-popover__title">{profileAgent.title}</p>
            <p className="agent-profile-popover__approach">{getAgentApproach(profileAgent)}</p>
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
    .trim()
    .slice(0, 360);
}

export default App;
