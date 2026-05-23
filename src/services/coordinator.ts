import { AGENT_CATALOG } from '../data/agents';
import type { SourceRecord, WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeUpdate } from '../types/workflow';

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

type NormalizedDelegation = Required<DelegationPlanItem>;

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
  
  // 1. Warm-up and load prompts if they aren't loaded yet
  const activeAgents = agents.some(a => a.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const secretary = getCoordinator(activeAgents);
  const specialists = getSpecialists(activeAgents);
  const preRouting = rankSpecialistsForQuery(userQuery, specialists);
  const prioritizedSpecialists = preRouting.rankedSpecialists;
  
  // Helper to generate timestamps
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);

  try {
    // --- Step 1: Penny analyzes the request and delegates tasks ---
    onThinking(secretary.id, true);
    
    const planningPrompt = `
You are Penny, the Executive Coordinator. The User has sent a request:
"${userQuery}"

Your task is to:
1. Coordinate your team of specialists:
${prioritizedSpecialists.map(agent => `   - ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}
2. Write a JSON structure indicating which workflow steps you want to run, which agent owns each step, what prompt to send, and any dependencies between steps.
3. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query (between 1 and 4 agents).
  - If a specialist's title and role are irrelevant, omit that specialist.
  - If the request is pure coding, API design, setup, or systems architecture, prioritize technical agents.
  - If the request is creative writing, branding, advertising, or campaign work, prioritize creative agents.
  - If user research, demographics, culture, or behavior are irrelevant, omit cultural research agents.
  - If business strategy, SWOT, pricing, or OKRs are irrelevant, omit strategy agents.
4. You may use the same specialist more than once if the work naturally loops back to them. Each repeated appearance must be a separate delegation with a unique id.
5. Provide a very concise status message in the 'response' field outlining your plan to the user. Avoid pleasantries, chit-chat, or filler text. Start directly with the plan, state exactly which agents you are consulting and why (in a short sentence), and end with: "Working with the other agents now..."
6. Deterministic routing prior from keyword matching (use as a strong prior, not an absolute rule):
${preRouting.summary}

Your response MUST be valid JSON in this exact format:
{
  "delegations": [
    {
      "id": "short_unique_step_id",
      "agent": "${prioritizedSpecialists.map(agent => agent.role).join('" | "')}",
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

    // Clean JSON wrapper if the LLM outputted code blocks
    const cleanJsonText = planTextRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    let plan: PlanningResult;
    
    try {
      plan = JSON.parse(cleanJsonText);
    } catch {
      // Fallback if parsing fails
      plan = {
        delegations: [
          ...prioritizedSpecialists.slice(0, 2).map(agent => ({
            id: `${agent.id}-pass-1`,
            agent: agent.role,
            label: agent.name,
            prompt: `Analyze this request from your specialty: ${userQuery}`
          }))
        ],
        response: `${secretary.name} here. I'll consult ${prioritizedSpecialists.slice(0, 2).map(agent => agent.name).join(' and ')}. Working with the other agents now...`
      };
    }

    const normalizedDelegations = normalizeDelegations(plan.delegations, activeAgents);
    const resolvedPlan = resolveDelegationDependencies(normalizedDelegations);
    const workflow = createWorkflowPlan(userQuery, secretary, activeAgents, resolvedPlan.delegations);
    onWorkflowPlan?.(workflow.nodes, workflow.edges);

    // Post Penny's planning message
    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: plan.response,
      timestamp: getTimestamp()
    });

    if (resolvedPlan.warnings.length > 0) {
      onStep(secretary.id, {
        id: uuid(),
        sender: secretary.name,
        role: 'agent',
        text: resolvedPlan.warnings.join(' '),
        timestamp: getTimestamp()
      });
    }

    const subAgentResults: Record<string, { label: string; agentName: string; text: string }> = {};
    let cumulativeSources = [...existingSources];

    // --- Step 2: Execute delegations in sequence/parallel ---
    for (const delegation of resolvedPlan.orderedDelegations) {
      const targetAgent = activeAgents.find(a => a.role === delegation.agent || a.id === delegation.agent);
      if (!targetAgent) {
        const errorText = `Error: Unable to resolve specialist for step "${delegation.id}".`;
        subAgentResults[delegation.id] = {
          label: delegation.label,
          agentName: delegation.agent,
          text: errorText
        };
        onWorkflowNodeUpdate?.(delegation.id, { status: 'error', output: errorText });
        continue;
      }

      onWorkflowNodeUpdate?.(delegation.id, { status: 'thinking' });
      workflow.edges
        .filter(edge => edge.target === delegation.id)
        .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
      onThinking(targetAgent.id, true);
      // Wait a simulated bit to give the UI breathing room
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch prompt
      try {
        let runSources = cumulativeSources;
        if (targetAgent.role === 'researcher') {
          const foundSources = await searchWeb(`${userQuery}\n${delegation.prompt}`, targetAgent.name);
          if (foundSources.length > 0) {
            onSources?.(foundSources);
            cumulativeSources = [...cumulativeSources, ...foundSources];
            runSources = cumulativeSources;
          }
        }
        const dependencyContext = delegation.dependsOn
          .map(depId => subAgentResults[depId] ? `Output from step ${depId} (${subAgentResults[depId].label}, ${subAgentResults[depId].agentName}):\n${subAgentResults[depId].text}` : '')
          .filter(Boolean)
          .join('\n\n');
        const prompt = `${delegation.prompt}${dependencyContext ? `\n\nDependency outputs:\n${dependencyContext}` : ''}${formatSourcesForPrompt(runSources)}`;
        const subResult = await callModel(provider, model, targetAgent.systemPrompt || '', prompt);
        subAgentResults[delegation.id] = {
          label: delegation.label,
          agentName: targetAgent.name,
          text: subResult
        };
        
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: subResult,
          timestamp: getTimestamp()
        });
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        const errorText = `Error: ${message}`;
        subAgentResults[delegation.id] = {
          label: delegation.label,
          agentName: targetAgent.name,
          text: errorText
        };
        onWorkflowNodeUpdate?.(delegation.id, { status: 'error', output: message });
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: `Apologies, I encountered an issue: ${message}`,
          timestamp: getTimestamp()
        });
      }
      if (subAgentResults[delegation.id] && !subAgentResults[delegation.id].text.startsWith('Error:')) {
        onWorkflowNodeUpdate?.(delegation.id, { status: 'complete', output: summarizeForNode(subAgentResults[delegation.id].text) });
      }
      workflow.edges
        .filter(edge => edge.target === delegation.id)
        .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: false }));
      onThinking(targetAgent.id, false);
    }

    // --- Step 3: Penny synthesizes all inputs and responds to the user ---
    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'thinking' });
    workflow.edges
      .filter(edge => edge.target === workflow.synthesisNodeId)
      .forEach(edge => onWorkflowEdgeUpdate?.(edge.id, { active: true }));
    onThinking(secretary.id, true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const synthesisPrompt = `
The team has finished their sub-tasks. Here are their reports:
${resolvedPlan.orderedDelegations.map((delegation) => {
  const result = subAgentResults[delegation.id];
  const author = result?.agentName ?? delegation.agent;
  const output = result?.text ?? 'No output captured for this step.';
  return `\n### Step ${delegation.id} (${delegation.label}) - ${author}:\n${output}`;
}).join('\n')}

Based on their findings and your role as Penny (Executive Coordinator), present the final compiled solution to the User. Make it professional, beautifully structured with headings/markdown, and highlight which expert provided which insights.
Keep the tone direct and concise, avoiding excessive conversational filler, fluff, or chatty pleasantries.
`;

    const finalAnswer = await callModel(provider, model, secretary.systemPrompt || '', `${synthesisPrompt}${formatSourcesForPrompt(cumulativeSources)}`, 6144);
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
  const agentNodes = sortWorkflowNodes(nodes.filter(node => node.type === 'agent' && node.agentId), edges);
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);
  const nodeOutputs: Record<string, string> = {};

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

    const incomingEdges = edges.filter(edge => edge.target === node.id);
    incomingEdges.forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: true }));
    onWorkflowNodeUpdate(node.id, { status: 'thinking' });
    onThinking(agent.id, true);

    const upstreamContext = incomingEdges
      .map(edge => nodeOutputs[edge.source] ? `Output from ${edge.source}:\n${nodeOutputs[edge.source]}` : '')
      .filter(Boolean)
      .join('\n\n');

    const defaultPrompt = `Contribute your ${agent.title} expertise to this workflow.`;
    let runSources = existingSources;
    if (agent.role === 'researcher') {
      const foundSources = await searchWeb(`${userQuery}\n${node.prompt || defaultPrompt}`, agent.name);
      if (foundSources.length > 0) {
        onSources(foundSources);
        runSources = [...existingSources, ...foundSources];
      }
    }

    const prompt = `${node.prompt || defaultPrompt}\n\nUser request:\n${userQuery}\n\n${upstreamContext ? `Upstream context:\n${upstreamContext}` : ''}${formatSourcesForPrompt(runSources)}`;

    try {
      const output = await callModel(provider, model, agent.systemPrompt || '', prompt);
      nodeOutputs[node.id] = output;
      onWorkflowNodeUpdate(node.id, { status: 'complete', output: summarizeForNode(output) });
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
    } finally {
      incomingEdges.forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: false }));
      onThinking(agent.id, false);
    }
  }

  const synthesisNode = nodes.find(node => node.type === 'synthesis') ?? {
    id: 'synthesis',
    type: 'synthesis' as const,
    label: 'Penny synthesis',
    status: 'queued' as const
  };
  onWorkflowNodeUpdate(synthesisNode.id, { status: 'thinking' });
  edges.filter(edge => edge.target === synthesisNode.id).forEach(edge => onWorkflowEdgeUpdate(edge.id, { active: true }));
  onThinking(manager.id, true);

  const workflowOutputs = Object.entries(nodeOutputs).map(([id, output]) => `\n## ${id}\n${output}`).join('\n');
  const synthesisPrompt = `Synthesize this authored workflow into a polished final output.\n\nUser request:\n${userQuery}\n\nWorkflow outputs:\n${workflowOutputs}${formatSourcesForPrompt(existingSources)}`;
  const finalAnswer = await callModel(provider, model, manager.systemPrompt || '', synthesisPrompt, 6144);
  onThinking(manager.id, false);
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

  return delegations
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
}

function resolveDelegationDependencies(delegations: NormalizedDelegation[]) {
  const validIds = new Set(delegations.map(delegation => delegation.id));
  const warnings: string[] = [];
  const dependencies = new Map<string, Set<string>>();

  for (const delegation of delegations) {
    const filteredDependencies = new Set<string>();
    for (const dependencyId of delegation.dependsOn) {
      if (dependencyId === delegation.id) {
        warnings.push(`Ignored self-dependency on step "${delegation.id}".`);
        continue;
      }
      if (!validIds.has(dependencyId)) {
        warnings.push(`Ignored unknown dependency "${dependencyId}" referenced by step "${delegation.id}".`);
        continue;
      }
      filteredDependencies.add(dependencyId);
    }
    dependencies.set(delegation.id, filteredDependencies);
  }

  const scheduled = new Set<string>();
  const orderedIds: string[] = [];

  while (orderedIds.length < delegations.length) {
    const ready = delegations.filter(delegation => !scheduled.has(delegation.id) && [...(dependencies.get(delegation.id) ?? [])].every(depId => scheduled.has(depId)));
    if (ready.length > 0) {
      for (const delegation of ready) {
        scheduled.add(delegation.id);
        orderedIds.push(delegation.id);
      }
      continue;
    }

    const blocked = delegations.find(delegation => !scheduled.has(delegation.id));
    if (!blocked) break;
    const blockedDependencies = dependencies.get(blocked.id);
    const dependencyToDrop = blockedDependencies ? [...blockedDependencies].find(depId => !scheduled.has(depId)) : undefined;
    if (dependencyToDrop && blockedDependencies) {
      blockedDependencies.delete(dependencyToDrop);
      warnings.push(`Detected cyclic dependency. Proceeding by dropping "${dependencyToDrop}" from "${blocked.id}".`);
      continue;
    }

    scheduled.add(blocked.id);
    orderedIds.push(blocked.id);
  }

  const delegationById = new Map(delegations.map(delegation => [delegation.id, delegation]));
  const resolvedDelegations = delegations.map(delegation => ({
    ...delegation,
    dependsOn: [...(dependencies.get(delegation.id) ?? [])]
  }));
  const orderedDelegations = orderedIds
    .map(id => delegationById.get(id))
    .filter((delegation): delegation is NormalizedDelegation => Boolean(delegation))
    .map(delegation => ({
      ...delegation,
      dependsOn: [...(dependencies.get(delegation.id) ?? [])]
    }));

  return {
    delegations: resolvedDelegations,
    orderedDelegations,
    warnings
  };
}

function rankSpecialistsForQuery(userQuery: string, specialists: Agent[]) {
  const normalizedQuery = userQuery.toLowerCase();
  const scoredSpecialists = specialists.map((specialist, index) => {
    const keywords = specialist.specialtyKeywords ?? [];
    const matchedKeywords = keywords
      .map(keyword => keyword.trim().toLowerCase())
      .filter(keyword => keyword.length > 0 && normalizedQuery.includes(keyword));

    return {
      specialist,
      matchedKeywords,
      score: matchedKeywords.length,
      index
    };
  });

  const rankedSpecialists = [...scoredSpecialists]
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(item => item.specialist);

  const summary = scoredSpecialists
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .map(item => {
      if (item.score === 0) return `- ${item.specialist.name}: no keyword match`;
      return `- ${item.specialist.name}: ${item.score} match(es) (${item.matchedKeywords.slice(0, 4).join(', ')})`;
    })
    .join('\n');

  return { rankedSpecialists, summary };
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
