// HTTP-backed generation engine that calls the BFF (services/bff), which drives
// OpenCode → the GreenNode model. Wrapped in a resilient engine that falls back
// to the in-browser mock when the BFF is unreachable, so the app always works.
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
        body: JSON.stringify({
          type: artifact.type,
          current: content,
          instruction,
          modelId: artifact.modelId,
          lang: 'en',
          opencodeSessionId: artifact.opencodeSessionId,
        }),
      });
      if (!res.ok) throw new Error(`BFF revise failed (${res.status})`);
      return res.json();
    },

    async generateStream(req, name, onStage): Promise<Artifact> {
      const res = await fetch(`${baseUrl}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req, name }),
      });
      if (!res.ok || !res.body) throw new Error(`BFF stream failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let artifact: Artifact | undefined;

      // Parse the SSE stream: blocks separated by a blank line, each with
      // an `event:` and a `data:` line.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = /event: (.*)/.exec(block)?.[1];
          const dataLine = /data: (.*)/s.exec(block)?.[1];
          if (!dataLine) continue;
          const data = JSON.parse(dataLine);
          if (event === 'stage') onStage(data.label);
          else if (event === 'done') artifact = data as Artifact;
          else if (event === 'error') throw new Error(data.message || 'stream error');
        }
      }
      if (!artifact) throw new Error('stream ended without an artifact');
      return artifact;
    },
  };
}

/** Try the primary engine; on any failure, fall back to the secondary (and report it). */
export function makeResilientEngine(
  primary: GenerationEngine,
  fallback: GenerationEngine,
  onFallback?: (reason: string) => void,
): GenerationEngine {
  const report = (e: unknown) => {
    console.warn('[atlas] BFF unavailable, using local mock engine:', (e as Error).message);
    onFallback?.((e as Error).message);
  };
  return {
    async generate(req, name) {
      try {
        return await primary.generate(req, name);
      } catch (e) {
        report(e);
        return fallback.generate(req, name);
      }
    },
    async revise(artifact, instruction) {
      try {
        return await primary.revise(artifact, instruction);
      } catch (e) {
        report(e);
        return fallback.revise(artifact, instruction);
      }
    },
    async generateStream(req, name, onStage) {
      try {
        return primary.generateStream
          ? await primary.generateStream(req, name, onStage)
          : await primary.generate(req, name);
      } catch (e) {
        report(e);
        return fallback.generate(req, name);
      }
    },
  };
}
