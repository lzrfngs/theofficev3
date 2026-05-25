import { AGENT_CATALOG } from '../data/agents';
import type {
  EvidenceClaim,
  EvidenceCategory,
  EvidencePolicy,
  EvaluationScorecard,
  ExecutionTraceRecord,
  FactualClaim,
  KnowledgeItem,
  ProjectLibrary,
  DeliverableSection,
  ProjectMemorySnapshot,
  SourceChunk,
  ResearchBrief,
  ResearchQuery,
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

interface RoutingGate {
  role: string;
  reason: string;
  prompt: string;
  dependsOn?: string[];
}

interface SearchOptions {
  maxResults?: number;
  category?: EvidenceCategory;
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news';
  days?: number;
}

interface IngestResult {
  title: string;
  url?: string;
  text: string;
  summary: string;
  chunks: SourceChunk[];
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
  claimExtraction: {
    id: 'claim_extraction',
    name: 'Claim extraction',
    description: 'Identifies factual claims in the user request that need verification.'
  },
  evidencePolicy: {
    id: 'evidence_policy',
    name: 'Evidence policy',
    description: 'Determines whether external evidence is required before synthesis.'
  },
  sourceSummarization: {
    id: 'source_summarization',
    name: 'Source summarization',
    description: 'Condenses source material into reusable knowledge records.'
  },
  claimVerification: {
    id: 'claim_verification',
    name: 'Claim verification',
    description: 'Connects claims to sources and confidence labels.'
  },
  documentIngestion: {
    id: 'document_ingestion',
    name: 'Document ingestion',
    description: 'Turns user-provided text and source notes into knowledge items.'
  },
  repairPlanning: {
    id: 'repair_planning',
    name: 'Repair planning',
    description: 'Creates targeted follow-up steps when critique finds gaps.'
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

  const data = await readJsonResponse<{ text?: string; error?: string }>(response, 'model router');
  if (!response.ok) {
    throw new Error(data?.error || `Model router error (${response.status})`);
  }

  const text = data?.text;
  if (!text) throw new Error('Empty response from model router');
  return text;
}

async function searchWeb(query: string, usedBy: string, options: SearchOptions = {}): Promise<SourceRecord[]> {
  const response = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      maxResults: options.maxResults ?? 5,
      searchDepth: options.searchDepth ?? 'basic',
      topic: options.topic ?? 'general',
      days: options.days
    })
  });

  if (!response.ok) return [];
  const data = await readJsonResponse<{ results?: Array<{ title: string; url: string; snippet: string; provider: SourceRecord['provider']; publishedDate?: string }> }>(response, 'search router');
  return (data?.results ?? []).map((result, index: number) => ({
    id: `${usedBy}-${Date.now().toString(36)}-${index}`,
    title: result.title,
    url: result.url,
    snippet: result.snippet,
    query,
    category: options.category ?? 'research',
    publishedDate: result.publishedDate,
    provider: result.provider,
    usedBy,
    timestamp: new Date().toISOString()
  }));
}

async function ingestSource(source: SourceRecord): Promise<SourceRecord> {
  if (!source.url && !source.snippet) return source;

  try {
    const response = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: source.url, title: source.title, text: source.url ? undefined : source.snippet, maxChars: 28000 })
    });
    if (!response.ok) return source;
    const data = await readJsonResponse<IngestResult>(response, 'source ingestion');
    return {
      ...source,
      fullText: data.text,
      summary: data.summary,
      chunks: data.chunks,
      snippet: data.summary || source.snippet
    };
  } catch {
    return source;
  }
}

async function enrichSources(sources: SourceRecord[]): Promise<SourceRecord[]> {
  const enriched: SourceRecord[] = [];
  for (const source of sources.slice(0, 10)) {
    enriched.push(await ingestSource(source));
  }
  return [...enriched, ...sources.slice(10)];
}

async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  const rawText = await response.text();
  if (!rawText.trim()) {
    throw new Error(`Empty response from ${label} (${response.status}). In local development, run Vite with the local API middleware enabled and confirm server environment variables are available.`);
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 220);
    throw new Error(`Invalid JSON from ${label} (${response.status}): ${preview || 'no response body'}`);
  }
}

function formatSourcesForPrompt(sources: SourceRecord[]) {
  if (sources.length === 0) return '';
  return `\n\nAvailable sources:\n${sources.map((source, index) => `${index + 1}. [${source.category || 'research'}] ${source.title}${source.publishedDate ? ` (${source.publishedDate})` : ''}${source.url ? ` - ${source.url}` : ''}\n${source.snippet}`).join('\n\n')}`;
}

function formatResearchBriefForPrompt(brief?: ResearchBrief) {
  if (!brief) return '';
  return `\n\nResearch brief:\nQueries run:\n${brief.queries.map(query => `- [${query.category}] ${query.query} (${query.reason})`).join('\n')}\n\nCurrent/news signals:\n${formatSignalList(brief.currentSignals)}\n\nForecast/prediction signals:\n${formatSignalList(brief.forecastSignals)}\n\nCompetitive signals:\n${formatSignalList(brief.competitiveSignals)}\n\nCaveats:\n${formatSignalList(brief.caveats)}`;
}

function formatSignalList(items: string[]) {
  return items.length > 0 ? items.map(item => `- ${item}`).join('\n') : '- None captured.';
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

function getRoutingGates(userQuery: string): RoutingGate[] {
  const query = userQuery.toLowerCase();
  const gates: RoutingGate[] = [];

  const isStrategyOrCreative = /\b(gtm|go-to-market|go to market|strategy|positioning|launch|campaign|creative platform|brand platform|messaging|market|audience|customer|growth)\b/.test(query);
  const isAiProductOrPlatform = /\b(ai|copilot|agent|agents|llm|automation|software|platform|product|api|data|technical|architecture|prototype|workflow|integration)\b/.test(query);
  const isFutureFacing = /\b(future|futures|forecast|prediction|trend|trends|scenario|signals|horizon|where .* going|next few years|emerging)\b/.test(query);
  const needsMeasurement = /\b(gtm|go-to-market|go to market|launch|growth|experiment|test|testing|kpi|metrics|measurement|success|dashboard|conversion|retention|activation|funnel|30\/60\/90|90 days)\b/.test(query);
  const needsWriter = /\b(campaign|creative platform|brand platform|messaging|copy|copywriting|tagline|headline|voice|launch|gtm|go-to-market|go to market|manifesto|landing page|social|ad|naming)\b/.test(query);
  const needsArtDirection = /\b(campaign|creative platform|brand platform|messaging|launch|gtm|go-to-market|go to market|identity|visual|art direction|look and feel|upper funnel|mid funnel|lower funnel|funnel creative|creative idea|creative territory|territories)\b/.test(query);

  if (isStrategyOrCreative) {
    gates.push({
      role: 'anthropologist',
      reason: 'GTM, strategy, and creative platform work depends on audience adoption, cultural reception, trust, and behavior.',
      prompt: 'Provide an audience and cultural reality check. Identify adoption friction, trust signals, status dynamics, language risks, and what would make the audience feel seen rather than targeted.'
    });
  }

  if (isAiProductOrPlatform) {
    gates.push({
      role: 'tech_expert',
      reason: 'AI, product, platform, software, or automation work needs feasibility, technical trust, data, and implementation risk review.',
      prompt: 'Provide a technical feasibility and trust review. Identify product behavior implied by the strategy, architecture constraints, AI/data risks, implementation dependencies, and failure modes.'
    });
  }

  if (isFutureFacing) {
    gates.push({
      role: 'futurist',
      reason: 'Future-facing or trend-sensitive work needs signals, uncertainty, scenarios, and implications.',
      prompt: 'Provide a foresight pass. Identify signals, plausible scenarios, critical uncertainties, watchpoints, and implications for the strategy and creative platform.'
    });
  }

  if (needsMeasurement) {
    gates.push({
      role: 'measurement_analyst',
      reason: 'Launch, GTM, growth, and strategy work needs measurable success criteria, experiments, and a learning agenda.',
      prompt: 'Define the measurement system. Provide KPIs, leading indicators, experiments, decision thresholds, dashboard needs, and a 30/60/90 day learning agenda.'
    });
  }

  if (needsWriter) {
    gates.push({
      role: 'writer',
      reason: 'Campaign, GTM, creative platform, messaging, naming, or launch work needs sharp audience-facing language rather than generic strategy prose.',
      prompt: 'Create the verbal platform. Find the human tension, write distinct creative territories, choose the strongest territory, build the messaging system, line bank, voice rules, and rewrite pass.'
    });
  }

  if (needsArtDirection) {
    gates.push({
      role: 'creative_director',
      reason: 'Campaign, launch, creative platform, and funnel work needs an art director to turn the verbal hook into a full visual and channel system.',
      prompt: 'Partner with Stephen. Pressure-test his lines for visual potential and turn the strongest hook into upper, mid, and lower funnel creative ideas with art direction, formats, and system rules.'
    });
  }

  return gates;
}

function formatRoutingGates(gates: RoutingGate[]) {
  if (gates.length === 0) return 'No mandatory routing gates were triggered.';
  return gates.map(gate => `- ${gate.role}: ${gate.reason}`).join('\n');
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

function applyRoutingGates(delegations: NormalizedDelegation[], gates: RoutingGate[], agents: Agent[]): NormalizedDelegation[] {
  const usedIds = new Set(delegations.map(delegation => delegation.id));
  const nextDelegations = [...delegations];

  gates.forEach((gate, index) => {
    if (nextDelegations.some(delegation => delegation.agent === gate.role)) return;
    const agent = agents.find(candidate => candidate.role === gate.role);
    if (!agent) return;
    const baseId = sanitizeId(`${gate.role}-review`);
    const id = usedIds.has(baseId) ? `${baseId}-${index + 1}` : baseId;
    usedIds.add(id);
    nextDelegations.push({
      id,
      agent: agent.role,
      label: `${agent.name} review`,
      prompt: `${gate.prompt}\n\nReason Penny must include this role: ${gate.reason}`,
      dependsOn: gate.dependsOn ?? []
    });
  });

  return nextDelegations;
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

const REQUIRED_DELIVERABLE_SECTIONS = [
  'Executive Read',
  'Evidence Base',
  'Market Truth',
  'Audience Truth',
  'Strategic Tension',
  'Opportunity',
  'Positioning',
  'Creative Platform',
  'Messaging Architecture',
  'Channel Plan',
  'Launch Phases',
  'Proof Points',
  'Risks And Watchouts',
  'Experiments',
  'Evidence Table',
  'Assumptions Table',
  'Open Questions'
];

function formatDeliverableSchemaForPrompt() {
  return `\n\nRequired deliverable schema:\n${REQUIRED_DELIVERABLE_SECTIONS.map(section => `## ${section}`).join('\n')}\n\nEvery section must be present. In Creative Platform and Messaging Architecture, preserve Stephen's sharpest language, include multiple creative territories when available, and avoid flattening lines into generic strategy prose. Show how the recommended hook scales into upper, mid, and lower funnel creative with August's visual/system guidance. In Evidence Table, include source title or URL, claim supported, confidence, and relevance. In Assumptions Table, include assumption, why it matters, and validation action.`;
}

function buildDelegationPrompt(userQuery: string, delegation: NormalizedDelegation, dependencyContext: string, sources: SourceRecord[]) {
  return `${delegation.prompt}${formatAgentSpecificBrief(delegation.agent)}\n\nUser request:\n${userQuery}${dependencyContext}${formatSourcesForPrompt(sources)}`;
}

function formatAgentSpecificBrief(agentRole: string) {
  if (agentRole === 'strategist') {
    return `\n\nEvelyn-to-Stephen handoff mandate:\n- If this work will become messaging, campaign, GTM narrative, or creative platform, give Stephen a strategic enemy, audience belief shift, single-minded proposition, concrete proof points, stakes, refusal, and creative tension.\n- Do not hand Stephen generic positioning prose. Give him pressure he can write from.`;
  }

  if (agentRole === 'anthropologist') {
    return `\n\nJohn-to-Stephen handoff mandate:\n- If this work will become messaging, campaign, GTM narrative, or creative platform, give Stephen audience tension, cultural enemy, human truth, language from the world, trust tripwires, permission notes, and copy fuel.\n- Help Stephen write from lived behavior and culture, not from product features alone.`;
  }

  if (agentRole === 'writer') {
    return `\n\nStephen-specific copy mandate:\n- Do not summarize the strategy as copy. Turn it into language with tension, point of view, and memorability.\n- Produce three distinct creative territories before choosing one.\n- Include a line bank with at least 12 usable lines across headlines, taglines, CTAs, social hooks, and product/lifecycle copy.\n- Include voice rules and taboo phrases.\n- Include one weak generic line rewritten into a sharper line with rationale.\n- Apply the hostile self-read: What does that even mean? Who cares? Would a smart, skeptical audience tell this brand to fuck off?\n- Kill lines that sound vague, pompous, fake-helpful, self-congratulatory, overbalanced, or committee-approved.\n- Each territory must include a simple hook August can turn into upper, mid, and lower funnel creative.\n- The best line should feel so true that the audience thinks: how did I not think of that?\n- Avoid mush words like empower, unlock, seamless, innovative, reimagine, transform, next-generation, supercharge, elevate, robust, solution, leverage, at scale, future of, and generic AI-powered claims.\n- Make every major line specific to this brand, audience, product, evidence, or cultural tension.`;
  }

  if (agentRole === 'creative_director') {
    return `\n\nAugust-specific writer/art-director mandate:\n- Treat Stephen's best line as raw creative material, not decoration.\n- Do not literalize the line. If the hook says thread, do not simply show a thread. Find the deeper behavior and dramatize that.\n- Pressure-test whether the hook can become a visual system across upper, mid, and lower funnel.\n- If the line cannot produce a poster, film/social idea, landing-page system, product moment, and sales/deck expression, say so and propose a stronger creative spine.\n- Build from one simple, true hook that feels obvious in hindsight.\n- Use metaphor, reversal, demonstration, product theater, cultural objects, visual tension, or a repeatable system device to create spark.\n- Show how the line becomes image logic, layout, motion, typography, proof, CTA behavior, and channel formats.\n- Name what would make the idea distinctive, not just attractive.`;
  }

  return '';
}

function extractFactualClaims(userQuery: string): FactualClaim[] {
  const claimPatterns = [
    /\b(?:is|are|was|were|will be|has|have|had|must|should|can|cannot|can't|won't)\b[^.!?]*(?:[.!?]|$)/gi,
    /\b(?:latest|current|competitor|competitors|pricing|market|audience|customer|users|launch|gtm|Microsoft|Copilot|OpenAI|Google|Anthropic|Vercel)\b[^.!?]*(?:[.!?]|$)/gi
  ];
  const seen = new Set<string>();
  const claims: FactualClaim[] = [];

  for (const pattern of claimPatterns) {
    for (const match of userQuery.matchAll(pattern)) {
      const text = match[0].replace(/\s+/g, ' ').trim().replace(/[.!?]$/, '');
      if (text.length < 18 || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      claims.push({
        id: `claim-input-${claims.length + 1}`,
        text,
        status: 'needs-research',
        reason: 'User request contains an external factual or market/product assertion.',
        sourceIds: [],
        confidence: 'low'
      });
    }
  }

  return claims.slice(0, 8);
}

function evaluateEvidencePolicy(userQuery: string, claims: FactualClaim[], sources: SourceRecord[]): EvidencePolicy {
  const query = userQuery.toLowerCase();
  const reasons = [
    claims.length > 0 ? 'The request contains factual claims that affect recommendation quality.' : '',
    /\b(latest|current|recent|today|now|market|competitor|competitive|pricing|benchmark|users|audience|customer|gtm|launch|microsoft|copilot|super-app|unifying|unified)\b/.test(query)
      ? 'The request depends on current market, product, audience, or competitive context.'
      : '',
    /\b(best|should|recommend|strategy|plan|forecast|trend|risk|opportunity)\b/.test(query)
      ? 'The output is likely to make recommendations that should distinguish evidence from assumptions.'
      : ''
  ].filter(Boolean);
  const required = reasons.length > 0;

  return {
    required,
    status: !required ? 'not-required' : sources.length > 0 ? 'satisfied' : 'required',
    reasons,
    requiredToolIds: required ? [RUNTIME_TOOLS.webSearch.id, RUNTIME_TOOLS.claimVerification.id] : []
  };
}

function createResearchQueries(userQuery: string, claims: FactualClaim[]): ResearchQuery[] {
  const cleanedObjective = userQuery.replace(/\s+/g, ' ').trim();
  const claimText = claims.map(claim => claim.text).join('; ');
  const subject = claimText || cleanedObjective;
  const queries: Omit<ResearchQuery, 'id'>[] = [
    {
      category: 'news',
      query: `${subject} latest news current developments`,
      reason: 'Ground the work in current events and recent product or market movement.'
    },
    {
      category: 'research',
      query: `${cleanedObjective} market research evidence user behavior`,
      reason: 'Find evidence that should shape the strategic foundation.'
    },
    {
      category: 'forecast',
      query: `${cleanedObjective} predictions trends forecast future implications`,
      reason: 'Capture forward-looking signals and plausible future constraints.'
    },
    {
      category: 'competitive',
      query: `${cleanedObjective} competitors alternatives examples positioning`,
      reason: 'Benchmark adjacent products, examples, competitors, and positioning moves.'
    },
    {
      category: 'culture',
      query: `${cleanedObjective} audience culture adoption trust behavior`,
      reason: 'Understand audience adoption, trust, language, and cultural friction.'
    },
    {
      category: 'strategy',
      query: `${cleanedObjective} go to market strategy launch playbook`,
      reason: 'Find GTM precedents and strategy patterns relevant to the brief.'
    }
  ];

  return queries.map((query, index) => ({ ...query, id: `research-query-${index + 1}` }));
}

async function buildEvidencePack(userQuery: string, claims: FactualClaim[], usedBy: string): Promise<{ brief: ResearchBrief; sources: SourceRecord[] }> {
  const queries = createResearchQueries(userQuery, claims);
  const sourceMap = new Map<string, SourceRecord>();

  for (const query of queries) {
    const foundSources = await searchWeb(query.query, usedBy, {
      category: query.category,
      maxResults: query.category === 'news' ? 4 : 3,
      searchDepth: query.category === 'news' || query.category === 'forecast' ? 'advanced' : 'basic',
      topic: query.category === 'news' ? 'news' : 'general',
      days: query.category === 'news' ? 30 : undefined
    });

    for (const source of foundSources) {
      const key = source.url || `${source.title}-${source.snippet.slice(0, 60)}`;
      if (!sourceMap.has(key)) sourceMap.set(key, source);
    }
  }

  const sources = await enrichSources([...sourceMap.values()].slice(0, 18));
  const brief: ResearchBrief = {
    id: `research-brief-${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    queries,
    sourceIds: sources.map(source => source.id),
    currentSignals: summarizeSourcesByCategory(sources, ['news', 'research']).slice(0, 6),
    forecastSignals: summarizeSourcesByCategory(sources, ['forecast']).slice(0, 5),
    competitiveSignals: summarizeSourcesByCategory(sources, ['competitive', 'strategy']).slice(0, 5),
    caveats: sources.length === 0
      ? ['No external sources were returned. Treat factual claims as unverified until research succeeds.']
      : ['Search results are snippets, not full source ingestion. Validate critical claims before final production decisions.']
  };

  return { brief, sources };
}

function summarizeSourcesByCategory(sources: SourceRecord[], categories: EvidenceCategory[]) {
  return sources
    .filter(source => source.category && categories.includes(source.category))
    .map(source => `${source.title}${source.publishedDate ? ` (${source.publishedDate})` : ''}: ${source.snippet.slice(0, 180)}`);
}

function applyEvidenceToClaims(claims: FactualClaim[], sources: SourceRecord[]): FactualClaim[] {
  if (sources.length === 0) return claims;
  return claims.map(claim => {
    const matches = matchClaimToSources(claim, sources);
    return {
      ...claim,
      status: matches.some(match => match.verdict === 'supports' && match.score >= 0.3) ? 'supported' : 'needs-research',
      sourceIds: matches.map(match => match.sourceId),
      matches,
      confidence: matches.some(match => match.score >= 0.55) ? 'high' : matches.length > 0 ? 'medium' : 'low'
    };
  });
}

function matchClaimToSources(claim: FactualClaim, sources: SourceRecord[]) {
  const claimTerms = extractKeyTerms(claim.text);
  return sources
    .flatMap(source => {
      const chunks = source.chunks && source.chunks.length > 0 ? source.chunks : [{ id: `${source.id}-snippet`, text: `${source.title}. ${source.snippet}`, index: 0 }];
      return chunks.map(chunk => {
        const chunkTerms = extractKeyTerms(chunk.text);
        const overlap = claimTerms.filter(term => chunkTerms.includes(term));
        const score = claimTerms.length === 0 ? 0 : overlap.length / claimTerms.length;
        return {
          claimId: claim.id,
          sourceId: source.id,
          chunkId: chunk.id,
          score: Math.round(score * 100) / 100,
          quote: getBestQuote(chunk.text, overlap),
          verdict: score >= 0.2 ? 'supports' as const : 'related' as const
        };
      });
    })
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

function extractKeyTerms(text: string) {
  const stopWords = new Set(['about', 'after', 'again', 'against', 'also', 'because', 'before', 'being', 'between', 'could', 'from', 'have', 'into', 'more', 'most', 'should', 'that', 'their', 'there', 'these', 'this', 'through', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your']);
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])].filter(term => !stopWords.has(term)).slice(0, 18);
}

function getBestQuote(text: string, terms: string[]) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const best = sentences
    .map(sentence => ({ sentence, score: terms.filter(term => sentence.toLowerCase().includes(term)).length }))
    .sort((a, b) => b.score - a.score)[0]?.sentence;
  return (best || text).slice(0, 360);
}

function formatEvidencePolicyForPrompt(policy: EvidencePolicy, claims: FactualClaim[]) {
  const policyLines = [
    `Evidence required: ${policy.required ? 'yes' : 'no'}`,
    `Evidence status: ${policy.status}`,
    ...policy.reasons.map(reason => `Reason: ${reason}`)
  ];
  const claimLines = claims.length === 0 ? ['No explicit factual claims were extracted.'] : claims.map(claim => `- [${claim.status}] ${claim.text} (${claim.reason})`);
  return `\n\nEvidence policy:\n${policyLines.join('\n')}\n\nFactual claims:\n${claimLines.join('\n')}`;
}

function ensureEvidenceDelegation(delegations: NormalizedDelegation[], specialists: Agent[], policy: EvidencePolicy, claims: FactualClaim[]): NormalizedDelegation[] {
  if (!policy.required || policy.status === 'satisfied' || delegations.some(delegation => delegation.agent === 'researcher')) return delegations;
  const researcher = specialists.find(agent => agent.role === 'researcher');
  if (!researcher) return delegations;

  const researchStep: NormalizedDelegation = {
    id: 'evidence-check',
    agent: researcher.role,
    label: 'Evidence check',
    prompt: `Research and verify the factual claims before any final recommendation. Return concise findings, source-backed corrections, and confidence labels.\n\nClaims:\n${claims.map(claim => `- ${claim.text}`).join('\n') || 'Identify any factual claims in the request.'}`,
    dependsOn: []
  };

  return [researchStep, ...delegations.map(delegation => ({
    ...delegation,
    dependsOn: delegation.dependsOn.length > 0 ? delegation.dependsOn : [researchStep.id]
  }))];
}

function shouldSearchForStep(agent: Agent, policy: EvidencePolicy, delegationPrompt: string) {
  if (agent.role === 'researcher') return true;
  if (!policy.required) return false;
  return /\b(research|verify|evidence|source|market|competitor|pricing|audience|benchmark|current|latest|Microsoft|Copilot)\b/i.test(delegationPrompt);
}

function createRunState(objective: string, mode: RunState['mode'], provider: ModelProvider, model: string, evidencePolicy: EvidencePolicy, factualClaims: FactualClaim[]): RunState {
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
    deliverableSections: [],
    evidencePolicy,
    factualClaims,
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

function extractDeliverableSections(markdown: string, sources: SourceRecord[]): DeliverableSection[] {
  const sectionMatches = [...markdown.matchAll(/^##\s+(.+)$/gm)];
  if (sectionMatches.length === 0) {
    return [{
      id: 'section-final-output',
      title: 'Final Output',
      body: markdown.trim(),
      status: 'draft',
      sourceIds: sources.map(source => source.id)
    }];
  }

  return sectionMatches.map((match, index) => {
    const title = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const next = sectionMatches[index + 1];
    const end = next?.index ?? markdown.length;
    return {
      id: `section-${sanitizeId(title)}`,
      title,
      body: markdown.slice(start, end).trim(),
      status: REQUIRED_DELIVERABLE_SECTIONS.some(required => required.toLowerCase() === title.toLowerCase()) ? 'draft' : 'needs-revision',
      sourceIds: sources.filter(source => markdown.slice(start, end).includes(source.title) || (source.url && markdown.slice(start, end).includes(source.url))).map(source => source.id)
    };
  });
}

function createScorecard(runState: RunState, finalAnswer: string, sources: SourceRecord[]): EvaluationScorecard {
  const requiredPresent = REQUIRED_DELIVERABLE_SECTIONS.filter(section => new RegExp(`^##\\s+${escapeRegExp(section)}\\s*$`, 'im').test(finalAnswer)).length;
  const evidenceCoverage = runState.evidencePolicy.required ? Math.min(10, Math.round((sources.length / 12) * 10)) : 8;
  const claimSupport = runState.factualClaims.length === 0 ? 8 : Math.round((runState.factualClaims.filter(claim => claim.status === 'supported').length / runState.factualClaims.length) * 10);
  const structureScore = Math.round((requiredPresent / REQUIRED_DELIVERABLE_SECTIONS.length) * 10);
  const hasCreative = /creative platform|creative territory|messaging architecture/i.test(finalAnswer);
  const hasActions = /experiment|launch phase|channel plan|next/i.test(finalAnswer);
  const sourceQuality = Math.min(10, Math.max(3, sources.filter(source => source.url).length));
  const scorecard = {
    evidenceCoverage,
    sourceQuality,
    claimSupport,
    strategicSharpness: Math.max(4, structureScore),
    creativeOriginality: hasCreative ? 8 : 5,
    actionability: hasActions ? 8 : 5,
    consistency: runState.conflicts.length === 0 ? 8 : 5,
    overall: 0,
    notes: [
      `${requiredPresent}/${REQUIRED_DELIVERABLE_SECTIONS.length} required sections present.`,
      `${sources.length} sources attached.`,
      `${runState.factualClaims.filter(claim => claim.status === 'supported').length}/${runState.factualClaims.length} factual claims supported.`
    ]
  };
  scorecard.overall = Math.round((scorecard.evidenceCoverage + scorecard.sourceQuality + scorecard.claimSupport + scorecard.strategicSharpness + scorecard.creativeOriginality + scorecard.actionability + scorecard.consistency) / 7);
  return scorecard;
}

async function createModelScorecard(provider: ModelProvider, model: string, manager: Agent, runState: RunState, finalAnswer: string, sources: SourceRecord[]): Promise<EvaluationScorecard> {
  const fallback = createScorecard(runState, finalAnswer, sources);
  try {
    const prompt = `Score this strategy and creative platform. Return only JSON with integer 0-10 scores and notes array.\n\nCriteria: evidenceCoverage, sourceQuality, claimSupport, strategicSharpness, creativeOriginality, actionability, consistency, overall.\n\nRun state:\n${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}${formatResearchBriefForPrompt(runState.researchBrief)}\n\nOutput:\n${finalAnswer.slice(0, 12000)}\n\nJSON shape:\n{"evidenceCoverage":0,"sourceQuality":0,"claimSupport":0,"strategicSharpness":0,"creativeOriginality":0,"actionability":0,"consistency":0,"overall":0,"notes":["..."]}`;
    const raw = await callModel(provider, model, manager.systemPrompt || '', prompt, 1400);
    const parsed = extractScorecard(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function extractScorecard(rawText: string): EvaluationScorecard | null {
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
  try {
    const parsed = JSON.parse(candidate) as Partial<EvaluationScorecard>;
    const scorecard: EvaluationScorecard = {
      evidenceCoverage: clampScore(parsed.evidenceCoverage),
      sourceQuality: clampScore(parsed.sourceQuality),
      claimSupport: clampScore(parsed.claimSupport),
      strategicSharpness: clampScore(parsed.strategicSharpness),
      creativeOriginality: clampScore(parsed.creativeOriginality),
      actionability: clampScore(parsed.actionability),
      consistency: clampScore(parsed.consistency),
      overall: clampScore(parsed.overall),
      notes: Array.isArray(parsed.notes) ? parsed.notes.filter(note => typeof note === 'string') : []
    };
    return scorecard;
  } catch {
    return null;
  }
}

function clampScore(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(10, Math.round(number)));
}

function createProjectMemorySnapshot(runState: RunState, sources: SourceRecord[], sections: DeliverableSection[]): ProjectMemorySnapshot {
  const timestamp = new Date().toISOString();
  return {
    id: `project-memory-${runState.id}`,
    title: runState.objective.slice(0, 72),
    objective: runState.objective,
    createdAt: runState.startedAt,
    updatedAt: timestamp,
    acceptedClaimIds: runState.factualClaims.filter(claim => claim.status === 'supported').map(claim => claim.id),
    rejectedClaimIds: [],
    sourceIds: sources.map(source => source.id),
    deliverableSectionIds: sections.map(section => section.id)
  };
}

function createProjectLibrary(runState: RunState, sources: SourceRecord[], memory: ProjectMemorySnapshot): ProjectLibrary {
  return {
    id: `project-library-${sanitizeId(memory.title)}`,
    name: memory.title,
    updatedAt: new Date().toISOString(),
    memories: [memory],
    sources,
    acceptedClaims: runState.factualClaims.filter(claim => claim.status === 'supported'),
    rejectedClaims: [],
    openQuestions: runState.openQuestions,
    deliverableSections: runState.deliverableSections,
    runIds: [runState.id]
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const routingGates = getRoutingGates(userQuery);
  const routingGateText = formatRoutingGates(routingGates);
  
  // Helper to generate timestamps
  const getTimestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const uuid = () => Math.random().toString(36).substring(2, 9);
  const factualClaims = extractFactualClaims(userQuery);
  let evidencePolicy = evaluateEvidencePolicy(userQuery, factualClaims, existingSources);
  const runState = createRunState(userQuery, 'automatic', provider, model, evidencePolicy, factualClaims);
  emitRunState(runState, runtimeOptions);
  addTrace(runState, runtimeOptions, {
    type: 'tool-call',
    title: RUNTIME_TOOLS.claimExtraction.name,
    detail: factualClaims.length > 0 ? factualClaims.map(claim => claim.text).join('\n') : 'No explicit factual claims extracted.'
  });
  addTrace(runState, runtimeOptions, {
    type: 'tool-call',
    title: RUNTIME_TOOLS.evidencePolicy.name,
    detail: evidencePolicy.required ? evidencePolicy.reasons.join('\n') : 'Evidence is not required for this request.'
  });

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
4. Obey these mandatory routing gates unless the user explicitly asked to skip that role:
${routingGateText}
5. Apply the evidence policy. If evidence is required, include Mira/researcher or depend on the automatic evidence-check step before making claims.
${formatEvidencePolicyForPrompt(evidencePolicy, factualClaims)}
6. EXERCISE WISDOM: Do NOT automatically consult all agents. Selectively consult ONLY the specialist(s) that are relevant to the query and mandatory gates (usually between 1 and 6 agents).
  - If a specialist's title and role are irrelevant, omit that specialist.
  - If the request is pure coding, API design, setup, or systems architecture, prioritize technical agents.
  - If the request is creative writing, branding, advertising, or campaign work, prioritize creative agents.
  - Do not omit John when the work depends on audience adoption, culture, trust, or reception.
  - Do not omit Vadim when the work involves AI, software, platforms, product behavior, automation, data, or technical trust.
  - Do not omit Iris when the work depends on trends, forecasts, futures, or category shifts.
  - Do not omit Nora when the work needs launch metrics, experiments, KPIs, growth, or success criteria.
  - If business strategy, SWOT, pricing, or OKRs are irrelevant, omit strategy agents.
7. You may use the same specialist more than once if the work naturally loops back to them. Each repeated appearance must be a separate delegation with a unique id.
8. If a step depends on another step, put the prior step id in dependsOn. Later steps will receive dependency outputs at runtime.
9. Provide a very concise status message in the 'response' field outlining your plan to the user. Avoid pleasantries, chit-chat, or filler text. Start directly with the plan, state exactly which agents you are consulting and why (in a short sentence), and end with: "Working with the other agents now..."

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
    const baseDelegations = normalizedDelegations.length > 0 ? normalizedDelegations : normalizeDelegations(fallbackPlan.delegations, activeAgents);
    const gatedDelegations = applyRoutingGates(baseDelegations, routingGates, activeAgents);
    const executableDelegations = ensureEvidenceDelegation(gatedDelegations, specialists, evidencePolicy, factualClaims);
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
    if (evidencePolicy.required && allSources.length === 0) {
      const toolCall = addToolCall(runState, runtimeOptions, {
        toolId: RUNTIME_TOOLS.webSearch.id,
        toolName: 'Evidence pack search',
        requestedBy: secretary.name,
        input: userQuery,
        status: 'running'
      });
      const { brief, sources: evidencePackSources } = await buildEvidencePack(userQuery, runState.factualClaims, secretary.name);
      if (evidencePackSources.length > 0) {
        onSources?.(evidencePackSources);
        allSources = [...allSources, ...evidencePackSources];
        const knowledgeItems = sourcesToKnowledgeItems(evidencePackSources);
        const evidenceClaims = createEvidenceClaims(evidencePackSources, secretary.name);
        runtimeOptions.onKnowledgeItems?.(knowledgeItems);
        runtimeOptions.onEvidenceClaims?.(evidenceClaims);
        evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
        updateRunState(runState, runtimeOptions, {
          researchBrief: brief,
          evidencePolicy,
          factualClaims: applyEvidenceToClaims(runState.factualClaims, evidencePackSources),
          knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
          evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
        });
      } else {
        updateRunState(runState, runtimeOptions, { researchBrief: brief, evidencePolicy: { ...evidencePolicy, status: 'missing' } });
      }
      updateToolCall(runState, runtimeOptions, toolCall.id, {
        status: evidencePackSources.length > 0 ? 'complete' : 'error',
        outputSummary: evidencePackSources.length > 0 ? `${evidencePackSources.length} sources found across ${brief.queries.length} queries` : 'No sources returned for evidence pack',
        sourceIds: evidencePackSources.map(source => source.id)
      });
      addTrace(runState, runtimeOptions, {
        type: 'tool-call',
        title: 'Evidence pack built',
        detail: `${brief.queries.length} queries; ${evidencePackSources.length} sources`,
        agentId: secretary.id
      });
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
        if (shouldSearchForStep(targetAgent, evidencePolicy, delegation.prompt)) {
          const toolCall = addToolCall(runState, runtimeOptions, {
            toolId: RUNTIME_TOOLS.webSearch.id,
            toolName: RUNTIME_TOOLS.webSearch.name,
            requestedBy: targetAgent.name,
            input: `${userQuery}\n${delegation.prompt}`,
            status: 'running'
          });
          const foundSources = await enrichSources(await searchWeb(`${userQuery}\n${delegation.prompt}`, targetAgent.name));
          if (foundSources.length > 0) {
            onSources?.(foundSources);
            allSources = [...allSources, ...foundSources];
            runSources = allSources;
            const knowledgeItems = sourcesToKnowledgeItems(foundSources);
            const evidenceClaims = createEvidenceClaims(foundSources, targetAgent.name);
            runtimeOptions.onKnowledgeItems?.(knowledgeItems);
            runtimeOptions.onEvidenceClaims?.(evidenceClaims);
            updateRunState(runState, runtimeOptions, {
              factualClaims: applyEvidenceToClaims(runState.factualClaims, foundSources),
              knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
              evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
            });
            evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
            updateRunState(runState, runtimeOptions, { evidencePolicy });
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
        const prompt = `${buildDelegationPrompt(userQuery, delegation, dependencyContext, runSources)}${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}${formatResearchBriefForPrompt(runState.researchBrief)}\n\nWhen making factual claims, label them as sourced, assumed, or needing validation. Tie strategy and creative recommendations back to current signals, forecast signals, competitive signals, or caveats.`;
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

    evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
    if (evidencePolicy.required && allSources.length === 0) evidencePolicy = { ...evidencePolicy, status: 'missing' };
    updateRunState(runState, runtimeOptions, { evidencePolicy });

    // --- Step 2b: Penny critiques the run and may request one targeted repair pass ---
    updateRunState(runState, runtimeOptions, { status: 'critiquing', activeStepId: undefined });
    onThinking(secretary.id, true);
    const critiquePrompt = `
Review the current run state and specialist outputs. Decide whether the answer is sufficient or whether one more targeted specialist pass is needed.

User objective:
${userQuery}

${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}
${formatResearchBriefForPrompt(runState.researchBrief)}

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

${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}
${formatResearchBriefForPrompt(runState.researchBrief)}

Execution trace:
${formatStepResultsForSynthesis(stepResults, synthesisOrder)}

Based on their findings and your role as Penny (Executive Coordinator), present the final compiled solution to the User. Make it professional, beautifully structured with headings/markdown, and highlight which expert provided which insights.
Create a complete strategy and creative platform from the research: situation, current/news signals, forecast implications, audience truth, strategic choice, positioning, creative platform, messaging system, channel plan, proof points, risks, and next experiments.
Use explicit labels for Sourced, Assumed, Recommended, and Needs validation. When evidence is missing but policy required it, state that clearly before recommendations. Cite sources by title or URL where relevant.
${formatDeliverableSchemaForPrompt()}
Keep the tone direct and concise, avoiding excessive conversational filler, fluff, or chatty pleasantries.
`;

    const finalAnswer = await callModel(provider, model, secretary.systemPrompt || '', `${synthesisPrompt}${formatSourcesForPrompt(allSources)}`, 6144);
    onThinking(secretary.id, false);
  const deliverableSections = extractDeliverableSections(finalAnswer, allSources);
  const scorecard = await createModelScorecard(provider, model, secretary, runState, finalAnswer, allSources);
  const projectMemory = createProjectMemorySnapshot(runState, allSources, deliverableSections);
  const projectLibrary = createProjectLibrary(runState, allSources, projectMemory);
  updateRunState(runState, runtimeOptions, { status: 'complete', completedAt: new Date().toISOString(), activeStepId: undefined, deliverableSections, scorecard, projectMemory, projectLibrary });
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
  const factualClaims = extractFactualClaims(userQuery);
  let evidencePolicy = evaluateEvidencePolicy(userQuery, factualClaims, existingSources);
  const runState = createRunState(userQuery, 'authored', provider, model, evidencePolicy, factualClaims);
  emitRunState(runState, runtimeOptions);
  addTrace(runState, runtimeOptions, {
    type: 'tool-call',
    title: RUNTIME_TOOLS.claimExtraction.name,
    detail: factualClaims.length > 0 ? factualClaims.map(claim => claim.text).join('\n') : 'No explicit factual claims extracted.'
  });
  addTrace(runState, runtimeOptions, {
    type: 'tool-call',
    title: RUNTIME_TOOLS.evidencePolicy.name,
    detail: evidencePolicy.required ? evidencePolicy.reasons.join('\n') : 'Evidence is not required for this request.'
  });
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
  if (evidencePolicy.required && allSources.length === 0) {
    const toolCall = addToolCall(runState, runtimeOptions, {
      toolId: RUNTIME_TOOLS.webSearch.id,
      toolName: 'Evidence pack search',
      requestedBy: manager.name,
      input: userQuery,
      status: 'running'
    });
    const { brief, sources: evidencePackSources } = await buildEvidencePack(userQuery, runState.factualClaims, manager.name);
    if (evidencePackSources.length > 0) {
      onSources(evidencePackSources);
      allSources = [...allSources, ...evidencePackSources];
      const knowledgeItems = sourcesToKnowledgeItems(evidencePackSources);
      const evidenceClaims = createEvidenceClaims(evidencePackSources, manager.name);
      runtimeOptions.onKnowledgeItems?.(knowledgeItems);
      runtimeOptions.onEvidenceClaims?.(evidenceClaims);
      evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
      updateRunState(runState, runtimeOptions, {
        researchBrief: brief,
        evidencePolicy,
        factualClaims: applyEvidenceToClaims(runState.factualClaims, evidencePackSources),
        knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
        evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
      });
    } else {
      updateRunState(runState, runtimeOptions, { researchBrief: brief, evidencePolicy: { ...evidencePolicy, status: 'missing' } });
    }
    updateToolCall(runState, runtimeOptions, toolCall.id, {
      status: evidencePackSources.length > 0 ? 'complete' : 'error',
      outputSummary: evidencePackSources.length > 0 ? `${evidencePackSources.length} sources found across ${brief.queries.length} queries` : 'No sources returned for evidence pack',
      sourceIds: evidencePackSources.map(source => source.id)
    });
    addTrace(runState, runtimeOptions, {
      type: 'tool-call',
      title: 'Evidence pack built',
      detail: `${brief.queries.length} queries; ${evidencePackSources.length} sources`,
      agentId: manager.id
    });
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
    if (shouldSearchForStep(agent, evidencePolicy, node.prompt || defaultPrompt)) {
      const toolCall = addToolCall(runState, runtimeOptions, {
        toolId: RUNTIME_TOOLS.webSearch.id,
        toolName: RUNTIME_TOOLS.webSearch.name,
        requestedBy: agent.name,
        input: `${userQuery}\n${node.prompt || defaultPrompt}`,
        status: 'running'
      });
      const foundSources = await enrichSources(await searchWeb(`${userQuery}\n${node.prompt || defaultPrompt}`, agent.name));
      if (foundSources.length > 0) {
        onSources(foundSources);
        allSources = [...allSources, ...foundSources];
        runSources = allSources;
        const knowledgeItems = sourcesToKnowledgeItems(foundSources);
        const evidenceClaims = createEvidenceClaims(foundSources, agent.name);
        runtimeOptions.onKnowledgeItems?.(knowledgeItems);
        runtimeOptions.onEvidenceClaims?.(evidenceClaims);
        updateRunState(runState, runtimeOptions, {
          factualClaims: applyEvidenceToClaims(runState.factualClaims, foundSources),
          knowledgeItemIds: mergeUnique(runState.knowledgeItemIds, knowledgeItems.map(item => item.id)),
          evidenceClaimIds: mergeUnique(runState.evidenceClaimIds, evidenceClaims.map(claim => claim.id))
        });
        evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
        updateRunState(runState, runtimeOptions, { evidencePolicy });
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

    const prompt = `${node.prompt || defaultPrompt}\n\nUser request:\n${userQuery}\n\n${upstreamContext ? `Upstream context:\n${upstreamContext}` : ''}${formatSourcesForPrompt(runSources)}${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}${formatResearchBriefForPrompt(runState.researchBrief)}\n\nWhen making factual claims, label them as sourced, assumed, or needing validation. Tie strategy and creative recommendations back to current signals, forecast signals, competitive signals, or caveats.`;

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

  evidencePolicy = evaluateEvidencePolicy(userQuery, runState.factualClaims, allSources);
  if (evidencePolicy.required && allSources.length === 0) evidencePolicy = { ...evidencePolicy, status: 'missing' };
  updateRunState(runState, runtimeOptions, { evidencePolicy });

  updateRunState(runState, runtimeOptions, { status: 'critiquing', activeStepId: undefined });
  const authoredEvaluation: RunEvaluation = {
    id: `eval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    reviewer: 'system',
    rating: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? 2 : 3,
    summary: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? 'Authored workflow completed with at least one step error.' : 'Authored workflow completed and is ready for synthesis.',
    strengths: ['Authored execution used the visible team graph.'],
    gaps: Object.values(nodeOutputs).some(output => output.startsWith('Error:')) ? ['Review failed steps before relying on the synthesis.'] : [],
    nextActions: ['Review final synthesis and rerun any weak step from the team workflow.'],
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
  const synthesisPrompt = `Synthesize this authored workflow into a polished final output. Create a complete strategy and creative platform from the research: situation, current/news signals, forecast implications, audience truth, strategic choice, positioning, creative platform, messaging system, channel plan, proof points, risks, and next experiments. Use explicit labels for Sourced, Assumed, Recommended, and Needs validation. If evidence is missing but policy required it, state that before recommendations. Cite available sources by title or URL where relevant.${formatDeliverableSchemaForPrompt()}\n\nUser request:\n${userQuery}${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}${formatResearchBriefForPrompt(runState.researchBrief)}\n\nWorkflow outputs:\n${workflowOutputs}${formatSourcesForPrompt(allSources)}`;
  const finalAnswer = await callModel(provider, model, manager.systemPrompt || '', synthesisPrompt, 6144);
  onThinking(manager.id, false);
  const deliverableSections = extractDeliverableSections(finalAnswer, allSources);
  const scorecard = await createModelScorecard(provider, model, manager, runState, finalAnswer, allSources);
  const projectMemory = createProjectMemorySnapshot(runState, allSources, deliverableSections);
  const projectLibrary = createProjectLibrary(runState, allSources, projectMemory);
  updateRunState(runState, runtimeOptions, { status: 'complete', completedAt: new Date().toISOString(), activeStepId: undefined, deliverableSections, scorecard, projectMemory, projectLibrary });
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

export async function runTargetedRevision(
  userQuery: string,
  sectionTitle: string,
  originalSection: string,
  notes: string[],
  agents: Agent[],
  agentIds: string[],
  provider: ModelProvider,
  model: string,
  sources: SourceRecord[] = [],
  runState?: RunState | null
) {
  const activeAgents = agents.some(agent => agent.systemPrompt) ? agents : await loadAgentSystemPrompts(agents);
  const selectedAgents = activeAgents.filter(agent => agentIds.includes(agent.id));
  const manager = getCoordinator(activeAgents);
  const specialistContext = selectedAgents.length > 0
    ? selectedAgents.map(agent => `\n## ${agent.name} (${agent.title})\n${agent.systemPrompt || ''}`).join('\n')
    : `\n## ${manager.name} (${manager.title})\n${manager.systemPrompt || ''}`;

  const prompt = `
You are running a targeted revision, not a full workflow rerun.

Objective:
${userQuery}

Section to revise:
${sectionTitle}

Original section:
${originalSection}

User notes:
${notes.map(note => `- ${note}`).join('\n') || '- Improve this section.'}

Relevant run context:
${runState ? `${formatEvidencePolicyForPrompt(runState.evidencePolicy, runState.factualClaims)}${formatResearchBriefForPrompt(runState.researchBrief)}\nOpen questions: ${runState.openQuestions.join('; ') || 'none'}\nRisks: ${runState.risks.join('; ') || 'none'}` : 'No run context supplied.'}
${formatSourcesForPrompt(sources)}

Specialist perspectives to use:
${specialistContext}

Return only JSON in this shape:
{
  "revisedBody": "full revised section markdown, without repeating the section heading",
  "rationale": "short explanation of what changed and why"
}

Rules:
- Preserve the section's job in the larger artifact.
- Do not rewrite unrelated sections.
- Address the user notes directly.
- Keep evidence labels and assumptions clear.
- If Stephen is involved, improve taste, tension, memorability, and line quality.
- If August is involved, improve the creative system and avoid literal visual ideas.
`;

  const raw = await callModel(provider, model, manager.systemPrompt || '', prompt, 4096);
  const parsed = extractRevisionJson(raw);
  return parsed ?? { revisedBody: raw, rationale: 'Model returned markdown instead of structured revision JSON.' };
}

function extractRevisionJson(rawText: string): { revisedBody: string; rationale: string } | null {
  const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;

  try {
    const parsed = JSON.parse(candidate) as Partial<{ revisedBody: string; rationale: string }>;
    if (typeof parsed.revisedBody !== 'string') return null;
    return {
      revisedBody: parsed.revisedBody,
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : 'Revision generated.'
    };
  } catch {
    return null;
  }
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
