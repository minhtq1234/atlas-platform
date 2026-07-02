# Deep Generation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in "Deep" generation tier — a Platform BFF pipeline `Outline → Draft → adversarial rubric-Critic → Revise` (adaptive, cap 2 rounds) behind `mode:'deep'` on `BuildRequest` — that produces deeper artifacts than the single turn, is degrade-safe (never worse than fast-path), and ships with an on-demand eval harness that measures the depth lift.

**Architecture:** `generate.ts` `produceContent` routes `mode:'deep'` to a new Platform module `deep/pipeline.ts` instead of the single `runModel` call; the pipeline is a chain of `runModel`-backed stages, fully injectable (`callModel`, `parse`, `now`) so it unit-tests without a network. It returns the same `ArtifactContent`, so canvas/versions/export/streaming are unchanged. The critic is anchored to a shared depth rubric that the eval judge reuses. Sovereignty unchanged (all stages → GreenNode via `runModel`).

**Tech Stack:** Node + TS + zod + vitest. Reuses `runModel` (modelClient), `generateSystem`/`generateUser` (prompt), `parseContent`/`extractJson` (generate), the existing `onStage` streaming and `degraded` metadata.

**Success:** existing suites stay green (BFF 62 · web 34 · Python 24); fast path byte-unchanged (`mode` defaults `'fast'`); `runDeepPipeline` unit tests prove the full fallback ladder; `generate({mode:'deep'})` routes to the pipeline; the eval harness runs on-demand and is skipped in normal CI. Web toggle + Phase 2 (decomposition) are out of scope.

---

## Design invariants
- **Degrade-safe.** The pipeline always holds the best valid `ArtifactContent` so far. Outline fails → single-turn; draft invalid → self-heal retry → single-turn; critic/revise fails → keep last valid draft. Only a pre-first-valid-draft total failure propagates to `produceContent`'s existing `catch` → template.
- **Fast path untouched.** `mode` is optional, default `'fast'`; when not `'deep'`, `produceContent` behaves exactly as today.
- **Injectable pipeline.** `runDeepPipeline` takes `callModel`/`parse`/`now` in `deps` so it's tested with fakes (no model, deterministic clock).
- **No new contract change.** The outliner/critic use the module's existing `shapeHint`+`guidance` via `generateSystem`; packs are untouched. (Per-type rubric = Phase 3.)
- **Rubric is shared** between the critic and the eval judge, defined once in `deep/rubric.ts`.

## File structure (all under `services/bff/src/`)
- Modify `types.ts` — add `mode: z.enum(['fast','deep']).optional()` to `BuildRequest`.
- Create `deep/rubric.ts` — `DEPTH_RUBRIC` string.
- Create `deep/prompts.ts` — stage prompt builders + `CritiqueResult` schema.
- Create `deep/prompts.test.ts` — prompt-builder unit tests.
- Create `deep/pipeline.ts` — `runDeepPipeline` + `DeepDeps`/`DeepInput`/`DeepResult`.
- Create `deep/pipeline.test.ts` — the fallback-ladder unit tests (mocked `callModel`).
- Modify `generate.ts` — route `mode:'deep'` to `runDeepPipeline`.
- Create `generate.deep.test.ts` — wiring test (pipeline mocked).
- Create `deep/judge.ts` — `judgeSystem`/`judgeUser`/`judgeDepth` + `DepthScore`.
- Create `deep/judge.test.ts` — judge-builder unit tests.
- Create `deep/eval.test.ts` — on-demand live eval (skipped unless `RUN_DEEP_EVAL`).
- Modify `SPEC.md` — note the Deep tier under §5/§10.

---

## Task 1: `mode` flag on `BuildRequest`

**Files:** Modify `services/bff/src/types.ts` · Test `services/bff/src/types.test.ts`

- [ ] **Step 1: Write the failing test** — append to `services/bff/src/types.test.ts`:

```ts
import { BuildRequest } from './types';

describe('BuildRequest.mode', () => {
  it('accepts fast/deep and defaults undefined', () => {
    expect(BuildRequest.parse({ brief: 'b', type: 'Doc', modelId: 'm' }).mode).toBeUndefined();
    expect(BuildRequest.parse({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'deep' }).mode).toBe('deep');
    expect(BuildRequest.safeParse({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'nope' }).success).toBe(false);
  });
});
```
(If `types.test.ts` doesn't already import `BuildRequest`, add it to the existing import from `./types`.)

- [ ] **Step 2: Run — FAIL** — `cd services/bff && npx vitest run src/types.test.ts` → the new case fails (`mode` unknown / not rejected).

- [ ] **Step 3: Implement** — in `services/bff/src/types.ts`, add one line to the `BuildRequest` object, after `archetypeId`:

```ts
  archetypeId: z.string().max(60).optional(),
  /** 'deep' opts into the multi-agent depth pipeline; default single-turn. */
  mode: z.enum(['fast', 'deep']).optional(),
});
```

- [ ] **Step 4: Run — PASS** — `cd services/bff && npx vitest run src/types.test.ts && npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add services/bff/src/types.ts services/bff/src/types.test.ts
git commit -m "feat(deep): mode:'fast'|'deep' flag on BuildRequest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Rubric + stage prompt builders

**Files:** Create `services/bff/src/deep/rubric.ts`, `deep/prompts.ts` · Test `deep/prompts.test.ts`

- [ ] **Step 1: Write the failing test** — create `services/bff/src/deep/prompts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  outlineSystem, draftSystem, draftUser,
  critiqueSystem, critiqueUser, CritiqueResult,
  reviseSystem, reviseUser,
} from './prompts';

const req = { brief: 'ship X', type: 'Doc', modelId: 'm' } as any;

describe('deep prompt builders', () => {
  it('outlineSystem asks for a JSON plan of units+points, not the artifact', () => {
    const s = outlineSystem('Doc', 'en');
    expect(s).toContain('"units"');
    expect(s).toContain('points');
    expect(s.toLowerCase()).toContain('plan');
  });
  it('draftSystem extends generateSystem with a plan-expansion instruction; draftUser carries <plan>', () => {
    const s = draftSystem('Doc', 'en');
    expect(s).toContain('"kind":"Doc"');       // inherited from generateSystem SHAPE
    expect(s).toContain('<plan>');
    const u = draftUser(req, [], null, '{"units":[]}');
    expect(u).toContain('<brief>ship X</brief>');
    expect(u).toContain('<plan>\n{"units":[]}\n</plan>');
  });
  it('critiqueSystem is rubric-anchored and demands findings-not-scores', () => {
    const s = critiqueSystem('Doc');
    expect(s).toContain('"done"');
    expect(s).toContain('"findings"');
    expect(s.toLowerCase()).toContain('do not give a score');
    expect(s).toContain('Specificity'); // from the rubric
  });
  it('critiqueUser wraps brief + current', () => {
    expect(critiqueUser('{"kind":"Doc"}', 'b')).toBe('<brief>b</brief>\n<current>\n{"kind":"Doc"}\n</current>');
  });
  it('CritiqueResult validates the shape', () => {
    expect(CritiqueResult.safeParse({ done: false, findings: ['x'] }).success).toBe(true);
    expect(CritiqueResult.safeParse({ done: true, findings: [] }).success).toBe(true);
    expect(CritiqueResult.safeParse({ findings: ['x'] }).success).toBe(false);
  });
  it('reviseSystem extends generateSystem; reviseUser wraps current + findings', () => {
    expect(reviseSystem('Doc', 'en')).toContain('<findings>');
    expect(reviseUser('{"kind":"Doc"}', ['a', 'b'])).toBe('<current>\n{"kind":"Doc"}\n</current>\n<findings>\n- a\n- b\n</findings>');
  });
});
```

- [ ] **Step 2: Run — FAIL** — `cd services/bff && npx vitest run src/deep/prompts.test.ts` → module not found.

- [ ] **Step 3a: Create `services/bff/src/deep/rubric.ts`:**

```ts
/** The shared depth bar the critic optimizes to and the eval judge scores against. */
export const DEPTH_RUBRIC = [
  'A DEEP artifact scores high on ALL of:',
  '- Specificity: concrete claims, names, and details — not generic statements that fit any company.',
  '- Non-obviousness: at least one insight, tradeoff, or risk a template would miss.',
  '- Quantification: numbers where the brief supports them, internally consistent across the artifact.',
  '- No filler: every section/slide/bullet earns its place; no restated headings or empty transitions.',
].join('\n');
```

- [ ] **Step 3b: Create `services/bff/src/deep/prompts.ts`:**

```ts
import { z } from 'zod';
import type { ArtifactType, BuildRequest } from '../types';
import type { Archetype } from '../artifacts/module';
import { generateSystem, generateUser } from '../prompt';
import { DEPTH_RUBRIC } from './rubric';

/** Stage 1 — plan (NOT the artifact). The user message reuses generateUser(). */
export function outlineSystem(type: ArtifactType, lang: 'en' | 'vi'): string {
  return [
    `You are Atlas, planning a ${type} before writing it.`,
    'Break it into its natural units (a Doc → sections, a Deck → slides, a Report → sections, etc.).',
    'For EACH unit, list the specific substantive points it must make — concrete, non-obvious, quantified where the brief supports it. Plan substance, not headings.',
    'Respond with ONLY this JSON object — no prose:',
    '{"units":[{"label":string,"points":string[]}]}',
    lang === 'vi' ? 'Write the points in Vietnamese.' : 'Write the points in English.',
  ].join('\n');
}

/** Stage 2 — draft the artifact, expanding the plan. */
export function draftSystem(type: ArtifactType, lang: 'en' | 'vi', arch?: Archetype): string {
  return `${generateSystem(type, lang, arch)}\nA <plan> is provided in the user message: expand every point into specific, substantive content. Every block must earn its place — no filler.`;
}
export function draftUser(req: BuildRequest, context: string[], exemplar: string | null, outlineJson: string): string {
  return `${generateUser(req, context, exemplar)}\n<plan>\n${outlineJson}\n</plan>`;
}

/** Stage 3 — adversarial critic. Returns findings, never a score. */
export const CritiqueResult = z.object({
  done: z.boolean(),
  findings: z.array(z.string().max(600)).max(30),
});
export type CritiqueResult = z.infer<typeof CritiqueResult>;

export function critiqueSystem(type: ArtifactType): string {
  return [
    `You are a demanding editor reviewing a ${type} for DEPTH. Hunt genericness.`,
    DEPTH_RUBRIC,
    'List specific, actionable findings — each names WHERE it is generic/boilerplate/inconsistent and WHAT an expert would add. Do not rewrite the artifact. Do not give a score.',
    'If the artifact already meets the rubric with nothing material to fix, set "done":true and "findings":[].',
    'Respond with ONLY this JSON object — no prose:',
    '{"done":boolean,"findings":string[]}',
  ].join('\n');
}
export function critiqueUser(currentJson: string, brief: string): string {
  return `<brief>${brief}</brief>\n<current>\n${currentJson}\n</current>`;
}

/** Stage 4 — revise to address the findings. */
export function reviseSystem(type: ArtifactType, lang: 'en' | 'vi', arch?: Archetype): string {
  return `${generateSystem(type, lang, arch)}\nRevise the <current> artifact to address EVERY item in <findings>. Return the full updated artifact JSON. Keep what is already strong; deepen what is weak.`;
}
export function reviseUser(currentJson: string, findings: string[]): string {
  return `<current>\n${currentJson}\n</current>\n<findings>\n- ${findings.join('\n- ')}\n</findings>`;
}
```

- [ ] **Step 4: Run — PASS** — `cd services/bff && npx vitest run src/deep/prompts.test.ts && npm run typecheck`.

- [ ] **Step 5: Commit**
```bash
git add services/bff/src/deep/rubric.ts services/bff/src/deep/prompts.ts services/bff/src/deep/prompts.test.ts
git commit -m "feat(deep): depth rubric + stage prompt builders (outline/draft/critic/revise)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: The pipeline (`runDeepPipeline`) + fallback ladder

**Files:** Create `services/bff/src/deep/pipeline.ts` · Test `deep/pipeline.test.ts`

This is the core. `deps.callModel` is injected so tests drive stage outputs deterministically; `deps.parse` mirrors `generate.parseContent` (a fake in tests); `deps.now` is an injectable clock for the budget test.

- [ ] **Step 1: Write the failing test** — create `services/bff/src/deep/pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runDeepPipeline, type DeepDeps, type DeepInput } from './pipeline';

const doc = (tag: string) => ({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: [tag] } as any);
const input: DeepInput = { req: { brief: 'b', type: 'Doc', modelId: 'm' } as any, arch: undefined, context: [], exemplar: null };

// parse: JSON.parse but forces kind (like generate.parseContent); throws on 'BAD'.
const parse = (raw: string, type: any) => {
  if (raw === 'BAD') throw new Error('invalid');
  const o = JSON.parse(raw); o.kind = type; return o;
};
const findings = JSON.stringify({ done: false, findings: ['§1 is generic'] });
const clean = JSON.stringify({ done: true, findings: [] });

function deps(scripted: string[], over: Partial<DeepDeps> = {}): DeepDeps {
  const calls = [...scripted];
  return { callModel: vi.fn(async () => calls.shift() ?? clean), parse, ...over };
}

describe('runDeepPipeline', () => {
  it('happy path: outline → draft → critic(finds) → revise → critic(clean) stops', async () => {
    const d = deps([
      '{"units":[]}',                 // outline
      JSON.stringify(doc('draft')),   // draft
      findings,                        // critic round 1
      JSON.stringify(doc('revised')), // revise
      clean,                           // critic round 2 → done
    ]);
    const r = await runDeepPipeline(input, d);
    expect(r.content.paragraphs).toEqual(['revised']);
    expect(r.degradedReason).toBeUndefined();
  });

  it('stops early when the first critic returns done', async () => {
    const call = vi.fn(async () => '');
    (call as any).mockResolvedValueOnce('{"units":[]}')
      .mockResolvedValueOnce(JSON.stringify(doc('draft')))
      .mockResolvedValueOnce(clean); // critic done immediately
    const r = await runDeepPipeline(input, { callModel: call, parse });
    expect(r.content.paragraphs).toEqual(['draft']);
    expect(call).toHaveBeenCalledTimes(3); // no revise
  });

  it('caps at maxRounds critic→revise iterations', async () => {
    // always finds; each revise valid → should stop at maxRounds=2 revises
    const call = vi.fn(async (_s: string, u: string) =>
      u.includes('<plan>') ? JSON.stringify(doc('draft'))
      : u.includes('<findings>') ? JSON.stringify(doc('rev'))
      : u.includes('units') || !u.includes('<current>') ? '{"units":[]}'
      : findings);
    const r = await runDeepPipeline(input, { callModel: call as any, parse, maxRounds: 2 });
    expect(r.content.paragraphs).toEqual(['rev']);
    // outline + draft + (critic+revise)*2 = 6 calls
    expect(call).toHaveBeenCalledTimes(6);
  });

  it('outline failure → single-turn fast path (degraded)', async () => {
    const call = vi.fn(async (s: string, u: string) => {
      if (!u.includes('<plan>') && !u.includes('<current>')) throw new Error('outline down'); // outline call throws
      return JSON.stringify(doc('single'));
    });
    // first call is the outline (throws); singleTurn re-calls with generateUser (no <plan>) → returns 'single'
    const r = await runDeepPipeline(input, { callModel: call as any, parse });
    expect(r.content.paragraphs).toEqual(['single']);
    expect(r.degradedReason).toContain('outline');
  });

  it('invalid draft → self-heal retry → single-turn if still invalid', async () => {
    const d = deps(['{"units":[]}', 'BAD', 'BAD', JSON.stringify(doc('single'))]);
    const r = await runDeepPipeline(input, d);
    expect(r.content.paragraphs).toEqual(['single']);
    expect(r.degradedReason).toContain('draft');
  });

  it('invalid revise → keeps the last valid draft', async () => {
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), findings, 'BAD']);
    const r = await runDeepPipeline(input, d);
    expect(r.content.paragraphs).toEqual(['draft']); // revise threw → keep draft
  });

  it('unparseable critique → keeps the draft (loop breaks)', async () => {
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), 'not json']);
    const r = await runDeepPipeline(input, d);
    expect(r.content.paragraphs).toEqual(['draft']);
  });

  it('budget exceeded → returns best so far before the next round', async () => {
    let t = 0;
    const d = deps(
      ['{"units":[]}', JSON.stringify(doc('draft')), findings, JSON.stringify(doc('rev'))],
      { now: () => (t += 1000), budgetMs: 500 }, // clock jumps past budget on the first loop check
    );
    const r = await runDeepPipeline(input, d);
    expect(r.content.paragraphs).toEqual(['draft']); // budget hit before round 1 critic
    expect(r.degradedReason).toContain('budget');
  });

  it('emits stage labels', async () => {
    const onStage = vi.fn();
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), clean], { onStage });
    await runDeepPipeline(input, d);
    expect(onStage.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['Outlining…', 'Drafting…', 'Critiquing…']),
    );
  });
});
```

- [ ] **Step 2: Run — FAIL** — `cd services/bff && npx vitest run src/deep/pipeline.test.ts` → module not found.

- [ ] **Step 3: Create `services/bff/src/deep/pipeline.ts`:**

```ts
import type { ArtifactContent, ArtifactType, BuildRequest } from '../types';
import type { Archetype } from '../artifacts/module';
import { generateSystem, generateUser } from '../prompt';
import {
  outlineSystem, draftSystem, draftUser,
  critiqueSystem, critiqueUser, CritiqueResult,
  reviseSystem, reviseUser,
} from './prompts';

export interface DeepDeps {
  /** Raw model text for (system,user). Injected so the pipeline tests without a network. */
  callModel: (system: string, user: string) => Promise<string>;
  /** Parse+validate raw text into ArtifactContent (= generate.parseContent). Throws on invalid. */
  parse: (raw: string, type: ArtifactType) => ArtifactContent;
  onStage?: (label: string) => void;
  now?: () => number;
  maxRounds?: number;   // critic→revise cap (default 2)
  budgetMs?: number;    // wall-clock (default 60000)
}
export interface DeepInput {
  req: BuildRequest;
  arch?: Archetype;
  context: string[];
  exemplar: string | null;
}
export interface DeepResult {
  content: ArtifactContent;
  degradedReason?: string;
}

/**
 * Outline → Draft → (Critic → Revise)* depth pipeline. Always returns the best valid
 * ArtifactContent produced. May throw ONLY before the first valid draft exists (outline
 * or draft path fully fails) — the caller (produceContent) then degrades to a template.
 */
export async function runDeepPipeline(input: DeepInput, deps: DeepDeps): Promise<DeepResult> {
  const { req, arch, context, exemplar } = input;
  const type = req.type;
  const lang = req.lang ?? 'en';
  const onStage = deps.onStage ?? (() => {});
  const now = deps.now ?? (() => Date.now());
  const maxRounds = deps.maxRounds ?? 2;
  const budgetMs = deps.budgetMs ?? 60000;
  const start = now();

  const singleTurn = async (reason: string): Promise<DeepResult> => {
    const raw = await deps.callModel(generateSystem(type, lang, arch), generateUser(req, context, exemplar));
    return { content: deps.parse(raw, type), degradedReason: reason };
  };

  // Stage 1 — outline (best-effort; failure → single-turn fast path)
  onStage('Outlining…');
  let outlineJson: string;
  try {
    outlineJson = await deps.callModel(outlineSystem(type, lang), generateUser(req, context, exemplar));
  } catch {
    return singleTurn('deep: outline failed → single-turn');
  }

  // Stage 2 — draft (invalid → one self-heal retry → single-turn)
  onStage('Drafting…');
  let best: ArtifactContent;
  try {
    best = deps.parse(await deps.callModel(draftSystem(type, lang, arch), draftUser(req, context, exemplar, outlineJson)), type);
  } catch {
    try {
      const retryUser = `${draftUser(req, context, exemplar, outlineJson)}\nYour previous output was not valid JSON for the shape. Return ONLY the valid JSON object.`;
      best = deps.parse(await deps.callModel(draftSystem(type, lang, arch), retryUser), type);
    } catch {
      return singleTurn('deep: draft invalid → single-turn');
    }
  }

  // Stages 3+4 — critic → revise (adaptive, capped, budgeted)
  let degradedReason: string | undefined;
  for (let round = 0; round < maxRounds; round++) {
    if (now() - start > budgetMs) { degradedReason = 'deep: budget hit → best so far'; break; }
    onStage('Critiquing…');
    let critique: CritiqueResult;
    try {
      critique = CritiqueResult.parse(JSON.parse(await deps.callModel(critiqueSystem(type), critiqueUser(JSON.stringify(best), req.brief))));
    } catch {
      break; // critique unusable → keep best (still valid)
    }
    if (critique.done || critique.findings.length === 0) break; // stops early when clean
    onStage('Revising…');
    try {
      best = deps.parse(await deps.callModel(reviseSystem(type, lang, arch), reviseUser(JSON.stringify(best), critique.findings)), type);
    } catch {
      break; // revise invalid → keep the last valid draft (never lose progress)
    }
  }

  return { content: best, degradedReason };
}
```

- [ ] **Step 4: Run — PASS** — `cd services/bff && npx vitest run src/deep/pipeline.test.ts && npm run typecheck`. All 9 cases green.

- [ ] **Step 5: Commit**
```bash
git add services/bff/src/deep/pipeline.ts services/bff/src/deep/pipeline.test.ts
git commit -m "feat(deep): runDeepPipeline (outline→draft→critic→revise) + fallback ladder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire `mode:'deep'` into `produceContent`

**Files:** Modify `services/bff/src/generate.ts` · Test `services/bff/src/generate.deep.test.ts`

- [ ] **Step 1: Write the failing test** — create `services/bff/src/generate.deep.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Force generation on (bypass model-config gate) and stub the pipeline.
vi.mock('./config', async (orig) => ({ ...(await orig<typeof import('./config')>()), generationEnabled: () => true }));
vi.mock('./deep/pipeline', () => ({
  runDeepPipeline: vi.fn(async () => ({ content: { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['deep'] } })),
}));

import { generate } from './generate';
import { runDeepPipeline } from './deep/pipeline';

describe('produceContent routing', () => {
  it('routes mode:deep through the deep pipeline and returns its content', async () => {
    const art = await generate({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'deep' } as any, 'n');
    expect(runDeepPipeline).toHaveBeenCalledOnce();
    expect(art.versions[0].content).toMatchObject({ kind: 'Doc', paragraphs: ['deep'] });
  });
});
```

- [ ] **Step 2: Run — FAIL** — `cd services/bff && npx vitest run src/generate.deep.test.ts` → `runDeepPipeline` not called (no routing yet).

- [ ] **Step 3: Implement** — in `services/bff/src/generate.ts`:

Add the import near the other `./` imports:
```ts
import { runDeepPipeline } from './deep/pipeline';
```
In `produceContent`, inside the `try`, right after `exemplar` is fetched and before the existing `onStage('Composing …')` line, add the deep branch:
```ts
    const exemplar = await exemplarProvider.getExemplar(req.type, req.archetypeId);
    const arch = archetype(req.archetypeId ?? detectArchetype(req.brief));
    if (req.mode === 'deep') {
      const { content, degradedReason } = await runDeepPipeline(
        { req, arch, context, exemplar },
        {
          callModel: (system, user) => runModel(system, user, req.modelId).then((r) => r.text),
          parse: parseContent,
          onStage,
        },
      );
      return { content, viaModel: true, degradedReason };
    }
    onStage(`Composing ${req.type.toLowerCase()}…`);
```
(The existing `const arch = archetype(...)` line below the old exemplar line is now redundant — move it up as shown and delete the duplicate. The single-turn branch keeps using `arch`.)

- [ ] **Step 4: Run — PASS** — `cd services/bff && npm run typecheck && npx vitest run`. Full suite green (62 + prompts + pipeline + this wiring test). `generate.test.ts` (extractJson) unaffected.

- [ ] **Step 5: Commit**
```bash
git add services/bff/src/generate.ts services/bff/src/generate.deep.test.ts
git commit -m "feat(deep): route mode:'deep' through runDeepPipeline in produceContent

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Eval harness (depth judge + on-demand runner)

**Files:** Create `services/bff/src/deep/judge.ts`, `deep/judge.test.ts`, `deep/eval.test.ts`

- [ ] **Step 1: Write the failing test** — create `services/bff/src/deep/judge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { judgeSystem, judgeUser, DepthScore } from './judge';

describe('depth judge', () => {
  it('judgeSystem is rubric-anchored on a 1-5 scale', () => {
    const s = judgeSystem('Doc');
    expect(s).toContain('1');
    expect(s).toContain('5');
    expect(s).toContain('Specificity');   // from the shared rubric
    expect(s).toContain('"score"');
  });
  it('judgeUser wraps brief + artifact', () => {
    expect(judgeUser('{"kind":"Doc"}', 'b')).toBe('<brief>b</brief>\n<artifact>\n{"kind":"Doc"}\n</artifact>');
  });
  it('DepthScore validates 1-5 + rationale', () => {
    expect(DepthScore.safeParse({ score: 4, rationale: 'ok' }).success).toBe(true);
    expect(DepthScore.safeParse({ score: 9, rationale: 'x' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL** — `cd services/bff && npx vitest run src/deep/judge.test.ts` → module not found.

- [ ] **Step 3a: Create `services/bff/src/deep/judge.ts`:**

```ts
import { z } from 'zod';
import type { ArtifactType } from '../types';
import { DEPTH_RUBRIC } from './rubric';

export const DepthScore = z.object({ score: z.number().min(1).max(5), rationale: z.string() });
export type DepthScore = z.infer<typeof DepthScore>;

export function judgeSystem(type: ArtifactType): string {
  return [
    `You are scoring a ${type} for DEPTH on a 1-5 scale (5 = an expert would be impressed; 1 = generic template).`,
    DEPTH_RUBRIC,
    'Respond with ONLY this JSON object — no prose: {"score":number,"rationale":string}',
  ].join('\n');
}
export function judgeUser(artifactJson: string, brief: string): string {
  return `<brief>${brief}</brief>\n<artifact>\n${artifactJson}\n</artifact>`;
}
export async function judgeDepth(
  callModel: (system: string, user: string) => Promise<string>,
  type: ArtifactType,
  artifactJson: string,
  brief: string,
): Promise<DepthScore> {
  return DepthScore.parse(JSON.parse(await callModel(judgeSystem(type), judgeUser(artifactJson, brief))));
}
```

- [ ] **Step 3b: Create the on-demand runner `services/bff/src/deep/eval.test.ts`** (skipped unless `RUN_DEEP_EVAL`, so normal CI ignores it; needs a live model):

```ts
import { describe, it, expect } from 'vitest';
import { generate } from '../generate';
import { runModel } from '../modelClient';
import { judgeDepth } from './judge';

const MODEL = process.env.EVAL_MODEL ?? 'gn-llama3-70b';
const EVAL_SET = [
  { type: 'Doc' as const, brief: 'A one-page product strategy for a sovereign, AI-native document generator for VN enterprises.' },
  { type: 'Deck' as const, brief: 'A 6-slide board update on Q3 progress for an internal AI platform.' },
];

describe.skipIf(!process.env.RUN_DEEP_EVAL)('deep eval (live; RUN_DEEP_EVAL=1 + model env)', () => {
  const callModel = (s: string, u: string) => runModel(s, u, MODEL).then((r) => r.text);
  for (const item of EVAL_SET) {
    it(`deep depth >= fast depth for ${item.type}`, async () => {
      const base = { brief: item.brief, type: item.type, modelId: MODEL };
      const fast = await generate({ ...base, mode: 'fast' } as any, 'eval');
      const deep = await generate({ ...base, mode: 'deep' } as any, 'eval');
      const f = await judgeDepth(callModel, item.type, JSON.stringify(fast.versions[0].content), item.brief);
      const d = await judgeDepth(callModel, item.type, JSON.stringify(deep.versions[0].content), item.brief);
      console.log(`[eval ${item.type}] fast=${f.score} deep=${d.score} — ${d.rationale}`);
      expect(d.score).toBeGreaterThanOrEqual(f.score);
    }, 180000);
  }
});
```

- [ ] **Step 4: Run — PASS** — `cd services/bff && npx vitest run src/deep/judge.test.ts` (judge builders). Then confirm the eval is skipped in normal runs: `npx vitest run src/deep/eval.test.ts` → reports the suite skipped (0 failures). (Optional, needs GreenNode env: `RUN_DEEP_EVAL=1 MODEL_BASE_URL=… MODEL_API_KEY=… MODEL_NAME=… npx vitest run src/deep/eval.test.ts` to see the real fast-vs-deep depth scores.)

- [ ] **Step 5: Commit**
```bash
git add services/bff/src/deep/judge.ts services/bff/src/deep/judge.test.ts services/bff/src/deep/eval.test.ts
git commit -m "feat(deep): depth judge + on-demand fast-vs-deep eval (skipped in CI)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Full-suite verify + docs

**Files:** Modify `SPEC.md`

- [ ] **Step 1: Full tri-suite** — all green:
  - `cd services/bff && npm run typecheck && npx vitest run` (62 + Task1 + prompts + pipeline + wiring + judge; eval skipped)
  - `cd apps/web && npx tsc -p tsconfig.json --noEmit && npx vitest run` (34, unchanged)
  - `cd services/artifacts && . .venv/bin/activate && python -m pytest -q` (24, unchanged)

- [ ] **Step 2: SPEC.md** — in §5, after the "Exemplar toolkit" paragraph, add:
```markdown
**Deep generation tier (phase-1).** An opt-in `mode:'deep'` on generate runs a Platform pipeline `Outline → Draft → adversarial rubric-Critic → Revise` (adaptive, cap 2 rounds; `services/bff/src/deep/`) that trades latency for depth. Same `ArtifactContent` out; degrade-safe (outline/draft failure → single-turn; critic/revise failure → keep best); sovereign. A shared depth rubric anchors the critic and the on-demand eval judge (`RUN_DEEP_EVAL=1`). Fast single-turn stays the default. Phase-2 (parallel decomposition) is future.
```

- [ ] **Step 3: Commit + finish**
```bash
git add SPEC.md
git commit -m "docs: Deep generation tier (phase-1) in SPEC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Then use **superpowers:finishing-a-development-branch**.

---

## Self-review

**Spec coverage (design §3–§9):** flag on BuildRequest → Task 1; pipeline behind the seam (§3) → Task 4; four stages + adaptive cap-2 loop (§4) → Tasks 2,3; shared rubric + findings-not-scores critic (§5) → Tasks 2,3; robustness/fallback ladder + budgets (§6) → Task 3 (8 ladder tests); eval harness/judge (§7) → Task 5; testing (§8) → Tasks 2–5; no contract change (§5) → confirmed (only types.ts `mode` added). Phase 2/3 explicitly out of scope. **Web toggle deferred** (needs its own read of the web store) — flagged, not built; the pipeline is fully usable/eval-able via the API without it.

**Placeholder scan:** every step has exact code, paths, commands. No TBDs. The eval set briefs are concrete.

**Type consistency:** `runDeepPipeline(input: DeepInput, deps: DeepDeps): DeepResult` is defined in Task 3 and consumed identically in Task 4; `DeepDeps.callModel`/`parse`/`onStage`/`now`/`maxRounds`/`budgetMs` match between the pipeline, its tests, and the Task 4 wiring (`callModel` wraps `runModel(...).then(r=>r.text)`, `parse: parseContent`). `CritiqueResult`/`DepthScore` (zod) defined once (prompts.ts / judge.ts) and reused. `DEPTH_RUBRIC` defined once (rubric.ts), used by critic (Task 2) + judge (Task 5). `mode` enum matches between types.ts (Task 1) and the wiring check `req.mode === 'deep'` (Task 4).

**Circular-import check:** `deep/pipeline.ts` imports only from `../types`, `../artifacts/module`, `../prompt`, and `./prompts` — NOT from `../generate` (critique uses `JSON.parse`, artifact parsing is injected via `deps.parse`). `generate.ts` imports `runDeepPipeline`. One-directional; no cycle.
