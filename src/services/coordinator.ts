import { AGENT_CATALOG } from '../data/agents';
import type {
  RunStateMemory,
  SourceRecord,
  WorkflowCanvasEdge,
  WorkflowCanvasNode,
  WorkflowModelProvider,
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

export type ModelProvider = WorkflowModelProvider;

interface DelegationPlanItem {
  agent: string;
  prompt: string;
  id?: string;
  label?: string;
  dependsOn?: string[];
  provider?: ModelProvider;
  model?: string;
}

interface PlanningResult {
  delegations: DelegationPlanItem[];
  response: string;
  assumptions?: string[];
  unansweredQuestions?: string[];
}

interface NormalizedDelegation {
  id: string;
  agent: string;
  label: string;
  prompt: string;
  dependsOn: string[];
  provider?: ModelProvider;
  model?: string;
}

interface HeuristicRoute {
  agent: Agent;
  score: number;
  matchedKeywords: string[];
}

interface CoordinatorCritique {
  verdict: 'sufficient' | 'needs_more_evidence' | 'needs_followup';
  reason: string;
  followupPrompt?: string;
  assumptions?: string[];
  unansweredQuestions?: string[];
  conflicts?: string[];
}

interface ExecutionStep {
  id: string;
  agentId: string;
  label: string;
  prompt: string;
  dependsOn: string[];
  provider?: ModelProvider;
  model?: string;
}

interface ExecuteWorkflowGraphParams {
  userQuery: string;
  manager: Agent;
  activeAgents: Agent[];
  provider: ModelProvider;
  model: string;
  steps: ExecutionStep[];
  edges: WorkflowCanvasEdge[];
  runState: RunStateMemory;
  onStep: (agentId: string, message: ChatMessage) => void;
  onThinking: (agentId: string, isThinking: boolean) => void;
  onWorkflowNodeUpdate?: (nodeId: string, update: WorkflowNodeUpdate) => void;
  onWorkflowEdgeUpdate?: (edgeId: string, update: Partial<WorkflowCanvasEdge>) => void;
  onSources?: (sources: SourceRecord[]) => void;
}

export const INITIAL_AGENTS: Agent[] = AGENT_CATALOG;

const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const uuid = () => Math.random().toString(36).substring(2, 9);

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
  return `\n\nAvailable sources:\n${sources
    .map((source, index) => `[S${index + 1}] ${source.title}${source.url ? ` (${source.url})` : ''}\n${source.snippet}`)
    .join('\n\n')}`;
}

function createRunState(userQuery: string, existingSources: SourceRecord[]): RunStateMemory {
  return {
    objective: userQuery,
    assumptions: [],
    evidence: [],
    conflicts: [],
    unansweredQuestions: [],
    decisions: [],
    stepOutputs: {},
    stepSummaries: {},
    sources: [...existingSources]
  };
}

function computeHeuristicRoutes(userQuery: string, specialists: Agent[]): HeuristicRoute[] {
  const normalizedQuery = userQuery.toLowerCase();
  const routes = specialists.map(agent => {
    const keywords = agent.specialtyKeywords ?? [];
    const matchedKeywords = keywords.filter(keyword => normalizedQuery.includes(keyword.toLowerCase()));
    return {
      agent,
      score: matchedKeywords.length,
      matchedKeywords
    };
  }).filter(route => route.score > 0);

  return routes.sort((a, b) => b.score - a.score || a.agent.name.localeCompare(b.agent.name));
}

function stripCodeFences(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

function extractJsonObject(text: string): string {
  const trimmed = stripCodeFences(text);
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return trimmed;
  }
  return trimmed.slice(firstBrace, lastBrace + 1);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean);
}

function buildFallbackPlan(specialists: Agent[], userQuery: string, heuristicRoutes: HeuristicRoute[]): PlanningResult {
  const selected = (heuristicRoutes.length > 0 ? heuristicRoutes.map(route => route.agent) : specialists).slice(0, 2);
  const fallbackSpecialists = selected.length > 0 ? selected : specialists.slice(0, 1);

  return {
    delegations: fallbackSpecialists.map((agent, index) => ({
      id: `${agent.id}-pass-${index + 1}`,
      agent: agent.role,
      label: `${agent.name} pass ${index + 1}`,
      prompt: `Analyze this request from your specialty and provide actionable guidance:\n${userQuery}`,
      dependsOn: index === 0 ? [] : [`${fallbackSpecialists[index - 1].id}-pass-${index}`]
    })),
    response: `Plan: consult ${fallbackSpecialists.map(agent => agent.name).join(', ')} for targeted coverage. Working with the other agents now...`
  };
}

function parsePlanningResult(
  planTextRaw: string,
  specialists: Agent[],
  userQuery: string,
  heuristicRoutes: HeuristicRoute[]
): PlanningResult {
  try {
    const parsed = JSON.parse(extractJsonObject(planTextRaw)) as Record<string, unknown>;
    const rawDelegations = Array.isArray(parsed.delegations) ? parsed.delegations : [];

    const delegations: DelegationPlanItem[] = [];
    rawDelegations.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const record = item as Record<string, unknown>;
      const agent = typeof record.agent === 'string' ? record.agent.trim() : '';
      const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
      if (!agent || !prompt) return;

      const provider = typeof record.provider === 'string' ? record.provider.trim() as ModelProvider : undefined;
      const model = typeof record.model === 'string' ? record.model.trim() : undefined;

      delegations.push({
        id: typeof record.id === 'string' ? record.id : `step-${index + 1}`,
        agent,
        label: typeof record.label === 'string' ? record.label.trim() : undefined,
        prompt,
        dependsOn: parseStringArray(record.dependsOn),
        provider,
        model
      });
    });

    if (delegations.length === 0) {
      return buildFallbackPlan(specialists, userQuery, heuristicRoutes);
    }

    return {
      delegations,
      response: typeof parsed.response === 'string' && parsed.response.trim().length > 0
        ? parsed.response.trim()
        : `Plan: consult ${delegations.length} specialist step${delegations.length === 1 ? '' : 's'} based on your request. Working with the other agents now...`,
      assumptions: parseStringArray(parsed.assumptions),
      unansweredQuestions: parseStringArray(parsed.unansweredQuestions)
    };
  } catch {
    return buildFallbackPlan(specialists, userQuery, heuristicRoutes);
  }
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

      const normalizedDelegation: NormalizedDelegation = {
        id,
        agent: target.role,
        label: delegation.label || `${target.name} pass ${index + 1}`,
        prompt: delegation.prompt,
        dependsOn: delegation.dependsOn ?? [],
        provider: delegation.provider,
        model: delegation.model
      };
      return normalizedDelegation;
    })
    .filter((delegation): delegation is NormalizedDelegation => delegation !== null);

  const validIds = new Set(normalized.map(item => item.id));
  return normalized.map(step => ({
    ...step,
    dependsOn: [...new Set(step.dependsOn
      .map(sanitizeId)
      .filter(sourceId => sourceId !== step.id && validIds.has(sourceId)))]
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
        prompt: delegation.prompt,
        provider: delegation.provider,
        model: delegation.model
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

const TOOL_REGISTRY = {
  webSearch: {
    shouldUse: (_step: ExecutionStep, agent: Agent, userQuery: string, prompt: string) => (
      agent.role === 'researcher' || /\b(research|source|sources|evidence|fact|facts|verify|validation|compare|benchmark|cit|latest|news)\b/i.test(`${userQuery}\n${prompt}`)
    ),
    run: async (query: string, usedBy: string) => searchWeb(query, usedBy)
  }
} as const;

function buildDependencyContext(step: ExecutionStep, runState: RunStateMemory) {
  if (step.dependsOn.length === 0) return '';

  const sections = step.dependsOn
    .map(dependsOnId => {
      const outputs = runState.stepOutputs[dependsOnId] ?? [];
      if (outputs.length === 0) return '';
      return `### Dependency ${dependsOnId}\n${outputs.join('\n\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return sections ? `\n\nDependency outputs:\n${sections}` : '';
}

async function critiqueStepResult(
  manager: Agent,
  provider: ModelProvider,
  model: string,
  userQuery: string,
  step: ExecutionStep,
  result: string,
  runState: RunStateMemory
): Promise<CoordinatorCritique> {
  const critiquePrompt = `You are ${manager.name}, evaluating specialist output for workflow step "${step.label}" (${step.id}).\n\nUser objective:\n${userQuery}\n\nCurrent step prompt:\n${step.prompt}\n\nStep result:\n${result}\n\nKnown assumptions:\n${runState.assumptions.join('\n') || 'None'}\n\nKnown unanswered questions:\n${runState.unansweredQuestions.join('\n') || 'None'}\n\nRespond ONLY JSON with this schema:\n{\n  "verdict": "sufficient" | "needs_more_evidence" | "needs_followup",\n  "reason": "short reason",\n  "followupPrompt": "optional follow-up instructions",\n  "assumptions": ["optional assumption"],\n  "unansweredQuestions": ["optional unanswered question"],\n  "conflicts": ["optional conflict"]\n}`;

  try {
    const critiqueRaw = await callModel(provider, model, manager.systemPrompt || '', critiquePrompt, 1024);
    const parsed = JSON.parse(extractJsonObject(critiqueRaw)) as Record<string, unknown>;
    const verdict = typeof parsed.verdict === 'string' ? parsed.verdict : 'sufficient';

    return {
      verdict: verdict === 'needs_more_evidence' || verdict === 'needs_followup' ? verdict : 'sufficient',
      reason: typeof parsed.reason === 'string' && parsed.reason.trim().length > 0 ? parsed.reason.trim() : 'No critique provided.',
      followupPrompt: typeof parsed.followupPrompt === 'string' ? parsed.followupPrompt.trim() : undefined,
      assumptions: parseStringArray(parsed.assumptions),
      unansweredQuestions: parseStringArray(parsed.unansweredQuestions),
      conflicts: parseStringArray(parsed.conflicts)
    };
  } catch {
    return {
      verdict: 'sufficient',
      reason: 'Critique unavailable.'
    };
  }
}

async function executeSingleStep(
  params: ExecuteWorkflowGraphParams,
  step: ExecutionStep
): Promise<void> {
  const { userQuery, manager, activeAgents, provider, model, edges, runState, onStep, onThinking, onWorkflowNodeUpdate, onWorkflowEdgeUpdate, onSources } = params;
  const agent = activeAgents.find(item => item.id === step.agentId);
  if (!agent) return;

  const incomingEdges = edges.filter(edge => edge.target === step.id);
  incomingEdges.forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
  onWorkflowNodeUpdate?.(step.id, { status: 'thinking' });
  onThinking(agent.id, true);

  const outputs: string[] = [];
  const maxCritiquePasses = 2;
  let pass = 0;
  let currentPrompt = step.prompt;

  while (pass <= maxCritiquePasses) {
    let runSources = runState.sources;
    if (TOOL_REGISTRY.webSearch.shouldUse(step, agent, userQuery, currentPrompt)) {
      const discovered = await TOOL_REGISTRY.webSearch.run(`${userQuery}\n${currentPrompt}`, agent.name);
      if (discovered.length > 0) {
        runState.sources = [...runState.sources, ...discovered];
        runSources = runState.sources;
        runState.evidence.push(`Step ${step.id} gathered ${discovered.length} web source${discovered.length === 1 ? '' : 's'}.`);
        onSources?.(discovered);
      }
    }

    const dependencyContext = buildDependencyContext(step, runState);
    const perStepPrompt = `${currentPrompt}\n\nUser request:\n${userQuery}${dependencyContext}${formatSourcesForPrompt(runSources)}`;

    try {
      const result = await callModel(step.provider || provider, step.model || model, agent.systemPrompt || '', perStepPrompt);
      outputs.push(result);

      const keyedOutputs = runState.stepOutputs[step.id] ?? [];
      runState.stepOutputs[step.id] = [...keyedOutputs, result];
      runState.stepSummaries[step.id] = summarizeForNode(result);

      onStep(agent.id, {
        id: uuid(),
        sender: agent.name,
        role: 'agent',
        text: result,
        timestamp: getTimestamp()
      });

      const critique = await critiqueStepResult(manager, provider, model, userQuery, step, result, runState);
      if (critique.assumptions && critique.assumptions.length > 0) {
        runState.assumptions = [...new Set([...runState.assumptions, ...critique.assumptions])];
      }
      if (critique.unansweredQuestions && critique.unansweredQuestions.length > 0) {
        runState.unansweredQuestions = [...new Set([...runState.unansweredQuestions, ...critique.unansweredQuestions])];
      }
      if (critique.conflicts && critique.conflicts.length > 0) {
        runState.conflicts = [...new Set([...runState.conflicts, ...critique.conflicts])];
      }

      runState.decisions.push(`Step ${step.id}: ${critique.reason}`);

      if (critique.verdict === 'sufficient' || pass === maxCritiquePasses) {
        break;
      }

      pass += 1;
      currentPrompt = critique.followupPrompt && critique.followupPrompt.length > 0
        ? `${step.prompt}\n\nFollow-up pass ${pass}: ${critique.followupPrompt}`
        : `${step.prompt}\n\nFollow-up pass ${pass}: improve evidence quality and resolve open questions from the previous result.`;
    } catch (error) {
      const message = getErrorMessage(error);
      runState.stepOutputs[step.id] = [...(runState.stepOutputs[step.id] ?? []), `Error: ${message}`];
      runState.stepSummaries[step.id] = message;
      onWorkflowNodeUpdate?.(step.id, { status: 'error', output: message });
      onStep(agent.id, {
        id: uuid(),
        sender: agent.name,
        role: 'agent',
        text: `Apologies, I encountered an issue: ${message}`,
        timestamp: getTimestamp()
      });
      incomingEdges.forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: false }));
      onThinking(agent.id, false);
      return;
    }
  }

  const finalText = outputs.join('\n\n---\n\n');
  onWorkflowNodeUpdate?.(step.id, { status: 'complete', output: summarizeForNode(finalText) });
  incomingEdges.forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: false }));
  onThinking(agent.id, false);
}

async function executeWorkflowGraph(params: ExecuteWorkflowGraphParams): Promise<void> {
  const pending = new Map(params.steps.map(step => [step.id, step]));
  const completed = new Set<string>();

  while (pending.size > 0) {
    const ready = [...pending.values()].filter(step => step.dependsOn.every(dependsOnId => completed.has(dependsOnId)));
    const batch = ready.length > 0 ? ready : [pending.values().next().value as ExecutionStep];

    await Promise.all(batch.map(async step => {
      await executeSingleStep(params, step);
      completed.add(step.id);
      pending.delete(step.id);
    }));
  }
}

function buildRunStatePrompt(runState: RunStateMemory): string {
  const sections = [
    `Objective:\n${runState.objective}`,
    `Assumptions:\n${runState.assumptions.join('\n') || 'None'}`,
    `Evidence notes:\n${runState.evidence.join('\n') || 'None'}`,
    `Conflicts:\n${runState.conflicts.join('\n') || 'None'}`,
    `Unanswered questions:\n${runState.unansweredQuestions.join('\n') || 'None'}`,
    `Decisions:\n${runState.decisions.join('\n') || 'None'}`,
    `Step outputs:\n${Object.entries(runState.stepOutputs).map(([stepId, outputs]) => `## ${stepId}\n${outputs.join('\n\n')}`).join('\n\n') || 'None'}`
  ];

  return sections.join('\n\n');
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
  existingSources: SourceRecord[] = []
): Promise<void> {
  const activeAgents = agents.some(a => a.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const secretary = getCoordinator(activeAgents);
  const specialists = getSpecialists(activeAgents);
  const runState = createRunState(userQuery, existingSources);

  try {
    onThinking(secretary.id, true);

    const heuristicRoutes = computeHeuristicRoutes(userQuery, specialists);
    const heuristicPrior = heuristicRoutes.length > 0
      ? `Heuristic prior from specialty keywords (use as guidance, not a hard rule):\n${heuristicRoutes.slice(0, 4).map(route => `- ${route.agent.name} (${route.agent.role}) score=${route.score} keywords=[${route.matchedKeywords.join(', ')}]`).join('\n')}`
      : 'Heuristic prior from specialty keywords: no strong direct match found.';

    const planningPrompt = `
You are Penny, the Executive Coordinator. The User has sent a request:
"${userQuery}"

Your task is to:
1. Coordinate your team of specialists:
${specialists.map(agent => `   - ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}
2. Write a JSON structure indicating which workflow steps to run, which agent owns each step, what prompt to send, any dependencies between steps, and optional provider/model overrides.
3. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query (between 1 and 4 agents).
4. You may use the same specialist more than once if the work naturally loops back to them. Each repeated appearance must be a separate delegation with a unique id.
5. Keep response concise and end with: "Working with the other agents now..."

${heuristicPrior}

Your response MUST be valid JSON in this exact format:
{
  "delegations": [
    {
      "id": "short_unique_step_id",
      "agent": "${specialists.map(agent => agent.role).join('" | "')}",
      "label": "Short node label",
      "prompt": "Detailed instructions",
      "dependsOn": ["optional_previous_step_id"],
      "provider": "optional provider override",
      "model": "optional model override"
    }
  ],
  "response": "status message",
  "assumptions": ["optional assumption"],
  "unansweredQuestions": ["optional open question"]
}
Do not write markdown formatting (like \`\`\`json) in your raw output, output only the JSON string.
`;

    const planTextRaw = await callModel(provider, model, secretary.systemPrompt || '', `${planningPrompt}${formatSourcesForPrompt(runState.sources)}`);
    onThinking(secretary.id, false);

    const plan = parsePlanningResult(planTextRaw, specialists, userQuery, heuristicRoutes);
    runState.assumptions = [...new Set([...runState.assumptions, ...(plan.assumptions ?? [])])];
    runState.unansweredQuestions = [...new Set([...runState.unansweredQuestions, ...(plan.unansweredQuestions ?? [])])];

    const normalizedDelegations = normalizeDelegations(plan.delegations, activeAgents);
    const workflow = createWorkflowPlan(userQuery, secretary, activeAgents, normalizedDelegations);
    onWorkflowPlan?.(workflow.nodes, workflow.edges);

    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: plan.response,
      timestamp: getTimestamp()
    });

    const steps: ExecutionStep[] = normalizedDelegations.map(delegation => {
      const targetAgent = activeAgents.find(item => item.role === delegation.agent || item.id === delegation.agent);
      return {
        id: delegation.id,
        agentId: targetAgent?.id || delegation.agent,
        label: delegation.label,
        prompt: delegation.prompt,
        dependsOn: delegation.dependsOn,
        provider: delegation.provider,
        model: delegation.model
      };
    });

    await executeWorkflowGraph({
      userQuery,
      manager: secretary,
      activeAgents,
      provider,
      model,
      steps,
      edges: workflow.edges,
      runState,
      onStep,
      onThinking,
      onWorkflowNodeUpdate,
      onWorkflowEdgeUpdate,
      onSources
    });

    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'thinking' });
    workflow.edges
      .filter(edge => edge.target === workflow.synthesisNodeId)
      .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
    onThinking(secretary.id, true);

    const synthesisPrompt = `
The team has finished their delegated workflow.

Synthesize a final answer using the structured run-state below.
- Explicitly cite applicable sources using [S1], [S2], etc.
- If evidence is partial or weak, clearly state uncertainty/confidence.
- Preserve useful specialist insights while removing duplication.

Run-state memory:
${buildRunStatePrompt(runState)}
`;

    const finalAnswer = await callModel(provider, model, secretary.systemPrompt || '', `${synthesisPrompt}${formatSourcesForPrompt(runState.sources)}`, 6144);
    onThinking(secretary.id, false);
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

function buildAuthoredExecutionSteps(nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]): ExecutionStep[] {
  const agentNodes = nodes.filter(node => node.type === 'agent' && node.agentId);
  return agentNodes.map(node => {
    const dependsOn = edges
      .filter(edge => edge.target === node.id)
      .map(edge => edge.source)
      .filter(source => agentNodes.some(candidate => candidate.id === source));

    return {
      id: node.id,
      agentId: node.agentId as string,
      label: node.label,
      prompt: node.prompt || 'Contribute your expertise to this workflow step.',
      dependsOn,
      provider: node.provider,
      model: node.model
    };
  });
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
  existingSources: SourceRecord[] = []
) {
  const activeAgents = agents.some(agent => agent.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const manager = getCoordinator(activeAgents);
  const steps = buildAuthoredExecutionSteps(nodes, edges);
  const runState = createRunState(userQuery, existingSources);

  onStep(manager.id, {
    id: uuid(),
    sender: manager.name,
    role: 'agent',
    text: `I will run your authored workflow with ${steps.length} specialist step${steps.length === 1 ? '' : 's'}.`,
    timestamp: getTimestamp()
  });

  await executeWorkflowGraph({
    userQuery,
    manager,
    activeAgents,
    provider,
    model,
    steps,
    edges,
    runState,
    onStep,
    onThinking,
    onWorkflowNodeUpdate,
    onWorkflowEdgeUpdate,
    onSources
  });

  const synthesisNode = nodes.find(node => node.type === 'synthesis') ?? {
    id: 'synthesis',
    type: 'synthesis' as const,
    label: 'Penny synthesis',
    status: 'queued' as const
  };

  onWorkflowNodeUpdate(synthesisNode.id, { status: 'thinking' });
  edges.filter(edge => edge.target === synthesisNode.id).forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: true }));
  onThinking(manager.id, true);

  const synthesisPrompt = `Synthesize this authored workflow into a polished final output.

Use and respect this run-state memory:
${buildRunStatePrompt(runState)}

Requirements:
- Cite relevant sources with [S1], [S2], etc.
- Mark confidence/uncertainty when evidence is weak or partial.`;

  const finalAnswer = await callModel(provider, model, manager.systemPrompt || '', `${synthesisPrompt}${formatSourcesForPrompt(runState.sources)}`, 6144);
  onThinking(manager.id, false);
  onWorkflowNodeUpdate(synthesisNode.id, { status: 'complete', output: summarizeForNode(finalAnswer) });
  edges.filter(edge => edge.target === synthesisNode.id).forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: false }));
  onFinalOutput({ id: uuid(), sender: manager.name, role: 'agent', text: finalAnswer, timestamp: getTimestamp() });
  onStep(manager.id, { id: uuid(), sender: manager.name, role: 'agent', text: 'Output is ready.', timestamp: getTimestamp() });
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
