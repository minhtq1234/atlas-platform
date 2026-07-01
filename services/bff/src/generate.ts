import { randomUUID } from 'node:crypto';
import { config, generationEnabled } from './config';
import { runModel } from './modelClient';
import { generateSystem, generateUser, reviseSystem, reviseUser } from './prompt';
import { fallbackContent, fallbackRevise } from './templates';
import {
  ArtifactContent,
  type Artifact,
  type ArtifactType,
  type ArtifactVersion,
  type BuildRequest,
} from './types';

/** Parse + validate model JSON into ArtifactContent, forcing the expected kind. */
function parseContent(raw: string, type: ArtifactType): ArtifactContent {
  // Real models may wrap JSON in prose/fences — extract the outermost object.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  const obj = JSON.parse(json) as Record<string, unknown>;
  obj.kind = type; // trust the request's type over the model's self-report
  return ArtifactContent.parse(obj);
}

interface Produced {
  content: ArtifactContent;
  viaModel: boolean;
  sessionId?: string;
  degradedReason?: string;
}

function assemble(req: BuildRequest, name: string, p: Produced): Artifact {
  const now = Date.now();
  return {
    id: randomUUID(),
    name,
    type: req.type,
    sourceLabel: req.sourceKey,
    modelId: req.modelId,
    createdAt: now,
    versions: [
      { id: randomUUID(), createdAt: now, note: p.viaModel ? 'Initial build' : 'Initial build (template)', content: p.content },
    ],
    currentVersion: 0,
    opencodeSessionId: p.sessionId,
    degraded: !!p.degradedReason,
    degradedReason: p.degradedReason,
  };
}

type Stage = (label: string) => void;

async function produceContent(req: BuildRequest, onStage: Stage = () => {}): Promise<Produced> {
  if (!generationEnabled()) {
    onStage('Composing from template…');
    return { content: fallbackContent(req), viaModel: false };
  }
  onStage(config.agentRuntime === 'opencode' ? 'Connecting to the agent…' : 'Contacting the model…');
  try {
    onStage(`Composing ${req.type.toLowerCase()}…`);
    const { text, sessionId } = await runModel(
      generateSystem(req.type, req.lang ?? 'en'),
      generateUser(req),
      req.modelId,
    );
    onStage('Validating & finalizing…');
    return { content: parseContent(text, req.type), viaModel: true, sessionId };
  } catch (err) {
    const degradedReason = (err as Error).message;
    console.warn('[bff] model generate failed, using template:', degradedReason);
    onStage('Model unavailable — using template…');
    return { content: fallbackContent(req), viaModel: false, degradedReason };
  }
}

export async function generate(req: BuildRequest, name: string): Promise<Artifact> {
  return assemble(req, name, await produceContent(req));
}

/** Same as generate() but emits human-readable stage labels as it goes. */
export async function generateStreaming(req: BuildRequest, name: string, onStage: Stage): Promise<Artifact> {
  return assemble(req, name, await produceContent(req, onStage));
}

export async function revise(
  type: ArtifactType,
  current: ArtifactContent,
  instruction: string,
  modelId: string,
  lang: 'en' | 'vi' = 'en',
  opencodeSessionId?: string,
): Promise<ArtifactVersion> {
  let content: ArtifactContent;
  if (generationEnabled()) {
    try {
      const { text } = await runModel(reviseSystem(type, lang), reviseUser(JSON.stringify(current), instruction), modelId, {
        sessionId: opencodeSessionId,
      });
      content = parseContent(text, type);
    } catch (err) {
      console.warn('[bff] model revise failed, using template:', (err as Error).message);
      content = fallbackRevise(current, instruction);
    }
  } else {
    content = fallbackRevise(current, instruction);
  }
  return { id: randomUUID(), createdAt: Date.now(), note: instruction, content };
}
