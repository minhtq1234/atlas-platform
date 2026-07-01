# Structured Documents — Design

Status: **approved** (2026-07-01) · Owner: Atlas
Related: [SPEC.md](../../../SPEC.md) §6 (artifact model), [multi-step-agent](2026-07-01-multi-step-agent-design.md)

## 1. Summary & root cause

A user asked for a structured business document and got a generic-feeling memo with a decorative bar
chart. The model *did* generate it — but Atlas's only prose shape is the flat
**Doc** (`eyebrow + title + meta + paragraphs[] + optional bars + one callout`).
That shape cannot express a real business document's structure (numbered sections,
requirement tables, stakeholders, assumptions,
risks, acceptance criteria), so the model wrote a few generic paragraphs and
**padded the empty `bars` field** with an invented chart. Two gaps:

1. **The artifact schema is too flat** for structured documents.
2. **No document-type awareness** — there's only a generic "Doc," with no way for a team to declare a named document type.

This design fixes both: evolve `Doc` into an optional **sectioned** model, and add
a **data-driven archetype registry** that ships a `'general'` archetype, with
**auto-detection** from the brief. Named archetypes (PRD, SOW, policy, …) are
**team-owned data** a team adds as a registry entry — they are *not* shipped by the platform.

## 2. Goals / Non-goals

**Goals**
- A real **sectioned document model** (headings + typed blocks) so structured
  business documents render properly — the general fix.
- A **data-driven archetype registry** with **auto-detection** from the brief, shown as an **editable chip**.
- Charts become an **explicit block** — no more gratuitous padding.
- Backward compatible: existing flat Docs (memos) render + generate unchanged.
- Adding a named archetype (e.g. PRD/SOW/policy) = **team-owned data**, not code.

**Non-goals (v1)**
- Shipping named archetypes — the platform ships only the `'general'` archetype;
  named archetypes (PRD, SOW, policy, …) are illustrative examples of team-owned data, *not* shipped.
- Nested subsections (flat sections only in v1).
- Export fidelity for chart/callout blocks (docx renders text/lists/tables; charts best-effort).
- Archetypes for non-Doc types (Deck/Sheet/Dashboard/Report unchanged).

## 3. Architecture

### 3.1 Document model (evolve `Doc`)

`Doc` gains an optional `sections[]`. A memo keeps flat `paragraphs[]`; a
structured document uses `sections[]`. The renderer branches on which is present.

```ts
// Discriminated union on `type`
Block =
  | { type: 'paragraph'; text: string }                    // inline **bold** honored
  | { type: 'bullets';  items: string[] }
  | { type: 'numbers';  items: string[] }                  // ordered list
  | { type: 'table';    columns: string[]; rows: string[][] }
  | { type: 'callout';  value: string; label: string }
  | { type: 'bars';     label?: string; bars: { label: string; value: number }[] };

Section = { heading: string; blocks: Block[] };

DocContent = {
  kind: 'Doc'; eyebrow: string; title: string; meta: string;
  paragraphs?: string[];   // flat memo path (was required; now optional)
  sections?: Section[];    // structured path (new)
  bars?: { label; value }[]; callout?: { value; label };  // legacy flat extras (kept)
};
// Validity: at least one of paragraphs[] | sections[] must be non-empty.
```

A structured document renders as a sequence of headed sections, each holding typed
blocks — e.g. Purpose (paragraph), Scope (paragraphs + bullets), Stakeholders
(table), a **requirements** table (columns like ID / Requirement / Priority),
Non-Functional (bullets), Assumptions & Risks (bullets), Acceptance (numbers).
The specific skeleton comes from the archetype (see §3.2). Because a chart is now a
`bars` **block**, it exists only when the model emits it.

### 3.2 Archetype registry (`services/bff/src/archetypes.ts`)

The registry is **data-driven** and ships **only the `'general'` archetype**. A team
declares named archetypes (PRD, SOW, policy, …) by adding registry entries — they are
**team-owned data, not shipped by the platform**. An entry supplies an id, a label,
detection `aliases`, an ordered `sections` skeleton, and `guidance`.

```ts
interface Archetype { id: string; label: string; aliases: string[]; sections: string[]; guidance: string; }

// Shipped registry — 'general' only.
const ARCHETYPES: Record<string, Archetype> = {
  general: { id:'general', label:'Document', aliases:[], sections:[], guidance:'Structure the document into logical sections that fit the request.' },
};

// Illustrative team-owned entry (EXAMPLE — NOT SHIPPED). A team adds one like this;
// no code change is required, only this data:
//
//   prd: { id:'prd', label:'PRD', aliases:['prd','product requirements','product requirement'],
//     sections:['Overview','Goals','Personas','Requirements',
//               'Non-Functional Requirements','Assumptions & Dependencies','Risks','Acceptance Criteria'],
//     guidance:'Use a requirements table with IDs and priority for Requirements. Ground every figure in the brief/inputs — never invent metrics or charts.' }

export function detectArchetype(brief: string): string; // lowercase alias match → id, else 'general'
export function archetype(id?: string): Archetype;       // safe lookup, defaults to general
```
The **web** carries a light mirror (`apps/web/src/data/archetypes.ts`: id/label/aliases
for the chip + dropdown); the **BFF** registry is authoritative (adds sections + guidance).

### 3.3 Detection + editable chip
- `detectArchetype(brief)` — lowercase brief, first archetype whose alias appears wins; else `general`.
- **Composer (web):** when output type is `Doc`, detect from the draft and show
  a **"Document type: … ▾"** chip — a dropdown of the registered archetypes (with a
  team's named archetypes appearing once added) plus Document (General),
  editable. The chosen `archetypeId` rides on the `BuildRequest`. With only `'general'`
  shipped, the chip defaults to Document; it fills out as a team adds archetype data.
- **BFF:** authoritative — if `archetypeId` absent, re-detect from `brief`.

### 3.4 Generation (archetype-aware)
`generateSystem`/`generateUser` (Doc) offer BOTH shapes and steer by archetype:
> "Produce a **{label}**. For a short memo use `paragraphs`; for a structured
> document use `sections`. Use these sections: {skeleton}. {guidance}. Shape: {sectioned-Doc JSON}."

Known archetype → skeleton-guided `sections`. General → model structures freely
(may still use `sections`). Simple memos → `paragraphs` (unchanged). This fixes the
class: any Doc can now come out structured when the content warrants.

### 3.5 Revise
The sectioned `Doc` flows through the existing skill runtime; the revise shape hint
(`skills/prompts.ts`) is extended with the sectioned model so edits can add/reorder
sections. The anti-overclaim rule (already shipped) applies.

### 3.6 Renderer + export
- **`DocView`:** if `sections?.length` → render sections (heading + a sub-renderer per
  block type; tables get clean styling; reuse `renderInline` bold + the horizontal-bar
  work); else the existing flat memo path. New unit: `SectionedDoc` + block renderers.
- **docx export (`services/artifacts`):** `build_doc` emits headings + paragraphs +
  bullet/number lists + tables when `sections` present; else the flat path. Charts/
  callouts best-effort (text).

## 4. Contracts

- **Schema** mirrored in `apps/web/src/types.ts`, `services/bff/src/types.ts` (zod),
  `services/artifacts/app/models.py` (pydantic): `Block` union, `Section`, `Doc.sections`,
  `Doc.paragraphs` optional + "at least one" validity.
- **`BuildRequest`** gains `archetypeId?: string`.
- **Archetype registry** shape as in §3.2.

## 5. Error handling / backward compatibility
- Existing flat Docs (no `sections`) render + export exactly as before.
- Unknown `archetypeId` → treated as `general` (safe lookup).
- Model omits both `paragraphs` and `sections` → validation fails → existing
  degraded-template fallback (a flat template Doc).
- A `table` with ragged rows → renderer pads/truncates to `columns.length` (defensive,
  like the Sheet renderer).
- Detection is best-effort; the chip is always editable, so a misdetect is one click to fix.

## 6. Testing
- **BFF (vitest):** `Block`/`Section`/`Doc` zod parse (valid sectioned doc; invalid block
  type; empty-both rejected); `detectArchetype` (a brief with no known alias → 'general';
  and, with a sample registry entry, its aliases → that id);
  archetype-aware prompt includes the archetype's section skeleton + guidance; `parseContent` accepts a
  sectioned Doc.
- **Web (vitest):** `detectArchetype` mirror; a pure `sectionsToPlainText` (or block-kind
  guard) helper for the renderer; store carries `archetypeId`.
- **Python (pytest):** `build_doc` with `sections` produces a docx with headings + a table +
  lists (assert paragraph/table counts); flat Doc still builds.

## 7. Build order (feeds writing-plans)
1. **Schema** — `Block`/`Section` + `Doc.sections`/optional `paragraphs` in bff zod, web ts,
   pydantic (+ parse tests).
2. **Archetype registry + `detectArchetype`** (bff) + web light mirror (+ tests).
3. **Generate** — archetype-aware `generateSystem`/`generateUser`, `BuildRequest.archetypeId`,
   wire into `produceContent` (+ tests).
4. **Revise** — extend the skills shape hint with the sectioned model.
5. **DocView** — `SectionedDoc` + per-block renderers (paragraph/bullets/numbers/table/callout/bars).
6. **docx export** — sections in `build_doc` (+ python tests).
7. **Web composer** — detection chip (Doc only) + `archetypeId` on the request.
8. **Live verify** (generate a real structured document on GreenNode) + update SPEC + merge.

## 8. Open questions / risks
- **Table width on the Doc page** (620px): many-column requirement tables may need
  horizontal scroll or smaller type — the renderer caps columns / shrinks type; revisit if
  structured docs commonly exceed ~4 columns.
- **Web/BFF registry duplication** — accepted (same pattern as the mirrored `ArtifactContent`);
  the web mirror only needs id/label/aliases. If it drifts, the BFF re-detects authoritatively.
- **General fallback quality** depends on the model structuring well; the sectioned shape hint
  nudges it, and known archetypes sidestep it.
