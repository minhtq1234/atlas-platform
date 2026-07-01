import { z } from 'zod';
import { ArtifactContent, ArtifactType, type Artifact, type ArtifactVersion } from '../types';

export const Skill = z.enum(['clarify', 'plan', 'edit', 'answer']);
export type Skill = z.infer<typeof Skill>;

export const AgentAction = z.object({
  skill: Skill,
  message: z.string().max(4000),
  options: z.array(z.string().max(300)).max(6).optional(),
  plan: z.object({ steps: z.array(z.string().max(400)).min(1).max(8) }).optional(),
  content: ArtifactContent.optional(),
});
export type AgentAction = z.infer<typeof AgentAction>;

export type Awaiting = 'none' | 'plan-confirm';

export interface TurnInput {
  type: z.infer<typeof ArtifactType>;
  current: z.infer<typeof ArtifactContent>;
  message: string;
  modelId: string;
  lang?: 'en' | 'vi';
  sessionId?: string;
  awaiting?: Awaiting;
  plan?: { steps: string[] };
  confirm?: boolean;
  context?: string[]; // extracted attachment text — empty in v1 (seam)
}

export interface TurnResult {
  action: AgentAction;
  version: ArtifactVersion | null; // set only for `edit`
  awaiting: Awaiting;
}

export type { Artifact }; // re-export convenience
