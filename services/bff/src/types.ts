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
  paragraphs: z.array(z.string()).min(1),
  bars: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  callout: z.object({ value: z.string(), label: z.string() }).optional(),
});

export const Slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()).optional(),
  isCover: z.boolean().optional(),
  subtitle: z.string().optional(),
});

export const DeckContent = z.object({
  kind: z.literal('Deck'),
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(Slide).min(1),
});

export const SheetContent = z.object({
  kind: z.literal('Sheet'),
  title: z.string(),
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
});

export const DashboardContent = z.object({
  kind: z.literal('Dashboard'),
  title: z.string(),
  subtitle: z.string(),
  tiles: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string().optional() })),
  series: z.object({ label: z.string(), bars: z.array(z.number()) }),
});

export const ReportContent = z.object({
  kind: z.literal('Report'),
  eyebrow: z.string(),
  title: z.string(),
  asOf: z.string(),
  stats: z.array(z.object({ value: z.string(), label: z.string() })),
  paragraphs: z.array(z.string()).min(1),
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
  id: z.string(),
  name: z.string(),
  sizeBytes: z.number(),
  mime: z.string(),
  excerpt: z.string().optional(),
});

export const BuildRequest = z.object({
  brief: z.string(),
  type: ArtifactType,
  templateId: z.string().optional(),
  sourceKey: z.string().optional(),
  modelId: z.string(),
  uploads: z.array(UploadRef).optional(),
  brief_chips: z.array(z.string()).optional(),
  lang: z.enum(['en', 'vi']).optional(),
});
export type BuildRequest = z.infer<typeof BuildRequest>;

export const GenerateBody = z.object({ req: BuildRequest, name: z.string() });
export const ReviseBody = z.object({
  type: ArtifactType,
  current: ArtifactContent,
  instruction: z.string(),
  modelId: z.string(),
  lang: z.enum(['en', 'vi']).optional(),
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
}
