# The Office v3

A Vite + React multi-agent workspace. Penny coordinates specialist agents, routes user requests, builds a node-based workflow canvas, and synthesizes the team response.

## Workflow Canvas

The app opens with Penny on the left and an empty workflow canvas on the right. When a user gives Penny a task, Penny plans the right team and the app renders the work as connected nodes. Agents can appear multiple times in a single flow when the work needs to loop back through the same specialist.

Local simulated mode has been removed. A Gemini API key is required for live agent runs until a backend model router is added.

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

## Build

```bash
npm run build
```

## Deployment

This is a static Vite app and can be deployed to Vercel with the default settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
