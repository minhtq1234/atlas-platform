import { describe, it, expect, vi } from 'vitest';
import { makeTools, formatIssues } from './tools';
import type { Step, Task } from './types';
import type { ArtifactContent } from '../types';

const validDoc = { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] };

function harness() {
  const steps: Step[] = [];
  const run = { content: undefined as ArtifactContent | undefined, tasks: [] as Task[], emitTries: 0 };
  const tools = makeTools(run, 'Doc', (s) => steps.push(s));
  return { steps, run, tools };
}

describe('emitArtifact', () => {
  it('captures valid content (forcing kind) and returns ok', () => {
    const { run, tools } = harness();
    const r = tools.emitArtifact({ ...validDoc, kind: 'Deck' }); // wrong kind on purpose
    expect(r).toEqual({ ok: true });
    expect(run.content?.kind).toBe('Doc'); // forced to the requested type
    expect(run.emitTries).toBe(1);
  });
  it('returns readable errors on invalid content and does not capture', () => {
    const { run, tools } = harness();
    const r = tools.emitArtifact({ title: 123 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toMatch(/title/);
    expect(run.content).toBeUndefined();
  });
});

describe('updateTaskList', () => {
  it('stores the list and emits a task Step', () => {
    const { run, steps, tools } = harness();
    const tasks: Task[] = [{ id: '1', title: 'Parse file', status: 'active' }];
    expect(tools.updateTaskList(tasks)).toEqual({ ok: true });
    expect(run.tasks).toEqual(tasks);
    expect(steps.at(-1)).toEqual({ kind: 'task', tasks });
  });
});

describe('formatIssues', () => {
  it('joins zod issues into a compact string', () => {
    const msg = formatIssues({ issues: [{ path: ['a', 'b'], message: 'Required' }] } as never);
    expect(msg).toBe('a.b: Required');
  });
});
