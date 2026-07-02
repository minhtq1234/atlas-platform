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
