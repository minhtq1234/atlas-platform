// HTTP-backed generation engine that calls the BFF (services/bff), which drives
// OpenCode → the GreenNode model. Wrapped in a resilient engine that falls back
// to the in-browser mock when the BFF is unreachable, so the app always works.
import type { AgentStep, AgentTurn, Artifact, BuildRequest } from '../types';
import type { GenerationEngine, ReviseOpts } from './engine';

/** The BFF was reachable but returned an error (vs. a network/transport failure). */
export class BffServerError extends Error {}

export function makeHttpEngine(baseUrl: string): GenerationEngine {
  return {
    async generate(req: BuildRequest, name: string): Promise<Artifact> {
      const res = await fetch(`${baseUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req, name }),
      });
      if (!res.ok) throw new BffServerError(`BFF generate failed (${res.status})`);
      return res.json();
    },

    async revise(artifact: Artifact, message: string, opts?: ReviseOpts): Promise<AgentTurn> {
      const content = artifact.versions[artifact.currentVersion].content;
      const res = await fetch(`${baseUrl}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: artifact.type,
          current: content,
          instruction: message,
          modelId: artifact.modelId,
          lang: 'en',
          opencodeSessionId: artifact.opencodeSessionId,
          awaiting: opts?.awaiting,
          plan: opts?.plan,
          confirm: opts?.confirm,
        }),
      });
      if (!res.ok) throw new BffServerError(`BFF revise failed (${res.status})`);
      return res.json();
    },

    async generateStream(req, name, onStage): Promise<Artifact> {
      const res = await fetch(`${baseUrl}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req, name }),
      });
      if (!res.ok || !res.body) throw new BffServerError(`BFF stream failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let artifact: Artifact | undefined;

      // SSE: events separated by a blank line. Within a block, join all `data:`
      // lines per spec; a leading `event:` line names the event.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let event = 'message';
          const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
            // lines starting with ':' are comments (heartbeats) — ignore
          }
          if (dataLines.length === 0) continue;
          const data = JSON.parse(dataLines.join('\n'));
          if (event === 'stage') onStage(data.label);
          else if (event === 'done') artifact = data as Artifact;
          else if (event === 'error') throw new BffServerError(data.message || 'stream error');
        }
      }
      if (!artifact) throw new BffServerError('stream ended without an artifact');
      return artifact;
    },

    async agentPlan(req: BuildRequest): Promise<{ steps: string[] }> {
      const res = await fetch(`${baseUrl}/agent/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req }),
      });
      if (!res.ok) throw new BffServerError(`BFF agent/plan failed (${res.status})`);
      return (await res.json()).plan;
    },

    async agentRun(req, name, plan, onStep): Promise<Artifact> {
      const res = await fetch(`${baseUrl}/agent/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req, name, plan }),
      });
      if (!res.ok || !res.body) throw new BffServerError(`BFF agent/run failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let artifact: Artifact | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let event = 'message';
          const dataLines: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
          }
          if (!dataLines.length) continue;
          const data = JSON.parse(dataLines.join('\n'));
          if (event === 'step') onStep(data as AgentStep);
          else if (event === 'done') artifact = data as Artifact;
          else if (event === 'error') throw new BffServerError(data.message || 'agent error');
        }
      }
      if (!artifact) throw new BffServerError('agent stream ended without an artifact');
      return artifact;
    },
  };
}

/** Try the primary engine; on failure fall back to the secondary. Reports only
 *  true transport failures via onFallback (so a server-sent error isn't mislabeled
 *  "offline"). */
export function makeResilientEngine(
  primary: GenerationEngine,
  fallback: GenerationEngine,
  onFallback?: (reason: string) => void,
): GenerationEngine {
  const handle = (e: unknown) => {
    const err = e as Error;
    // A BffServerError means the BFF was reachable — don't claim "offline".
    if (!(err instanceof BffServerError)) onFallback?.(err.message);
    console.warn('[atlas] falling back to local mock engine:', err.message);
  };
  return {
    async generate(req, name) {
      try {
        return await primary.generate(req, name);
      } catch (e) {
        handle(e);
        return fallback.generate(req, name);
      }
    },
    async revise(artifact, message, opts) {
      try {
        return await primary.revise(artifact, message, opts);
      } catch (e) {
        handle(e);
        return fallback.revise(artifact, message, opts);
      }
    },
    async generateStream(req, name, onStage) {
      try {
        return primary.generateStream
          ? await primary.generateStream(req, name, onStage)
          : await primary.generate(req, name);
      } catch (e) {
        handle(e);
        return fallback.generate(req, name);
      }
    },
  };
}
