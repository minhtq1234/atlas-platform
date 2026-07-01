// Generation facade. The rest of the app depends ONLY on this interface;
// the mock implementation swaps for GreenNode-model-backed generation later.
import type { AgentTurn, Artifact, ArtifactVersion, BuildRequest } from '../types';
import { buildContent, reviseContent, uid } from './mockEngine';

/** Optional plan-confirm state carried into a revise turn (drives the skill runtime). */
export interface ReviseOpts {
  awaiting?: 'none' | 'plan-confirm';
  plan?: { steps: string[] };
  confirm?: boolean;
}

export interface GenerationEngine {
  generate(req: BuildRequest, name: string): Promise<Artifact>;
  revise(artifact: Artifact, message: string, opts?: ReviseOpts): Promise<AgentTurn>;
  /** Optional: stream human-readable stage labels while generating. */
  generateStream?(req: BuildRequest, name: string, onStage: (label: string) => void): Promise<Artifact>;
}

export const mockEngine: GenerationEngine = {
  async generate(req, name) {
    const now = Date.now();
    const version: ArtifactVersion = {
      id: uid('v'),
      createdAt: now,
      note: 'Initial build',
      content: buildContent(req),
    };
    return {
      id: uid('art'),
      name,
      type: req.type,
      sourceLabel: req.sourceKey ?? undefined,
      modelId: req.modelId,
      createdAt: now,
      versions: [version],
      currentVersion: 0,
    };
  },
  // Offline parity with the BFF skill runtime: always an `edit` turn (no model
  // to route clarify/plan/answer), so the app works fully without a backend.
  async revise(artifact, message) {
    const current = artifact.versions[artifact.currentVersion].content;
    const content = reviseContent(current, message);
    return {
      action: { skill: 'edit', message: `Updated the ${artifact.type.toLowerCase()}.`, content },
      version: { id: uid('v'), createdAt: Date.now(), note: message, content },
      awaiting: 'none',
    };
  },
};

let engine: GenerationEngine = mockEngine;

/** Swap the engine (e.g. to a GreenNode-backed one) at startup. */
export function setEngine(next: GenerationEngine) {
  engine = next;
}

export const generateArtifact = (req: BuildRequest, name: string) =>
  engine.generate(req, name);
export const reviseArtifact = (artifact: Artifact, message: string, opts?: ReviseOpts) =>
  engine.revise(artifact, message, opts);

/** Streams stage labels if the engine supports it; otherwise a plain generate. */
export const generateArtifactStream = (
  req: BuildRequest,
  name: string,
  onStage: (label: string) => void,
): Promise<Artifact> =>
  engine.generateStream ? engine.generateStream(req, name, onStage) : engine.generate(req, name);
