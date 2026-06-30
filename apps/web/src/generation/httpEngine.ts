// HTTP-backed generation engine that calls the BFF (services/bff), which in
// turn calls the GreenNode model. Wrapped in a resilient engine that falls
// back to the in-browser mock when the BFF is unreachable, so the app always works.
import type { Artifact, ArtifactVersion, BuildRequest } from '../types';
import type { GenerationEngine } from './engine';

export function makeHttpEngine(baseUrl: string): GenerationEngine {
  return {
    async generate(req: BuildRequest, name: string): Promise<Artifact> {
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req, name }),
      });
      if (!res.ok) throw new Error(`BFF generate failed (${res.status})`);
      return res.json();
    },
    async revise(artifact: Artifact, instruction: string): Promise<ArtifactVersion> {
      const content = artifact.versions[artifact.currentVersion].content;
      const res = await fetch(`${baseUrl}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: artifact.type, current: content, instruction, modelId: artifact.modelId, lang: 'en' }),
      });
      if (!res.ok) throw new Error(`BFF revise failed (${res.status})`);
      return res.json();
    },
  };
}

/** Try the primary engine; on any failure, fall back to the secondary. */
export function makeResilientEngine(primary: GenerationEngine, fallback: GenerationEngine): GenerationEngine {
  return {
    async generate(req, name) {
      try {
        return await primary.generate(req, name);
      } catch (e) {
        console.warn('[atlas] BFF unavailable, using local mock engine:', (e as Error).message);
        return fallback.generate(req, name);
      }
    },
    async revise(artifact, instruction) {
      try {
        return await primary.revise(artifact, instruction);
      } catch (e) {
        console.warn('[atlas] BFF unavailable, using local mock engine:', (e as Error).message);
        return fallback.revise(artifact, instruction);
      }
    },
  };
}
