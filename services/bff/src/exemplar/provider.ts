import { config } from '../config';
import { moduleFor } from '../artifacts/registry';
import type { ArtifactType } from '../types';

export interface ExemplarProvider {
  /** Best-effort gold reference for a type/archetype, or null (none/error). */
  getExemplar(type: ArtifactType, archetypeId?: string): Promise<string | null>;
}

export function makeExemplarProvider(
  artifactsUrl: string = config.artifactsUrl,
  fetchFn: typeof fetch = fetch,
): ExemplarProvider {
  return {
    async getExemplar(type, archetypeId) {
      // Prefer an archetype-specific exemplar, then the type's default.
      const tags = [archetypeId, moduleFor(type).exemplarKey].filter(
        (t): t is string => !!t,
      );
      try {
        const res = await fetchFn(`${artifactsUrl}/exemplars/retrieve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { exemplar?: { text?: string } | null };
        return data.exemplar?.text ?? null;
      } catch {
        return null; // exemplars are best-effort — never fail the turn
      }
    },
  };
}

export const exemplarProvider = makeExemplarProvider();
