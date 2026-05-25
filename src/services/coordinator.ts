import { AGENT_CATALOG } from '../data/agents';
import type {
  EvidenceClaim,
  ExecutionTraceRecord,
  KnowledgeItem,
  RunEvaluation,
  RunState,
  SourceRecord,
  ToolCallRecord,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowNodeUpdate
} from '../types/workflow';

export interface Agent {
  id: string;
  name: string;
  title: string;
  role: string;
  isCoordinator?: boolean;
  avatar: string;
  color: string;
  badgeClass: string;
  activeClass: string;
  mdFile: string;
  systemPrompt?: string;
  specialtyKeywords?: string[];
  mockAction?: string;
  mockFocus?: string;
  mockResponse?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  role: 'user' | 'agent' | 'thought';
  text: string;
  timestamp: string;
}

export type ModelProvider = 'gemini' | 'openai' | 'anthropic' | 'azure-openai' | 'github-models';

interface DelegationPlanItem {
  agent: string;
  prompt: string;
  id?: string;
  label?: string;
  dependsOn?: string[];
}

interface PlanningResult {
  delegations: DelegationPlanItem[];
  response: string;
}

interface CritiqueResult {
  sufficient: boolean;
  confidence: RunState['confidence'];
  summary: string;
  assumptions?: string[];
  openQuestions?: string[];
  decisions?: string[];
  risks?: string[];
  conflicts?: string[];
  additionalDelegations?: DelegationPlanItem[];
  nextActions?: string[];
}

interface ExecutionRuntimeOptions {
  onRunState?: (state: RunState) => void;
  onTrace?: (trace: ExecutionTraceRecord) => void;
  onEvidenceClaims?: (claims: EvidenceClaim[]) => void;
  onKnowledgeItems?: (items: KnowledgeItem[]) => void;
  stepModelOverrides?: Record<string, string>;
}

type NormalizedDelegation = Required<DelegationPlanItem>;

interface StepExecutionResult {
  id: string;
  label: string;
  agentName: string;
  agentRole: string;
  output: string;
}

interface RoutingHint {
  agent: Agent;
  score: number;
  matchedKeywords: string[];
}

const RUNTIME_TOOLS = {
  webSearch: {
    id: 'web_search',
    name: 'Web search',
    description: 'Searches the public web and returns source records.'
  },
  knowledgeLookup: {
    id: 'knowledge_lookup',
    name: 'Knowledge lookup',
    description: 'Injects saved sources and knowledge into the step prompt.'
  },
  imageGeneration: {
    id: 'image_generation',
    name: 'Image generation',
    description: 'Available visual generation capability for creative workflows.'
  }
} as const;

export const INITIAL_AGENTS: Agent[] = AGENT_CATALOG;

function getCoordinator(agents: Agent[]): Agent {
  const coordinator = agents.find(agent => agent.isCoordinator) ?? agents.find(agent => agent.role === 'secretary') ?? agents[0];
  if (!coordinator) {
    throw new Error('At least one agent is required to coordinate the pipeline.');
  }
  return coordinator;
}

function getSpecialists(agents: Agent[]): Agent[] {
  const coordinator = getCoordinator(agents);
  return agents.filter(agent => agent.id !== coordinator.id);
}

// Helper to fetch the system prompts from markdown files
export async function loadAgentSystemPrompts(agents: Agent[]): Promise<Agent[]> {
  const loadedAgents = await Promise.all(
    agents.map(async (agent) => {
      try {
        if (agent.systemPrompt) return agent;

        const response = await fetch(agent.mdFile);
        if (!response.ok) throw new Error(`Failed to load ${agent.mdFile}`);
        const text = await response.text();
        return { ...agent, systemPrompt: text };
      } catch (err) {
        console.error(`Error loading agent profile for ${agent.name}:`, err);
        return agent;
      }
    })
  );
  return loadedAgents;
}

async function callModel(provider: ModelProvider, model: string, systemInstruction: string, prompt: string, maxOutputTokens = 4096): Promise<string> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      model,
      system: systemInstruction,
      prompt,
      temperature: 0.7,
      maxOutputTokens,
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Model router error (${response.status})`);
  }

  const text = data?.text;
  if (!text) throw new Error('Empty response from model router');
  return text;
}

async function searchWeb(query: string, usedBy: string): Promise<SourceRecord[]> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults: 5 })
  });

  if (!response.ok) return [];
  const data = await response.json();
  return (data?.results ?? []).map((result: { title: string; url: string; snippet: string; provider: SourceRecord['provider'] }, index: number) => ({
    id: `${usedBy}-${Date.now().toString(36)}-${index}`,
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    query,
    provider: result.provider,
    usedBy,
    timestamp: new Date().toISOString()
  }));
}

function formatSourcesForPrompt(sources: SourceRecord[]) {
  if (sources.length === 0) return '';
  return `\n\nAvailable sources:\n${sources.map((source, index) => `${index + 1}. ${source.title}${source.url ? ` (${source.url})` : ''}\n${source.snippet}`).join('\n\n')}`;
}

function formatRoutingHints(hints: RoutingHint[]) {
  if (hints.length === 0) return 'No strong deterministic routing hints were found; use your judgment.';
  return hints
    .slice(0, 5)
    .map(hint => `- ${hint.agent.name} (${hint.agent.role}): matched ${hint.matchedKeywords.join(', ')}`)
    .join('\n');
}

function getRoutingHints(userQuery: string, specialists: Agent[]): RoutingHint[] {
  const query = userQuery.toLowerCase();

  return specialists
    .map(agent => {
      const matchedKeywords = (agent.specialtyKeywords ?? [])
        .filter(keyword => query.includes(keyword.toLowerCase()))
        .sort((a, b) => b.length - a.length);

      return {
        agent,
        matchedKeywords,
        score: matchedKeywords.reduce((total, keyword) => total + Math.max(1, keyword.split(/\s+/).length), 0)
      };
    })
    .filter(hint => hint.score > 0)
    .sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name));
}

function extractPlannerJson(rawText: string): PlanningResult | null {
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<PlanningResult>;
      if (Array.isArray(parsed.delegations) && typeof parsed.response === 'string') {
        return {
          delegations: parsed.delegations.filter(isDelegationPlanItem),
          response: parsed.response
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function isDelegationPlanItem(value: unknown): value is DelegationPlanItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DelegationPlanItem>;
  return typeof item.agent === 'string' && typeof item.prompt === 'string';
}

function createFallbackPlan(userQuery: string, specialists: Agent[], routingHints: RoutingHint[], coordinatorName: string): PlanningResult {
  const fallbackAgents = (routingHints.length > 0 ? routingHints.map(hint => hint.agent) : specialists).slice(0, 2);

  return {
    delegations: fallbackAgents.map((agent, index) => ({
      id: `${agent.id}-pass-${index + 1}`,
      agent: agent.role,
      label: agent.name,
      prompt: `Analyze this request from your specialty and produce concrete, decision-ready recommendations:\n${userQuery}`
    })),
    response: `${coordinatorName} will consult ${fallbackAgents.map(agent => agent.name).join(' and ')} based on the strongest routing signals. Working with the other agents now...`
  };
}

function sortDelegationsByDependencies(delegations: NormalizedDelegation[]): NormalizedDelegation[] {
  const remaining = [...delegations];
  const sorted: NormalizedDelegation[] = [];
  const completed = new Set<string>();
  const validIds = new Set(delegations.map(delegation => delegation.id));

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex(delegation => delegation.dependsOn
      .filter(dependencyId => validIds.has(dependencyId))
      .every(dependencyId => completed.has(dependencyId)));
    const index = nextIndex === -1 ? 0 : nextIndex;
    const [next] = remaining.splice(index, 1);
    sorted.push(next);
    completed.add(next.id);
  }

  return sorted;
}

function formatDependencyContext(delegation: NormalizedDelegation, stepResults: Record<string, StepExecutionResult>) {
  const dependencyReports = delegation.dependsOn
    .map(dependencyId => stepResults[dependencyId])
    .filter(Boolean);

  if (dependencyReports.length === 0) return '';

  return `\n\nDependency outputs to build on:\n${dependencyReports.map(result => `\n### ${result.label} (${result.agentName})\n${result.output}`).join('\n')}`;
}

function formatStepResultsForSynthesis(stepResults: Record<string, StepExecutionResult>, orderedDelegations: NormalizedDelegation[]) {
  return orderedDelegations
    .map(delegation => stepResults[delegation.id])
    .filter(Boolean)
    .map(result => `\n### ${result.label} - ${result.agentName} (${result.agentRole})\nStep id: ${result.id}\n${result.output}`)
    .join('\n');
}

function buildDelegationPrompt(userQuery: string, delegation: NormalizedDelegation, dependencyContext: string, sources: SourceRecord[]) {
  return `${delegation.prompt}\n\nUser request:\n${userQuery}${dependencyContext}${formatSourcesForPrompt(sources)}`;
}

function createRunState(objective: string, mode: RunState['mode'], provider: ModelProvider, model: string): RunState {
  const timestamp = new Date().toISOString();
  return {
    id: `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    objective,
    mode,
    status: 'planning',
    provider,
    model,
    startedAt: timestamp,
    updatedAt: timestamp,
    confidence: 'medium',
    assumptions: [],
    openQuestions: [],
    decisions: [],
    risks: [],
    conflicts: [],
    evidenceClaimIds: [],
    knowledgeItemIds: [],
    toolCalls: [],
    traces: [],
    evaluations: []
  };
}

function emitRunState(runState: RunState, options: ExecutionRuntimeOptions) {
  options.onRunState?.({
    ...runState,
    toolCalls: [...runState.toolCalls],
    traces: [...runState.traces],
    evaluations: [...runState.evaluations]
  });
}

function updateRunState(runState: RunState, options: ExecutionRuntimeOptions, update: Partial<RunState>) {
  Object.assign(runState, update, { updatedAt: new Date().toISOString() });
  emitRunState(runState, options);
}

function addTrace(runState: RunState, options: ExecutionRuntimeOptions, trace: Omit<ExecutionTraceRecord, 'id' | 'runId' | 'timestamp'>) {
  const record: ExecutionTraceRecord = {
    ...trace,
    id: `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    runId: runState.id,
    timestamp: new Date().toISOString()
  };
  runState.traces = [...runState.traces, record];
  runState.updatedAt = record.timestamp;
  options.onTrace?.(record);
  emitRunState(runState, options);
}

function addToolCall(runState: RunState, options: ExecutionRuntimeOptions, call: Omit<ToolCallRecord, 'id' | 'timestamp'>) {
  const record: ToolCallRecord = {
    ...call,
    id: `tool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString()
  };
  runState.toolCalls = [...runState.toolCalls, record];
  emitRunState(runState, options);
  return record;
}

function updateToolCall(runState: RunState, options: ExecutionRuntimeOptions, toolCallId: string, update: Partial<ToolCallRecord>) {
  runState.toolCalls = runState.toolCalls.map(call => call.id === toolCallId ? { ...call, ...update } : call);
  emitRunState(runState, options);
}

function sourcesToKnowledgeItems(sources: SourceRecord[]): KnowledgeItem[] {
  const timestamp = new Date().toISOString();
  return sources.map(source => ({
    id: `knowledge-${source.id}`,
    title: source.title,
    body: source.snippet,
    kind: 'source',
    sourceId: source.id,
    tags: [source.provider, source.usedBy || 'source'].filter(Boolean),
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

function outputToKnowledgeItem(step: StepExecutionResult): KnowledgeItem {
  const timestamp = new Date().toISOString();
  return {
    id: `knowledge-output-${step.id}`,
    title: `${step.label} output`,
    body: step.output,
    kind: 'agent-output',
    tags: [step.agentRole, step.agentName],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function createEvidenceClaims(sources: SourceRecord[], usedBy: string): EvidenceClaim[] {
  const timestamp = new Date().toISOString();
  return sources.map(source => ({
    id: `claim-${source.id}`,
    claim: source.snippet || source.title,
    sourceIds: [source.id],
    confidence: source.provider === 'manual' ? 'medium' : 'low',
    usedBy,
    timestamp
  }));
}

function mergeUnique<T>(current: T[], additions: T[]) {
  return [...current, ...additions.filter(item => !current.includes(item))];
}

function selectModelForStep(baseModel: string, agent: Agent, stepId: string, options: ExecutionRuntimeOptions) {
  return options.stepModelOverrides?.[stepId] || options.stepModelOverrides?.[agent.id] || options.stepModelOverrides?.[agent.role] || baseModel;
}

function extractCritique(rawText: string): CritiqueResult | null {
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as Partial<CritiqueResult>;
    if (typeof parsed.sufficient !== 'boolean' || typeof parsed.summary !== 'string') return null;
    return {
      sufficient: parsed.sufficient,
      confidence: parsed.confidence === 'low' || parsed.confidence === 'high' ? parsed.confidence : 'medium',
      summary: parsed.summary,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.filter(item => typeof item === 'string') : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions.filter(item => typeof item === 'string') : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter(item => typeof item === 'string') : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.filter(item => typeof item === 'string') : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.filter(item => typeof item === 'string') : [],
      additionalDelegations: Array.isArray(parsed.additionalDelegations) ? parsed.additionalDelegations.filter(isDelegationPlanItem).slice(0, 2) : [],
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.filter(item => typeof item === 'string') : []
    };
  } catch {
    return null;
  }
}

function critiqueToEvaluation(critique: CritiqueResult): RunEvaluation {
  return {
    id: `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    reviewer: 'penny',
    rating: critique.confidence === 'high' ? 4 : critique.confidence === 'medium' ? 3 : 2,
    summary: critique.summary,
    strengths: critique.decisions ?? [],
    gaps: [...(critique.openQuestions ?? []), ...(critique.conflicts ?? [])],
    nextActions: critique.nextActions ?? [],
    timestamp: new Date().toISOString()
  };
}

// Coordinate the multi-agent execution pipeline
export async function runMultiAgentPipeline(
  userQuery: string,
  agents: Agent[],
  provider: ModelProvider,
  model: string,
  onStep: (agentId: string, message: ChatMessage) => void,
  onThinking: (agentId: string, isThinking: boolean) => void,
  onWorkflowPlan?: (nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]) => void,
  onWorkflowNodeUpdate?: (nodeId: string, update: WorkflowNodeUpdate) => void,
  onWorkflowEdgeUpdate?: (edgeId: string, update: Partial<WorkflowCanvasEdge>) => void,
  onFinalOutput?: (message: ChatMessage) => void,
  onSources?: (sources: SourceRecord[]) => void,
  existingSources: SourceRecord[] = [],
  runtimeOptions: ExecutionRuntimeOptions = {}
): Promise<void> {
  
  // 1. Warm-up and load prompts if they aren't loaded yet
  const activeAgents = agents.some(a => a.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const secretary = getCoordinator(activeAgents);
  const specialists = getSpecialists(activeAgents);
  const routingHints = getRoutingHints(userQuery, specialists);
  const routingHintText = formatRoutingHints(routingHints);
  
  // Helper to generate timestamps
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);
  const runState = createRunState(userQuery, 'automatic', provider, model);
  emitRunState(runState, runtimeOptions);

  try {
    // --- Step 1: Penny analyzes the request and delegates tasks ---
    onThinking(secretary.id, true);
    
    const planningPrompt = `
You are Penny, the Executive Coordinator. The User has sent a request:
"${userQuery}"

Your task is to:
1. Coordinate your team of specialists:
${specialists.map(agent => `   - ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}
2. Write a JSON structure indicating which workflow steps you want to run, which agent owns each step, what prompt to send, and any dependencies between steps.
3. Use this deterministic routing prior as evidence, then apply judgment:
${routingHintText}
4. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query (between 1 and 4 agents).
  - If a specialist's title and role are irrelevant, omit that specialist.
  - If the request is pure coding, API design, setup, or systems architecture, prioritize technical agents.
  - If the request is creative writing, branding, advertising, or campaign work, prioritize creative agents.
  - If user research, demographics, culture, or behavior are irrelevant, omit cultural research agents.
  - If business strategy, SWOT, pricing, or OKRs are irrelevant, omit strategy agents.
5. You may use the same specialist more than once if the work naturally loops back to them. Each repeated appearance must be a separate delegation with a unique id.
6. If a step depends on another step, put the prior step id in dependsOn. Later steps will receive dependency outputs at runtime.
7. Provide a very concise status message in the 'response' field outlining your plan to the user. Avoid pleasantries, chit-chat, or filler text. Start directly with the plan, state exactly which agents you are consulting and why (in a short sentence), and end with: "Working with the other agents now..."

Your response MUST be valid JSON in this exact format:
{
  "delegations": [
    {
      "id": "short_unique_step_id",
      "agent": "${specialists.map(agent => agent.role).join('" | "')}",
      "label": "Short node label",
      "prompt": "The detailed instructions you want this agent to execute",
      "dependsOn": ["optional_previous_step_id"]
    }
  ],
  "response": "Your status message to the user"
}
Do not write markdown formatting (like \`\`\`json) in your raw output, output only the JSON string.
`;

    const planTextRaw = await callModel(provider, model, secretary.systemPrompt || '', `${planningPrompt}${formatSourcesForPrompt(existingSources)}`);
    onThinking(secretary.id, false);

    const fallbackPlan = createFallbackPlan(userQuery, specialists, routingHints, secretary.name);
    const plan = extractPlannerJson(planTextRaw) ?? fallbackPlan;

    const normalizedDelegations = normalizeDelegations(plan.delegations, activeAgents);
    const executableDelegations = normalizedDelegations.length > 0 ? normalizedDelegations : normalizeDelegations(fallbackPlan.delegations, activeAgents);
    const executionOrder = sortDelegationsByDependencies(executableDelegations);
    const synthesisOrder = [...executionOrder];
    const workflow = createWorkflowPlan(userQuery, secretary, activeAgents, executableDelegations);
    onWorkflowPlan?.(workflow.nodes, workflow.edges);
    addTrace(runState, runtimeOptions, {
      type: 'plan',
      title: 'Workflow planned',
      detail: executionOrder.map(delegation => `${delegation.id}: ${delegation.agent}`).join('\n')
    });

    // Post Penny's planning message
    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: plan.response,
      timestamp: getTimestamp()
    });

    const stepResults: Record<string, StepExecutionResult> = {};
    let allSources = [...existingSources];
    const initialKnowledge = sourcesToKnowledgeItems(existingSources);
    if (initialKnowledge.length > 0) {
      runtimeOptions.onKnowledgeItems?.(initialKnowledge);
      updateRunState(runState, runtimeOptions, { knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, initialKnowledge.map(item => item.id)) });
    }
    updateRunState(runState, runtimeOptions, { status: 'executing' });

    // --- Step 2: Execute delegations in sequence/parallel ---
    for (const delegation of executionOrder) {
      const targetAgent = activeAgents.find(a => a.role === delegation.agent || a.id === delegation.agent);
      if (!targetAgent) continue;
      const stepModel = selectModelForStep(model, targetAgent, delegation.id, runtimeOptions);

      onWorkflowNodeUpdate?.(delegation.id, { status: 'thinking' });
      updateRunState(runState, runtimeOptions, { activeStepId: delegation.id });
      addTrace(runState, runtimeOptions, {
        type: 'step-start',
        title: `${targetAgent.name} started ${delegation.label}`,
        detail: delegation.prompt,
        agentId: targetAgent.id,
        nodeId: delegation.id
      });
      workflow.edges
        .filter(edge => edge.target === delegation.id)
        .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
      onThinking(targetAgent.id, true);
      // Wait a simulated bit to give the UI breathing room
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch prompt
      try {
        let runSources = allSources;
        if (targetAgent.role === 'researcher') {
          const toolCall = addToolCall(runState, runtimeOptions, {
            toolId: RUNTIME_TOOLS.webSearch.id,
            toolName: RUNTIME_TOOLS.webSearch.name,
            requestedBy: targetAgent.name,
            input: `${userQuery}\n${delegation.prompt}`,
            status: 'running'
          });
          const foundSources = await searchWeb(`${userQuery}\n${delegation.prompt}`, targetAgent.name);
          if (foundSources.length > 0) {
            onSources?.(foundSources);
            allSources = [...allSources, ...foundSources];
            runSources = allSources;
            const knowledgeItems = sourcesToKnowledgeItems(foundSources);
            const evidenceClaims = createEvidenceClaims(foundSources, targetAgent.name);
            runtimeOptions.onKnowledgeItems?.(knowledgeItems);
            runtimeOptions.onEvidenceClaims?.(evidenceClaims);
            updateRunState(runState, runtimeOptions, {
              knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
              evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
            });
          }
          updateToolCall(runState, runtimeOptions, toolCall.id, {
            status: foundSources.length > 0 ? 'complete' : 'error',
            outputSummary: foundSources.length > 0 ? `${foundSources.length} sources found` : 'No sources returned',
            sourceIds: foundSources.map(source => source.id)
          });
          addTrace(runState, runtimeOptions, {
            type: 'tool-call',
            title: RUNTIME_TOOLS.webSearch.name,
            detail: foundSources.length > 0 ? `${foundSources.length} sources attached` : 'Search returned no sources',
            agentId: targetAgent.id,
            nodeId: delegation.id
          });
        }
        const dependencyContext = formatDependencyContext(delegation, stepResults);
        const prompt = buildDelegationPrompt(userQuery, delegation, dependencyContext, runSources);
        const subResult = await callModel(provider, stepModel, targetAgent.systemPrompt || '', prompt);
        stepResults[delegation.id] = {
          id: delegation.id,
          label: delegation.label,
          agentRole: targetAgent.role,
          agentName: targetAgent.name,
          output: subResult
        };
        
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: subResult,
          timestamp: getTimestamp()
        });
        const outputKnowledge = outputToKnowledgeItem(stepResults[delegation.id]);
        runtimeOptions.onKnowledgeItems?.([outputKnowledge]);
        updateRunState(runState, runtimeOptions, {
          knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, [outputKnowledge.id])
        });
        addTrace(runState, runtimeOptions, {
          type: 'step-complete',
          title: `${targetAgent.name} completed ${delegation.label}`,
          detail: summarizeForNode(subResult),
          agentId: targetAgent.id,
          nodeId: delegation.id
        });
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        stepResults[delegation.id] = {
          id: delegation.id,
          label: delegation.label,
          agentRole: targetAgent.role,
          agentName: targetAgent.name,
          output: `Error: ${message}`
        };
        onWorkflowNodeUpdate?.(delegation.id, { status: 'error', output: message });
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: `Apologies, I encountered an issue: ${message}`,
          timestamp: getTimestamp()
        });
        addTrace(runState, runtimeOptions, {
          type: 'error',
          title: `${targetAgent.name} step failed`,
          detail: message,
          agentId: targetAgent.id,
          nodeId: delegation.id
        });
      }
      if (stepResults[delegation.id] && !stepResults[delegation.id].output.startsWith('Error:')) {
        onWorkflowNodeUpdate?.(delegation.id, { status: 'complete', output: summarizeForNode(stepResults[delegation.id].output) });
      }
      workflow.edges
        .filter(edge => edge.target === delegation.id)
        .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: false }));
      onThinking(targetAgent.id, false);
    }

    // --- Step 2b: Penny critiques the run and may request one targeted repair pass ---
    updateRunState(runState, runtimeOptions, { status: 'critiquing', activeStepId: undefined });
    onThinking(secretary.id, true);
    const critiquePrompt = `
Review the current run state and specialist outputs. Decide whether the answer is sufficient or whether one more targeted specialist pass is needed.

User objective:
${userQuery}

Current outputs:
${formatStepResultsForSynthesis(stepResults, executionOrder)}

Available specialists:
${specialists.map(agent => `- ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}

Return only JSON:
{
  "sufficient": true,
  "confidence": "low | medium | high",
  "summary": "short evaluation",
  "assumptions": ["..."],
  "openQuestions": ["..."],
  "decisions": ["..."],
  "risks": ["..."],
  "conflicts": ["..."],
  "additionalDelegations": [
    { "id": "repair_step_id", "agent": "${specialists.map(agent => agent.role).join(' | ')}", "label": "Short label", "prompt": "Focused repair instructions", "dependsOn": ["existing_step_id"] }
  ],
  "nextActions": ["..."]
}
Use additionalDelegations only when a concrete missing pass would materially improve the result. Limit to one additional delegation.
`;
    const critiqueRaw = await callModel(provider, model, secretary.systemPrompt || '', critiquePrompt, 2048);
    onThinking(secretary.id, false);
    const critique = extractCritique(critiqueRaw) ?? {
      sufficient: true,
      confidence: 'medium',
      summary: 'The run completed without a structured critique response.',
      assumptions: [],
      openQuestions: [],
      decisions: [],
      risks: [],
      conflicts: [],
      additionalDelegations: [],
      nextActions: []
    };
    const evaluation = critiqueToEvaluation(critique);
    updateRunState(runState, runtimeOptions, {
      confidence: critique.confidence,
      summary: critique.summary,
      assumptions: critique.assumptions ?? [],
      openQuestions: critique.openQuestions ?? [],
      decisions: critique.decisions ?? [],
      risks: critique.risks ?? [],
      conflicts: critique.conflicts ?? [],
      evaluations: [...runState.evaluations, evaluation]
    });
    addTrace(runState, runtimeOptions, {
      type: 'critique',
      title: critique.sufficient ? 'Critique accepted run' : 'Critique requested repair',
      detail: critique.summary
    });

    const repairDelegations = normalizeDelegations((critique.additionalDelegations ?? []).slice(0, 1), activeAgents);
    if (!critique.sufficient && repairDelegations.length > 0) {
      addTrace(runState, runtimeOptions, {
        type: 'replan',
        title: 'Repair pass added',
        detail: repairDelegations.map(delegation => `${delegation.id}: ${delegation.agent}`).join('\n')
      });

      for (const delegation of repairDelegations) {
        const targetAgent = activeAgents.find(a => a.role === delegation.agent || a.id === delegation.agent);
        if (!targetAgent) continue;
        const stepModel = selectModelForStep(model, targetAgent, delegation.id, runtimeOptions);
        updateRunState(runState, runtimeOptions, { status: 'executing', activeStepId: delegation.id });
        addTrace(runState, runtimeOptions, {
          type: 'step-start',
          title: `${targetAgent.name} started repair pass`,
          detail: delegation.prompt,
          agentId: targetAgent.id,
          nodeId: delegation.id
        });
        onThinking(targetAgent.id, true);
        const dependencyContext = formatDependencyContext(delegation, stepResults);
        const prompt = buildDelegationPrompt(userQuery, delegation, dependencyContext, allSources);
        const output = await callModel(provider, stepModel, targetAgent.systemPrompt || '', prompt);
        stepResults[delegation.id] = {
          id: delegation.id,
          label: delegation.label,
          agentRole: targetAgent.role,
          agentName: targetAgent.name,
          output
        };
        synthesisOrder.push(delegation);
        onThinking(targetAgent.id, false);
        onStep(targetAgent.id, { id: uuid(), sender: targetAgent.name, role: 'agent', text: output, timestamp: getTimestamp() });
        const outputKnowledge = outputToKnowledgeItem(stepResults[delegation.id]);
        runtimeOptions.onKnowledgeItems?.([outputKnowledge]);
        updateRunState(runState, runtimeOptions, {
          knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, [outputKnowledge.id])
        });
        addTrace(runState, runtimeOptions, {
          type: 'step-complete',
          title: `${targetAgent.name} completed repair pass`,
          detail: summarizeForNode(output),
          agentId: targetAgent.id,
          nodeId: delegation.id
        });
      }
    }

    // --- Step 3: Penny synthesizes all inputs and responds to the user ---
    updateRunState(runState, runtimeOptions, { status: 'synthesizing', activeStepId: workflow.synthesisNodeId });
    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'thinking' });
    workflow.edges
      .filter(edge => edge.target === workflow.synthesisNodeId)
      .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
    onThinking(secretary.id, true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const synthesisPrompt = `
The team has finished their sub-tasks for this objective:
${userQuery}

Execution trace:
${formatStepResultsForSynthesis(stepResults, synthesisOrder)}

Based on their findings and your role as Penny (Executive Coordinator), present the final compiled solution to the User. Make it professional, beautifully structured with headings/markdown, and highlight which expert provided which insights.
When sources are available, cite them by title or URL where relevant and distinguish sourced facts from recommendations.
Keep the tone direct and concise, avoiding excessive conversational filler, fluff, or chatty pleasantries.
`;

    const finalAnswer = await callModel(provider, model, secretary.systemPrompt || '', `${synthesisPrompt}${formatSourcesForPrompt(allSources)}`, 6144);
    onThinking(secretary.id, false);
    updateRunState(runState, runtimeOptions, { status: 'complete', completedAt: new Date().toISOString(), activeStepId: undefined });
    addTrace(runState, runtimeOptions, {
      type: 'synthesis',
      title: 'Final synthesis complete',
      detail: summarizeForNode(finalAnswer),
      agentId: secretary.id,
      nodeId: workflow.synthesisNodeId
    });
    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'complete', output: summarizeForNode(finalAnswer) });
    workflow.edges
      .filter(edge => edge.target === workflow.synthesisNodeId)
      .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: false }));

    onFinalOutput?.({
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: finalAnswer,
      timestamp: getTimestamp()
    });

    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: 'Output is ready.',
      timestamp: getTimestamp()
    });

  } catch (err: unknown) {
    const message = getErrorMessage(err);
    updateRunState(runState, runtimeOptions, { status: 'error', summary: message, completedAt: new Date().toISOString(), activeStepId: undefined });
    addTrace(runState, runtimeOptions, { type: 'error', title: 'Run failed', detail: message, agentId: secretary.id });
    onThinking(secretary.id, false);
    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: `Oh dear, I ran into a technical error coordinating the team: ${message}. Check that the selected provider has its server-side environment variable configured, then redeploy if you changed Vercel settings.`,
      timestamp: getTimestamp()
    });
  }
}

export async function runAuthoredWorkflow(
  userQuery: string,
  agents: Agent[],
  provider: ModelProvider,
  model: string,
  nodes: WorkflowCanvasNode[],
  edges: WorkflowCanvasEdge[],
  onStep: (agentId: string, message: ChatMessage) => void,
  onThinking: (agentId: string, isThinking: boolean) => void,
  onWorkflowNodeUpdate: (nodeId: string, update: WorkflowNodeUpdate) => void,
  onWorkflowEdgeUpdate: (edgeId: string, update: Partial<WorkflowCanvasEdge>) => void,
  onFinalOutput: (message: ChatMessage) => void,
  onSources: (sources: SourceRecord[]) => void,
  existingSources: SourceRecord[] = [],
  runtimeOptions: ExecutionRuntimeOptions = {}
) {
  const activeAgents = agents.some(agent => agent.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const manager = getCoordinator(activeAgents);
  const agentNodes = sortWorkflowNodes(nodes.filter(node => node.type === 'agent' && node.agentId), edges);
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);
  const nodeOutputs: Record<string, string> = {};
  let allSources = [...existingSources];
  const runState = createRunState(userQuery, 'authored', provider, model);
  emitRunState(runState, runtimeOptions);
  updateRunState(runState, runtimeOptions, { status: 'executing' });
  addTrace(runState, runtimeOptions, {
    type: 'plan',
    title: 'Authored workflow loaded',
    detail: agentNodes.map(node => `${node.id}: ${node.label}`).join('\n')
  });
  const initialKnowledge = sourcesToKnowledgeItems(existingSources);
  if (initialKnowledge.length > 0) {
    runtimeOptions.onKnowledgeItems?.(initialKnowledge);
    updateRunState(runState, runtimeOptions, { knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, initialKnowledge.map(item => item.id)) });
  }

  onStep(manager.id, {
    id: uuid(),
    sender: manager.name,
    role: 'agent',
    text: `I will run your authored workflow with ${agentNodes.length} specialist step${agentNodes.length === 1 ? '' : 's'}.`,
    timestamp: getTimestamp()
  });

  for (const node of agentNodes) {
    const agent = activeAgents.find(item => item.id === node.agentId);
    if (!agent) continue;
    const stepModel = selectModelForStep(model, agent, node.id, runtimeOptions);

    const incomingEdges = edges.filter(edge => edge.target === node.id);
    incomingEdges.forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: true }));
    onWorkflowNodeUpdate(node.id, { status: 'thinking' });
    onThinking(agent.id, true);
    updateRunState(runState, runtimeOptions, { activeStepId: node.id });
    addTrace(runState, runtimeOptions, {
      type: 'step-start',
      title: `${agent.name} started ${node.label}`,
      detail: node.prompt || `Contribute your ${agent.title} expertise to this workflow.`,
      agentId: agent.id,
      nodeId: node.id
    });

    const upstreamContext = incomingEdges
      .map(edge => nodeOutputs[edge.source] ? `Output from ${edge.source}:\n${nodeOutputs[edge.source]}` : '')
      .filter(Boolean)
      .join('\n\n');

    const defaultPrompt = `Contribute your ${agent.title} expertise to this workflow.`;
    let runSources = allSources;
    if (agent.role === 'researcher') {
      const toolCall = addToolCall(runState, runtimeOptions, {
        toolId: RUNTIME_TOOLS.webSearch.id,
        toolName: RUNTIME_TOOLS.webSearch.name,
        requestedBy: agent.name,
        input: `${userQuery}\n${node.prompt || defaultPrompt}`,
        status: 'running'
      });
      const foundSources = await searchWeb(`${userQuery}\n${node.prompt || defaultPrompt}`, agent.name);
      if (foundSources.length > 0) {
        onSources(foundSources);
        allSources = [...allSources, ...foundSources];
        runSources = allSources;
        const knowledgeItems = sourcesToKnowledgeItems(foundSources);
        const evidenceClaims = createEvidenceClaims(foundSources, agent.name);
        runtimeOptions.onKnowledgeItems?.(knowledgeItems);
        runtimeOptions.onEvidenceClaims?.(evidenceClaims);
        updateRunState(runState, runtimeOptions, {
          knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
          evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
        });
      }
      updateToolCall(runState, runtimeOptions, toolCall.id, {
        status: foundSources.length > 0 ? 'complete' : 'error',
        outputSummary: foundSources.length > 0 ? `${foundSources.length} sources found` : 'No sources returned',
        sourceIds: foundSources.map(source => source.id)
      });
      addTrace(runState, runtimeOptions, {
        type: 'tool-call',
        title: RUNTIME_TOOLS.webSearch.name,
        detail: foundSources.length > 0 ? `${foundSources.length} sources attached` : 'Search returned no sources',
        agentId: agent.id,
        nodeId: node.id
      });
    }

    const prompt = `${node.prompt || defaultPrompt}\n\nUser request:\n${userQuery}\n\n${upstreamContext ? `Upstream context:\n${upstreamContext}` : ''}${formatSourcesForPrompt(runSources)}`;

    try {
      const output = await callModel(provider, stepModel, agent.systemPrompt || '', prompt);
      nodeOutputs[node.id] = output;
      onWorkflowNodeUpdate(node.id, { status: 'complete', output: summarizeForNode(output) });
      const outputKnowledge = outputToKnowledgeItem({ id: node.id, label: node.label, agentName: agent.name, agentRole: agent.role, output });
      runtimeOptions.onKnowledgeItems?.([outputKnowledge]);
      updateRunState(runState, runtimeOptions, { knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, [outputKnowledge.id]) });
      addTrace(runState, runtimeOptions, {
        type: 'step-complete',
        title: `${agent.name} completed ${node.label}`,
        detail: summarizeForNode(output),
        agentId: agent.id,
        nodeId: node.id
      });
      onStep(agent.id, {
        id: uuid(),
        sender: agent.name,
        role: 'agent',
        text: output,
        timestamp: getTimestamp()
      });
    } catch (error) {
      const message = getErrorMessage(error);
      nodeOutputs[node.id] = `Error: ${message}`;
      onWorkflowNodeUpdate(node.id, { status: 'error', output: message });
      addTrace(runState, runtimeOptions, {
        type: 'error',
        title: `${agent.name} step failed`,
        detail: message,
        agentId: agent.id,
        nodeId: node.id
      });
    } finally {
      incomingEdges.forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: false }));
      onThinking(agent.id, false);
    }
  }

  updateRunState(runState, runtimeOptions, { status: 'critiquing', activeStepId: undefined });
  const authoredEvaluation: RunEvaluation = {
    id: `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    reviewer: 'system',
    rating: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? 2 : 3,
    summary: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? 'Authored workflow completed with at least one step error.' : 'Authored workflow completed and is ready for synthesis.',
    strengths: ['Authored execution used the visible canvas graph.'],
    gaps: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? ['Review failed steps before relying on the synthesis.'] : [],
    nextActions: ['Review final synthesis and rerun any weak step from the canvas.'],
    timestamp: new Date().toISOString()
  };
  updateRunState(runState, runtimeOptions, { evaluations: [...runState.evaluations, authoredEvaluation], summary: authoredEvaluation.summary });
  addTrace(runState, runtimeOptions, { type: 'critique', title: 'Authored workflow evaluation', detail: authoredEvaluation.summary });

  const synthesisNode = nodes.find(node => node.type === 'synthesis') ?? {
    id: 'synthesis',
    type: 'synthesis' as const,
    label: 'Penny synthesis',
    status: 'queued' as const
  };
  onWorkflowNodeUpdate(synthesisNode.id, { status: 'thinking' });
  edges.filter(edge => edge.target === synthesisNode.id).forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: true }));
  onThinking(manager.id, true);
  updateRunState(runState, runtimeOptions, { status: 'synthesizing', activeStepId: synthesisNode.id });

  const workflowOutputs = Object.entries(nodeOutputs).map(([id, output]) => `\n## ${id}\n${output}`).join('\n');
  const synthesisPrompt = `Synthesize this authored workflow into a polished final output. Cite available sources by title or URL where relevant.\n\nUser request:\n${userQuery}\n\nWorkflow outputs:\n${workflowOutputs}${formatSourcesForPrompt(allSources)}`;
  const finalAnswer = await callModel(provider, model, manager.systemPrompt || '', synthesisPrompt, 6144);
  onThinking(manager.id, false);
  updateRunState(runState, runtimeOptions, { status: 'complete', completedAt: new Date().toISOString(), activeStepId: undefined });
  addTrace(runState, runtimeOptions, {
    type: 'synthesis',
    title: 'Final synthesis complete',
    detail: summarizeForNode(finalAnswer),
    agentId: manager.id,
    nodeId: synthesisNode.id
  });
  onWorkflowNodeUpdate(synthesisNode.id, { status: 'complete', output: summarizeForNode(finalAnswer) });
  edges.filter(edge => edge.target === synthesisNode.id).forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: false }));
  onFinalOutput({ id: uuid(), sender: manager.name, role: 'agent', text: finalAnswer, timestamp: getTimestamp() });
  onStep(manager.id, { id: uuid(), sender: manager.name, role: 'agent', text: 'Output is ready.', timestamp: getTimestamp() });
}

function sortWorkflowNodes(nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]) {
  const sorted: WorkflowCanvasNode[] = [];
  const remaining = [...nodes];
  const completed = new Set<string>();

  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex(node => edges.filter(edge => edge.target === node.id && nodes.some(candidate => candidate.id === edge.source)).every(edge => completed.has(edge.source)));
    const index = nextIndex === -1 ? 0 : nextIndex;
    const [next] = remaining.splice(index, 1);
    sorted.push(next);
    completed.add(next.id);
  }

  return sorted;
}

function normalizeDelegations(delegations: DelegationPlanItem[], agents: Agent[]): NormalizedDelegation[] {
  const usedIds = new Set<string>();

  const normalized = delegations
    .map((delegation, index) => {
      const target = agents.find(agent => agent.role === delegation.agent || agent.id === delegation.agent);
      if (!target) return null;

      const baseId = sanitizeId(delegation.id || `${target.id}-${index + 1}`);
      const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
      usedIds.add(id);

      return {
        id,
        agent: target.role,
        label: delegation.label || `${target.name} pass ${index + 1}`,
        prompt: delegation.prompt,
        dependsOn: (delegation.dependsOn ?? []).map(sanitizeId)
      };
    })
    .filter((delegation): delegation is NormalizedDelegation => delegation !== null);

  const validIds = new Set(normalized.map(delegation => delegation.id));
  return normalized.map(delegation => ({
    ...delegation,
    dependsOn: delegation.dependsOn.filter(dependencyId => validIds.has(dependencyId) && dependencyId !== delegation.id)
  }));
}

function createWorkflowPlan(userQuery: string, manager: Agent, agents: Agent[], delegations: NormalizedDelegation[]) {
  const requestNodeId = 'request';
  const managerNodeId = 'manager';
  const synthesisNodeId = 'synthesis';

  const nodes: WorkflowCanvasNode[] = [
    {
      id: requestNodeId,
      type: 'request',
      label: 'User request',
      status: 'complete',
      output: userQuery
    },
    {
      id: managerNodeId,
      type: 'manager',
      label: manager.name,
      status: 'complete',
      agentId: manager.id,
      output: 'Team assembled'
    },
    ...delegations.map(delegation => {
      const agent = agents.find(item => item.role === delegation.agent || item.id === delegation.agent);
      return {
        id: delegation.id,
        type: 'agent' as const,
        label: delegation.label,
        status: 'queued' as const,
        agentId: agent?.id,
        prompt: delegation.prompt
      };
    }),
    {
      id: synthesisNodeId,
      type: 'synthesis',
      label: 'Penny synthesis',
      status: 'queued'
    }
  ];

  const edges: WorkflowCanvasEdge[] = [
    { id: 'request-manager', source: requestNodeId, target: managerNodeId },
    ...delegations.flatMap(delegation => {
      if (delegation.dependsOn.length === 0) {
        return [{ id: `${managerNodeId}-${delegation.id}`, source: managerNodeId, target: delegation.id }];
      }

      return delegation.dependsOn.map(sourceId => ({
        id: `${sanitizeId(sourceId)}-${delegation.id}`,
        source: sanitizeId(sourceId),
        target: delegation.id
      }));
    }),
    ...delegations.map(delegation => ({ id: `${delegation.id}-${synthesisNodeId}`, source: delegation.id, target: synthesisNodeId }))
  ];

  return { nodes, edges, synthesisNodeId };
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'step';
}

function summarizeForNode(text: string): string {
  const cleaned = text.replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 220)}...` : cleaned;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
