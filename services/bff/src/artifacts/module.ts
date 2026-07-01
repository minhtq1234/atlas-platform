import type { z } from 'zod';
import type { ArtifactType } from '../types';

/** A curated document archetype (team-owned data; the registry ships only `general`). */
export interface Archetype {
  id: string;
  label: string;
  aliases: string[];
  sections: string[];
  guidance: string;
}

/**
 * One artifact type as a self-contained module. Pack teams implement this; the
 * Platform registry composes all modules. `schema` MUST be a raw ZodObject (it is
 * a discriminated-union member).
 */
export interface ArtifactTypeModule {
  type: ArtifactType;
  schema: z.ZodObject<{ kind: z.ZodLiteral<ArtifactType> } & Record<string, z.ZodTypeAny>>;
  shapeHint: string;
  guidance(archetypeId?: string): string;
  archetypes: Archetype[];
  exemplarKey: string;
}
