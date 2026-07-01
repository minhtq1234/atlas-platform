import { z } from 'zod';

// Zod schemas mirroring the web app's ArtifactContent (apps/web/src/types.ts).
// These both validate model output and document the contract.

export const ArtifactType = z.enum(['Doc', 'Deck', 'Sheet', 'Dashboard', 'Report']);
export type ArtifactType = z.infer<typeof ArtifactType>;

export const DocContent = z.object({
  kind: z.literal('Doc'),
  eyebrow: z.string(),
  title: z.string(),
  meta: z.string(),
  paragraphs: z.array(z.string()).min(1).max(200),
  bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50).optional(),
  callout: z.object({ value: z.string(), label: z.string() }).optional(),
});

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

export const SheetContent = z.object({
  kind: z.literal('Sheet'),
  title: z.string(),
  columns: z.array(z.string()).min(1).max(50),
  rows: z.array(z.array(z.union([z.string(), z.number()])).max(50)).max(5000),
});

export const DashboardContent = z.object({
  kind: z.literal('Dashboard'),
  title: z.string(),
  subtitle: z.string(),
  tiles: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string().optional() })).max(24),
  series: z.object({
    label: z.string(),
    bars: z.array(z.object({ label: z.string(), value: z.number() })).max(1000),
  }),
});

export const ReportContent = z.object({
  kind: z.literal('Report'),
  eyebrow: z.string(),
  title: z.string(),
  asOf: z.string(),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).max(24),
  paragraphs: z.array(z.string()).min(1).max(200),
});

export const ArtifactContent = z.discriminatedUnion('kind', [
  DocContent,
  DeckContent,
  SheetContent,
  DashboardContent,
  ReportContent,
]);
export type ArtifactContent = z.infer<typeof ArtifactContent>;

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
