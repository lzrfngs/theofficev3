# Agent Profiles

This folder is the durable source of truth for The Office agent instructions.

To add a future agent:

1. Add a markdown profile in this folder.
2. Import it in `src/data/agents.ts` with `?raw`.
3. Add a matching entry to `AGENT_CATALOG` with a unique `id`, `role`, visual settings, and `specialtyKeywords`.
4. Add a portrait to `public/portraits` if the agent needs one.

The app imports these markdown files at build time, so they travel with the deployed Vercel build instead of depending on editable runtime files.

Current agents:

- Penny: coordinator
- Stephen: writer
- Evelyn: strategist
- John: anthropologist
- Mira: researcher
- Vadim: tech expert