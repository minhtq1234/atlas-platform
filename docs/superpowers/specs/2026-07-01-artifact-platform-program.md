# Artifact Platform — Program & Decomposition

Status: **approved decomposition** (2026-07-01) · Owner: Atlas platform
Purpose: structure the "make every artifact type genuinely good" effort so **one team per artifact type can work independently and deeply**, without colliding.

This is a *program map*, not a feature spec. Each workstream below gets its own
`spec → plan → implementation` cycle (superpowers flow).

## 1. Problem

Atlas must produce high-quality artifacts across **five types** — Doc, Deck, Sheet,
Dashboard, Report — and we want a **team per type** to go deep (real archetypes,
exemplars, prompt tuning, renderer + export polish). Today the *shape* of every type
is tangled in a few shared files (`services/bff/src/types.ts`, `prompt.ts`,
`archetypes.ts`), so five teams editing them in parallel would collide constantly.

## 2. Organizing principle

Split the system into two layers connected by **one stable contract**:

- **The Platform** (one core/owner team): the shared engine + contracts + the
  **quality toolkit** every type reuses. Stable substrate; changes rarely.
- **Artifact Packs** (one team per type): a self-contained module that plugs into
  the Platform via the contract. A pack team edits **only its own files** → true
  independence, no cross-team merge coordination beyond the contract.

Renderers (`apps/web/src/artifacts/renderers/<Type>View.tsx`) and Office exports are
already ~per-type; the work is to give schema + prompt + archetypes the same
per-type isolation and formalize the seams.

## 3. The contract — `ArtifactTypeModule`

Each pack implements this; the Platform's registries compose all modules. Frozen by
WS-0 before packs start.

```ts
// services/bff/src/artifacts/<type>/index.ts
export interface ArtifactTypeModule {
  type: ArtifactType;                       // 'Doc' | 'Deck' | 'Sheet' | 'Dashboard' | 'Report'
  schema: z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> } & Record<string, z.ZodTypeAny>>; // raw ZodObject — union member
  shapeHint: string;                        // JSON shape string for generate + revise prompts
  guidance(arch?: Archetype): string;       // steering for the resolved archetype object ('' if none)
  archetypes: Archetype[];                  // type-specific archetypes (team-owned data, e.g. a PRD under Doc)
  exemplarKey: string;                      // tag used to store/retrieve this type's exemplars
}
```

**Composition (Platform-owned registries):**
- BFF: `ArtifactContent = z.discriminatedUnion('kind', [DocContent, …])` built from the
  concrete per-type schemas (mapping over `modules.map(m => m.schema)` collapses the
  inferred type to `{ kind }`-only — the contract widens `schema`); `SHAPE[type] =
  module.shapeHint`; the archetype registry flattens every module's `archetypes`; the
  generate prompt calls `module.guidance(arch)` with the resolved archetype object.
- Web: a renderer registry `type → <Type>View` (formalize what `ArtifactCanvas`
  already switches on).
- Python: an export registry `type → build_<type>(content)`.
- Exemplars: `ExemplarProvider.getExemplar(type, archetypeId)` selects by
  `exemplarKey` (archetype match → type match → none).

**A pack team owns, per layer:**
- `services/bff/src/artifacts/<type>/{schema,prompt,archetypes,index}.ts`
- `apps/web/src/artifacts/renderers/<Type>View.tsx` *(already isolated)*
- `services/artifacts/app/<type>_export.py`
- `exemplars/<type>/…` (their curated gold docs)
- Contract-conformance tests for their module.

Only WS-0 touches the shared engine (registries, pipeline, toolkit). Packs never do.

## 4. Shared quality toolkit (Platform-provided seams; every pack inherits)

These are the "why it feels well-trained" levers, built once in the Platform and
consumed uniformly by all packs. Each is its own sub-spec.

1. **Exemplar library** *(scoped 2026-07-01; WS-0's first toolkit capability)* —
   few-shot injection of gold-standard docs, curated + growable behind an
   `ExemplarProvider` seam; ingested from a gitignored `exemplars/` folder via a
   script that reuses the attachments extractor; stored server-side (sovereignty).
   Proven on the Doc reference pack, then reused by every pack.
2. **Clarify-before-generate** — the generate step asks 2–3 targeted questions to
   gather specifics before building (reuses the skill-runtime clarify pattern).
3. **Reasoning-first generation** — stop forcing JSON-only for reasoning models;
   outline → draft → self-critique as pluggable pipeline stages.
4. **Grounding** — attachments (built) + FDL data layer (parked) as source material.

## 5. Workstreams

### WS-0 · Platform (core team, FIRST — unblocks everyone)
> **Status (2026-07-01): phase-1 landed.** The `ArtifactTypeModule` contract, the per-type
> module refactor behind BFF/web/python registries, and contract tests are built and merged
> (tri-suite green: BFF 55 · web 34 · Python 14; public API unchanged; "add a type = one
> module folder + a couple registry lines"). **Phase-2 (companion plan)** — the exemplar
> toolkit, Doc exemplars/seeds, and the pack authoring guide + module template — is not yet
> built; pack teams are fully unblocked only once it lands.
- Define + freeze the `ArtifactTypeModule` contract.
- Refactor `types.ts` / `prompt.ts` / `archetypes.ts` into per-type modules behind
  registries, keeping the public API (`ArtifactContent`, `SHAPE`, `generateSystem`,
  the archetype registry) stable so `generate`/`skills`/`server` don't change.
- Formalize the web renderer registry and the python export registry.
- Build the **exemplar toolkit** (capability #1) as a Platform seam.
- Ship **Doc as the reference pack** — the worked example every pack copies,
  validating the contract end-to-end (schema + prompt + archetypes + renderer +
  export + exemplar).
- Deliver a **pack authoring guide** + a **module template** + contract tests.

### WS-1…5 · Artifact Packs (parallel, one team each)
Each clones the reference pack's structure against the frozen contract and goes deep:

> **Status (2026-07-01): WS-2 Deck — P0–P1 shipped.** Board + Pitch archetypes, deck
> craft-rule guidance (assertion-style titles, speaker notes), and section/statement
> layouts across schema · renderer · pptx export. Suites green (BFF 63 · web 36 · py 15),
> `tsc` clean, code-reviewed, and live-verified against GreenNode (board + pitch decks).
> Chart slides deferred. Pack docs: `docs/artifact-packs/deck/`; plan:
> `docs/superpowers/plans/2026-07-01-deck-pack-build.md`.

| Pack | Team charter (deepen) |
|---|---|
| **WS-1 Doc** | Archetypes: team-defined archetypes (e.g. PRD, SOW, policy, exec memo). Sectioned-block depth, requirement tables, exemplars, revise flows. |
| **WS-2 Deck** | Slide archetypes: board deck, pitch, QBR. Per-slide layouts, speaker notes, richer slide blocks, exemplars, pptx fidelity. |
| **WS-3 Sheet** | Archetypes: financial model, headcount plan, schedule. Formulas, multi-block tables, exemplars, xlsx fidelity. |
| **WS-4 Dashboard** | KPI/chart archetypes, chart-type variety, tile/series layouts, exemplars. |
| **WS-5 Report** | Recurring-report archetypes, stats + narrative sections, refresh (ties to grounding/FDL later), exemplars. |

## 6. Sequencing & dependencies

1. **WS-0 first** (contract + module refactor + exemplar toolkit + Doc reference
   pack). Nothing else starts until the contract is frozen and the reference pack
   proves it.
2. **WS-1…5 fan out in parallel** — independent, contract-bound, disjoint files.
   (WS-1 Doc is partly done already — it becomes the reference pack.)
3. **Toolkit capabilities #2–#4** (clarify, reasoning, grounding) roll out later as
   Platform stages; every pack inherits them at once, with no per-pack work.

## 7. How independence is enforced (CI / process)

- **Contract tests per module** — each pack proves its module satisfies
  `ArtifactTypeModule`; a Platform "registry composes cleanly" test guarantees the
  union/SHAPE/registries build from all modules.
- **Disjoint file ownership** — CODEOWNERS per `artifacts/<type>/` path; packs never
  edit shared engine files.
- **Frozen contract** — contract changes are a Platform-team decision with a
  migration note; packs pin to a contract version.
- **Reference pack + authoring guide** — every team starts from the same worked
  example, so quality + structure stay consistent without central coordination.

## 8. Deliverables / next steps

- **This doc** = the shared map + boundaries for team leads.
- **Next spec: WS-0 Platform** — folds in the already-scoped exemplar library as its
  first toolkit capability, does the module refactor, and ships Doc as the
  reference pack. (Its own `spec → plan → implementation`.)
- Each pack team then writes its own `spec → plan` against the frozen contract,
  using the reference pack + authoring guide.

## 9. Non-goals (program level)

- Not a heavyweight plugin framework — a typed registry + folder-per-type is enough
  (YAGNI). Don't over-abstract before the second pack proves reuse.
- No new artifact types beyond the five in v1.
- Toolkit capabilities #2–#4 are sequenced after the module split + exemplars; not
  parallelized into the initial fan-out.
