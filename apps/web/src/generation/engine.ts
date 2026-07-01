// Generation facade. The rest of the app depends ONLY on this interface;
// the mock implementation swaps for GreenNode-model-backed generation later.
import type { Artifact, ArtifactVersion, BuildRequest } from '../types';
import { buildContent, reviseContent, uid } from './mockEngine';

/** A revise turn: a new version (or null if the user just asked a question) + the assistant's reply. */
export interface ReviseResult {
  version: ArtifactVersion | null;
  message: string;
}

export interface GenerationEngine {
  generate(req: BuildRequest, name: string): Promise<Artifact>;
  revise(artifact: Artifact, instruction: string): Promise<ReviseResult>;
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
  async revise(artifact, instruction) {
    const current = artifact.versions[artifact.currentVersion];
    return {
      version: { id: uid('v'), createdAt: Date.now(), note: instruction, content: reviseContent(current.content, instruction) },
      message: `Updated the ${artifact.type.toLowerCase()}.`,
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

/** Streams stage labels if the engine supports it; otherwise a plain generate. */
export const generateArtifactStream = (
  req: BuildRequest,
  name: string,
  onStage: (label: string) => void,
): Promise<Artifact> =>
  engine.generateStream ? engine.generateStream(req, name, onStage) : engine.generate(req, name);
