import type { Agent } from '../services/coordinator';
import secretaryPrompt from '../../docs/agents/secretary.md?raw';
import writerPrompt from '../../docs/agents/writer.md?raw';
import strategistPrompt from '../../docs/agents/strategist.md?raw';
import anthropologistPrompt from '../../docs/agents/anthropologist.md?raw';
import techExpertPrompt from '../../docs/agents/tech_expert.md?raw';
import researcherPrompt from '../../docs/agents/researcher.md?raw';
import futuristPrompt from '../../docs/agents/futurist.md?raw';

export const AGENT_CATALOG: Agent[] = [
  {
    id: 'secretary',
    name: 'Penny',
    title: 'Executive Coordinator & Time Manager',
    role: 'secretary',
    isCoordinator: true,
    avatar: '/portraits/secretary.jpeg',
    color: '#a78bfa',
    badgeClass: 'badge-secretary',
    activeClass: 'active-secretary',
    mdFile: 'docs/agents/secretary.md',
    systemPrompt: secretaryPrompt,
    specialtyKeywords: ['coordinate', 'plan', 'schedule', 'prioritize', 'summarize'],
    mockAction: 'coordinate the work',
    mockFocus: 'Break the work into clear tasks and synthesize the team output.'
  },
  {
    id: 'writer',
    name: 'Stephen',
    title: 'Creative Copywriter & Ad Specialist',
    role: 'writer',
    avatar: '/portraits/writer.jpeg',
    color: '#fbbf24',
    badgeClass: 'badge-writer',
    activeClass: 'active-writer',
    mdFile: 'docs/agents/writer.md',
    systemPrompt: writerPrompt,
    specialtyKeywords: ['write', 'copy', 'campaign', 'pitch', 'slogan', 'tagline', 'brand', 'ad', 'hook', 'creative', 'script'],
    mockAction: 'write a creative hook',
    mockFocus: 'Shape the idea into a clear hook, stronger messaging, and practical copy options.',
    mockResponse: `### Creative Advertising & Hook
Here are potential angles using the **AIDA** framework:

* **Angle 1: The Rebellious Builder**
  * **Hook**: Tired of bloated platforms? Meet the clean setup.
  * **Core message**: Less config, more creation. Build on your terms.
* **Angle 2: The Professional Efficiency Play**
  * **Hook**: Your virtual team is online. Delegate the busywork.

> Don't write more code to manage your code. Create with The Office and let specialized agents handle the thinking lanes.`
  },
  {
    id: 'strategist',
    name: 'Evelyn',
    title: 'Business & Marketing Strategist',
    role: 'strategist',
    avatar: '/portraits/strategist.jpeg',
    color: '#34d399',
    badgeClass: 'badge-strategist',
    activeClass: 'active-strategist',
    mdFile: 'docs/agents/strategist.md',
    systemPrompt: strategistPrompt,
    specialtyKeywords: ['strategy', 'market', 'business', 'launch', 'pricing', 'swot', 'plan', 'kpi', 'positioning', 'growth'],
    mockAction: 'map out a strategy',
    mockFocus: 'Turn the request into positioning, milestones, and measurable next steps.',
    mockResponse: `### Business & Positioning Strategy
Here is the positioning frame:

| Dimension | Strategy Details |
| :--- | :--- |
| **Target Audience** | Early tech adopters, creators, and operators |
| **Differentiator** | Direct control over a focused specialist team |
| **Core Channel** | Community-led demos, maker updates, and practical templates |

**Recommendation:** Lead with simplicity and control, then show concrete output from the agents.`
  },
  {
    id: 'anthropologist',
    name: 'John',
    title: 'Digital Anthropologist',
    role: 'anthropologist',
    avatar: '/portraits/anthropologist.jpeg',
    color: '#fb7185',
    badgeClass: 'badge-anthropologist',
    activeClass: 'active-anthropologist',
    mdFile: 'docs/agents/anthropologist.md',
    systemPrompt: anthropologistPrompt,
    specialtyKeywords: ['user', 'audience', 'customer', 'demographic', 'behavior', 'people', 'culture', 'community', 'research'],
    mockAction: 'analyze user behavior',
    mockFocus: 'Clarify the human context, cultural friction, and language that will feel authentic.',
    mockResponse: `### Cultural Insights & User Behavior
The strongest opportunity is trust. Users respond when agent systems feel legible and controllable instead of magical or opaque.

1. **Authenticity matters**: People reject vague automation claims quickly.
2. **Control reduces anxiety**: Make it obvious which agent is acting and why.
3. **Recommendation**: Keep the team metaphor visible, but let the user stay in charge of the workflow.`
  },
  {
    id: 'researcher',
    name: 'Mira',
    title: 'Research Analyst & Evidence Synthesizer',
    role: 'researcher',
    avatar: '',
    color: '#60a5fa',
    badgeClass: 'badge-researcher',
    activeClass: 'active-researcher',
    mdFile: 'docs/agents/researcher.md',
    systemPrompt: researcherPrompt,
    specialtyKeywords: ['research', 'source', 'sources', 'fact', 'facts', 'evidence', 'verify', 'validation', 'compare', 'comparison', 'benchmark', 'examples', 'reference', 'scan', 'discovery', 'background', 'investigate'],
    mockAction: 'gather evidence and context',
    mockFocus: 'Clarify what is known, what needs validation, and which findings should guide the team.',
    mockResponse: `### Research Brief & Evidence Map
I would frame the investigation around three questions:

| Thread | What to Check | Output |
| :--- | :--- | :--- |
| **Context** | Existing examples, comparable products, and terminology | Short landscape summary |
| **Evidence** | Claims that need sources, benchmarks, or user proof | Confidence-ranked findings |
| **Gaps** | Unknowns that could change the recommendation | Follow-up research tasks |

**Provisional read:** Bring research in early when the request depends on facts, examples, market context, or comparison. Then hand findings to strategy, writing, or technical agents as needed.`
  },
  {
    id: 'futurist',
    name: 'Iris',
    title: 'Strategic Futurist & Scenario Planner',
    role: 'futurist',
    avatar: '',
    color: '#c084fc',
    badgeClass: 'badge-futurist',
    activeClass: 'active-futurist',
    mdFile: 'docs/agents/futurist.md',
    systemPrompt: futuristPrompt,
    specialtyKeywords: ['future', 'futures', 'futurist', 'foresight', 'signal', 'signals', 'scenario', 'scenarios', 'horizon', 'trend', 'trends', 'implications', 'plausible', 'forecast', 'forecasting', 'backcast', 'backcasting', 'steep', 'uncertainty', 'uncertainties', 'what if', 'where is this going'],
    mockAction: 'build a future-facing scenario frame',
    mockFocus: 'Use signals and foresight frameworks to map plausible futures, tensions, and decision points.',
    mockResponse: `### Futures Scan & Scenario Frame
I would treat this as a foresight pass, not a prediction.

| Lens | Question | Output |
| :--- | :--- | :--- |
| **Signals** | What early indicators are already visible? | Weak and strong signal map |
| **Sense-making** | What pattern connects the signals? | Named clusters and tensions |
| **Scenarios** | What could plausibly unfold? | H1/H2/H3 or 2x2 scenario frame |
| **Implications** | Who needs to decide what now? | Near-term choices and risks |

**Provisional read:** Bring the futurist in when the work depends on where a market, culture, technology, role, or creative practice may be heading. Pair with Mira when claims need evidence, and Evelyn when the future needs to become strategy.`
  },
  {
    id: 'tech_expert',
    name: 'Vadim',
    title: 'AI & Systems Architect',
    role: 'tech_expert',
    avatar: '/portraits/tech_expert.jpeg',
    color: '#22d3ee',
    badgeClass: 'badge-tech',
    activeClass: 'active-tech',
    mdFile: 'docs/agents/tech_expert.md',
    systemPrompt: techExpertPrompt,
    specialtyKeywords: ['code', 'tech', 'api', 'develop', 'system', 'architecture', 'backend', 'database', 'typescript', 'react', 'build', 'setup', 'program', 'script', 'deploy'],
    mockAction: 'architect the technical path',
    mockFocus: 'Define the implementation steps, integration constraints, and deployment path.',
    mockResponse: `### Technical Architecture & Integrations
Recommended implementation pattern:

\`\`\`typescript
const office = createOffice({
  coordinator: 'secretary',
  visibleAgents: ['writer', 'strategist', 'tech_expert'],
  mode: 'selective-delegation'
});
\`\`\`

**Key Specs**
- Keep agent profiles as markdown source files.
- Use a typed catalog for identity, UI color, and routing metadata.
- Deploy the static Vite build to Vercel with no server needed.`
  }
];