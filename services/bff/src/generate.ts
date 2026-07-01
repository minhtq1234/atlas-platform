import { randomUUID } from 'node:crypto';
import { config, generationEnabled } from './config';
import { runModel } from './modelClient';
import { generateSystem, generateUser } from './prompt';
import { fallbackContent } from './templates';
import {
  ArtifactContent,
  type Artifact,
  type ArtifactType,
  type BuildRequest,
} from './types';
import { runTurn } from './skills/runtime';
import type { TurnResult } from './skills/types';
import { contextProvider } from './context/provider';

/** Extract a JSON object from possibly-prose/fenced model output. */
export function extractJson(raw: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence) return fence[1].trim();
  const start = raw.indexOf('{');
  if (start < 0) return raw;
  // Scan for the first balanced {...}, respecting strings/escapes, so a stray
  // '}' in trailing prose can't extend the slice.
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return raw.slice(start, i + 1);
  }
  return raw.slice(start);
}

/** Parse + validate model JSON into ArtifactContent, forcing the expected kind. */
function parseContent(raw: string, type: ArtifactType): ArtifactContent {
  const obj = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  obj.kind = type; // trust the request's type over the model's self-report
  return ArtifactContent.parse(obj);
}

export interface Produced {
  content: ArtifactContent;
  viaModel: boolean;
  sessionId?: string;
  degradedReason?: string;
}

export function assemble(req: BuildRequest, name: string, p: Produced): Artifact {
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
    // Best-effort: fetch extracted text for any attachments (docIds) as context.
    const docIds = (req.uploads ?? []).map((u) => u.docId).filter((d): d is string => !!d);
    const context = docIds.length ? await contextProvider.getContext(docIds, req.brief) : [];
    onStage(`Composing ${req.type.toLowerCase()}…`);
    const { text, sessionId } = await runModel(
      generateSystem(req.type, req.lang ?? 'en'),
      generateUser(req, context),
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

/**
 * A revision turn: routes through the skill runtime, which returns a typed
 * Action (clarify | plan | edit | answer) plus a version when it edited.
 */
export async function revise(
  type: ArtifactType,
  current: ArtifactContent,
  instruction: string,
  modelId: string,
  lang: 'en' | 'vi' = 'en',
  opencodeSessionId?: string,
  opts: { awaiting?: 'none' | 'plan-confirm'; plan?: { steps: string[] }; confirm?: boolean; context?: string[] } = {},
): Promise<TurnResult> {
  return runTurn({ type, current, message: instruction, modelId, lang, sessionId: opencodeSessionId, ...opts });
}
