# The Office v3

A Vite + React multi-agent workspace. Penny coordinates specialist agents, routes user requests, builds a node-based workflow canvas, and synthesizes the team response.

## Workflow Canvas

The app opens with Penny on the left and an empty workflow canvas on the right. When a user gives Penny a task, Penny plans the right team and the app renders the work as connected nodes. Agents can appear multiple times in a single flow when the work needs to loop back through the same specialist.

Local simulated mode has been removed. Live agent runs use the server-side model router in `api/generate.ts`.

## Model Router

The frontend calls `/api/generate`; provider secrets should live in Vercel environment variables, not browser localStorage.

Supported router targets:

- `gemini`
- `openai`
- `anthropic`
- `azure-openai`
- `github-models`

Copy `.env.example` for local reference and add the matching variables in Vercel Project Settings. The Settings modal controls provider/model selection, but the corresponding server-side key must exist for that provider.

There is also an image-generation foundation at `/api/generate-image`, configured for OpenAI image models such as `gpt-image-2`. This is intended for future real-time thinking portraits and visual agent-state experiments.

## Sources & Web Search

The Sources tab stores manual sources and web results. Mira can search the web during researcher steps when `TAVILY_API_KEY` is configured in Vercel. Search results are saved with title, URL, snippet, query, provider, and the agent that used them.

## Runtime Intelligence

The Run tab exposes the active workflow's structured state: objective, confidence, assumptions, open questions, decisions, risks, conflicts, tool calls, evidence claims, knowledge items, traces, and evaluations. Automatic workflows execute dependency-aware plans, preserve repeated-agent outputs by step id, and run a bounded Penny critique pass that can request one targeted repair step before final synthesis.

Manual sources and agent outputs can be promoted into the shared knowledge pool. Workspace snapshots can be exported/imported as JSON for portable persistence beyond browser localStorage. Settings also support per-agent model overrides so routing, specialist work, and synthesis can use different model choices while keeping the same provider router.

Evidence policy now runs before planning. The app extracts factual claims from the user request, decides whether external evidence is required, and can force a Mira evidence-check before dependent strategy or creative steps. Final synthesis is instructed to label material as sourced, assumed, recommended, or needing validation. The Run tab shows the evidence policy, factual claims, tool calls, and repair actions for follow-up research or critique.

When evidence is required and no sources are already attached, The Office builds a multi-query evidence pack before specialist execution. The pack searches current news, market research, forecasts/predictions, competitive examples, cultural adoption signals, and GTM strategy patterns, then stores those sources as a research brief. Penny and the specialists receive the brief so strategy and creative platforms can trace recommendations back to current signals, forecast implications, competitive context, caveats, and source snippets.

Final synthesis now targets a fixed strategy and creative platform schema: executive read, evidence base, market truth, audience truth, strategic tension, opportunity, positioning, creative platform, messaging architecture, channel plan, launch phases, proof points, risks, experiments, evidence table, assumptions table, and open questions. The runtime extracts those sections, scores the run for evidence coverage, source quality, claim support, strategic sharpness, creative originality, actionability, and consistency, and stores a project memory snapshot that can travel with exported workspaces. The Run tab lets users refine individual deliverable sections without manually rebuilding the whole workflow.

## Agent Profiles

Persistent agent markdown files live in `docs/agents`. The app imports those files through `src/data/agents.ts`, which acts as the agent catalog.

To add a new agent:

1. Create `docs/agents/new_agent.md`.
2. Add a portrait to `public/portraits` if needed.
3. Import the markdown file in `src/data/agents.ts` with `?raw`.
4. Add a new `AGENT_CATALOG` entry with a unique `id`, `role`, `color`, `badgeClass`, `activeClass`, and `specialtyKeywords`.

## Development

```bash
npm install
npm run dev
```

Vite runs local middleware for `/api/generate` and `/api/search`, so the normal dev server can exercise the same server-side router shape used on Vercel. Add local provider keys to `.env` when testing live model calls, for example `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_MODELS_TOKEN`, or `TAVILY_API_KEY`.

The app checks `/api/providers` at startup and in Settings. If a saved browser provider is not configured on the server, the UI warns you and falls back to the first configured provider when possible. Azure OpenAI requires both `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT`; `AZURE_OPENAI_DEPLOYMENT` is used as the default model/deployment when present.

## Build

```bash
npm run build
```

## Deployment

This is a static Vite app and can be deployed to Vercel with the default settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
