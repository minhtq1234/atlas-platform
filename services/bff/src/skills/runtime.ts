import { randomUUID } from 'node:crypto';
import { generationEnabled } from '../config';
import { runModel } from '../modelClient';
import { extractJson } from '../generate';
import { fallbackRevise } from '../templates';
import type { ArtifactContent, ArtifactVersion } from '../types';
import { AgentAction, type Awaiting, type TurnInput, type TurnResult } from './types';
import { buildActionPrompt, turnUser, executeUser } from './prompts';

const mkVersion = (content: ArtifactContent, note: string): ArtifactVersion =>
  ({ id: randomUUID(), createdAt: Date.now(), note, content });

export async function runTurn(input: TurnInput): Promise<TurnResult> {
  const lang = input.lang ?? 'en';
  const executing = input.awaiting === 'plan-confirm' && input.confirm === true;

  // No model → deterministic template edit (offline parity).
  if (!generationEnabled()) {
    const content = fallbackRevise(input.current, input.message);
    return {
      action: { skill: 'edit', message: 'Applied that as a basic edit (offline template).', content },
      version: mkVersion(content, input.message),
      awaiting: 'none',
    };
  }

  const user = executing
    ? executeUser(JSON.stringify(input.current), input.plan?.steps ?? [])
    : turnUser(JSON.stringify(input.current), input.message);

  try {
    const { text } = await runModel(
      buildActionPrompt(input.type, lang, input.context),
      user,
      input.modelId,
      { sessionId: input.sessionId },
    );
    const raw = JSON.parse(extractJson(text)) as Record<string, unknown>;
    if (raw.content && typeof raw.content === 'object') (raw.content as Record<string, unknown>).kind = input.type;
    if (executing && !raw.skill) raw.skill = 'edit';
    const action = AgentAction.parse(raw);
    const version = action.skill === 'edit' && action.content ? mkVersion(action.content, input.message) : null;
    const awaiting: Awaiting = action.skill === 'plan' ? 'plan-confirm' : 'none';
    return { action, version, awaiting };
  } catch (err) {
    console.warn('[skills] turn failed, answering:', (err as Error).message);
    return {
      action: { skill: 'answer', message: "I couldn't parse that — could you rephrase?" },
      version: null,
      awaiting: 'none',
    };
  }
}
