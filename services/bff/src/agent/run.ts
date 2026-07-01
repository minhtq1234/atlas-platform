import { randomUUID } from 'node:crypto';
import { generationEnabled, config } from '../config';
import { runModel } from '../modelClient';
import { extractJson } from '../generate';
import { shapeHint, INJECTION_NOTE } from '../prompt';
import { fallbackContent } from '../templates';
import { contextProvider } from '../context/provider';
import { makeTools, type RunState } from './tools';
import type { BuildRequest } from '../types';
import type { AgentProduced, AgentSession, SandboxHandle, SeedFile, Step, Sandbox } from './types';
import { LocalSandbox } from './sandbox';
import { ContainerSandbox } from './sandbox.container';
import { makeOpenCodeSession } from './session';

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

export interface AgentInput { req: BuildRequest; plan: Plan; }

export interface RunDeps {
  provision: Sandbox['provision'];
  makeSession: (h: SandboxHandle) => AgentSession;
  onStep: (s: Step) => void;
  seedFiles: (req: BuildRequest) => Promise<SeedFile[]>;
  maxSteps: number;
  signal?: AbortSignal; // external Stop
}

/** Fetch attachment text (reusing the ContextProvider) as seed files. */
export async function defaultSeedFiles(req: BuildRequest): Promise<SeedFile[]> {
  const docIds = (req.uploads ?? []).map((u) => u.docId).filter((d): d is string => !!d);
  if (!docIds.length) return [];
  const passages = await contextProvider.getContext(docIds, req.brief);
  return passages.map((text, i) => {
    const name = req.uploads?.[i]?.name ?? `input-${i + 1}.txt`;
    return { name: /\.[a-z0-9]+$/i.test(name) ? `${name}.txt` : `${name}.txt`, bytes: Buffer.from(text, 'utf8') };
  });
}

/** Concrete deps from config: Local sandbox in dev, Container in prod. */
export function defaultRunDeps(modelId: string, onStep: (s: Step) => void, signal?: AbortSignal): RunDeps {
  const sandbox = config.agent.sandbox === 'container'
    ? new ContainerSandbox()
    : new LocalSandbox(config.openCode.url, config.agent.workRoot);
  return {
    provision: sandbox.provision.bind(sandbox),
    makeSession: (h) => makeOpenCodeSession(h, modelId),
    onStep,
    seedFiles: defaultSeedFiles,
    maxSteps: config.agent.maxSteps,
    signal,
  };
}

/**
 * Run the autonomous agent loop. Always resolves (never throws): any failure
 * degrades to a template artifact with a reason. The sandbox is always destroyed.
 * Callers (e.g. the /agent/run route) should guard with generationEnabled() before
 * calling this when using real deps; injected test deps bypass that guard.
 */
export async function runAgent(input: AgentInput, deps: RunDeps): Promise<AgentProduced> {
  const { req } = input;

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  deps.signal?.addEventListener('abort', onAbort);

  let handle: SandboxHandle | undefined;
  try {
    const files = await deps.seedFiles(req);
    handle = await deps.provision(randomUUID(), files);
    const session = deps.makeSession(handle);
    const run: RunState = { content: undefined, tasks: [], emitTries: 0 };
    let stepCount = 0;
    const tools = makeTools(run, req.type, deps.onStep);
    const onEvent = (s: Step) => {
      if (s.kind !== 'task') {
        if (++stepCount > deps.maxSteps) { ctrl.abort(); return; }
      }
      deps.onStep(s);
    };
    await session.run({ prompt: buildAgentPrompt(req, input.plan), tools, onEvent, signal: ctrl.signal });

    if (ctrl.signal.aborted && !run.content) {
      return { content: fallbackContent(req), viaModel: false, degradedReason: 'stopped or step budget exceeded' };
    }
    if (!run.content) {
      return { content: fallbackContent(req), viaModel: false, degradedReason: 'agent produced no valid artifact' };
    }
    return { content: run.content, viaModel: true };
  } catch (err) {
    return { content: fallbackContent(req), viaModel: false, degradedReason: (err as Error).message };
  } finally {
    deps.signal?.removeEventListener('abort', onAbort);
    if (handle) await handle.destroy().catch(() => {});
  }
}
