## DEV — Change Log

_Newest version first. Drop raw notes in the Inbox; I process them into the next version below._

<!-- Conventions: small version bumps on the third decimal (v0.1.1, v0.1.2 …). Strike shipped work with ~~strikethrough~~ and a short "what changed" note. Status markers: [x] done · [!] dropped/changed · [ ] open. -->

## 📥 Inbox

_Add new notes/requests here as bullets. They get processed into a version below, then cleared._

-
-

---

## v0.1 — Initial state

- Vite + React multi-agent workspace. Penny coordinates specialists, routes requests, builds a node-based workflow canvas, synthesizes the team response.
- Server-side model router at `api/generate.ts` (gemini / openai / anthropic / azure-openai / github-models). Frontend calls `/api/generate`; provider secrets live in Vercel env vars.
- Other serverless endpoints: `/api/search` (Tavily web search), `/api/ingest` (RAG), `/api/providers`, `/api/generate-image` (OpenAI image foundation).
- Frontend calls same-origin `/api/*` from `src/services/coordinator.ts` and `src/App.tsx`. No keys in the browser.

### Notes / research

- **VibeHub API Connections (2026-06-06):** Evaluated VibeHub's new credential-proxy feature for this project. Verdict: **only relevant if we want to host The Office on VibeHub** (corp-boundary, shareable link). It does NOT help the current Vercel app — we already proxy provider keys server-side, which is the exact problem API Connections solves, and ours does more.
  - VibeHub is **static-only** (no server code). API Connections is a thin credential-injecting pass-through proxy (`fetch('/api/proxy/<name>/...')`, token added server-side, AES-256-GCM at rest, SSRF defense, allowed-path allowlist, 50MB / 30s / 60rpm limits).
  - It could cleanly replace **one** endpoint: `/api/generate` for a **single provider** (e.g. Azure OpenAI via a Custom Header connection named `api-key`, base URL = Azure resource, allowed path locked to the deployment's chat/completions).
  - It **cannot** carry over: (1) the multi-provider routing + request/response shaping in `generate.ts` (would have to move to the client and pick one provider), (2) `/api/search` aggregation, (3) `/api/ingest` RAG chunking/embeddings. Those are real logic, not pass-through.
  - [ ] If a public "VibeHub demo" build is ever wanted: strip to single-provider, no-RAG, move provider body-shaping client-side, wire one API Connection. Tracked as a someday, not started.
