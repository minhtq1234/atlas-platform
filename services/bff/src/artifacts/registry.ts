import { z } from 'zod';
import type { ArtifactType } from '../types';
import type { ArtifactTypeModule, Archetype } from './module';
import { docModule } from './doc';
import { deckModule } from './deck';
import { sheetModule } from './sheet';
import { dashboardModule } from './dashboard';
import { reportModule } from './report';
import { DocContent } from './doc/schema';
import { DeckContent } from './deck/schema';
import { SheetContent } from './sheet/schema';
import { DashboardContent } from './dashboard/schema';
import { ReportContent } from './report/schema';

export const MODULES: ArtifactTypeModule[] = [docModule, deckModule, sheetModule, dashboardModule, reportModule];

// The union is built from the CONCRETE per-type schemas so `z.infer` keeps every
// field (a `MODULES.map((m) => m.schema)` union would collapse to `{ kind }`-only,
// because the module contract intentionally widens `schema`). MODULES still drives the
// runtime registries below. When adding a type: add its module to MODULES AND its schema
// here — the "parses every kind" registry test asserts every MODULES type parses, so a
// forgotten schema fails CI.
export const ArtifactContent = z.discriminatedUnion('kind', [
  DocContent,
  DeckContent,
  SheetContent,
  DashboardContent,
  ReportContent,
]);
export type ArtifactContent = z.infer<typeof ArtifactContent>;

export const SHAPE = Object.fromEntries(MODULES.map((m) => [m.type, m.shapeHint])) as Record<ArtifactType, string>;

export function moduleFor(type: ArtifactType): ArtifactTypeModule {
  return MODULES.find((m) => m.type === type)!;
}

/** All archetypes across modules, keyed by id (always includes the shared `general`). */
export const ARCHETYPES: Record<string, Archetype> = Object.fromEntries(
  MODULES.flatMap((m) => m.archetypes).map((a) => [a.id, a]),
);

export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of Object.values(ARCHETYPES)) {
    if (a.aliases.length && a.aliases.some((alias) => b.includes(alias))) return a.id;
  }
  return 'general';
}
export function archetype(id?: string): Archetype {
  return (id && ARCHETYPES[id]) || ARCHETYPES.general;
}
