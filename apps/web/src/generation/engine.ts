// Generation facade. The rest of the app depends ONLY on this interface;
// the mock implementation swaps for GreenNode-model-backed generation later.
import type { Artifact, ArtifactVersion, BuildRequest } from '../types';
import { buildContent, reviseContent, uid } from './mockEngine';

export interface GenerationEngine {
  generate(req: BuildRequest, name: string): Promise<Artifact>;
  revise(artifact: Artifact, instruction: string): Promise<ArtifactVersion>;
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
  async revise(artifact, instruction) {
    const current = artifact.versions[artifact.currentVersion];
    return {
      id: uid('v'),
      createdAt: Date.now(),
      note: instruction,
      content: reviseContent(current.content, instruction),
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
export const reviseArtifact = (artifact: Artifact, instruction: string) =>
  engine.revise(artifact, instruction);
