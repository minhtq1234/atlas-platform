import { generationEnabled } from '../config';
import { runModel } from '../modelClient';
import { extractJson } from '../generate';
import { shapeHint, INJECTION_NOTE } from '../prompt';
import type { BuildRequest } from '../types';

export interface Plan { steps: string[] }

/** A cheap planning turn — proposes the task list shown at the plan-gate. No sandbox. */
export async function proposePlan(req: BuildRequest, context: string[]): Promise<Plan> {
  const noun = req.type.toLowerCase();
  const fallback: Plan = {
    steps: [
      'Read the brief and any attached files',
      `Derive the key facts for the ${noun}`,
      `Draft the ${noun} and check the numbers`,
      'Finalize and emit the artifact',
    ],
  };
  if (!generationEnabled()) return fallback;
  try {
    const sys = [
      'You are Atlas planning a short task list for building a business artifact with tools.',
      'Respond with ONLY JSON: {"steps": string[]} — 3 to 6 concise, concrete steps.',
      INJECTION_NOTE,
    ].join('\n');
    const ctx = context.length ? `\n<context>\n${context.join('\n---\n')}\n</context>` : '';
    const user = `<brief>${req.brief}</brief>\n<type>${req.type}</type>${ctx}`;
    const { text } = await runModel(sys, user, req.modelId);
    const obj = JSON.parse(extractJson(text)) as { steps?: unknown };
    const steps = Array.isArray(obj.steps) ? obj.steps.filter((s) => typeof s === 'string').slice(0, 6) : [];
    return steps.length ? { steps: steps as string[] } : fallback;
  } catch {
    return fallback;
  }
}

/** The instruction handed to the in-sandbox agent. */
export function buildAgentPrompt(req: BuildRequest, plan: Plan): string {
  return [
    'You are Atlas, an autonomous builder agent working in a sandbox with full dev tools.',
    'Attached files (if any) are in ./inputs. Use bash/python/read to derive facts from them.',
    'Follow this plan, calling update_task_list to mark progress:',
    plan.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    `When done, call emit_artifact with a ${req.type} matching EXACTLY this shape:`,
    shapeHint(req.type),
    'Numbers must be internally consistent and grounded in the inputs.',
    INJECTION_NOTE,
    `<brief>${req.brief}</brief>`,
    req.lang === 'vi' ? 'Write all human-readable text in Vietnamese.' : 'Write all human-readable text in English.',
  ].join('\n');
}
