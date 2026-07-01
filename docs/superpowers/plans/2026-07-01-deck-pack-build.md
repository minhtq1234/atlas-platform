# Deck Pack Build (P0–P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the Deck artifact type from a bare title+bullets transport to a genuinely good business-deck generator: every deck gets craft rules (assertion titles, concision, speaker notes), Board and Pitch archetypes add the right slide arc, and slides support speaker notes + section/statement layouts end-to-end (schema → renderer → pptx).

**Architecture:** Deck is a self-contained `ArtifactTypeModule` under `services/bff/src/artifacts/deck/` (schema · prompt · archetypes · index), rendered by `apps/web/src/artifacts/renderers/DeckView.tsx` and exported by `services/artifacts/app/pptx_builder.py`. The BFF `generateSystem` already injects `moduleFor('Deck').guidance(arch)` where `arch` is the archetype resolved from the brief; this plan fills that guidance in and deepens the schema/renderer/export around it. This is the Phase-3 build of the Deck pack ([charter](../../artifact-packs/deck/CHARTER.md)); Phases 1–2 (exemplars, rubric, eval prompts) are already authored under `docs/artifact-packs/deck/`.

**Tech Stack:** TypeScript + zod + vitest (BFF), React + TS + vitest (web), Python + FastAPI + python-pptx + pytest (artifacts).

---

## ⚠️ Prerequisite (read before starting)

This plan edits files that live on the **`ws0-platform-refactor`** branch (the per-type module structure, the registry, and the `guidance(arch?: Archetype)` contract). **Do not start until WS-0 is merged to `main`.** Then branch `deck-pack` off `main` and verify these exist:
- `services/bff/src/artifacts/deck/{schema,prompt,archetypes,index}.ts`
- `services/bff/src/artifacts/module.ts` exports `interface ArtifactTypeModule { …; guidance(arch?: Archetype): string; archetypes: Archetype[]; … }` and `interface Archetype { id; label; aliases; sections; guidance }`.
- `services/bff/src/prompt.ts` `generateSystem` calls `moduleFor(type).guidance(arch)` and pushes the result when truthy.
- `services/bff/src/generate.ts` resolves `archetype(req.archetypeId ?? detectArchetype(req.brief))` and passes it to `generateSystem`.

If any signature drifted from the above, reconcile the affected task against the merged code before writing tests.

## Platform coordination / known limitations (not blockers)

- **`detectArchetype` is global, not type-scoped.** It matches a brief against *every* type's archetypes and ignores `req.type`. To keep a Deck archetype from ever attaching to a Doc, Task 2 uses **deck-anchored aliases** (each contains the word "deck"). Recommend a Platform follow-up: scope `detectArchetype(brief, type)` to the selected type; then Deck aliases can broaden (e.g. bare "board update"). Deck's own `guidance` (Task 3) already ignores foreign archetypes, so the Deck side is safe regardless.
- **Web archetype picker.** Surfacing "Board Deck" / "Pitch Deck" in the composer so users pass `archetypeId` explicitly (the reliable selection path) is a small web/platform change tracked separately; it is **out of scope** here. Until then, selection is via deck-anchored brief detection, and every deck still gets the craft rules.

## File structure (what each task touches)

- **Task 1 — schema + shape:** `services/bff/src/artifacts/deck/schema.ts`, `services/bff/src/artifacts/deck/prompt.ts` (shapeHint line) — add `notes` + `layout`.
- **Task 2 — archetypes data:** `services/bff/src/artifacts/deck/archetypes.ts` — Board + Pitch.
- **Task 3 — guidance:** `services/bff/src/artifacts/deck/prompt.ts` (guidance fn), `services/bff/src/prompt.test.ts` (update the Deck assertion).
- **Task 4 — web:** `apps/web/src/types.ts` (Slide), `apps/web/src/artifacts/renderers/DeckView.tsx` (layouts + notes).
- **Task 5 — python export:** `services/artifacts/app/models.py` (Slide), `services/artifacts/app/pptx_builder.py` (section/statement + notes).
- **Task 6 — verify + gate:** all suites + Phase-4 eval against the rubric.

---

### Task 1: Deck schema — speaker notes + layout

**Files:**
- Modify: `services/bff/src/artifacts/deck/schema.ts`
- Modify: `services/bff/src/artifacts/deck/prompt.ts` (the `shapeHint` string only)
- Test: `services/bff/src/artifacts/deck/schema.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `services/bff/src/artifacts/deck/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { DeckContent } from './schema';

describe('Deck schema', () => {
  it('accepts speaker notes and a layout on a slide', () => {
    const parsed = DeckContent.parse({
      kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
      slides: [
        { title: 'Cover', isCover: true },
        { title: 'Agenda', layout: 'section' },
        { title: 'Growth up 40%', bullets: ['Enterprise led'], notes: 'Mention the Q2 deal.' },
      ],
    });
    expect(parsed.slides[1].layout).toBe('section');
    expect(parsed.slides[2].notes).toContain('Q2 deal');
  });

  it('rejects an unknown layout value', () => {
    expect(() =>
      DeckContent.parse({
        kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
        slides: [{ title: 'x', layout: 'carousel' }],
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/bff && npx vitest run src/artifacts/deck/schema.test.ts`
Expected: FAIL — `layout` is stripped/undefined (not yet in schema), and the unknown-value case does not throw.

- [ ] **Step 3: Add the fields to the schema**

Replace `services/bff/src/artifacts/deck/schema.ts` with:
```ts
import { z } from 'zod';

export const Slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(30).optional(),
  notes: z.string().optional(),
  layout: z.enum(['section', 'statement']).optional(),
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

- [ ] **Step 4: Update the shapeHint so the model emits the new fields**

In `services/bff/src/artifacts/deck/prompt.ts`, replace the `shapeHint` line with:
```ts
export const shapeHint = `{"kind":"Deck","eyebrow":string,"title":string,"subtitle":string,"slides":[{"title":string,"bullets":string[]?,"notes":string?,"layout":("section"|"statement")?,"isCover":boolean?,"subtitle":string?}] (first slide isCover:true; use layout:"section" for a divider slide in a long deck, layout:"statement" for a single big-idea slide; put presenter detail in "notes", never on the slide)}`;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/bff && npx vitest run src/artifacts/deck/schema.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add services/bff/src/artifacts/deck/schema.ts services/bff/src/artifacts/deck/schema.test.ts services/bff/src/artifacts/deck/prompt.ts
git commit -m "feat(deck): add speaker notes + layout to the slide schema"
```

---

### Task 2: Deck archetypes — Board + Pitch

**Files:**
- Modify: `services/bff/src/artifacts/deck/archetypes.ts`
- Test: `services/bff/src/artifacts/deck/archetypes.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `services/bff/src/artifacts/deck/archetypes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { archetypes } from './archetypes';
import { detectArchetype } from '../registry';

describe('Deck archetypes', () => {
  it('defines board and pitch, each with a slide arc', () => {
    const ids = archetypes.map((a) => a.id).sort();
    expect(ids).toEqual(['board', 'pitch']);
    const board = archetypes.find((a) => a.id === 'board')!;
    expect(board.sections.some((s) => s.toLowerCase().includes('ask'))).toBe(true);
    const pitch = archetypes.find((a) => a.id === 'pitch')!;
    expect(pitch.sections.some((s) => s.toLowerCase().includes('problem'))).toBe(true);
  });

  it('never uses the reserved "general" id (it would collide in the registry)', () => {
    expect(archetypes.some((a) => a.id === 'general')).toBe(false);
  });

  it('detects a board-deck brief via the registry', () => {
    expect(detectArchetype('make a board deck for the Q2 review')).toBe('board');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/bff && npx vitest run src/artifacts/deck/archetypes.test.ts`
Expected: FAIL — `archetypes` is `[]`, so `ids` is `[]` and detection returns `'general'`.

- [ ] **Step 3: Populate the archetypes**

Replace `services/bff/src/artifacts/deck/archetypes.ts` with:
```ts
import type { Archetype } from '../module';

// Aliases are deck-anchored (each contains "deck") on purpose: detectArchetype is
// global across types, so a bare word like "proposal" must not pull a Doc into a
// deck archetype. See the plan's "Platform coordination" note.
export const archetypes: Archetype[] = [
  {
    id: 'board',
    label: 'Board Deck',
    aliases: ['board deck', 'board update deck', 'board meeting deck', 'exec update deck'],
    sections: [
      'Cover',
      'TL;DR — 3–5 headline assertions',
      'KPIs vs. plan (with prior-period or target comparison)',
      'Progress by workstream',
      'Risks & issues (with mitigation)',
      'The ask / decisions needed',
      'Next steps + owners',
    ],
    guidance:
      'Board/exec audience: dense, factual, confident, no fluff. Aim for ~10–15 slides. Lead with takeaways; make the ask explicit and put comparisons on every KPI.',
  },
  {
    id: 'pitch',
    label: 'Pitch Deck',
    aliases: ['pitch deck', 'sales deck', 'investor deck', 'proposal deck'],
    sections: [
      'Cover',
      'The problem / why-now',
      'The solution (one line)',
      'How it works',
      'Proof (traction, case, or evidence)',
      'Differentiation',
      'Business model / pricing or cost & plan',
      'The ask / CTA',
    ],
    guidance:
      'Persuasive, narrative, value-first. Aim for ~10–12 slides. Open with the problem, not the product; close with a specific, time-bound call to action.',
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd services/bff && npx vitest run src/artifacts/deck/archetypes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the registry contract test (archetypes flow into the registry)**

Run: `cd services/bff && npx vitest run src/artifacts/registry.test.ts`
Expected: PASS — `ARCHETYPES` now also holds `board`/`pitch`; no id collides with `general`.

- [ ] **Step 6: Commit**

```bash
git add services/bff/src/artifacts/deck/archetypes.ts services/bff/src/artifacts/deck/archetypes.test.ts
git commit -m "feat(deck): add Board and Pitch archetypes with slide arcs"
```

---

### Task 3: Deck guidance — craft rules always, own-archetype arc when matched

**Files:**
- Modify: `services/bff/src/artifacts/deck/prompt.ts` (the `guidance` export)
- Modify: `services/bff/src/prompt.test.ts` (update the existing Deck assertion — it currently expects Decks to be unaffected by archetypes)
- Test: `services/bff/src/artifacts/deck/prompt.test.ts` (create)

- [ ] **Step 1: Write the failing unit test**

Create `services/bff/src/artifacts/deck/prompt.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { guidance } from './prompt';
import { archetypes } from './archetypes';

describe('Deck guidance', () => {
  it('always includes the craft rules (assertion titles, notes)', () => {
    const g = guidance();
    expect(g).toContain('assertion');
    expect(g).toContain('notes');
  });

  it('adds the board slide arc for the board archetype', () => {
    const board = archetypes.find((a) => a.id === 'board')!;
    const g = guidance(board);
    expect(g).toContain('Use these slides in order');
    expect(g.toLowerCase()).toContain('the ask');
  });

  it('ignores a foreign (Doc) archetype — no slide arc leaks in', () => {
    const foreign = { id: 'testdoc', label: 'X', aliases: [], sections: ['Alpha Section'], guidance: 'x' };
    const g = guidance(foreign);
    expect(g).toContain('assertion');         // craft rules still present
    expect(g).not.toContain('Alpha Section');  // foreign arc NOT applied
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/bff && npx vitest run src/artifacts/deck/prompt.test.ts`
Expected: FAIL — current `guidance` is `() => ''`, so none of the substrings are present.

- [ ] **Step 3: Implement the guidance**

Replace the whole `services/bff/src/artifacts/deck/prompt.ts` with (shapeHint unchanged from Task 1, shown in full for clarity):
```ts
import type { Archetype } from '../module';
import { archetypes } from './archetypes';

export const shapeHint = `{"kind":"Deck","eyebrow":string,"title":string,"subtitle":string,"slides":[{"title":string,"bullets":string[]?,"notes":string?,"layout":("section"|"statement")?,"isCover":boolean?,"subtitle":string?}] (first slide isCover:true; use layout:"section" for a divider slide in a long deck, layout:"statement" for a single big-idea slide; put presenter detail in "notes", never on the slide)}`;

// Deck-wide craft rules — applied to every deck, with or without an archetype.
const DECK_RULES =
  'Deck craft: every content-slide title must be an assertion (the takeaway, e.g. "Enterprise drove 40% of new ARR"), not a topic label ("Revenue"). One idea per slide, ≤ ~40 words of body. Put presenter detail in "notes", not on the slide. Add a layout:"section" divider slide when a deck runs longer than ~10 slides.';

/**
 * Deck steering: the craft rules, plus the slide arc when the resolved archetype is
 * one of Deck's OWN (board/pitch). Foreign archetypes (e.g. a Doc archetype that a
 * global brief-match happened to select) are ignored, so no other type's skeleton
 * leaks into a deck.
 */
export function guidance(arch?: Archetype): string {
  const parts = [DECK_RULES];
  const own = arch ? archetypes.find((a) => a.id === arch.id) : undefined;
  if (own && own.sections.length) {
    parts.push(`Use these slides in order: ${own.sections.join('; ')}.`);
    if (own.guidance) parts.push(own.guidance);
  }
  return parts.join('\n');
}
```

- [ ] **Step 4: Update the existing root prompt test**

In `services/bff/src/prompt.test.ts`, replace the `it('a Deck is unaffected by archetype', …)` test with:
```ts
  it('a Deck gets craft rules but ignores a foreign (Doc) archetype', () => {
    const sys = generateSystem('Deck', 'en', testArch);
    expect(sys).toContain('"kind":"Deck"');
    expect(sys).toContain('assertion');          // DECK_RULES injected via moduleFor('Deck').guidance
    expect(sys).not.toContain('Alpha Section');  // the Doc archetype's sections do NOT leak in
  });
```

- [ ] **Step 5: Run the deck + root prompt tests**

Run: `cd services/bff && npx vitest run src/artifacts/deck/prompt.test.ts src/prompt.test.ts`
Expected: PASS — deck guidance (3) + root prompt (all) green.

- [ ] **Step 6: Commit**

```bash
git add services/bff/src/artifacts/deck/prompt.ts services/bff/src/artifacts/deck/prompt.test.ts services/bff/src/prompt.test.ts
git commit -m "feat(deck): inject deck craft rules + archetype arc into generation"
```

---

### Task 4: Web — Slide type + DeckView layouts and speaker notes

**Files:**
- Modify: `apps/web/src/types.ts` (the `Slide` interface, ~line 82)
- Modify: `apps/web/src/artifacts/renderers/DeckView.tsx`
- Test: `apps/web/src/artifacts/renderers/DeckView.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/artifacts/renderers/DeckView.test.ts` (matches the codebase's pure/smoke renderer-test style, e.g. `SectionedDoc.test.ts` — no DOM library):
```ts
import { describe, it, expect } from 'vitest';
import { DeckView, slideKind } from './DeckView';
import type { DeckContent } from '../../types';

describe('slideKind', () => {
  it('classifies cover, section, statement, and bullets', () => {
    expect(slideKind({ title: 'x', isCover: true })).toBe('cover');
    expect(slideKind({ title: 'x', layout: 'section' })).toBe('section');
    expect(slideKind({ title: 'x', layout: 'statement' })).toBe('statement');
    expect(slideKind({ title: 'x', bullets: ['a'] })).toBe('bullets');
  });
});

describe('DeckView', () => {
  const deck: DeckContent = {
    kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
    slides: [
      { title: 'Cover', isCover: true },
      { title: 'Part Two', layout: 'section' },
      { title: 'Growth up 40%', bullets: ['Enterprise led'], notes: 'Mention the deal.' },
    ],
  };
  it('is a function component that builds every slide kind without throwing', () => {
    expect(typeof DeckView).toBe('function');
    expect(DeckView({ c: deck, slide: 0 })).toBeTruthy(); // cover
    expect(DeckView({ c: deck, slide: 1 })).toBeTruthy(); // section
    expect(DeckView({ c: deck, slide: 2 })).toBeTruthy(); // bullets + notes
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/artifacts/renderers/DeckView.test.ts`
Expected: FAIL — `slideKind` is not exported (and `layout`/`notes` not on `Slide`).

- [ ] **Step 3: Add the new fields to the web Slide type**

In `apps/web/src/types.ts`, replace the `Slide` interface with:
```ts
export interface Slide {
  title: string;
  bullets?: string[];
  notes?: string;
  layout?: 'section' | 'statement';
  isCover?: boolean;
  subtitle?: string;
}
```

- [ ] **Step 4: Implement the renderer**

Replace `apps/web/src/artifacts/renderers/DeckView.tsx` with:
```tsx
import { color, shadow } from '../../brand/tokens';
import type { DeckContent, Slide } from '../../types';
import { renderInline } from '../inline';

export function slideKind(s: Slide): 'cover' | 'section' | 'statement' | 'bullets' {
  if (s.isCover) return 'cover';
  if (s.layout === 'section') return 'section';
  if (s.layout === 'statement') return 'statement';
  return 'bullets';
}

export function DeckView({ c, slide = 0 }: { c: DeckContent; slide?: number }) {
  const s = c.slides[Math.min(slide, c.slides.length - 1)];
  if (!s) {
    return (
      <div style={{ width: 680, maxWidth: '100%', aspectRatio: '16 / 9', borderRadius: 10, boxShadow: shadow.artifact, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textMuted, fontSize: 14 }}>
        This deck has no slides yet.
      </div>
    );
  }
  const frame = {
    width: 680,
    maxWidth: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 10,
    boxShadow: shadow.artifact,
    padding: '44px 52px',
    display: 'flex',
    flexDirection: 'column',
  } as const;

  const kind = slideKind(s);

  const slideEl =
    kind === 'cover' ? (
      <div style={{ ...frame, background: 'linear-gradient(150deg,#1A1A2E,#2D3A8C)', color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)' }}>{c.eyebrow}</div>
        <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.04, marginTop: 'auto', letterSpacing: '-0.01em' }}>{s.title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>{s.subtitle ?? c.subtitle}</div>
      </div>
    ) : kind === 'section' ? (
      <div style={{ ...frame, background: 'linear-gradient(150deg,#2D3A8C,#1A1A2E)', color: '#fff', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, color: 'rgba(255,255,255,0.6)' }}>{c.eyebrow}</div>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, marginTop: 10, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
      </div>
    ) : kind === 'statement' ? (
      <div style={{ ...frame, background: '#fff', justifyContent: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, color: color.ink, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
        {s.subtitle ? <div style={{ fontSize: 16, color: color.textMuted, marginTop: 14 }}>{renderInline(s.subtitle)}</div> : null}
      </div>
    ) : (
      <div style={{ ...frame, background: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: color.indigo }}>{c.eyebrow}</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, color: color.ink, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
        <ul style={{ marginTop: 18, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(s.bullets ?? []).map((b, i) => (
            <li key={i} style={{ fontSize: 17, lineHeight: 1.4, color: color.textSlate }}>{renderInline(b)}</li>
          ))}
        </ul>
      </div>
    );

  if (!s.notes) return slideEl;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 680, maxWidth: '100%' }}>
      {slideEl}
      <div style={{ fontSize: 13, lineHeight: 1.5, color: color.textMuted, borderLeft: '3px solid #E6E8EF', paddingLeft: 12 }}>
        <span style={{ fontWeight: 700, color: color.textSlate }}>Speaker notes. </span>
        {renderInline(s.notes)}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test**

Run: `cd apps/web && npx vitest run src/artifacts/renderers/DeckView.test.ts`
Expected: PASS (2 describe blocks, 2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types.ts apps/web/src/artifacts/renderers/DeckView.tsx apps/web/src/artifacts/renderers/DeckView.test.ts
git commit -m "feat(deck): render section/statement layouts + speaker notes in DeckView"
```

---

### Task 5: Python — Slide model + pptx section/statement layouts and speaker notes

**Files:**
- Modify: `services/artifacts/app/models.py` (the `Slide` model, ~line 57)
- Modify: `services/artifacts/app/pptx_builder.py`
- Test: `services/artifacts/tests/test_builders.py` (add one test)

- [ ] **Step 1: Write the failing test**

Add to `services/artifacts/tests/test_builders.py` (it already imports `DeckContent`, `build_deck`, `Presentation`, `io`):
```python
def test_deck_exports_speaker_notes_and_section_layout():
    c = DeckContent(
        kind="Deck", eyebrow="ATLAS · BOARD", title="Q2", subtitle="x",
        slides=[
            {"isCover": True, "title": "Q2"},
            {"title": "Part Two", "layout": "section"},
            {"title": "Growth up 40%", "bullets": ["Enterprise led"], "notes": "Mention the Q2 deal."},
        ],
    )
    data = build_deck(c, "Q2 Deck")
    prs = Presentation(io.BytesIO(data))
    assert len(prs.slides) == 3
    # speaker notes land on the third slide's notes page
    assert "Q2 deal" in prs.slides[2].notes_slide.notes_text_frame.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/artifacts && . .venv/bin/activate && pytest tests/test_builders.py::test_deck_exports_speaker_notes_and_section_layout -v`
Expected: FAIL — `Slide` rejects `notes`/`layout` (extra fields ignored → the notes page is empty; assertion fails).

- [ ] **Step 3: Add the fields to the Pydantic model**

In `services/artifacts/app/models.py`, replace the `Slide` model with:
```python
class Slide(BaseModel):
    title: str
    bullets: list[str] | None = Field(default=None, max_length=30)
    notes: str | None = None
    layout: Literal["section", "statement"] | None = None
    isCover: bool | None = None
    subtitle: str | None = None
```
(`Literal` is already imported at the top of `models.py`.)

- [ ] **Step 4: Add the layout builders + notes handling**

In `services/artifacts/app/pptx_builder.py`, add these two functions after `_content` (before `build_deck`):
```python
def _section(slide, deck: DeckContent, s: Slide):
    _bg(slide, brand.INDIGO)
    _text(slide, 0.9, 0.7, 11, 0.4, deck.eyebrow.upper(), size=12, color=brand.CORAL, bold=True)
    _text(slide, 0.9, 3.0, 11.5, 1.6, s.title, size=40, color=brand.WHITE, bold=True, font=brand.SERIF_FONT)


def _statement(slide, deck: DeckContent, s: Slide):
    _bg(slide, brand.WHITE)
    _text(slide, 0.9, 2.8, 11.5, 2.0, s.title, size=34, color=brand.INK, bold=True, font=brand.SERIF_FONT)
    if s.subtitle:
        _text(slide, 0.9, 4.7, 11.5, 0.8, s.subtitle, size=16, color=brand.INDIGO)
```

Then replace the loop body in `build_deck` with:
```python
    for s in content.slides:
        slide = prs.slides.add_slide(blank)
        if s.isCover:
            _cover(slide, content, s)
        elif s.layout == "section":
            _section(slide, content, s)
        elif s.layout == "statement":
            _statement(slide, content, s)
        else:
            _content(slide, content, s)
        if s.notes:
            slide.notes_slide.notes_text_frame.text = s.notes
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/artifacts && . .venv/bin/activate && pytest tests/test_builders.py -k deck -v`
Expected: PASS — both the existing `test_deck_is_valid_pptx_with_one_slide_per_input` and the new notes/section test.

- [ ] **Step 6: Commit**

```bash
git add services/artifacts/app/models.py services/artifacts/app/pptx_builder.py services/artifacts/tests/test_builders.py
git commit -m "feat(deck): export section/statement layouts + speaker notes to pptx"
```

---

### Task 6: Full-suite verify + Phase-4 quality gate

**Files:** none (verification only).

- [ ] **Step 1: Run all three suites**

```bash
cd services/bff && npm test        # expect green (52 baseline + new deck tests)
cd ../../apps/web && npm test      # expect green (34 baseline + DeckView test)
cd ../services/artifacts && . .venv/bin/activate && pytest -q   # expect green (14 baseline + new deck test)
```
Expected: all green. If a baseline test broke, it is almost certainly the root `prompt.test.ts` Deck assertion — confirm Task 3 Step 4 was applied.

- [ ] **Step 2: Run the Phase-4 eval loop (the quality gate)**

Bring the stack up (BFF → live GreenNode; artifacts service for export — see `ONBOARDING.md`). Generate each prompt in `docs/artifact-packs/deck/EVAL-PROMPTS.md`, export each to pptx and open it, and score every output against `docs/artifact-packs/deck/RUBRIC.md`. Iterate the `guidance`/archetype text (Tasks 2–3) until the set passes: **all ★ checks met, no fabricated data.** Record the scorecard.

- [ ] **Step 3: Update the program doc + commit**

Mark Deck as the first shipped pack in `docs/superpowers/specs/2026-07-01-artifact-platform-program.md` (and `SPEC.md` if deck depth is user-facing). Commit:
```bash
git add docs/superpowers/specs/2026-07-01-artifact-platform-program.md SPEC.md
git commit -m "docs: Deck pack (P0–P1) shipped — passes rubric on the eval set"
```

- [ ] **Step 4: Finish the branch**

Use `superpowers:finishing-a-development-branch` to merge `deck-pack` into `main`.

---

## Self-review notes (author)

- **Spec coverage:** Charter P0 (guidance + archetypes + speaker notes) → Tasks 1–5; P1 (section dividers + layout enum) → Tasks 1/4/5 (`layout: section|statement`). Rubric/eval gate → Task 6. Chart slides and the web archetype picker are explicitly deferred (charter "P2/deferred" + Platform-coordination note).
- **Type consistency:** `Slide` gains `notes?: string` and `layout?: 'section'|'statement'` identically across bff zod (`z.enum(['section','statement'])`), web TS, and Python (`Literal["section","statement"]`). `guidance(arch?: Archetype)` matches the frozen contract; `slideKind` returns the four kinds used by both the renderer and its test.
- **No placeholders:** every code step shows complete code; every run step gives an exact command + expected result.
