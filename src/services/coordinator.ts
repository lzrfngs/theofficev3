import { AGENT_CATALOG } from '../data/agents';

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

// Call Gemini API directly using Fetch
async function callGemini(apiKey: string, systemInstruction: string, prompt: string, model: string = 'gemini-3.5-flash'): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData?.error?.message || `API error (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini API');
  return text;
}

// Coordinate the multi-agent execution pipeline
export async function runMultiAgentPipeline(
  userQuery: string,
  agents: Agent[],
  apiKey: string,
  model: string,
  onStep: (agentId: string, message: ChatMessage) => void,
  onThinking: (agentId: string, isThinking: boolean) => void
): Promise<void> {
  
  // 1. Warm-up and load prompts if they aren't loaded yet
  const activeAgents = agents.some(a => a.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const secretary = getCoordinator(activeAgents);
  const specialists = getSpecialists(activeAgents);
  
  // Helper to generate timestamps
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);

  // If NO API Key is provided, fallback to the smart Local Simulator
  if (!apiKey) {
    await runMockPipeline(userQuery, activeAgents, onStep, onThinking, getTimestamp, uuid);
    return;
  }

  try {
    // --- Step 1: Penny analyzes the request and delegates tasks ---
    onThinking(secretary.id, true);
    
    const planningPrompt = `
You are Penny, the Executive Coordinator. The User has sent a request:
"${userQuery}"

Your task is to:
1. Coordinate your team of specialists:
${specialists.map(agent => `   - ${agent.name} (${agent.role}): ${agent.title}`).join('\n')}
2. Write a JSON structure indicating which agents you want to consult and what specific prompt to send them. 
3. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query (between 1 and 4 agents).
  - If a specialist's title and role are irrelevant, omit that specialist.
  - If the request is pure coding, API design, setup, or systems architecture, prioritize technical agents.
  - If the request is creative writing, branding, advertising, or campaign work, prioritize creative agents.
  - If user research, demographics, culture, or behavior are irrelevant, omit cultural research agents.
  - If business strategy, SWOT, pricing, or OKRs are irrelevant, omit strategy agents.
4. Provide a very concise status message in the 'response' field outlining your plan to the user. Avoid pleasantries, chit-chat, or filler text. Start directly with the plan, state exactly which agents you are consulting and why (in a short sentence), and end with: "Working with the other agents now..."

Your response MUST be valid JSON in this exact format:
{
  "delegations": [
    {
      "agent": "${specialists.map(agent => agent.role).join('" | "')}",
      "prompt": "The detailed instructions you want this agent to execute"
    }
  ],
  "response": "Your status message to the user"
}
Do not write markdown formatting (like \`\`\`json) in your raw output, output only the JSON string.
`;

    const planTextRaw = await callGemini(apiKey, secretary.systemPrompt || '', planningPrompt, model);
    onThinking(secretary.id, false);

    // Clean JSON wrapper if the LLM outputted code blocks
    const cleanJsonText = planTextRaw.replace(/```json/g, '').replace(/```/g, '').trim();
    let plan: { delegations: Array<{ agent: string; prompt: string }>; response: string };
    
    try {
      plan = JSON.parse(cleanJsonText);
    } catch {
      // Fallback if parsing fails
      plan = {
        delegations: [
          ...specialists.slice(0, 2).map(agent => ({
            agent: agent.role,
            prompt: `Analyze this request from your specialty: ${userQuery}`
          }))
        ],
        response: `${secretary.name} here. I'll consult ${specialists.slice(0, 2).map(agent => agent.name).join(' and ')}. Working with the other agents now...`
      };
    }

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
    for (const delegation of plan.delegations) {
      const targetAgent = activeAgents.find(a => a.role === delegation.agent || a.id === delegation.agent);
      if (!targetAgent) continue;

      onThinking(targetAgent.id, true);
      // Wait a simulated bit to give the UI breathing room
      await new Promise(resolve => setTimeout(resolve, 800));

      // Fetch prompt
      try {
        const subResult = await callGemini(apiKey, targetAgent.systemPrompt || '', delegation.prompt, model);
        subAgentResults[targetAgent.name] = subResult;
        
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: subResult,
          timestamp: getTimestamp()
        });
      } catch (err: any) {
        subAgentResults[targetAgent.name] = `Error: ${err.message}`;
        onStep(targetAgent.id, {
          id: uuid(),
          sender: targetAgent.name,
          role: 'agent',
          text: `Apologies, I encountered an issue: ${err.message}`,
          timestamp: getTimestamp()
        });
      }
      onThinking(targetAgent.id, false);
    }

    // --- Step 3: Penny synthesizes all inputs and responds to the user ---
    onThinking(secretary.id, true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const synthesisPrompt = `
The team has finished their sub-tasks. Here are their reports:
${Object.entries(subAgentResults).map(([name, text]) => `\n### Response from ${name}:\n${text}`).join('\n')}

Based on their findings and your role as Penny (Executive Coordinator), present the final compiled solution to the User. Make it professional, beautifully structured with headings/markdown, and highlight which expert provided which insights.
Keep the tone direct and concise, avoiding excessive conversational filler, fluff, or chatty pleasantries.
`;

    const finalAnswer = await callGemini(apiKey, secretary.systemPrompt || '', synthesisPrompt, model);
    onThinking(secretary.id, false);

    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: finalAnswer,
      timestamp: getTimestamp()
    });

  } catch (err: any) {
    onThinking(secretary.id, false);
    onStep(secretary.id, {
      id: uuid(),
      sender: secretary.name,
      role: 'agent',
      text: `Oh dear, I ran into a technical error coordinating the team: ${err.message}. Please verify your API Key and network connection in the settings modal.`,
      timestamp: getTimestamp()
    });
  }
}

// Local mock simulation engine (offline mode)
async function runMockPipeline(
  query: string,
  agents: Agent[],
  onStep: (agentId: string, message: ChatMessage) => void,
  onThinking: (agentId: string, isThinking: boolean) => void,
  getTimestamp: () => string,
  uuid: () => string
): Promise<void> {
  const secretary = getCoordinator(agents);
  const specialists = getSpecialists(agents);

  const lowerQuery = query.toLowerCase();

  const selectedAgents: Array<{ agent: Agent; text: string; action: string }> = [];

  specialists.forEach(agent => {
    const keywords = agent.specialtyKeywords ?? [];
    const isRelevant = keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
    if (isRelevant) {
      selectedAgents.push({
        agent,
        text: agent.mockResponse ?? `### ${agent.title}\n${agent.mockFocus ?? `I will analyze **"${query}"** from my specialty and return practical next steps.`}`,
        action: agent.mockAction ?? `contribute ${agent.title.toLowerCase()} insight`
      });
    }
  });

  // Ensure at least one agent is active as fallback
  if (selectedAgents.length === 0) {
    selectedAgents.push(
      ...specialists.slice(0, 2).map(agent => ({
        agent,
        text: agent.mockResponse ?? `### ${agent.title}\n${agent.mockFocus ?? `I will analyze **"${query}"** from my specialty and return practical next steps.`}`,
        action: agent.mockAction ?? `contribute ${agent.title.toLowerCase()} insight`
      }))
    );
  }

  // 1. Penny's Initial Planning Response
  onThinking(secretary.id, true);
  await new Promise(resolve => setTimeout(resolve, 1500));
  onThinking(secretary.id, false);
  
  // Build a concise planning response listing only the active agents
  const agentTasks = selectedAgents.map(sa => `**${sa.agent.name}** to ${sa.action}`).join(', and ');
  const planningResponse = `Penny here. Let's coordinate. I will task ${agentTasks}. Working with the other agents now...`;

  onStep(secretary.id, {
    id: uuid(),
    sender: secretary.name,
    role: 'agent',
    text: planningResponse,
    timestamp: getTimestamp()
  });

  // Helper to run an agent mock execution
  const runMockAgent = async (agent: Agent, text: string) => {
    onThinking(agent.id, true);
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1500));
    onThinking(agent.id, false);
    onStep(agent.id, {
      id: uuid(),
      sender: agent.name,
      role: 'agent',
      text,
      timestamp: getTimestamp()
    });
  };

  // Run only the selected agents
  for (const sa of selectedAgents) {
    await runMockAgent(sa.agent, sa.text);
  }

  // 6. Penny Synthesizes
  onThinking(secretary.id, true);
  await new Promise(resolve => setTimeout(resolve, 2000));
  onThinking(secretary.id, false);

  const synthesisReportHeader = `### Penny's Synthesized Project Report\n\nHere is the completed roadmap for **"${query}"**, consolidated from our selected team members' outputs:\n\n`;
  const synthesisBody = selectedAgents.map((sa, idx) => {
    let focus = '';
    focus = sa.agent.mockFocus ?? 'Contributed specialty guidance for the final response.';
    return `${idx + 1}. **${sa.agent.name} (${sa.agent.title})**: ${focus}`;
  }).join('\n');
  const synthesisFooter = `\n\nAll tasks completed. Let me know if you would like me to adjust any specific sections.`;
  const synthesisText = synthesisReportHeader + synthesisBody + synthesisFooter;

  onStep(secretary.id, {
    id: uuid(),
    sender: secretary.name,
    role: 'agent',
    text: synthesisText,
    timestamp: getTimestamp()
  });
}
