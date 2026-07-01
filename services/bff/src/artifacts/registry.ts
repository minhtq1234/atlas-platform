import { z } from 'zod';
import type { ArtifactType } from '../types';
import type { ArtifactTypeModule, Archetype } from './module';
import { docModule } from './doc';
import { deckModule } from './deck';
import { sheetModule } from './sheet';
import { dashboardModule } from './dashboard';
import { reportModule } from './report';

export const MODULES: ArtifactTypeModule[] = [docModule, deckModule, sheetModule, dashboardModule, reportModule];

export const ArtifactContent = z.discriminatedUnion(
  'kind',
  MODULES.map((m) => m.schema) as unknown as [z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> }>, ...z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> }>[]],
);
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
