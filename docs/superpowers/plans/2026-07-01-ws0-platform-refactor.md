# WS-0 Platform Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Atlas's monolithic artifact code into per-type **modules behind registries** that satisfy the frozen `ArtifactTypeModule` contract — so five Artifact Pack teams can each own one type and work independently, with zero behavior change.

**Architecture:** Each artifact type becomes a self-contained **module folder** (`services/bff/src/artifacts/<type>/{schema,prompt,archetypes,index}.ts`) whose `index.ts` exports an `ArtifactTypeModule` (schema + shapeHint + guidance + archetypes + exemplarKey). Folder-per-type (not a single `<type>.ts`) so a pack team owns a clean directory and CODEOWNERS globs on `artifacts/<type>/`. A BFF registry composes the modules into the existing `ArtifactContent` union / `SHAPE` map / archetype registry; `types.ts`/`prompt.ts`/`archetypes.ts` become thin re-export shims so **every existing import keeps working**. Web gets a renderer registry, Python an export registry. Doc is the deep reference; the other four are mechanical relocations.

**Tech Stack:** BFF = Node + TS + zod + vitest. Web = React + vitest. Export = Python + pytest. Companion (separate plan): the exemplar toolkit (WS-0 spec §5).

**Success:** existing suites stay green (BFF 51 · web 34 · Python 14); `ArtifactContent`, `SHAPE`, `generateSystem`, `shapeHint`, `ARCHETYPES`/`detectArchetype`/`archetype` keep their public shape; a new type = one new module folder + one registry line.

---

## Design invariants
- **Behavior-preserving.** This is relocation, not redesign. After each task the full suites must be green. The public exports of `types.ts`, `prompt.ts`, `archetypes.ts` are unchanged (re-export shims).
- **Contract rule.** A module's `schema` must be a raw `z.ZodObject` (discriminated-union member — no `.refine`).
- **Doc is deep, the other four are thin.** Move existing code verbatim; don't "improve" Deck/Sheet/Dashboard/Report here — that's their pack team's job.
- **Registry is the only new shared file.** Packs later edit only their `artifacts/<type>/` folder + renderer + export + exemplars.
- **Accepted behavior change (SHAPE dedup).** `skills/prompts.ts` today has its own terser SHAPE strings that DIFFER from `prompt.ts`'s (they drop hints like `(first slide isCover:true)`, `(each row length == columns length)`). Task 6 points skills at the registry SHAPE (= the richer `prompt.ts` strings), so the **revise** prompt gains those hints. This is a deliberate, approved improvement — the only intentional non-relocation in WS-0. Suites stay green (`runtime.test.ts` asserts behavior, not prompt text).

## File structure (BFF) — folder-per-type
- Create `services/bff/src/artifacts/module.ts` — `ArtifactTypeModule` interface + `Archetype` interface (moved from `archetypes.ts`). Stays at the `artifacts/` root (shared contract, Platform-owned).
- Create `services/bff/src/artifacts/doc/` — the deep reference pack, four files:
  - `schema.ts` — `Block`/`Section`/`DocContent` (moved from `types.ts`).
  - `prompt.ts` — `shapeHint` string + `guidance(archetypeId, archetypes)`.
  - `archetypes.ts` — the `general` archetype (`archetypes: Archetype[]`).
  - `index.ts` — assembles + exports `docModule: ArtifactTypeModule`.
- Create `services/bff/src/artifacts/{deck,sheet,dashboard,report}/` — each the same four files: `schema.ts` (the type's zod object), `prompt.ts` (`shapeHint` + `guidance = () => ''`), `archetypes.ts` (`archetypes: [] `), `index.ts` (the module).
- Create `services/bff/src/artifacts/registry.ts` — `MODULES`, `ArtifactContent`, `SHAPE`, `ARCHETYPES`, `detectArchetype`, `archetype`, `moduleFor`. Root-level, Platform-owned.
- Create `services/bff/src/artifacts/registry.test.ts` — contract-conformance + composition tests. Root-level.
- Modify `services/bff/src/types.ts` — re-export `ArtifactContent` from registry; keep `ArtifactType`/`UploadRef`/`BuildRequest`/bodies/`Artifact`/`ArtifactVersion`.
- Modify `services/bff/src/prompt.ts` — `generateSystem`/`shapeHint` read the registry.
- Modify `services/bff/src/skills/prompts.ts` — its `SHAPE` reads the registry (accepted dedup, above).
- Modify `services/bff/src/archetypes.ts` — re-export from registry.
- Create `apps/web/src/artifacts/renderers/registry.tsx` + rewire `ArtifactCanvas.tsx`.
- Create `services/artifacts/app/exports/__init__.py` (empty) + `services/artifacts/app/exports/registry.py` + rewire `main.py` `/export`.

---

## Task 1: The contract (`ArtifactTypeModule` + `Archetype`)

**Files:** Create `services/bff/src/artifacts/module.ts`

- [ ] **Step 1: Create `services/bff/src/artifacts/module.ts`:**

```ts
import type { z } from 'zod';
import type { ArtifactType } from '../types';

/** A curated document archetype (team-owned data; the registry ships only `general`). */
export interface Archetype {
  id: string;
  label: string;
  aliases: string[];
  sections: string[];
  guidance: string;
}

/**
 * One artifact type as a self-contained module. Pack teams implement this; the
 * Platform registry composes all modules. `schema` MUST be a raw ZodObject (it is
 * a discriminated-union member).
 */
export interface ArtifactTypeModule {
  type: ArtifactType;
  schema: z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> } & Record<string, z.ZodTypeAny>>;
  shapeHint: string;
  guidance(archetypeId?: string): string;
  archetypes: Archetype[];
  exemplarKey: string;
}
```

- [ ] **Step 2: Typecheck** — `cd services/bff && npm run typecheck` → PASS (no consumers yet).
- [ ] **Step 3: Commit** — `git add services/bff/src/artifacts/module.ts && git commit -m "feat(platform): ArtifactTypeModule + Archetype contract"`

---

## Task 2: Doc module (the deep reference)

**Files:** Create `services/bff/src/artifacts/doc/{schema,prompt,archetypes,index}.ts`

Move code verbatim out of the monolith into the four-file folder. `schema.ts` gets `Block`/`Section`/`DocContent` from `types.ts`; `prompt.ts` gets `SHAPE.Doc` from `prompt.ts` + the guidance builder from today's `generateSystem` Doc branch; `archetypes.ts` gets the `general` archetype from `archetypes.ts`; `index.ts` assembles the module.

- [ ] **Step 1: `services/bff/src/artifacts/doc/schema.ts`:**

```ts
import { z } from 'zod';

export const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().max(4000) }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('numbers'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('table'), columns: z.array(z.string().max(120)).min(1).max(8), rows: z.array(z.array(z.string().max(400)).max(8)).max(100) }),
  z.object({ type: z.literal('callout'), value: z.string().max(200), label: z.string().max(120) }),
  z.object({ type: z.literal('bars'), label: z.string().max(120).optional(), bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50) }),
]);
export const Section = z.object({ heading: z.string().max(200), blocks: z.array(Block).max(40) });

export const DocContent = z.object({
  kind: z.literal('Doc'),
  eyebrow: z.string(),
  title: z.string(),
  meta: z.string(),
  paragraphs: z.array(z.string()).max(200).optional(),
  sections: z.array(Section).max(30).optional(),
  bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50).optional(),
  barsLayout: z.enum(['vertical', 'horizontal']).optional(),
  callout: z.object({ value: z.string(), label: z.string() }).optional(),
});
```

- [ ] **Step 2: `services/bff/src/artifacts/doc/prompt.ts`:**

```ts
import type { Archetype } from '../module';

export const shapeHint = `{"kind":"Doc","eyebrow":string,"title":string,"meta":string, and EITHER "paragraphs":string[] (a short memo) OR "sections":[{"heading":string,"blocks":[{"type":"paragraph","text":string}|{"type":"bullets","items":string[]}|{"type":"numbers","items":string[]}|{"type":"table","columns":string[],"rows":string[][]}|{"type":"callout","value":string,"label":string}|{"type":"bars","label":string?,"bars":[{"label":string,"value":number 0..1}]}]}] (a structured document). Only add a "bars" block when the brief has real quantitative data.}`;

/** Type/archetype steering appended to the prompt ('' when none). */
export function guidance(archetypeId: string | undefined, archetypes: Archetype[]): string {
  const a = archetypes.find((x) => x.id === archetypeId);
  if (!a || !a.sections.length) return '';
  return `Use these sections in order: ${a.sections.join('; ')}.\n${a.guidance}`;
}
```

- [ ] **Step 3: `services/bff/src/artifacts/doc/archetypes.ts`:**

```ts
import type { Archetype } from '../module';

export const archetypes: Archetype[] = [
  {
    id: 'general', label: 'Document', aliases: [], sections: [],
    guidance: 'Structure the document into the logical sections that best fit the request.',
  },
];
```

- [ ] **Step 4: `services/bff/src/artifacts/doc/index.ts`:**

```ts
import type { ArtifactTypeModule } from '../module';
import { DocContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const docModule: ArtifactTypeModule = {
  type: 'Doc',
  schema: DocContent,
  shapeHint,
  archetypes,
  exemplarKey: 'doc',
  guidance: (archetypeId) => guidance(archetypeId, archetypes),
};
```

- [ ] **Step 5: Typecheck** — `cd services/bff && npm run typecheck` → PASS.
- [ ] **Step 6: Commit** — `git add services/bff/src/artifacts/doc && git commit -m "feat(platform): Doc module (deep reference)"`

---

## Task 3: Deck / Sheet / Dashboard / Report modules (thin, mechanical)

**Files:** Create `services/bff/src/artifacts/{deck,sheet,dashboard,report}/{schema,prompt,archetypes,index}.ts`

Each thin module is the same four-file folder as Doc, but with an empty archetype list and no guidance. Move each type's zod object out of `types.ts` verbatim (`schema.ts`), copy its `SHAPE[type]` string from `prompt.ts` (`prompt.ts`), ship `archetypes: []` (`archetypes.ts`), assemble in `index.ts`. Example — the `deck/` folder (do the analogous folder for sheet/dashboard/report):

- [ ] **Step 1: `services/bff/src/artifacts/deck/schema.ts`:**

```ts
import { z } from 'zod';

export const Slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(30).optional(),
  isCover: z.boolean().optional(),
  subtitle: z.string().optional(),
});
export const DeckContent = z.object({
  kind: z.literal('Deck'),
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(Slide).min(1).max(100),
});
```

- [ ] **Step 2: `services/bff/src/artifacts/deck/prompt.ts`:**

```ts
export const shapeHint = `{"kind":"Deck","eyebrow":string,"title":string,"subtitle":string,"slides":[{"title":string,"bullets":string[]?,"isCover":boolean?,"subtitle":string?}] (first slide isCover:true)}`;
export const guidance = (): string => '';
```

- [ ] **Step 3: `services/bff/src/artifacts/deck/archetypes.ts`:**

```ts
import type { Archetype } from '../module';
export const archetypes: Archetype[] = [];
```

- [ ] **Step 4: `services/bff/src/artifacts/deck/index.ts`:**

```ts
import type { ArtifactTypeModule } from '../module';
import { DeckContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const deckModule: ArtifactTypeModule = {
  type: 'Deck',
  schema: DeckContent,
  shapeHint,
  archetypes,
  exemplarKey: 'deck',
  guidance,
};
```

- [ ] **Step 5: Repeat for sheet / dashboard / report** — identical four-file pattern, copying the exact zod object and shapeHint string:
  - `sheet/` — `SheetContent` (types.ts:46-51), shapeHint (prompt.ts:8), `exemplarKey: 'sheet'`.
  - `dashboard/` — `DashboardContent` (types.ts:53-62), shapeHint (prompt.ts:9), `exemplarKey: 'dashboard'`.
  - `report/` — `ReportContent` (types.ts:64-71), shapeHint (prompt.ts:10), `exemplarKey: 'report'`.

- [ ] **Step 6: Typecheck** — `cd services/bff && npm run typecheck` → PASS.
- [ ] **Step 7: Commit** — `git add services/bff/src/artifacts/{deck,sheet,dashboard,report} && git commit -m "feat(platform): thin Deck/Sheet/Dashboard/Report modules"`

---

## Task 4: The registry

**Files:** Create `services/bff/src/artifacts/registry.ts`

- [ ] **Step 1: Create `services/bff/src/artifacts/registry.ts`:**

```ts
import { z } from 'zod';
import type { ArtifactType } from '../types';
import type { ArtifactTypeModule, Archetype } from './module';
import { docModule } from './doc';
import { deckModule } from './deck';
import { sheetModule } from './sheet';
import { dashboardModule } from './dashboard';
import { reportModule } from './report';

export const MODULES: ArtifactTypeModule[] = [docModule, deckModule, sheetModule, dashboardModule, reportModule];

export const ArtifactContent = z.discriminatedUnion(
  'kind',
  MODULES.map((m) => m.schema) as unknown as [z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> }>, ...z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> }>[]],
);
export type ArtifactContent = z.infer<typeof ArtifactContent>;

export const SHAPE = Object.fromEntries(MODULES.map((m) => [m.type, m.shapeHint])) as Record<ArtifactType, string>;

export function moduleFor(type: ArtifactType): ArtifactTypeModule {
  return MODULES.find((m) => m.type === type)!;
}

/** All archetypes across modules, keyed by id (always includes the shared `general`). */
export const ARCHETYPES: Record<string, Archetype> = Object.fromEntries(
  MODULES.flatMap((m) => m.archetypes).map((a) => [a.id, a]),
);

export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of Object.values(ARCHETYPES)) {
    if (a.aliases.length && a.aliases.some((alias) => b.includes(alias))) return a.id;
  }
  return 'general';
}
export function archetype(id?: string): Archetype {
  return (id && ARCHETYPES[id]) || ARCHETYPES.general;
}
```

- [ ] **Step 2: Typecheck** — `cd services/bff && npm run typecheck` → PASS. (If the discriminated-union cast complains, the `as unknown as [...]` tuple cast in Step 1 is the fix — zod needs a non-empty tuple type.)
- [ ] **Step 3: Commit** — `git add services/bff/src/artifacts/registry.ts && git commit -m "feat(platform): artifact module registry (union/SHAPE/archetypes)"`

---

## Task 5: Contract tests

**Files:** Create `services/bff/src/artifacts/registry.test.ts`

- [ ] **Step 1: Write the tests:**

```ts
import { describe, it, expect } from 'vitest';
import { MODULES, ArtifactContent, SHAPE, moduleFor, ARCHETYPES, detectArchetype, archetype } from './registry';

describe('artifact module registry', () => {
  it('has all five types, each conforming to the contract', () => {
    const types = MODULES.map((m) => m.type).sort();
    expect(types).toEqual(['Dashboard', 'Deck', 'Doc', 'Report', 'Sheet']);
    for (const m of MODULES) {
      expect(typeof m.shapeHint).toBe('string');
      expect(typeof m.guidance).toBe('function');
      expect(Array.isArray(m.archetypes)).toBe(true);
      expect(typeof m.exemplarKey).toBe('string');
      // schema's kind literal matches the module type
      expect(m.schema.shape.kind._def.value).toBe(m.type);
    }
  });
  it('composes a union that parses every kind', () => {
    expect(ArtifactContent.safeParse({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] }).success).toBe(true);
    expect(ArtifactContent.safeParse({ kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's', slides: [{ title: 'c', isCover: true }] }).success).toBe(true);
  });
  it('SHAPE + moduleFor cover every type', () => {
    for (const m of MODULES) { expect(SHAPE[m.type]).toBe(m.shapeHint); expect(moduleFor(m.type)).toBe(m); }
  });
  it('archetype registry ships only general; detection falls back', () => {
    expect(Object.keys(ARCHETYPES)).toEqual(['general']);
    expect(detectArchetype('anything at all')).toBe('general');
    expect(archetype('nope').id).toBe('general');
  });
});
```

- [ ] **Step 2: Run — PASS** — `cd services/bff && npx vitest run src/artifacts/registry.test.ts`
- [ ] **Step 3: Commit** — `git add services/bff/src/artifacts/registry.test.ts && git commit -m "test(platform): registry contract + composition"`

---

## Task 6: Rewire BFF shims (types / prompt / skills / archetypes)

**Files:** Modify `services/bff/src/types.ts`, `prompt.ts`, `skills/prompts.ts`, `archetypes.ts`

- [ ] **Step 1: `types.ts`** — delete the moved schemas (Block, Section, DocContent, Slide, DeckContent, SheetContent, DashboardContent, ReportContent, and the inline `ArtifactContent` union). Replace with a re-export from the registry, keeping everything else (`ArtifactType`, `UploadRef`, `BuildRequest`, bodies, `Artifact`, `ArtifactVersion`) exactly as-is:

```ts
export { ArtifactContent } from './artifacts/registry';
export type { ArtifactContent } from './artifacts/registry';
```
(Place these where the union used to be. `ReviseBody` references `ArtifactContent` — keep it after the re-export so the reference resolves.)

- [ ] **Step 2: `prompt.ts`** — replace the local `SHAPE` map + the Doc-specific `if` in `generateSystem` with the registry:

```ts
import { SHAPE, moduleFor } from './artifacts/registry';
import type { Archetype } from './artifacts/module';
// remove the local SHAPE const
export const shapeHint = (type: ArtifactType): string => SHAPE[type];
export function generateSystem(type: ArtifactType, lang: 'en' | 'vi', arch?: Archetype): string {
  const g = moduleFor(type).guidance(arch?.id);
  const lines = [
    'You are Atlas, an assistant that composes finished, on-brand business artifacts for VNG back-office teams.',
    `Produce a ${arch && arch.id !== 'general' && type === 'Doc' ? arch.label : type}. Respond with ONLY a single JSON object — no markdown, no prose — matching exactly this shape:`,
    SHAPE[type],
  ];
  if (g) lines.push(g);
  lines.push('Keep content concise, realistic, and professional. Numbers should be internally consistent.');
  lines.push(INJECTION_NOTE);
  lines.push(lang === 'vi' ? 'Write all human-readable text in Vietnamese.' : 'Write all human-readable text in English.');
  return lines.join('\n');
}
```
(Keep `INJECTION_NOTE` + `generateUser` unchanged.)

- [ ] **Step 3: `skills/prompts.ts`** — delete its local `SHAPE` map; `import { SHAPE } from '../artifacts/registry';` and use it where `SHAPE[type]` is referenced. (Its `z_ArtifactType` local type stays.) **Accepted behavior change:** the registry SHAPE is the richer `prompt.ts` set, so the revise prompt now carries hints the old terser skills strings dropped (`(first slide isCover:true)`, `(each row length == columns length)`, etc.). This is the deliberate dedup approved for WS-0 — verify `runtime.test.ts` stays green (it asserts behavior, not prompt text).

- [ ] **Step 4: `archetypes.ts`** — replace its body with a re-export:
```ts
export type { Archetype } from './artifacts/module';
export { ARCHETYPES, detectArchetype, archetype } from './artifacts/registry';
```

- [ ] **Step 5: Full BFF suite** — `cd services/bff && npm run typecheck && npx vitest run` → **all green** (existing 51 + registry 4). Every existing import (`generate.ts`, `server.ts`, `skills/*`, `agent/*`) resolves unchanged.
- [ ] **Step 6: Commit** — `git add services/bff/src && git commit -m "refactor(platform): types/prompt/skills/archetypes read the registry (API-stable)"`

---

## Task 7: Web renderer registry

**Files:** Create `apps/web/src/artifacts/renderers/registry.tsx` · Modify `apps/web/src/artifacts/ArtifactCanvas.tsx`

- [ ] **Step 1: Create `apps/web/src/artifacts/renderers/registry.tsx`:**

```tsx
import type { ArtifactContent } from '../../types';
import { DocView } from './DocView';
import { DeckView } from './DeckView';
import { SheetView } from './SheetView';
import { DashboardView } from './DashboardView';
import { ReportView } from './ReportView';

/** kind → renderer. A pack team registers its type here (+ ships its <Type>View). */
export function renderArtifact(content: ArtifactContent, page: number) {
  switch (content.kind) {
    case 'Doc': return <DocView c={content} />;
    case 'Deck': return <DeckView c={content} slide={page} />;
    case 'Sheet': return <SheetView c={content} />;
    case 'Dashboard': return <DashboardView c={content} />;
    case 'Report': return <ReportView c={content} />;
  }
}
```

- [ ] **Step 2: `ArtifactCanvas.tsx`** — replace the inline `switch` in `ArtifactCanvas` with `return renderArtifact(content, page);` and `import { renderArtifact } from './renderers/registry';`. Keep `pageCount`/`pageLabel`.

- [ ] **Step 3: Verify** — `cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx vite build 2>&1 | tail -3` → clean, 34 green, builds.
- [ ] **Step 4: Commit** — `git add apps/web/src/artifacts && git commit -m "refactor(platform): web renderer registry"`

---

## Task 8: Python export registry

**Files:** Create `services/artifacts/app/exports/registry.py` · Modify `services/artifacts/app/main.py`

- [ ] **Step 0: Create the package** — `services/artifacts/app/exports/__init__.py` (empty file), so `from .exports.registry import EXPORTERS` resolves.
- [ ] **Step 1: Create `services/artifacts/app/exports/registry.py`** — map each Office kind to its builder + extension (from `main.py`'s `KIND_EXT` + the `if kind ==` chain):

```python
from ..docx_builder import build_doc
from ..xlsx_builder import build_sheet
from ..pptx_builder import build_deck

# kind -> (extension, builder(content, name) -> bytes)
EXPORTERS = {
    "Doc": ("docx", build_doc),
    "Sheet": ("xlsx", build_sheet),
    "Deck": ("pptx", build_deck),
}
```

- [ ] **Step 2: `main.py` `/export`** — replace the `KIND_EXT`/`if kind==` block with a registry lookup, keeping the 415 (HTML kinds), the 422 (ValueError), and the disposition/media-type behavior identical:

```python
from .exports.registry import EXPORTERS
# in export():
entry = EXPORTERS.get(req.content.kind)
if not entry:
    raise HTTPException(status_code=415, detail=f"{req.content.kind} exports as HTML (handled client-side), not an Office file.")
ext, builder = entry
try:
    data = builder(req.content, req.name)
except ValueError as e:
    raise HTTPException(status_code=422, detail=f"Could not build {req.content.kind}: {e}")
return Response(content=data, media_type=MIME[ext], headers={"Content-Disposition": _disposition(req.name, ext)})
```
(Keep `MIME`, `_disposition`, `_filename` as-is.)

- [ ] **Step 3: Verify** — `cd services/artifacts && . .venv/bin/activate && python -m pytest -q` → 14 green (docx/xlsx/pptx + sectioned-doc export unchanged).
- [ ] **Step 4: Commit** — `git add services/artifacts/app && git commit -m "refactor(platform): python export registry"`

---

## Task 9: Verify + docs

**Files:** Modify `SPEC.md`, `docs/superpowers/specs/2026-07-01-artifact-platform-program.md`

- [ ] **Step 1: Full tri-suite** — BFF (`npm run typecheck && npx vitest run`), web (`npx tsc --noEmit && npx vitest run`), python (`pytest -q`). All green.
- [ ] **Step 2: Prove the seam** — a new type would be added by dropping `artifacts/<type>.ts` + one line in `registry.ts` `MODULES` + a renderer + an exporter. Note this in `SPEC.md` §5 (a one-liner: "artifact types are per-type modules behind a registry; see the program doc").
- [ ] **Step 3: Program doc** — mark WS-0 phase-1 (module refactor + registries + contract) as landed; note the exemplar toolkit is the phase-2 plan.
- [ ] **Step 4: Commit + merge** — secret-guard, then merge the branch to `main` (matches prior flow).

---

## Self-review

**Spec coverage (WS-0 §2–§4, §7–§10):** contract → Task 1; registries → Tasks 4,7,8; thin-migrate all 5 → Tasks 2,3; API-stable shims → Task 6; contract tests → Task 5; Doc deep reference → Task 2. **The exemplar toolkit (§5) + Doc exemplars/seeds (§6) + authoring guide (§7) are a SEPARATE companion plan** (they're additive and mirror the built attachments pattern) — flagged, not dropped.

**Placeholder scan:** Deck/Sheet/Dashboard/Report modules (Task 3) show the full `deck/` four-file folder + exact source line refs for the other three (pure verbatim relocation of code quoted in this session) — the executor copies the exact zod objects/shapeHints from `types.ts`/`prompt.ts` into `schema.ts`/`prompt.ts`. No TBD/soft steps.

**Accepted deviation from "pure relocation":** one intentional behavior change — the `skills/prompts.ts` SHAPE dedup (Task 6 Step 3), which enriches the revise prompt. Approved for WS-0; called out in the design invariants + Task 6. Everything else is byte-for-byte relocation.

**Type consistency:** `ArtifactTypeModule` (module.ts) fields — `type/schema/shapeHint/guidance/archetypes/exemplarKey` — are used identically in every module + the registry + the contract test. `ArtifactContent`/`SHAPE`/`moduleFor`/`ARCHETYPES`/`detectArchetype`/`archetype` are defined once (registry) and re-exported by the shims; consumers unchanged.

**Scope:** behavior-preserving refactor, one coherent increment (the unblocker). Exemplar toolkit deliberately deferred to its own plan.
