# Atlas — Backlog & Sprint Plan (v1)

> **STATUS (1 Jul 2026): the artifact-generation product is DELIVERED and live.**
> - **Done:** the full web product (Home → Configure → Build → Studio → Library), 5 artifact types, the generation engine, and states/polish — i.e. the S1–S5 *software* scope of this plan.
> - **Delivered beyond this plan:** Node/Fastify **BFF** (`/generate` · `/generate/stream` SSE · `/revise`), Python **artifact-export service** (docx/xlsx/pptx + HTML), **real OpenCode integration**, a **live GreenNode MaaS** connection (Gemma/Qwen/MiniMax), hardening, and a security code-review pass.
> - **Still parked (as planned, §6):** the data layer (FDL MCP / Trino / masking / identity), SSO, server persistence/retention, multi-tenant, deploy.
> Authoritative current state + roadmap: **`Atlas_Architecture-AsBuilt_v1.md`**. Below is the original plan (kept for traceability).

**Owner:** Andy Tran (DTO) · **Date:** 30 June 2026 · **Status:** Draft for team → delivered (software scope)
**Builds on:** `UX-Spec_Atlas-Home_v1.md`, `Kickoff_Atlas_Dev-Team.md`
**Scope:** VNG-internal · artifact generation only · five types (Doc/Deck/Sheet/Dashboard/Report)
**Data:** **No data-source dependency.** Artifacts are generated from **prompt + optional user uploads + the model**. All FDL/Trino/masking/identity work is **parked** (see §6).

---

## 0. Sequencing logic (read this first)

We are building the **pure software product** first: the AI-native artifact-generation loop, end to end, with **no governed-data backend**.

**Input to a build = the user's brief + any files they attach.** Grounding comes from the prompt and uploads, not from a connected source. This removes the entire identity → token-exchange → MCP → Trino → masking chain from the critical path, so the whole thing is **one track** and ships fast.

The product loop: **sign in → describe (or pick a template) + optionally attach a file → pick model → build → refine in Studio → save to library.**

> **What this defers:** connecting governed sources, per-user masking, provenance-from-source, refresh-from-source. These return as a later phase (§6). The north-star UX spec keeps the "Connect data sources" affordances; in this build they're **shown as coming-soon or omitted**.

**Cadence:** 2-week sprints. **Roles:** DTO core (web/BFF/runtime/artifact svcs), TSE (model hosting/OpenCode/K8s), BA/steward (templates/validation). *(DA not on the critical path for this plan.)*

---

## 1. Epics

| ID | Epic | Outcome |
|---|---|---|
| **E0** | Spikes & foundations | Model + runtime de-risked; repo + CI |
| **E1** | App shell & Home | Branded web shell, auth, Home per UX spec |
| **E2** | Generation loop | Composer (type/model) + uploads → build → artifact |
| **E5** | Artifact services | Doc / Deck / Sheet / Dashboard / Report generators |
| **E6** | Studio | Chat-left + canvas-right editor; iterate via chat |
| **E7** | Library & persistence | Recent artifacts, retention, regenerate |
| **E8** | Harden & pilot | Sovereignty, a11y, bilingual, autoscale, pilot |
| **E9** | *(Parked)* Data sources & governance | Deferred — see §6 |

---

## 2. User stories

> Format: **ID — title** · *As a … I want … so that …* · **AC** · owner · size (S/M/L) · deps.
> Foundational IDs (`FDL-`/`T`) carried from the kickoff; product IDs use `ATL-`.

### E0 — Spikes & foundations
- **T3 / FDL-3 — OpenCode multi-session isolation spike.** AC: two concurrent users get isolated sessions/context. DTO · M.
- **T4 / FDL-4 — GreenNode model spike.** *As eng, confirm the model can drive artifact generation.* AC: reliable tool-calling + acceptable Vietnamese; default selected (resolves **D3**). TSE · M.
- **ATL-1 — Repo scaffold + CI.** AC: monorepo per kickoff layout (web, bff, runtime config, artifact svc); lint/test/build on PR. DTO · S.

### E1 — App shell & Home
- **FDL-10 — SSO sign-in.** *As a user, I sign in so Atlas knows who I am and keeps my library.* AC: WSO2 OIDC login + sign-out; **stub-able** so the build loop isn't blocked on WSO2. TSE+DTO · M. *(Auth only — not a data-source dependency.)*
- **ATL-10 — App shell + brand.** AC: Strata tokens, **self-hosted fonts (no CDN)**, top bar, left rail, responsive. DTO · M.
- **ATL-11 — Home: hero + composer (static).** AC: greeting + orb; composer input; output-type menu (5 types); send. DTO · M.
- **ATL-12 — Model picker.** *As a user, I pick which GreenNode model runs.* AC: composer + Studio show model selector; default from T4; selection passed to runtime. DTO+TSE · S · dep T4.
- **ATL-13 — Template gallery + tabs.** AC: type filter tabs; template cards (thumb + name + type); Blank card. DTO · M.
- **ATL-14 — Configure overlay.** AC: preview pane per type; chat-to-tailor with applied/quick chips (incl. *In Vietnamese*); Build button. DTO · M · dep ATL-11.

### E2 — Generation loop (input = prompt + uploads)
- **FDL-20 — OpenCode server up.** AC: server-mode runtime reachable from BFF; config-only (no fork). TSE · M.
- **FDL-21 — Per-user agent session.** AC: each signed-in user gets an isolated session. DTO+TSE · M · dep FDL-20, T3.
- **ATL-22 — Generation agent.** *As a user, I get a built artifact from my brief.* AC: configured read-only agent composes an artifact from the prompt/context via an artifact tool call. DTO · M.
- **ATL-15 — Attach / upload input.** *As a user, I attach a file so Atlas builds from my content.* AC: upload (csv/xlsx/doc/text/image) parsed into build context; size/type limits; stored with the session. DTO · M.
- **ATL-20 — Build flow + progress.** AC: composer/overlay → staged build overlay → routes to Studio; build intent persisted. DTO · S.
- **ATL-21 — Generate one artifact (Doc) e2e.** *As a user, brief (+ optional upload) → finished Doc.* AC: composer → GreenNode model → Doc service → rendered/downloadable Doc. **(First demo.)** DTO · L · dep ATL-20, ATL-22, ATL-50.

### E5 — Artifact services (Python, as runtime tools)
- **ATL-50 — Doc generator.** AC: python-docx; branded template; brief/upload in → .docx out. DTO · M.
- **ATL-51 — Sheet generator.** AC: openpyxl; keeps formulas/structure, not dumped values. DTO · M.
- **ATL-52 — Deck generator.** AC: python-pptx; branded board-deck template. DTO · M.
- **ATL-53 — Dashboard (HTML).** AC: charts/tables; self-contained. DTO · M.
- **ATL-54 — Report (HTML).** AC: branded report layout; as-of stamp (from build time). DTO · M.
- **ATL-55 — Templates onboarded.** AC: stewards supply/validate per-type templates (resolves **D6**). BA/steward · M.

### E6 — Studio
- **ATL-60 — Studio shell (chat + canvas).** AC: chat-left, canvas-right; View/Edit toggle; pager + filmstrip; zoom. DTO · L.
- **ATL-61 — Iterate via chat.** *As a user, I refine by asking.* AC: follow-up regenerates/edits the canvas (content/layout/colors). DTO · L · dep ATL-60.
- **ATL-62 — Version history.** AC: snapshots; restore. DTO · M.
- **ATL-63 — Copy in new chat + share.** AC: duplicate to new session; internal share link. DTO · M.

### E7 — Library & persistence
- **ATL-70 — Recent artifacts.** AC: list of user's builds; re-open; re-download. DTO · S.
- **ATL-71 — Artifact storage + retention.** AC: object storage (MinIO); retention policy (resolves **D4**); access scoped to owner. DTO · M.
- **ATL-72 — Regenerate / refresh.** *As a user, re-run a build to refresh it.* AC: re-run with same brief/template/model (and re-uploaded data) → new version. *(Live source-refresh deferred — §6.)* DTO · M.
- **ATL-73 — States.** AC: empty (no artifacts), building, error, oversized/unsupported upload — all designed, friendly. DTO · S.

### E8 — Harden & pilot
- **ATL-80 — Sovereignty check.** AC: no public egress on inference/app paths; assets + fonts self-hosted; secrets from vault. DTO+TSE · M.
- **ATL-81 — A11y + bilingual pass.** AC: focus states, AA contrast; VN/EN shell decision applied. DTO · M.
- **ATL-82 — Autoscale + netpolicy.** TSE · M.
- **ATL-83 — Steward validation + pilot cohort.** AC: artifacts validated vs expectations; 5–10 users (D7). BA/steward · M.

---

## 3. Sprint plan

| Sprint | Theme | Stories | Demo / DoD |
|---|---|---|---|
| **S1** | Spikes & scaffold | T3, T4, ATL-1, FDL-10 | Model + runtime de-risked; repo+CI; user can sign in |
| **S2** | Generation loop | ATL-10, 11, 12, 13, 14, 15, 20, 21, 22; FDL-20, 21; ATL-50 | **Sign in → brief (+upload) → GreenNode model → finished Doc in Studio shell** |
| **S3** | Breadth + Studio | ATL-51, 52, 53, 54, 55; ATL-60, 61 | All five artifact types; refine any artifact by chat in Studio |
| **S4** | Studio depth + Library | ATL-62, 63, 70, 71, 72, 73 | Versions + share; library with recent artifacts; regenerate; states |
| **S5** | Harden + pilot | ATL-80, 81, 82, 83 | Sovereignty + autoscale verified; steward-validated; pilot cohort live |

Timeline ≈ 10 weeks (Jul → early Sep). Faster than the data-coupled plan because Track B is gone.

---

## 4. Dependencies & risks

- **Model quality (T4 / D3) is the single load-bearing risk.** A weak GreenNode model breaks the "burn tokens, get good work" promise regardless of UI. **Gate S2 on T4.**
- **Templates (D6)** gate artifact quality (E5); stewards needed by S3.
- **Sovereignty of inference** still applies — the GreenNode model + app must keep data/prompts inside VNG even with no governed source. Covered by ATL-80.
- **Upload handling (ATL-15)** is now the grounding mechanism — parsing fidelity (xlsx/doc) affects output quality.
- *No* identity/Trino/masking/DA dependencies in this plan.

## 5. Definition of Ready / Done
- **Ready:** AC written, deps green, owner assigned, design referenced.
- **Done (story):** AC met, tests green, reviewed, no public egress on inference/app paths.

---

## 6. Parked — data sources & governance (later phase)

Deliberately **out of scope** for this plan; re-introduced once the artifact product is proven. Tracked so visibility isn't lost:

| ID | Title | Why parked |
|---|---|---|
| T1 / FDL-1 | Trino JWT masking | No governed data in v1 |
| T2 / FDL-2 | WSO2 token exchange (RFC 8693) | No identity propagation needed |
| FDL-15 | BFF validate + token exchange | ″ |
| FDL-30 / 31 | FDL MCP query + provenance | No source to query |
| FDL-60 | Identity propagation verified | No data layer to reach |
| ATL-30 / 31 | Connect data sources + Source selector | UX kept as coming-soon |
| ATL-40 / 41 | Query audit + permission states | Tied to governed data |
| (was ATL-72) | Refreshable report from live source | Returns with data sources |

**When this phase starts**, the architecture from `Architecture_FDL-Assistant_v1.md` (FDL MCP → Trino masked views, end-user identity to Trino, audit) plugs in **behind** the existing Source picker — the software product above it does not change.
