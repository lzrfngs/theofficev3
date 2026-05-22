# The Office v3

A Vite + React multi-agent workspace. Penny coordinates specialist agents, routes user requests, and synthesizes the team response.

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
