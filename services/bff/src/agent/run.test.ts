import { describe, it, expect } from 'vitest';
import { proposePlan, buildAgentPrompt, runAgent, passagesToSeedFiles, type RunDeps } from './run';
import { FakeSandbox } from './sandbox';
import type { BuildRequest } from '../types';
import type { AgentSession, Step, AgentTools } from './types';

const req = (over: Partial<BuildRequest> = {}): BuildRequest =>
  ({ brief: 'Rebuild the deck as a 6-slide exec summary', type: 'Deck', modelId: 'gn-gemma', ...over });

describe('proposePlan (offline fallback)', () => {
  it('returns a non-empty step list when no model is configured', async () => {
    const plan = await proposePlan(req(), []);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.join(' ').toLowerCase()).toContain('deck');
  });
});

describe('buildAgentPrompt', () => {
  it('embeds the brief, the plan, and the exact shape for the type', () => {
    const p = buildAgentPrompt(req(), { steps: ['Parse the file', 'Draft slides'] });
    expect(p).toContain('Rebuild the deck');
    expect(p).toContain('Parse the file');
    expect(p).toContain('"kind":"Deck"');       // shapeHint(Deck)
    expect(p).toMatch(/match EXACTLY this shape/i);
    expect(p).toMatch(/untrusted user data/i);  // INJECTION_NOTE
  });
});

const validDeck = {
  kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 'S',
  slides: [{ title: 'Cover', isCover: true }, { title: 'One', bullets: ['a'] }],
};

/** A scripted session: runs `script(tools, onEvent)` then resolves. */
function mockSession(script: (t: AgentTools, e: (s: Step) => void) => void): AgentSession {
  return { async run({ tools, onEvent }) { script(tools, onEvent); } };
}

function deps(session: AgentSession, over: Partial<RunDeps> = {}): RunDeps {
  const fake = new FakeSandbox();
  return {
    provision: fake.provision.bind(fake),
    makeSession: () => session,
    onStep: () => {},
    seedFiles: async () => [],
    maxSteps: 40,
    timeoutMs: 180000,
    _fake: fake, // test-only handle
    ...over,
  } as RunDeps & { _fake: FakeSandbox };
}

describe('runAgent', () => {
  it('captures emitted content and destroys the sandbox', async () => {
    const steps: Step[] = [];
    const session = mockSession((t, e) => {
      e({ kind: 'tool', name: 'Reading zephyr.md', status: 'ok' });
      t.updateTaskList([{ id: '1', title: 'Draft', status: 'done' }]);
      t.emitArtifact(validDeck);
    });
    const d = deps(session, { onStep: (s) => steps.push(s) });
    const out = await runAgent({ req: { brief: 'b', type: 'Deck', modelId: 'm' }, plan: { steps: ['x'] } }, d);
    expect(out.viaModel).toBe(true);
    expect(out.content.kind).toBe('Deck');
    expect(steps.some((s) => s.kind === 'task')).toBe(true);
    expect((d as RunDeps & { _fake: FakeSandbox })._fake.destroyed.length).toBe(1);
  });

  it('degrades to a template when no valid artifact is emitted', async () => {
    const session = mockSession(() => { /* never emits */ });
    const out = await runAgent({ req: { brief: 'b', type: 'Doc', modelId: 'm' }, plan: { steps: ['x'] } }, deps(session));
    expect(out.viaModel).toBe(false);
    expect(out.degradedReason).toMatch(/no valid artifact/i);
    expect(out.content.kind).toBe('Doc');
  });

  it('degrades (and still destroys) when the session throws', async () => {
    const session: AgentSession = { async run() { throw new Error('session boom'); } };
    const d = deps(session);
    const out = await runAgent({ req: { brief: 'b', type: 'Doc', modelId: 'm' }, plan: { steps: ['x'] } }, d);
    expect(out.degradedReason).toMatch(/boom/);
    expect((d as RunDeps & { _fake: FakeSandbox })._fake.destroyed.length).toBe(1);
  });

  it('aborts and degrades when the step budget is exceeded', async () => {
    const session: AgentSession = {
      async run({ onEvent, signal, tools }) {
        for (let i = 0; i < 100 && !signal.aborted; i++) onEvent({ kind: 'tool', name: 'x', status: 'ok' });
        if (!signal.aborted) tools.emitArtifact(validDeck); // won't reach: aborted first
      },
    };
    const out = await runAgent(
      { req: { brief: 'b', type: 'Deck', modelId: 'm' }, plan: { steps: ['x'] } },
      deps(session, { maxSteps: 5 }),
    );
    expect(out.viaModel).toBe(false);
    expect(out.degradedReason).toBe('step budget exceeded');
  });

  it('times out and degrades when the session stalls', async () => {
    const session: AgentSession = { async run({ signal }) { await new Promise<void>((res) => signal.addEventListener('abort', () => res())); } };
    const out = await runAgent(
      { req: { brief: 'b', type: 'Doc', modelId: 'm' }, plan: { steps: ['x'] } },
      deps(session, { timeoutMs: 20 }),
    );
    expect(out.viaModel).toBe(false);
    expect(out.degradedReason).toMatch(/timed out/i);
  });

  it('reports "stopped" (not budget) on an external Stop', async () => {
    const ac = new AbortController();
    const session: AgentSession = {
      async run({ signal }) {
        await new Promise<void>((res) => {
          if (signal.aborted) { res(); return; }
          signal.addEventListener('abort', () => res());
        });
      },
    };
    const p = runAgent(
      { req: { brief: 'b', type: 'Doc', modelId: 'm' }, plan: { steps: ['x'] } },
      deps(session, { signal: ac.signal, timeoutMs: 60000 }),
    );
    ac.abort();
    const out = await p;
    expect(out.degradedReason).toBe('stopped');
  });
});

describe('passagesToSeedFiles', () => {
  it('maps each passage to its own seed file', () => {
    const files = passagesToSeedFiles(['[a.md] hello', '[b.md] world', '[a.md] more']);
    expect(files.map((f) => f.name)).toEqual(['passage-1.txt', 'passage-2.txt', 'passage-3.txt']);
    expect(files[0].bytes.toString()).toBe('[a.md] hello');
  });
});
