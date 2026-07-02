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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: ArtifactContent & Record<string, any>; // ArtifactContent at runtime; loosened for discriminated-union field access in tests
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
    // Include <current> tag to signal a fallback generation (distinguishes from outline calls in tests/routing).
    const raw = await deps.callModel(generateSystem(type, lang, arch), `${generateUser(req, context, exemplar)}\n<current>fallback</current>`);
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
