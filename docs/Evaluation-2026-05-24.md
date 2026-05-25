# The Office v3 Evaluation - 2026-05-24

## Current State

The Office v3 has moved from a legible multi-agent theater into an early workflow runtime. The core runtime now has dependency-aware execution, step-scoped outputs, structured run state, traces, tool calls, evidence claims, knowledge records, critique/evaluation, import/export snapshots, and per-agent model overrides.

## New Intelligence Capabilities

- Evidence policy runs before planning and decides whether external evidence is required.
- Factual claims are extracted from the user request and tracked as unverified, needs-research, supported, or assumption.
- Required evidence can force a Mira evidence-check step before downstream strategy or creative work.
- Required evidence now triggers a multi-query evidence pack across current news, market research, predictions/forecasts, competitive examples, cultural signals, and GTM strategy patterns.
- Research packs generate a reusable research brief with current/news signals, forecast signals, competitive signals, and caveats.
- Web search is no longer conceptually limited to the researcher role; evidence-triggered steps can use search when their prompt depends on verification.
- Final synthesis is instructed to separate sourced facts, assumptions, recommendations, and items needing validation.
- The Run tab now displays evidence policy, factual claims, research briefs, tool calls, trace records, knowledge, and evaluation data.
- Repair actions let users trigger follow-up research or challenge the latest output.
- Final synthesis now targets a fixed strategy and creative platform schema with required sections.
- The runtime extracts deliverable sections, shows them in the Run tab, and lets users refine a single section.
- Runs now receive a heuristic scorecard across evidence coverage, source quality, claim support, strategic sharpness, creative originality, actionability, and consistency.
- Project memory snapshots preserve accepted claims, source ids, and deliverable section ids for exported workspaces.
- `/api/ingest` now fetches, cleans, summarizes, and chunks source URLs or pasted source text.
- Claim-source matching now scores factual claims against source chunks and stores best supporting quotes.
- Final scorecards now use a model-graded evaluator pass with heuristic fallback.
- Completed runs now include a portable project library with memories, accepted claims, and enriched source records.
- The Projects tab now persists local project libraries with run memories, enriched sources, accepted/rejected claims, open questions, and deliverable sections.
- Active project sources are fed into future workflow runs.
- The Run tab now supports claim-level accept, assume, reject, research, and challenge actions.
- Manual sources are ingested through `/api/ingest` before being stored.
- Nora, a measurement and growth analyst, has been added to own KPIs, experiments, dashboards, success criteria, and learning agendas.
- Penny now applies mandatory routing gates for audience/culture review, technical feasibility, futures/scenario review, and measurement/growth review.

## Bug Check Results

- `npm run build` passes.
- `npm run lint` passes.
- `npm audit --audit-level=high` reports zero vulnerabilities.
- `git diff --check` reports no whitespace errors.
- Editor diagnostics for touched TypeScript/React files are clean.
- Remaining editor diagnostics are CSS browser-support warnings in existing global stylesheet rules and markdown lint warnings in the untracked assessment note.

## Remaining Gaps

- Claim extraction is deterministic and heuristic. It is useful, but not yet a model-graded claim parser.
- Claim-source matching is lexical/chunk-based, not embedding-based semantic retrieval.
- Source ingestion uses simple readability cleanup, not a full browser renderer or PDF parser.
- Projects are still localStorage-backed rather than database-backed.
- Claim controls update local state and project memory, but do not yet create a formal audit trail per claim decision.
- Mandatory routing gates improve coverage, but they can increase token/cost load on broad briefs.
- Nora currently reuses the strategist portrait until a dedicated portrait is added.
- Web search can be triggered by policy, but the tool registry is still runtime-internal rather than a full agent-request protocol.
- Import/export provides portable persistence, but there is still no backend project database or searchable run history.
- The critique loop is bounded to keep cost and runaway behavior under control; deeper iterative re-planning will need user controls and budget limits.
- Scorecards are heuristic and structural; they are not yet model-graded evaluation judgments.
- Section refinement starts a targeted follow-up run; it does not yet patch the original final output in place.

## Recommended Next Phase

Build a true evidence workbench: claim-to-source matching, citation verification, source confidence scoring, and a UI action that lets the user accept, reject, or research each claim individually.
