import { z } from 'zod';
import { ArtifactContent } from './artifacts/registry';

// Zod schemas mirroring the web app's ArtifactContent (apps/web/src/types.ts).
// These both validate model output and document the contract.

export const ArtifactType = z.enum(['Doc', 'Deck', 'Sheet', 'Dashboard', 'Report']);
export type ArtifactType = z.infer<typeof ArtifactType>;

// Artifact content schemas now live in per-type modules (services/bff/src/artifacts/<type>/)
// composed into this discriminated union by the registry. Re-exported (value + type) so
// every existing `from './types'` import keeps working and local references below resolve.
export { ArtifactContent };

export const UploadRef = z.object({
  id: z.string().max(200),
  name: z.string().max(500),
  sizeBytes: z.number(),
  mime: z.string().max(200),
  excerpt: z.string().max(50000).optional(),
  docId: z.string().max(200).optional(),
});

export const BuildRequest = z.object({
  brief: z.string().max(8000),
  type: ArtifactType,
  templateId: z.string().max(200).optional(),
  sourceKey: z.string().max(200).optional(),
  modelId: z.string().max(200),
  uploads: z.array(UploadRef).max(20).optional(),
  brief_chips: z.array(z.string().max(200)).max(50).optional(),
  lang: z.enum(['en', 'vi']).optional(),
  archetypeId: z.string().max(60).optional(),
  /** 'deep' opts into the multi-agent depth pipeline; default single-turn. */
  mode: z.enum(['fast', 'deep']).optional(),
});
export type BuildRequest = z.infer<typeof BuildRequest>;

export const GenerateBody = z.object({ req: BuildRequest, name: z.string() });
export const AgentPlanBody = z.object({ req: BuildRequest });
export const AgentRunBody = z.object({
  req: BuildRequest,
  name: z.string().max(200),
  plan: z.object({ steps: z.array(z.string().max(400)).min(1).max(8) }),
});
export const ReviseBody = z.object({
  type: ArtifactType,
  current: ArtifactContent,
  instruction: z.string().max(4000),
  modelId: z.string().max(200),
  lang: z.enum(['en', 'vi']).optional(),
  /** Continue an existing OpenCode session so edits keep context. */
  opencodeSessionId: z.string().max(200).optional(),
  /** Adaptive skill-runtime state (plan → confirm → edit). */
  awaiting: z.enum(['none', 'plan-confirm']).optional(),
  plan: z.object({ steps: z.array(z.string().max(400)).max(8) }).optional(),
  confirm: z.boolean().optional(),
  /** Extracted attachment text — empty in v1 (seam for attachments). */
  context: z.array(z.string().max(50000)).max(20).optional(),
});

// Artifact shape returned to the web app (matches apps/web Artifact).
export interface ArtifactVersion {
  id: string;
  createdAt: number;
  note: string;
  content: ArtifactContent;
}
export interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  sourceLabel?: string;
  modelId: string;
  createdAt: number;
  versions: ArtifactVersion[];
  currentVersion: number;
  /** OpenCode session backing this artifact (for context-aware revisions). */
  opencodeSessionId?: string;
  /** True when generation fell back to a template because the model errored. */
  degraded?: boolean;
  degradedReason?: string;
}
