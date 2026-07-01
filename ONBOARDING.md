# Atlas — Team Onboarding & Active Workstreams

Welcome. Atlas is a **sovereign, AI-native "Smart Artifact" generator** for VNG/GreenNode
back-office teams — describe what you need, Atlas builds a finished, on-brand artifact
(Doc / Deck / Sheet / Dashboard / Report). This guide gets you productive and points you
at your workstream.

## Repo at a glance
- `apps/web` — React + Vite + TS SPA (Home, Studio, renderers). Zustand state.
- `services/bff` — Fastify + zod BFF (`generate` / `revise` / `agent`). Model access + skill runtime.
- `services/artifacts` — FastAPI export service (docx/xlsx/pptx) + attachment extraction.
- `agent/` — OpenCode server config (providers, agents) for the multi-step tool tier.
- **`SPEC.md`** — the living spec. Read it first; it's the source of truth for what's built.

## Run it locally
```bash
# 1. Artifact/export service
cd services/artifacts && . .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8742
# 2. BFF (reads services/bff/.env → live GreenNode; else serves templates)
cd services/bff && npm run dev            # :8787
# 3. Web
cd apps/web && npm run dev                # http://localhost:5173
```
Connect GreenNode (keys, models, OpenCode topology): **`docs/Connect-GreenNode.md`**.
Never commit secrets — `.env`, `.greennode*`, token caches, and `*.db` are gitignored.

## How we structure artifact work (read before picking up a task)
We're making every artifact type genuinely good, with **one team per type**, working
independently. The architecture:
- **Platform** (core team) — shared engine + the `ArtifactTypeModule` **contract** + a
  reusable quality toolkit. Owns the registries; changes rarely.
- **Artifact Packs** (one team per type) — a self-contained module (schema · prompt ·
  archetypes · renderer · export · exemplars) that plugs in via the contract. You edit
  **only your pack's files**.

**Read in this order:**
1. `docs/superpowers/specs/2026-07-01-artifact-platform-program.md` — the map: Platform vs Packs, the `ArtifactTypeModule` contract, per-team charters, file-isolation map, how independence is enforced.
2. Your workstream's design + plan (below).

## Active workstream — WS-0 · Platform (do this first; it unblocks everyone)
The enabling refactor: freeze the contract, split the monolithic `types.ts`/`prompt.ts`/
`archetypes.ts` into **per-type modules behind registries** (behavior-preserving), and
formalize the web renderer + python export registries. Doc is the deep reference; the
other four are mechanical relocations.
- **Design:** `docs/superpowers/specs/2026-07-01-ws0-platform-design.md`
- **Executable plan (9 TDD tasks):** `docs/superpowers/plans/2026-07-01-ws0-platform-refactor.md`
- **Freeze first:** the `ArtifactTypeModule` contract (design §2 / plan Task 1) — every pack depends on it.
- **Run it:** task-by-task, or via `superpowers:subagent-driven-development`.
- **Guardrail / Definition of Done:** the full suites stay green after **every** task
  (BFF 51 · web 34 · Python 14), public APIs unchanged, and "add a type = drop one module
  file + one registry line."
- **Phase 2 (companion):** the **exemplar toolkit** — few-shot gold-doc injection to lift
  quality; full design in the WS-0 spec §5; gets its own plan.

## Pack workstreams (start after WS-0 freezes the contract)
Each team clones the Doc reference pack and goes deep, editing only its files:
- **Doc** — team-defined archetypes (PRD, SOW, policy, exec memo); sectioned-block depth; exemplars.
- **Deck** — slide archetypes (board / pitch / QBR); layouts; speaker notes; exemplars; pptx fidelity.
- **Sheet** — financial model / headcount plan / schedule; formulas; exemplars; xlsx fidelity.
- **Dashboard** — KPI + chart archetypes; chart-type variety; layouts; exemplars.
- **Report** — recurring-report archetypes; stats + narrative; refresh (later); exemplars.

## Conventions
- Branch off `main`; keep the three suites green; frequent small commits.
- We use the **superpowers** flow: brainstorm → spec (`docs/superpowers/specs/`) → plan
  (`docs/superpowers/plans/`) → subagent-driven implementation. Each workstream has its own cycle.
- Contract tests + CODEOWNERS per `artifacts/<type>/` path keep packs independent — don't edit shared engine files unless you're on the Platform team.
