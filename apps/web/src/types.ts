// Atlas domain types — shared across composer, generation engine, renderers, store.

export type ArtifactType = 'Doc' | 'Deck' | 'Sheet' | 'Dashboard' | 'Report';

export const ARTIFACT_TYPES: ArtifactType[] = [
  'Doc',
  'Deck',
  'Sheet',
  'Dashboard',
  'Report',
];

/** A connected (or connectable) governed data source. UI-only in Phase 1. */
export interface SourceOption {
  key: string;
  label: string; // "HRCore · headcount view"
  desc: string;
  connected: boolean;
  /** false = exists but the user is not provisioned (permission-denied state). */
  accessible: boolean;
}

/** A GreenNode-hosted model option. Static list in Phase 1. */
export interface ModelOption {
  id: string;
  label: string; // "GreenNode Llama-3 70B"
}

/** An uploaded file used to ground a build. */
export interface UploadRef {
  id: string;
  name: string;
  sizeBytes: number;
  mime: string;
  /** Parsed text/preview used by the (mock) engine. */
  excerpt?: string;
}

/** Everything the generation engine needs to build an artifact. */
export interface BuildRequest {
  brief: string; // free-text prompt or template seed
  type: ArtifactType;
  templateId?: string;
  sourceKey?: string; // optional governed source (deferred backend)
  modelId: string;
  uploads?: UploadRef[];
  /** Constraint chips from the configure step, e.g. ["Q2 2026", "In Vietnamese"]. */
  brief_chips?: string[];
  lang?: 'en' | 'vi';
}

// ---- Artifact content models (what the renderers consume) ----

export interface DocContent {
  kind: 'Doc';
  eyebrow: string;
  title: string;
  meta: string;
  paragraphs: string[];
  bars?: { label: string; value: number }[]; // 0..1 heights
  callout?: { value: string; label: string };
}

export interface Slide {
  title: string;
  bullets?: string[];
  isCover?: boolean;
  subtitle?: string;
}
export interface DeckContent {
  kind: 'Deck';
  eyebrow: string;
  title: string;
  subtitle: string;
  slides: Slide[];
}

export interface SheetContent {
  kind: 'Sheet';
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface DashboardContent {
  kind: 'Dashboard';
  title: string;
  subtitle: string;
  tiles: { label: string; value: string; delta?: string }[];
  // Each bar carries a category label (e.g. a month) + a 0..1 height.
  series: { label: string; bars: { label: string; value: number }[] };
}

export interface ReportContent {
  kind: 'Report';
  eyebrow: string;
  title: string;
  asOf: string;
  stats: { value: string; label: string }[];
  paragraphs: string[];
}

export type ArtifactContent =
  | DocContent
  | DeckContent
  | SheetContent
  | DashboardContent
  | ReportContent;

/** A built artifact, possibly with multiple versions from chat iteration. */
export interface ArtifactVersion {
  id: string;
  createdAt: number;
  note: string; // what changed, e.g. "Initial build" / the follow-up prompt
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
  currentVersion: number; // index into versions
  /** OpenCode session backing this artifact (set by the BFF; enables context-aware revisions). */
  opencodeSessionId?: string;
  /** True when the BFF fell back to a template because the model errored. */
  degraded?: boolean;
  degradedReason?: string;
}
