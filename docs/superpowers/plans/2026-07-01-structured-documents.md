# Structured Documents (BRD-first) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Atlas produce real structured business documents (BRD first) — a sectioned `Doc` model with typed blocks, a curated archetype registry with auto-detection, and an editable document-type chip — instead of a flat generic memo.

**Architecture:** Evolve `Doc` with an optional `sections[]` (headings + typed blocks: paragraph/bullets/numbers/table/callout/bars); a `Doc` renders sectioned when `sections` present, else the existing flat memo. A data-only archetype registry (BRD + General) drives an archetype-aware generate prompt; detection from the brief surfaces an editable chip. Charts are now an explicit `bars` block (no more padding an empty field).

**Tech Stack:** BFF = Node + Fastify + zod + vitest. Web = React + Zustand + vitest. Export = Python + python-docx + pytest. Reuses `renderInline`, the resilient engine, the skill runtime, and the export service.

---

## Design invariants (read before starting)
- **Backward compatible.** Existing flat Docs (no `sections`) render, generate, and export exactly as today. `paragraphs` becomes optional; the renderer/export guard for `undefined`.
- **No zod `.refine` on `DocContent`.** It's a member of the `ArtifactContent` discriminated union (which requires raw `ZodObject`s), so the "has paragraphs or sections" rule is enforced softly (generation always produces one; renderer handles empty gracefully) — not via a refine.
- **Charts are intentional.** A chart only renders if the model emits a `bars` block. The BRD guidance forbids inventing charts.
- **Archetypes are Doc-scoped and data-driven.** Adding PRD/SOW later = a registry entry, no code.
- **Schema mirrored in 3 layers** — keep `apps/web/src/types.ts`, `services/bff/src/types.ts` (zod), `services/artifacts/app/models.py` (pydantic) in sync.

## File structure

**Create:**
- `services/bff/src/archetypes.ts` — registry + `detectArchetype` + `archetype()` (+ test `archetypes.test.ts`)
- `apps/web/src/data/archetypes.ts` — light web mirror (id/label/aliases + `detectArchetype`) (+ test)
- `apps/web/src/artifacts/renderers/SectionedDoc.tsx` — sectioned renderer + per-block sub-renderers

**Modify:**
- `services/bff/src/types.ts` — `Block`, `Section`, `Doc.sections`, `paragraphs` optional, `BuildRequest.archetypeId`
- `apps/web/src/types.ts` — mirror `Block`/`Section`/`Doc`
- `services/artifacts/app/models.py` — mirror `Block`/`Section`/`Doc`
- `services/bff/src/prompt.ts` — sectioned `SHAPE.Doc`, archetype-aware `generateSystem`/`generateUser`/`shapeHint`
- `services/bff/src/generate.ts` — resolve archetype in `produceContent`, pass to prompt
- `services/bff/src/skills/prompts.ts` — sectioned `SHAPE.Doc` for revise
- `apps/web/src/artifacts/renderers/DocView.tsx` — branch to `SectionedDoc` when `sections` present; guard flat `paragraphs`
- `services/artifacts/app/docx_builder.py` — render `sections` in `build_doc`
- `apps/web/src/store/useAppStore.ts` — `archetypeId` + `setArchetype`; `composerRequest` includes it
- `apps/web/src/components/Composer.tsx` — document-type chip (Doc only)
- `SPEC.md` — feature status

---

## Task 1: Sectioned schema (BFF zod)

**Files:** Modify `services/bff/src/types.ts` · Test `services/bff/src/types.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `services/bff/src/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ArtifactContent } from './types';

const sectioned = {
  kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm',
  sections: [
    { heading: 'Purpose', blocks: [{ type: 'paragraph', text: 'Why.' }] },
    { heading: 'Requirements', blocks: [
      { type: 'table', columns: ['ID', 'Requirement', 'Priority'], rows: [['FR-1', 'Login', 'High']] },
      { type: 'bullets', items: ['a', 'b'] },
    ] },
  ],
};

describe('DocContent sectioned', () => {
  it('accepts a sectioned Doc', () => {
    const r = ArtifactContent.safeParse(sectioned);
    expect(r.success).toBe(true);
  });
  it('still accepts a flat memo (paragraphs only)', () => {
    const r = ArtifactContent.safeParse({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown block type', () => {
    const bad = { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', sections: [{ heading: 'H', blocks: [{ type: 'video', src: 'x' }] }] };
    expect(ArtifactContent.safeParse(bad).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`sections` not in schema)

Run: `cd services/bff && npx vitest run src/types.test.ts`
Expected: FAIL (sectioned parse false / unknown-block parse true).

- [ ] **Step 3: Add `Block` + `Section` and extend `DocContent`.** In `services/bff/src/types.ts`, immediately BEFORE `export const DocContent = z.object({`:

```ts
export const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().max(4000) }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('numbers'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('table'), columns: z.array(z.string().max(120)).min(1).max(8), rows: z.array(z.array(z.string().max(400)).max(8)).max(100) }),
  z.object({ type: z.literal('callout'), value: z.string().max(200), label: z.string().max(120) }),
  z.object({ type: z.literal('bars'), label: z.string().max(120).optional(), bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50) }),
]);
export const Section = z.object({ heading: z.string().max(200), blocks: z.array(Block).max(40) });
```

Then in `DocContent`, change the `paragraphs` line to optional and add `sections` after it:

```ts
  paragraphs: z.array(z.string()).max(200).optional(),
  sections: z.array(Section).max(30).optional(),
```

(Leave `bars`/`barsLayout`/`callout` as-is.)

- [ ] **Step 4: Run — expect PASS**

Run: `cd services/bff && npx vitest run src/types.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Run the whole BFF suite** (paragraphs-optional must not break generate/skills)

Run: `cd services/bff && npx vitest run`
Expected: all green (existing template Docs set `paragraphs`, still valid).

- [ ] **Step 6: Commit**

```bash
git add services/bff/src/types.ts services/bff/src/types.test.ts
git commit -m "feat(doc): sectioned Doc schema — Block/Section, optional paragraphs (bff)"
```

---

## Task 2: Mirror schema in web + python

**Files:** Modify `apps/web/src/types.ts`, `services/artifacts/app/models.py` · Test `services/artifacts/tests/test_models.py` (or existing test file)

- [ ] **Step 1: Web types.** In `apps/web/src/types.ts`, add before `export interface DocContent {`:

```ts
export type DocBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbers'; items: string[] }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'callout'; value: string; label: string }
  | { type: 'bars'; label?: string; bars: { label: string; value: number }[] };
export interface DocSection { heading: string; blocks: DocBlock[] }
```

Then in `DocContent`, change `paragraphs: string[];` to optional and add `sections`:

```ts
  paragraphs?: string[];
  sections?: DocSection[];
```

- [ ] **Step 2: Python models.** In `services/artifacts/app/models.py`, add block/section models before `class DocContent`:

```python
class TableBlock(BaseModel):
    type: Literal["table"]
    columns: list[str]
    rows: list[list[str]]

class TextBlock(BaseModel):
    type: Literal["paragraph"]
    text: str

class ListBlock(BaseModel):
    type: Literal["bullets", "numbers"]
    items: list[str]

class CalloutBlock(BaseModel):
    type: Literal["callout"]
    value: str
    label: str

class BarsBlock(BaseModel):
    type: Literal["bars"]
    label: str | None = None
    bars: list[Bar]

Block = Union[TextBlock, ListBlock, TableBlock, CalloutBlock, BarsBlock]

class Section(BaseModel):
    heading: str
    blocks: list[Block]
```

Then in `DocContent`, make `paragraphs` optional and add `sections`:

```python
    paragraphs: list[str] | None = Field(default=None, max_length=200)
    sections: list[Section] | None = Field(default=None, max_length=30)
```

- [ ] **Step 3: Python test.** Add to `services/artifacts/tests/test_models.py` (create if absent, mirroring existing test style):

```python
from app.models import DocContent

def test_doc_accepts_sections():
    d = DocContent.model_validate({
        "kind": "Doc", "eyebrow": "E", "title": "T", "meta": "m",
        "sections": [{"heading": "Purpose", "blocks": [
            {"type": "paragraph", "text": "why"},
            {"type": "table", "columns": ["ID", "Req"], "rows": [["FR-1", "Login"]]},
        ]}],
    })
    assert d.sections and d.sections[0].heading == "Purpose"

def test_doc_still_accepts_flat():
    d = DocContent.model_validate({"kind": "Doc", "eyebrow": "E", "title": "T", "meta": "m", "paragraphs": ["p"]})
    assert d.paragraphs == ["p"]
```

- [ ] **Step 4: Verify**

Run: `cd apps/web && npx tsc -p tsconfig.json --noEmit` → clean
Run: `cd services/artifacts && . .venv/bin/activate && python -m pytest tests/test_models.py -q` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types.ts services/artifacts/app/models.py services/artifacts/tests/test_models.py
git commit -m "feat(doc): mirror sectioned schema in web + python"
```

---

## Task 3: Archetype registry + detection (BFF)

**Files:** Create `services/bff/src/archetypes.ts` · Test `services/bff/src/archetypes.test.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { detectArchetype, archetype, ARCHETYPES } from './archetypes';

describe('archetypes', () => {
  it('detects BRD from aliases', () => {
    expect(detectArchetype('help me with a BRD')).toBe('brd');
    expect(detectArchetype('draft the business requirements for X')).toBe('brd');
  });
  it('falls back to general', () => {
    expect(detectArchetype('a short memo about lunch')).toBe('general');
  });
  it('archetype() is a safe lookup', () => {
    expect(archetype('brd').label).toBe('BRD');
    expect(archetype('nope').id).toBe('general');
    expect(archetype(undefined).id).toBe('general');
  });
  it('BRD has a section skeleton', () => {
    expect(ARCHETYPES.brd.sections).toContain('Functional Requirements');
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `cd services/bff && npx vitest run src/archetypes.test.ts`

- [ ] **Step 3: Create `services/bff/src/archetypes.ts`:**

```ts
export interface Archetype {
  id: string;
  label: string;
  aliases: string[];
  sections: string[];
  guidance: string;
}

export const ARCHETYPES: Record<string, Archetype> = {
  brd: {
    id: 'brd',
    label: 'BRD',
    aliases: ['brd', 'business requirements', 'business requirement'],
    sections: [
      'Purpose & Background', 'Scope', 'Stakeholders', 'Functional Requirements',
      'Non-Functional Requirements', 'Assumptions & Dependencies', 'Risks', 'Acceptance Criteria',
    ],
    guidance:
      'Use a table with columns ID, Requirement, Priority for Functional Requirements. ' +
      'Ground every figure in the brief/inputs — never invent metrics or charts.',
  },
  general: {
    id: 'general',
    label: 'Document',
    aliases: [],
    sections: [],
    guidance: 'Structure the document into the logical sections that best fit the request.',
  },
};

/** Lowercase alias match against the brief; first hit wins, else 'general'. */
export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of Object.values(ARCHETYPES)) {
    if (a.aliases.some((alias) => b.includes(alias))) return a.id;
  }
  return 'general';
}

/** Safe lookup; unknown/undefined → general. */
export function archetype(id?: string): Archetype {
  return (id && ARCHETYPES[id]) || ARCHETYPES.general;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd services/bff && npx vitest run src/archetypes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add services/bff/src/archetypes.ts services/bff/src/archetypes.test.ts
git commit -m "feat(doc): archetype registry + detectArchetype (BRD + general)"
```

---

## Task 4: Web archetype mirror

**Files:** Create `apps/web/src/data/archetypes.ts` · Test `apps/web/src/data/archetypes.test.ts`

- [ ] **Step 1: Write the failing test:**

```ts
import { describe, it, expect } from 'vitest';
import { WEB_ARCHETYPES, detectArchetype } from './archetypes';

describe('web archetypes', () => {
  it('detects BRD + falls back to general', () => {
    expect(detectArchetype('a BRD please')).toBe('brd');
    expect(detectArchetype('random note')).toBe('general');
  });
  it('exposes a labeled list for the dropdown', () => {
    expect(WEB_ARCHETYPES.find((a) => a.id === 'brd')?.label).toBe('BRD');
    expect(WEB_ARCHETYPES.find((a) => a.id === 'general')?.label).toBe('Document');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/web && npx vitest run src/data/archetypes.test.ts`

- [ ] **Step 3: Create `apps/web/src/data/archetypes.ts`** (light mirror — id/label/aliases only; the BFF is authoritative for sections/guidance):

```ts
export interface WebArchetype { id: string; label: string; aliases: string[] }

export const WEB_ARCHETYPES: WebArchetype[] = [
  { id: 'brd', label: 'BRD', aliases: ['brd', 'business requirements', 'business requirement'] },
  { id: 'general', label: 'Document', aliases: [] },
];

export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of WEB_ARCHETYPES) if (a.aliases.some((x) => b.includes(x))) return a.id;
  return 'general';
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/web && npx vitest run src/data/archetypes.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data/archetypes.ts apps/web/src/data/archetypes.test.ts
git commit -m "feat(web): archetype mirror for the composer chip"
```

---

## Task 5: archetypeId + archetype-aware generate prompt

**Files:** Modify `services/bff/src/types.ts`, `services/bff/src/prompt.ts`, `services/bff/src/generate.ts` · Test `services/bff/src/prompt.test.ts`

- [ ] **Step 1: Add `archetypeId` to `BuildRequest`.** In `services/bff/src/types.ts`, inside the `BuildRequest = z.object({ ... })`, add after `lang`:

```ts
  archetypeId: z.string().max(60).optional(),
```

- [ ] **Step 2: Write the failing prompt test.** Add to `services/bff/src/prompt.test.ts`:

```ts
import { generateSystem } from './prompt';
import { archetype } from './archetypes';

describe('archetype-aware generate', () => {
  it('injects the BRD skeleton + sectioned shape for a Doc', () => {
    const sys = generateSystem('Doc', 'en', archetype('brd'));
    expect(sys).toContain('Functional Requirements');   // skeleton
    expect(sys).toContain('"sections"');                // sectioned shape offered
    expect(sys).toMatch(/requirement.*priority/i);      // guidance
  });
  it('a Deck is unaffected by archetype', () => {
    const sys = generateSystem('Deck', 'en', archetype('brd'));
    expect(sys).toContain('"kind":"Deck"');
    expect(sys).not.toContain('Functional Requirements');
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (generateSystem takes 2 args)

Run: `cd services/bff && npx vitest run src/prompt.test.ts`

- [ ] **Step 4: Update `services/bff/src/prompt.ts`.** Replace the `Doc` entry of the `SHAPE` map with the sectioned shape:

```ts
  Doc: `{"kind":"Doc","eyebrow":string,"title":string,"meta":string, and EITHER "paragraphs":string[] (a short memo) OR "sections":[{"heading":string,"blocks":[{"type":"paragraph","text":string}|{"type":"bullets","items":string[]}|{"type":"numbers","items":string[]}|{"type":"table","columns":string[],"rows":string[][]}|{"type":"callout","value":string,"label":string}|{"type":"bars","label":string?,"bars":[{"label":string,"value":number 0..1}]}]}] (a structured document). Only add a "bars" block when the brief has real quantitative data.}`,
```

Add the import at the top:
```ts
import type { Archetype } from './archetypes';
```

Change `generateSystem` to accept an optional archetype and inject skeleton + guidance for Doc:

```ts
export function generateSystem(type: ArtifactType, lang: 'en' | 'vi', arch?: Archetype): string {
  const lines = [
    'You are Atlas, an assistant that composes finished, on-brand business artifacts for VNG back-office teams.',
    `Produce a ${arch && arch.id !== 'general' && type === 'Doc' ? arch.label : type}. Respond with ONLY a single JSON object — no markdown, no prose — matching exactly this shape:`,
    SHAPE[type],
  ];
  if (type === 'Doc' && arch && arch.sections.length) {
    lines.push(`Use these sections in order: ${arch.sections.join('; ')}.`);
    lines.push(arch.guidance);
  }
  lines.push('Keep content concise, realistic, and professional. Numbers should be internally consistent.');
  lines.push(INJECTION_NOTE);
  lines.push(lang === 'vi' ? 'Write all human-readable text in Vietnamese.' : 'Write all human-readable text in English.');
  return lines.join('\n');
}
```

(`generateUser` needs no change — it already passes brief/constraints/context.)

- [ ] **Step 5: Wire it in `services/bff/src/generate.ts`.** Add import:
```ts
import { archetype, detectArchetype } from './archetypes';
```
In `produceContent`, where it builds the model call, resolve the archetype and pass it:
```ts
    const arch = archetype(req.archetypeId ?? detectArchetype(req.brief));
    const { text, sessionId } = await runModel(
      generateSystem(req.type, req.lang ?? 'en', arch),
      generateUser(req, context),
      req.modelId,
    );
```

- [ ] **Step 6: Run — expect PASS + full suite**

Run: `cd services/bff && npx vitest run && npm run typecheck`
Expected: PASS (prompt test + existing; the template path is unaffected).

- [ ] **Step 7: Commit**

```bash
git add services/bff/src/types.ts services/bff/src/prompt.ts services/bff/src/generate.ts services/bff/src/prompt.test.ts
git commit -m "feat(doc): archetype-aware generation (BRD skeleton + sectioned shape)"
```

---

## Task 6: Revise shape hint (sectioned)

**Files:** Modify `services/bff/src/skills/prompts.ts`

- [ ] **Step 1: Update the revise `SHAPE.Doc`.** In `services/bff/src/skills/prompts.ts`, replace the `Doc:` line of its `SHAPE` map with the same sectioned shape used in Task 5 Step 4 (so edits can add/reorder sections):

```ts
  Doc: `{"kind":"Doc","eyebrow":string,"title":string,"meta":string, EITHER "paragraphs":string[] OR "sections":[{"heading":string,"blocks":[{"type":"paragraph","text":string}|{"type":"bullets","items":string[]}|{"type":"numbers","items":string[]}|{"type":"table","columns":string[],"rows":string[][]}|{"type":"callout","value":string,"label":string}|{"type":"bars","label":string?,"bars":[{"label":string,"value":number 0..1}]}]}]}`,
```

- [ ] **Step 2: Verify** — the existing `runtime.test.ts` still passes (revise contract unchanged):

Run: `cd services/bff && npx vitest run src/skills/runtime.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add services/bff/src/skills/prompts.ts
git commit -m "feat(doc): sectioned shape in the revise prompt"
```

---

## Task 7: DocView sectioned renderer

**Files:** Create `apps/web/src/artifacts/renderers/SectionedDoc.tsx` · Modify `apps/web/src/artifacts/renderers/DocView.tsx` · Test `apps/web/src/artifacts/renderers/SectionedDoc.test.ts`

- [ ] **Step 1: Create `apps/web/src/artifacts/renderers/SectionedDoc.tsx`:**

```tsx
import { color, font } from '../../brand/tokens';
import type { DocSection, DocBlock } from '../../types';
import { renderInline } from '../inline';

function BlockView({ b }: { b: DocBlock }) {
  if (b.type === 'paragraph') return <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: color.textSlate }}>{renderInline(b.text)}</p>;
  if (b.type === 'bullets') return <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: color.textSlate }}>{renderInline(it)}</li>)}</ul>;
  if (b.type === 'numbers') return <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: color.textSlate }}>{renderInline(it)}</li>)}</ol>;
  if (b.type === 'callout') return <div style={{ background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 12px' }}><div style={{ fontFamily: font.serif, fontSize: 18, fontWeight: 600, color: color.positive }}>{renderInline(b.value)}</div><div style={{ fontSize: 11, color: color.textMuted }}>{b.label}</div></div>;
  if (b.type === 'bars') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {b.bars.map((bar, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 120, flexShrink: 0, fontSize: 11, color: color.textMuted, textAlign: 'right' }}>{bar.label}</span>
          <div style={{ flex: 1, height: 14, background: color.trackBg, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.max(2, Math.round(bar.value * 100))}%`, height: '100%', background: color.indigo, borderRadius: 4 }} /></div>
        </div>
      ))}
    </div>
  );
  // table
  const cols = b.columns;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${color.border}`, color: color.textMuted, fontWeight: 700, fontSize: 11, letterSpacing: 0.3 }}>{c}</th>)}</tr></thead>
        <tbody>{b.rows.map((row, ri) => (
          <tr key={ri}>{cols.map((_, ci) => <td key={ci} style={{ padding: '6px 10px', borderBottom: `1px solid ${color.hairline}`, color: color.textSlate, verticalAlign: 'top' }}>{renderInline(row[ci] ?? '')}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SectionedDoc({ sections }: { sections: DocSection[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: font.serif, fontSize: 18, fontWeight: 600, color: color.ink }}>{s.heading}</div>
          {s.blocks.map((b, bi) => <BlockView key={bi} b={b} />)}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add a pure guard test** — create `apps/web/src/artifacts/renderers/SectionedDoc.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SectionedDoc } from './SectionedDoc';

describe('SectionedDoc', () => {
  it('is a function component that accepts sections', () => {
    expect(typeof SectionedDoc).toBe('function');
    // render smoke: React element construction doesn't throw
    const el = SectionedDoc({ sections: [{ heading: 'H', blocks: [{ type: 'paragraph', text: 'x' }] }] });
    expect(el).toBeTruthy();
  });
});
```

- [ ] **Step 3: Branch in `DocView.tsx`.** Add import:
```tsx
import { SectionedDoc } from './SectionedDoc';
```
Immediately after the `<div ... meta ...>` + hairline block (before the `{c.paragraphs...}` map), branch: render sections when present, else the flat memo. Replace the paragraphs map line:
```tsx
      {c.paragraphs.map((p, i) => (
```
with a guarded version, and render sections first:
```tsx
      {c.sections && c.sections.length ? (
        <SectionedDoc sections={c.sections} />
      ) : (
        (c.paragraphs ?? []).map((p, i) => (
```
and close the ternary after the `</p>))}` of the paragraph map:
```tsx
        ))
      )}
```
(The `bars`/`callout` flat block below stays; it only renders when `c.bars` is set — sectioned docs won't set it.)

- [ ] **Step 4: Verify**

Run: `cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run`
Expected: clean + green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/artifacts/renderers/SectionedDoc.tsx apps/web/src/artifacts/renderers/SectionedDoc.test.ts apps/web/src/artifacts/renderers/DocView.tsx
git commit -m "feat(web): sectioned Doc renderer (headings + typed blocks)"
```

---

## Task 8: docx export for sections

**Files:** Modify `services/artifacts/app/docx_builder.py` · Test `services/artifacts/tests/test_docx.py` (existing or new)

- [ ] **Step 1: Write the failing test** — add to the docx test file:

```python
from app.docx_builder import build_doc
from app.models import DocContent
from docx import Document
import io

def test_docx_renders_sections():
    c = DocContent.model_validate({
        "kind": "Doc", "eyebrow": "E", "title": "T", "meta": "m",
        "sections": [{"heading": "Requirements", "blocks": [
            {"type": "paragraph", "text": "intro"},
            {"type": "bullets", "items": ["a", "b"]},
            {"type": "table", "columns": ["ID", "Req"], "rows": [["FR-1", "Login"]]},
        ]}],
    })
    data = build_doc(c, "Doc")
    doc = Document(io.BytesIO(data))
    text = "\n".join(p.text for p in doc.paragraphs)
    assert "Requirements" in text and "intro" in text
    assert len(doc.tables) == 1 and doc.tables[0].rows[0].cells[0].text == "ID"
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/artifacts && . .venv/bin/activate && python -m pytest tests/test_docx.py::test_docx_renders_sections -q`

- [ ] **Step 3: Extend `build_doc`.** In `services/artifacts/app/docx_builder.py`, after the title/meta are written and before (or instead of) the flat paragraphs loop, add a sections branch. Insert a helper + a branch (adapt to the file's existing `build_doc` structure — it receives `content` and a `Document`):

```python
def _render_sections(doc, sections):
    for s in sections:
        doc.add_heading(s.heading, level=2)
        for b in s.blocks:
            if b.type == "paragraph":
                doc.add_paragraph(b.text)
            elif b.type in ("bullets", "numbers"):
                style = "List Bullet" if b.type == "bullets" else "List Number"
                for it in b.items:
                    doc.add_paragraph(it, style=style)
            elif b.type == "callout":
                doc.add_paragraph(f"{b.value} — {b.label}")
            elif b.type == "table":
                t = doc.add_table(rows=1, cols=len(b.columns))
                t.style = "Light Grid Accent 1"
                for i, col in enumerate(b.columns):
                    t.rows[0].cells[i].text = col
                for row in b.rows:
                    cells = t.add_row().cells
                    for i in range(len(b.columns)):
                        cells[i].text = row[i] if i < len(row) else ""
            # 'bars' blocks are omitted from docx in v1 (best-effort text export)
```

Then in `build_doc`, branch: if `content.sections`, call `_render_sections(doc, content.sections)`; else keep the existing flat `paragraphs` loop (guard `content.paragraphs or []`).

- [ ] **Step 4: Run — expect PASS + full python suite**

Run: `cd services/artifacts && . .venv/bin/activate && python -m pytest -q`
Expected: all green (flat Doc export still works).

- [ ] **Step 5: Commit**

```bash
git add services/artifacts/app/docx_builder.py services/artifacts/tests/test_docx.py
git commit -m "feat(export): docx renders sectioned Docs (headings/lists/tables)"
```

---

## Task 9: Composer document-type chip

**Files:** Modify `apps/web/src/store/useAppStore.ts`, `apps/web/src/components/Composer.tsx` · Test `apps/web/src/store/useAppStore.test.ts`

- [ ] **Step 1: Store field.** In `useAppStore.ts`: add `archetypeId: string;` to `AppState` (near `output`), initial `archetypeId: 'general',`, action type `setArchetype: (id: string) => void;`, action impl `setArchetype: (archetypeId) => set({ archetypeId }),`. In `composerRequest`, add `archetypeId: s.archetypeId,` to the returned `BuildRequest`. (Do NOT persist it — it's transient composer state; leave `partialize` unchanged.)

- [ ] **Step 2: Store test.** Add to `useAppStore.test.ts`:

```ts
it('composerRequest carries the archetypeId', () => {
  useAppStore.getState().setArchetype('brd');
  expect(useAppStore.getState().composerRequest('a brd').archetypeId).toBe('brd');
});
```

- [ ] **Step 3: Verify store**

Run: `cd apps/web && npx vitest run src/store/useAppStore.test.ts`
Expected: PASS.

- [ ] **Step 4: Composer chip.** In `apps/web/src/components/Composer.tsx`:
  - Import: `import { WEB_ARCHETYPES, detectArchetype } from '../data/archetypes';`
  - Read store: `const output = useAppStore((s) => s.output); const draft = ...(the composer draft field); const archetypeId = useAppStore((s) => s.archetypeId); const setArchetype = useAppStore((s) => s.setArchetype);`
  - Auto-detect as the user types: in the draft `onChange` (or a `useEffect` on the draft), when `output === 'Doc'`, call `setArchetype(detectArchetype(nextDraft))`.
  - Render, only when `output === 'Doc'`, a small chip/`<select>` in the composer action row (next to the ✦ Agent toggle), styled like the other pill controls:

```tsx
{output === 'Doc' && (
  <select
    value={archetypeId}
    onChange={(e) => setArchetype(e.target.value)}
    aria-label="Document type"
    style={{ cursor: 'pointer', border: `1px solid ${color.border}`, background: '#fff', color: color.textSlate, borderRadius: radius.pill, padding: '6px 10px', fontSize: 12.5, fontWeight: 600 }}
  >
    {WEB_ARCHETYPES.map((a) => <option key={a.id} value={a.id}>{a.id === 'general' ? 'Document' : a.label}</option>)}
  </select>
)}
```

  (Match the exact draft-state + action-row wiring already in `Composer.tsx`; the goal is: detect on type, editable, only for Doc, and the value flows via `composerRequest`.)

- [ ] **Step 5: Verify + build**

Run: `cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run && npx vite build 2>&1 | tail -3`
Expected: clean, green, builds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/store/useAppStore.ts apps/web/src/store/useAppStore.test.ts apps/web/src/components/Composer.tsx
git commit -m "feat(web): document-type chip (auto-detect + editable) in composer"
```

---

## Task 10: Live verify, SPEC, merge

**Files:** Modify `SPEC.md`

- [ ] **Step 1: Full hermetic suites**

Run: `cd services/bff && npm run typecheck && npx vitest run`
Run: `cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run`
Run: `cd services/artifacts && . .venv/bin/activate && python -m pytest -q`
Expected: all green.

- [ ] **Step 2: Live smoke (BFF → GreenNode).** With the stack running (opencode optional; `direct` is fine here — generation uses `runModel`), POST a BRD build and confirm sectioned output:

```bash
curl -s -X POST http://127.0.0.1:8787/generate -H 'Content-Type: application/json' \
  -d '{"name":"HRCore BRD","req":{"brief":"Write a BRD for modernizing the HRCore payroll platform","type":"Doc","modelId":"google/gemma-4-31b-it","archetypeId":"brd"}}' \
  | python3 -c "import sys,json;c=json.load(sys.stdin)['versions'][0]['content'];print('sections:',[s['heading'] for s in c.get('sections',[])] or 'FLAT')"
```
Expected: prints the BRD section headings (Purpose & Background, Scope, … Functional Requirements …), not `FLAT`. If `FLAT`, iterate on the prompt guidance (Task 5 Step 4) — the sectioned shape must be preferred for archetype Docs.

- [ ] **Step 3: Browser check.** In the web app: type "help me with a BRD", confirm the **Document type: BRD** chip appears, build, and the Studio shows a sectioned BRD (headings + a requirements table), no gratuitous chart.

- [ ] **Step 4: Update `SPEC.md`** — §6 note that Doc supports `sections[]` (typed blocks) + archetypes (BRD); §8 add "Structured documents (BRD-first)" as built; reference this spec/plan.

- [ ] **Step 5: Commit + merge**

```bash
git add SPEC.md
git commit -m "docs: SPEC — structured documents (BRD-first) live"
git diff main --name-only | grep -Eq '\.env$|greennode\.json|token_cache|attachments\.db|\.runs/' && echo "GUARD — STOP" || (git checkout main && git merge --no-ff feat/structured-documents -m "Merge feat/structured-documents: sectioned Docs + BRD archetype" && git branch -d feat/structured-documents)
```

---

## Self-review

**Spec coverage:** sectioned schema §3.1 → Tasks 1–2; archetype registry §3.2 → Task 3 (+web mirror 4); detection + chip §3.3 → Tasks 4, 9; archetype-aware generation §3.4 → Task 5; revise §3.5 → Task 6; renderer §3.6 → Task 7; docx export §3.6 → Task 8; contracts §4 → Tasks 1,2,5; backward-compat/error §5 → guarded `paragraphs`/`archetype()`/ragged-row pad (Tasks 1,3,7); testing §6 → each task + Task 10. ✓

**Placeholder scan:** No TBD/TODO. The two soft spots — the exact `build_doc` insertion point (Task 8) and the exact `Composer.tsx` draft/action-row wiring (Task 9) — are called out explicitly because those files' internals aren't quoted here; the executor adapts to the existing structure, with the required behavior fully specified.

**Type consistency:** `Block`/`Section` (bff) mirror `DocBlock`/`DocSection` (web) and `Block`/`Section` (python) — same `type` discriminants and fields. `archetype()`, `detectArchetype()`, `ARCHETYPES`, `WEB_ARCHETYPES`, `Archetype.sections/guidance`, `BuildRequest.archetypeId`, store `archetypeId`/`setArchetype` are named consistently across tasks. `generateSystem(type, lang, arch?)` signature is used consistently in Tasks 5 + its test.

**Scope:** One coherent feature (sectioned Docs + BRD archetype), backward compatible, BRD + General only (others are data). Good for a single plan.
