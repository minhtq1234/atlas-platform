// Generation facade. The rest of the app depends ONLY on this interface;
// the mock implementation swaps for GreenNode-model-backed generation later.
import type { AgentStep, AgentTurn, Artifact, ArtifactVersion, BuildRequest } from '../types';
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
  /** Optional: propose a task list for a build (the plan-gate). */
  agentPlan?(req: BuildRequest): Promise<{ steps: string[] }>;
  /** Optional: run the multi-step agent, streaming steps, returning the artifact. */
  agentRun?(req: BuildRequest, name: string, plan: { steps: string[] }, onStep: (s: AgentStep) => void): Promise<Artifact>;
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
  async agentPlan() {
    return { steps: ['Read the brief and files', 'Draft the content', 'Finalize the artifact'] };
  },
  async agentRun(req, name, plan, onStep) {
    onStep({ kind: 'task', tasks: plan.steps.map((t, i) => ({ id: String(i), title: t, status: 'done' })) });
    onStep({ kind: 'tool', name: 'Composing from template', status: 'ok' });
    return this.generate(req, name);
  },
  // Offline parity with the BFF skill runtime (no model to route clarify/plan/answer).
  // Guard: greetings/questions/acks must NOT mutate the doc — answer instead, so small
  // talk never mangles the artifact when the BFF is unreachable.
  async revise(artifact, message) {
    const m = message.trim();
    const smallTalk =
      m.length < 3 ||
      /\?\s*$/.test(m) ||
      /^(hi|hey|hello|yo|thanks|thank you|ok|okay|cool|nice|great|sup|good (morning|afternoon|evening))\b/i.test(m);
    if (smallTalk) {
      return {
        action: { skill: 'answer', message: "I'm the offline preview — tell me a concrete change (e.g. “add a Q3 outlook”) and I'll apply it." },
        version: null,
        awaiting: 'none',
      };
    }
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

export const agentPlan = (req: BuildRequest) =>
  engine.agentPlan ? engine.agentPlan(req) : Promise.resolve({ steps: ['Draft', 'Finalize'] });
export const agentRun = (
  req: BuildRequest, name: string, plan: { steps: string[] }, onStep: (s: AgentStep) => void,
) => (engine.agentRun ? engine.agentRun(req, name, plan, onStep) : engine.generate(req, name));
