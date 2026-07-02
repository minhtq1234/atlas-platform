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
