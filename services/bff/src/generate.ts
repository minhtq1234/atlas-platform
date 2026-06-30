import { randomUUID } from 'node:crypto';
import { modelConfigured } from './config';
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
  const obj = JSON.parse(raw) as Record<string, unknown>;
  obj.kind = type; // trust the request's type over the model's self-report
  return ArtifactContent.parse(obj);
}

async function produceContent(
  req: BuildRequest,
): Promise<{ content: ArtifactContent; viaModel: boolean }> {
  if (!modelConfigured()) return { content: fallbackContent(req), viaModel: false };
  try {
    const raw = await runModel(
      generateSystem(req.type, req.lang ?? 'en'),
      generateUser(req),
      req.modelId,
    );
    return { content: parseContent(raw, req.type), viaModel: true };
  } catch (err) {
    console.warn('[bff] model generate failed, using template:', (err as Error).message);
    return { content: fallbackContent(req), viaModel: false };
  }
}

export async function generate(req: BuildRequest, name: string): Promise<Artifact> {
  const { content, viaModel } = await produceContent(req);
  const now = Date.now();
  return {
    id: randomUUID(),
    name,
    type: req.type,
    sourceLabel: req.sourceKey,
    modelId: req.modelId,
    createdAt: now,
    versions: [
      { id: randomUUID(), createdAt: now, note: viaModel ? 'Initial build' : 'Initial build (template)', content },
    ],
    currentVersion: 0,
  };
}

export async function revise(
  type: ArtifactType,
  current: ArtifactContent,
  instruction: string,
  modelId: string,
  lang: 'en' | 'vi' = 'en',
): Promise<ArtifactVersion> {
  let content: ArtifactContent;
  if (modelConfigured()) {
    try {
      const raw = await runModel(
        reviseSystem(type, lang),
        reviseUser(JSON.stringify(current), instruction),
        modelId,
      );
      content = parseContent(raw, type);
    } catch (err) {
      console.warn('[bff] model revise failed, using template:', (err as Error).message);
      content = fallbackRevise(current, instruction);
    }
  } else {
    content = fallbackRevise(current, instruction);
  }
  return { id: randomUUID(), createdAt: Date.now(), note: instruction, content };
}
