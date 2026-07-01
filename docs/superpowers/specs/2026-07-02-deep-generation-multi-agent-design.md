# Deep Generation (Multi-Agent Depth Tier) — Design

Status: **proposed** (2026-07-02) · Owner: Atlas Platform
Parent: [artifact-platform-program.md](2026-07-01-artifact-platform-program.md) · Toolkit capability #3 ("reasoning-first generation"), made concrete.

## 1. Summary & goal

Today's `direct` generation is one model turn: brief (+ archetype guidance + exemplar) → one `ArtifactContent` JSON → zod-validate → template fallback. It's fast (~2s) but its output can be **generic/boilerplate** — the failure mode a single greedy turn produces.

This design adds an **opt-in "Deep" tier**: a Platform-level, multi-agent (multi-stage) generation pipeline that trades latency/cost for **depth**. The fast single-turn path stays the default and is unchanged; Deep is a per-build toggle (mirroring the existing agent-mode opt-in) that streams its stages through the existing `WorkingSteps` panel and returns the **same `ArtifactContent`** — so canvas, versions, and export are untouched.

**Success:** on a curated eval set, Deep produces a measurable **depth-score lift** over fast (judged against a shared depth rubric), within a bounded latency/cost budget, and **never produces output worse than the fast path** (degrade-safe). No change to the fast path, the per-type module contract (Phase 1), or sovereignty.

**Depth mechanism (chosen):** iterative self-refinement with an adversarial, rubric-anchored critic (`Outline → Draft → Critic → Revise`). Decomposition (parallel per-unit specialists) and a per-type rubric are later phases; the rubric-judge is repurposed as the eval harness.

## 2. Scope

**In (Phase 1):** the `mode: 'deep'` flag; the `deep/pipeline.ts` four-stage pipeline; the shared depth rubric; the degrade-safe fallback ladder + budgets; the offline eval harness (judge). Targets the prose-heavy types first (Doc, Deck).

**Out / later:** per-type decomposition + parallel specialists (Phase 2); per-type/archetype rubric as an optional module field (Phase 3); making Deep a default; grounding/FDL data (separate toolkit capability); the agent/`opencode` tier (Deep is a `direct`-runtime pipeline, not an OpenCode crew).

## 3. Architecture — where it plugs in

One flag, one Platform pipeline, zero downstream change.

- `BuildRequest` gains `mode?: 'fast' | 'deep'` (default `'fast'`). The web surfaces a "Deep" switch beside the agent toggle.
- `generate.ts` `produceContent`: when `mode === 'deep'` and `generationEnabled()`, route to `runDeepPipeline(...)` instead of the single `runModel` call. Everything else in `produceContent` — attachment context, exemplar fetch, archetype resolution, degrade-to-template, `onStage` streaming — stays.
- New Platform module `services/bff/src/deep/pipeline.ts` exports `runDeepPipeline(req, deps, onStage): Promise<{ content: ArtifactContent; degradedReason?: string }>`. It reuses `runModel`, the exemplar/context already fetched, and the per-type module (`shapeHint` + `guidance`) for type-awareness — the same inputs the single turn uses today.
- Output is the **same `ArtifactContent`**; `assemble`, versions, `ArtifactCanvas`, `/export`, and the SSE `WorkingSteps` panel are unchanged. Deep just emits more stage labels (`Outlining…` → `Drafting…` → `Critiquing…` → `Revising…`).
- **Platform-owned**, like the registries — packs never touch it.
- **Sovereignty unchanged** — every stage is a `runModel` call through GreenNode; no new egress.

## 4. The pipeline stages

Four stages; the **critic is the depth lever**, the rest set it up.

1. **Outline** — a *reasoning* call that outputs a **plan, not the artifact**: the units (sections/slides) and, for each, the *specific substance it must carry* (non-obvious points, numbers that matter, "what a domain expert would say that a template wouldn't"). Committing to substance before prose breaks the greedy shallow default. Fed the brief + archetype guidance + exemplar. Output: a lightweight plan (internal; not zod-`ArtifactContent`).
2. **Draft** — generate the full `ArtifactContent` from the outline (zod-validated). Like today's turn, but conditioned on a rich plan.
3. **Critic** — adversarial pass over the draft, anchored to the **shared depth rubric**. Returns **specific, actionable findings, never a score** (e.g. "§3 is boilerplate — an expert would add X/Y"; "these two bullets say nothing"; "table numbers don't tie to the summary"). Rubric-anchoring keeps it consistent and non-sycophantic; a "no material findings" result is the stop signal.
4. **Revise** — regenerate the `ArtifactContent` addressing the findings (zod-validated).

**Loop:** Critic→Revise is **adaptive**: repeat while the critic returns material findings, **hard cap 2 rounds**, and stop early on "no material findings". Also bounded by a wall-clock budget (§6).

## 5. Depth rubric + critic mechanic

- **Shared depth rubric** (Platform-level, one for all types in Phase 1): *specificity* (concrete over generic), *non-obviousness* (insight a template wouldn't have), *quantification* (numbers where the brief supports them, internally consistent), *no filler* (every block earns its place).
- The **critic optimizes to this rubric**; the **eval judge scores against the same rubric** — so "is Deep deeper?" is measured against the exact bar the critic targets.
- **Phase 1 needs no contract change:** the outliner/critic are Platform-level using the module's existing `shapeHint` + `guidance` + the shared rubric. A per-type rubric can become an optional module field later (Phase 3, opt-in). Packs stay untouched.

## 6. Robustness — never worse than fast-path

The pipeline always holds the **best valid `ArtifactContent` so far**; any failure degrades, never hard-fails.

- **Fallback ladder:**
  - Outline call fails → skip to a single-turn draft (today's exact path).
  - Draft fails zod → one self-heal retry with the errors (existing pattern), else template.
  - A critic/revise round fails or returns invalid → **keep the last valid draft** and stop.
  - Output carries the existing `degraded` metadata + reason when a full run didn't complete. Worst case, Deep === fast-path or template.
- **Budgets (reuse the agent-loop pattern):** hard cap on critic rounds (2); a wall-clock budget (abort → return best-so-far); per-stage token caps.
- **Cost is a conscious opt-in:** Deep ≈ 4–6 sequential model calls vs 1; the per-build toggle makes the user choose it; each version records which `mode` produced it (for later comparison).
- **Sequential by nature:** outline→draft→critic→revise is a chain — no parallel orchestration in Phase 1; it fits a normal streamed BFF request. (Parallelism arrives only with Phase 2 decomposition.)

## 7. Eval harness (proving depth)

Depth is subjective; without measurement we can't prove Deep beats fast, tune it, or catch regressions. So a judge ships alongside.

- **Offline, on-demand script** (not in the request path, not CI-blocking — needs a live model, is nondeterministic): for a small **curated eval set** of briefs (a few per type/archetype), generate *both* fast and deep, then a **judge** scores each against the shared depth rubric and reports the **depth-score lift + latency/cost delta**.
- This is the natural home for the `RUBRIC.md` / `EVAL-PROMPTS.md` concept sketched (then reverted) during WS-0 — Platform-level, tied to the critic's rubric.
- **Guardrail:** humans spot-check the eval set so the critic doesn't overfit a rubric that drifts from real quality.

## 8. Testing

- **Unit (mocked `runModel`, like today's tests):** each stage's prompt builder is a pure function → assert prompt shape (à la `prompt.test.ts`). Orchestration is tested by injecting stage outputs and asserting the **fallback ladder**: outline-fails→single-turn; draft-invalid→retry→template; critic-invalid→keep-last-draft; budget-hit→best-so-far; clean-critic→stops-early. No live model.
- **Eval (on-demand):** the judge harness in §7.
- Existing suites stay green; the fast path is unchanged.

## 9. Phased rollout

1. **Phase 1** — the `mode:'deep'` flag + the four-stage `deep/pipeline.ts` + shared rubric + fallback ladder/budgets + eval harness. Prove lift on Doc + Deck. **(This spec's implementation plan.)**
2. **Phase 2** — a per-type `decompose` hook on the module contract + parallel specialists + synthesizer/coherence critic, for long Docs / board Decks (depth-at-scale).
3. **Phase 3** — optional per-type/archetype rubric field (packs opt in).

## 10. Open questions / risks

- **Model reasoning ceiling:** if the base model is shallow, staged prompting helps but has a ceiling; the eval harness tells us how much lift is real before we invest in Phase 2.
- **Critic sycophancy / rubric drift:** mitigated by findings-not-scores, rubric-anchoring, and human spot-checks of the eval set.
- **Latency perception:** 4–6 sequential calls is 10–30s; relies on the `WorkingSteps` streaming to feel alive. If it feels slow, Phase 2's parallelism (or a smaller/faster critic model) is the lever.
- **Where "deep" lives long-term:** Phase 1 is a `direct`-runtime pipeline. If we later want tools/grounding mid-pipeline, some stages might migrate to the `opencode` tier — flagged, not decided.
