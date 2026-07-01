# WS-0 Platform — Design

Status: **approved** (2026-07-01) · Owner: Atlas platform (core team)
Parent: [artifact-platform-program.md](2026-07-01-artifact-platform-program.md) · Folds in: exemplar library (scoped 2026-07-01)

## 1. Summary & goal

WS-0 is the enabling workstream that lets the five Artifact Pack teams work in
parallel. It delivers:

1. The frozen **`ArtifactTypeModule` contract** + the Platform **registries** that
   compose modules (BFF schema/prompt/archetypes, web renderers, python exports).
2. A **thin migration of all five types** into per-type modules — mechanical,
   public-API-stable — so the registry is uniform and each pack starts from a clean
   module. *(Depth is left to the pack teams; WS-0 only relocates existing code.)*
3. The **exemplar toolkit** (first shared-quality capability): server-side store,
   folder ingest reusing the attachments extractor, `ExemplarProvider` seam,
   injection into generation.
4. **Doc as the deep reference pack** — the worked example every pack copies.
5. A **pack authoring guide** + **module template** + **contract tests**.

**Success:** existing behavior unchanged (suites green: BFF 51 · web 34 · Python 14);
`ArtifactContent`, `SHAPE`, `generateSystem`, the archetype registry keep their public
shape so `generate`/`skills`/`server`/`ArtifactCanvas` don't change; a new type could
be added by dropping one module folder; a Doc generate injects a Doc exemplar.

## 2. The contract (frozen)

```ts
// services/bff/src/artifacts/<type>/index.ts
export interface ArtifactTypeModule {
  type: ArtifactType;                        // 'Doc'|'Deck'|'Sheet'|'Dashboard'|'Report'
  schema: z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> } & Record<string, z.ZodTypeAny>>; // raw ZodObject (union member — NO .refine)
  shapeHint: string;                         // JSON shape string for generate + revise prompts
  guidance(arch?: Archetype): string;        // steering for the RESOLVED archetype object ('' if none); caller resolves via registry archetype(id)
  archetypes: Archetype[];                   // type-specific archetypes (team-owned data, e.g. a PRD under Doc)
  exemplarKey: string;                       // tag to store/retrieve this type's exemplars (default: type.toLowerCase())
}
```

Contract rule: `schema` must be a raw `ZodObject` (so `z.discriminatedUnion('kind', …)`
accepts it) — the "at least one of paragraphs|sections" style rules stay soft
(renderer/generation), never `.refine` on the union member.

## 3. Platform registries (composition)

**BFF — `services/bff/src/artifacts/registry.ts`:**
```ts
export const MODULES: ArtifactTypeModule[] = [doc, deck, sheet, dashboard, report];
// Union is built from the CONCRETE per-type schemas (full type inference). A
// `MODULES.map(m => m.schema)` union would collapse z.infer to `{ kind }`-only, since
// the contract widens `schema` — so the runtime registries use MODULES, but the union
// imports the concrete schemas. (The registry test asserts every MODULES type parses.)
export const ArtifactContent = z.discriminatedUnion('kind', [DocContent, DeckContent, SheetContent, DashboardContent, ReportContent]);
export const SHAPE: Record<ArtifactType,string> = Object.fromEntries(MODULES.map(m => [m.type, m.shapeHint]));
export const ARCHETYPES = /* flatten MODULES[].archetypes + the shared 'general' */;
export const moduleFor = (t: ArtifactType) => MODULES.find(m => m.type === t)!;
```
`types.ts` re-exports `ArtifactContent` (+ `ArtifactType`, `Artifact`, `ArtifactVersion`,
bodies) from the registry so **every existing import keeps working**. `prompt.ts`
`generateSystem` reads `SHAPE`/`moduleFor(type).guidance(arch)`; `skills/prompts.ts`
reads the same `SHAPE` (kills today's duplicated SHAPE map); `archetypes.ts` re-exports
the registry's `ARCHETYPES`/`detectArchetype`/`archetype`.

**Web — `apps/web/src/artifacts/renderers/registry.tsx`** (as-built)**:** exports
`renderArtifact(content, page)` — a `kind` switch mapping each type to its `<Type>View`;
`ArtifactCanvas` delegates to it (keeping `pageCount`/`pageLabel`). Each `<Type>View.tsx`
stays where it is (already per-type).

**Python — `services/artifacts/app/exports/registry.py`** (as-built)**:** `EXPORTERS:
dict[kind → (ext, builder)]` importing the existing `build_doc`/`build_sheet`/`build_deck`
from `docx_builder`/`xlsx_builder`/`pptx_builder` (kept as-is, not renamed); `main.py`
`/export` dispatches via the registry instead of the `if kind==…` chain (415/422 unchanged).

**Adding a 6th type** (beyond the v1 five — a non-goal today) touches, besides the module
folder: the `ArtifactContent` union list + `MODULES` entry (registry), the `ArtifactType`
enums in `services/bff/src/types.ts` and `apps/web/src/types.ts` (and the `z_ArtifactType`
alias in `skills/prompts.ts`), the web renderer switch + a `<Type>View`, and `EXPORTERS`
(if it exports to Office). Small, but more than one line — the enums are the extra bit.

## 4. Thin migration (all 5 types)

Mechanical relocation, no behavior change:
- BFF: for each type, create `artifacts/<type>/{schema.ts, prompt.ts, archetypes.ts, index.ts}`
  by moving that type's existing zod object, its `SHAPE[type]` string, its guidance, and its
  archetypes out of the monolithic files. `index.ts` exports the `ArtifactTypeModule`.
- Doc carries the sectioned schema + a `'general'` archetype (already built); named archetypes
  are team-owned data. Deck/Sheet/Dashboard/Report
  get thin modules (current schema + shapeHint, empty `archetypes`, `guidance` = '').
- The monolithic `types.ts`/`prompt.ts`/`archetypes.ts` shrink to re-export shims (API-stable).

## 5. Exemplar toolkit (first shared-quality capability)

Per the exemplar design (2026-07-01), built as a Platform seam:
- **Store** — `services/artifacts`: `exemplars` table in the existing SQLite (gitignored):
  `{id, type, archetype_id?, title, text, created_at}`. `exemplars.py` mirrors `attachments.py`
  (`store_exemplar`, `retrieve_exemplar(type, archetype_id)` → best match: archetype → type → none).
- **Ingest** — `ingest_exemplars.py`: walks a **gitignored `exemplars/`** folder (subfolder per
  tag: `exemplars/brd/…`, `exemplars/doc/…`), extracts via the existing `extract_text`, stores.
  Endpoints `POST /exemplars` + `POST /exemplars/retrieve` mirror `/attachments`.
- **Provider** — BFF `src/exemplar/provider.ts`: `makeExemplarProvider(artifactsUrl, fetchFn)` →
  `getExemplar(type, archetypeId): Promise<string|null>` (best-effort, null on none/error), mirroring
  `context/provider.ts`.
- **Injection** — `produceContent` fetches the exemplar for `(type, archetypeId)` and passes it to
  `generateUser`, which adds a capped (`~3–4k` chars) `<exemplar>` reference block: *"an excellent
  {label}; match its structure/depth/tone, do NOT copy its content."* Defense-in-depth: exemplar is
  reference-not-instructions. No exemplar → generation identical to today.
- **Seeds + sovereignty** — repo ships 1–2 safe generic exemplars (committed `.md`) so it works
  out-of-the-box; the org's real sourced docs go in the gitignored folder → server-side store →
  never committed.

## 6. Doc reference pack (deep)

Doc's module is the canonical, fully-realized example: sectioned schema + typed blocks (built),
the sectioned Doc + a `'general'` archetype (built; named archetypes are team-owned data),
`<DocView>` sectioned renderer (built), docx sectioned export
(built), plus **Doc exemplars** (a gold general doc, seeded). It is the template pack
teams clone and the proof that the contract is complete end-to-end.

## 7. Authoring guide + template + contract tests

- **`docs/artifact-packs/AUTHORING.md`** — how to add/deepen a pack: implement the module (schema,
  shapeHint, guidance, archetypes), the renderer, the export, drop exemplars, run contract tests.
- **Module template** — a commented skeleton `artifacts/_template/` a team copies.
- **Contract tests** — `registry.test.ts`: every module satisfies `ArtifactTypeModule`
  (has `type`/`schema`/`shapeHint`/`guidance`/`archetypes`/`exemplarKey`; `schema` is a ZodObject with a
  `kind` literal matching `type`); the union/SHAPE/archetype registry compose from all modules;
  `moduleFor` returns each type.

## 8. Backward compatibility / risk

- **Public API stable:** `types.ts`, `prompt.ts` (`generateSystem`/`generateUser`/`shapeHint`),
  `archetypes.ts` keep their exports (re-export shims). `generate.ts`, `skills/*`, `server.ts`,
  `ArtifactCanvas`, renderers, export `/export` behave identically.
- **Refactor is relocation, not rewrite** — guarded by the full existing suites + new contract tests.
  One **accepted, intentional exception:** the SHAPE dedup below.
- **`skills/prompts.ts` SHAPE dedup (accepted behavior change)** — today skills has its own *terser*
  SHAPE strings that differ from `prompt.ts`'s (they drop hints like `(first slide isCover:true)`,
  `(each row length == columns length)`). Pointing skills at the registry SHAPE (= the richer
  `prompt.ts` set) means the **revise** prompt gains those hints — a deliberate, approved improvement,
  not a pure relocation. Verify the revise tests (`runtime.test.ts`) stay green (they assert behavior,
  not prompt text).
- **Python `/export` dispatch** — verify the docx/xlsx/pptx + sectioned-doc tests stay green.

## 9. Testing

- **BFF:** contract-composition + per-module conformance (`registry.test.ts`); `ArtifactContent`
  still parses all 5 kinds (move/extend existing `types.test.ts`); `generateSystem` injects the
  right module guidance + shape; exemplar `ExemplarProvider` no-op (null) + best-effort; injection
  adds `<exemplar>` when present. Existing 51 stay green.
- **Web:** renderer registry maps every kind; `ArtifactCanvas` renders each. Existing 34 green.
- **Python:** `exemplars` store/retrieve (archetype→type→none); `/exemplars` + `/exemplars/retrieve`;
  export registry dispatches each type. Existing 14 green.

## 10. Build order (feeds writing-plans)

1. BFF: `ArtifactTypeModule` type + `artifacts/registry.ts` + thin-migrate the 5 types into
   `artifacts/<type>/` (Doc deep); re-export shims in `types.ts`/`prompt.ts`/`archetypes.ts`; `skills`
   reads registry SHAPE. (+ contract tests)
2. Web: renderer registry + `ArtifactCanvas` dispatch.
3. Python: export registry + `/export` dispatch.
4. Exemplar store + ingest script + `/exemplars`(+retrieve) endpoints (+ py tests).
5. `ExemplarProvider` seam + injection into `generateUser`/`produceContent` (+ bff tests).
6. Doc exemplars + committed safe seeds; a live Doc generate shows exemplar-anchored output.
7. Authoring guide + module template.
8. Full-suite verify + update SPEC + program doc "WS-0 done".

## 11. Non-goals (WS-0)

- No **deepening** of Deck/Sheet/Dashboard/Report (thin modules only — their teams deepen).
- No exemplar **upload UI** (folder+script only; UI is a later cycle).
- Toolkit capabilities **clarify-before-generate** + **reasoning-first** are later Platform stages.
- No new artifact types; no heavyweight plugin framework (typed registry + folder-per-type only).

## 12. Open questions

- **Thin-migrate-all vs Doc-only:** WS-0 migrates all five (thin) so the registry is uniform and
  packs start clean — chosen over Doc-only (which would leave a mixed registry). Flag for review.
- **Export module granularity:** wrap existing `*_builder.py` behind the registry vs rename to
  `<type>_export.py` — decide in the plan; either keeps tests green.
