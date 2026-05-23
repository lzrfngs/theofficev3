import { AGENT_CATALOG } from '../data/agents';
import type { WorkflowCanvasEdge, WorkflowCanvasNode, WorkflowNodeUpdate } from '../types/workflow';

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

async function callModel(provider: ModelProvider, model: string, systemInstruction: string, prompt: string): Promise<string> {
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
      maxOutputTokens: 2048,
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

// Coordinate the multi-agent execution pipeline
export async function runMultiAgentPipeline(
  userQuery: string,
  agents: Agent[],
  provider: ModelProvider,
  model: string,
  onStep: (agentId: string, message: ChatMessage) => void,
  onThinking: (agentId: string, isThinking: boolean) => void,
  onWorkflowPlan?: (nodes: WorkflowCanvasNode[], edges: WorkflowCanvasEdge[]) => void,
  onWorkflowNodeUpdate?: (nodeId: string, update: WorkflowNodeUpdate) => void
): Promise<void> {
  
  // 1. Warm-up and load prompts if they aren't loaded yet
  const activeAgents = agents.some(a => a.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const secretary = getCoordinator(activeAgents);
  const specialists = getSpecialists(activeAgents);
  
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
${specialists.map(agent => `   - ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}
2. Write a JSON structure indicating which workflow steps you want to run, which agent owns each step, what prompt to send, and any dependencies between steps.
3. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query (between 1 and 4 agents).
  - If a specialist's title and role are irrelevant, omit that specialist.
  - If the request is pure coding, API design, setup, or systems architecture, prioritize technical agents.
  - If the request is creative writing, branding, advertising, or campaign work, prioritize creative agents.
  - If user research, demographics, culture, or behavior are irrelevant, omit cultural research agents.
  - If business strategy, SWOT, pricing, or OKRs are irrelevant, omit strategy agents.
4. You may use the same specialist more than once if the work naturally loops back to them. Each repeated appearance must be a separate delegation with a unique id.
5. Provide a very concise status message in the 'response' field outlining your plan to the user. Avoid pleasantries, chit-chat, or filler text. Start directly with the plan, state exactly which agents you are consulting and why (in a short sentence), and end with: "Working with the other agents now..."

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

    const planTextRaw = await callModel(provider, model, secretary.systemPrompt || '', planningPrompt);
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
          ...specialists.slice(0, 2).map(agent => ({
            id: `${agent.id}-pass-1`,
            agent: agent.role,
            label: agent.name,
            prompt: `Analyze this request from your specialty: ${userQuery}`
          }))
        ],
        response: `${secretary.name} here. I'll consult ${specialists.slice(0, 2).map(agent => agent.name).join(' and ')}. Working with the other agents now...`
      };
    }

    const normalizedDelegations = normalizeDelegations(plan.delegations, activeAgents);
    const workflow = createWorkflowPlan(userQuery, secretary, activeAgents, normalizedDelegations);
    onWorkflowPlan?.(workflow.nodes, workflow.edges);

    // Post Penny's planning message
    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: plan.response,
      timestamp: getTimestamp()
    });

    const subAgentResults: Record<string, string> = {};

    // --- Step 2: Execute delegations in sequence/parallel ---
    for (const delegation of normalizedDelegations) {
      const targetAgent = activeAgents.find(a => a.role === delegation.agent || a.id === delegation.agent);
      if (!targetAgent) continue;

      onWorkflowNodeUpdate?.(delegation.id, { status: 'thinking' });
      onThinking(targetAgent.id, true);
      // Wait a simulated bit to give the UI breathing room
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch prompt
      try {
        const subResult = await callModel(provider, model, targetAgent.systemPrompt || '', delegation.prompt);
        subAgentResults[targetAgent.name] = subResult;
        
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: subResult,
          timestamp: getTimestamp()
        });
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        subAgentResults[targetAgent.name] = `Error: ${message}`;
        onWorkflowNodeUpdate?.(delegation.id, { status: 'error', output: message });
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: `Apologies, I encountered an issue: ${message}`,
          timestamp: getTimestamp()
        });
      }
      if (subAgentResults[targetAgent.name] && !subAgentResults[targetAgent.name].startsWith('Error:')) {
        onWorkflowNodeUpdate?.(delegation.id, { status: 'complete', output: summarizeForNode(subAgentResults[targetAgent.name]) });
      }
      onThinking(targetAgent.id, false);
    }

    // --- Step 3: Penny synthesizes all inputs and responds to the user ---
    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'thinking' });
    onThinking(secretary.id, true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const synthesisPrompt = `
The team has finished their sub-tasks. Here are their reports:
${Object.entries(subAgentResults).map(([name, text]) => `\n### Response from ${name}:\n${text}`).join('\n')}

Based on their findings and your role as Penny (Executive Coordinator), present the final compiled solution to the User. Make it professional, beautifully structured with headings/markdown, and highlight which expert provided which insights.
Keep the tone direct and concise, avoiding excessive conversational filler, fluff, or chatty pleasantries.
`;

    const finalAnswer = await callModel(provider, model, secretary.systemPrompt || '', synthesisPrompt);
    onThinking(secretary.id, false);
    onWorkflowNodeUpdate?.(workflow.synthesisNodeId, { status: 'complete', output: summarizeForNode(finalAnswer) });

    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: finalAnswer,
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

function normalizeDelegations(delegations: DelegationPlanItem[], agents: Agent[]): Required<DelegationPlanItem>[] {
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
        dependsOn: delegation.dependsOn ?? []
      };
    })
    .filter((delegation): delegation is Required<DelegationPlanItem> => delegation !== null);
}

function createWorkflowPlan(userQuery: string, manager: Agent, agents: Agent[], delegations: Required<DelegationPlanItem>[]) {
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
