import { describe, it, expect, vi } from 'vitest';
import { runDeepPipeline, type DeepDeps, type DeepInput } from './pipeline';

const doc = (tag: string) => ({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: [tag] } as any);
const input: DeepInput = { req: { brief: 'b', type: 'Doc', modelId: 'm' } as any, arch: undefined, context: [], exemplar: null };

// parse: JSON.parse but forces kind (like generate.parseContent); throws on 'BAD'.
const parse = (raw: string, type: any) => {
  if (raw === 'BAD') throw new Error('invalid');
  const o = JSON.parse(raw); o.kind = type; return o;
};
const findings = JSON.stringify({ done: false, findings: ['§1 is generic'] });
const clean = JSON.stringify({ done: true, findings: [] });

function deps(scripted: string[], over: Partial<DeepDeps> = {}): DeepDeps {
  const calls = [...scripted];
  return { callModel: vi.fn(async () => calls.shift() ?? clean), parse, ...over };
}

describe('runDeepPipeline', () => {
  it('happy path: outline → draft → critic(finds) → revise → critic(clean) stops', async () => {
    const d = deps([
      '{"units":[]}',                 // outline
      JSON.stringify(doc('draft')),   // draft
      findings,                        // critic round 1
      JSON.stringify(doc('revised')), // revise
      clean,                           // critic round 2 → done
    ]);
    const r = await runDeepPipeline(input, d);
    expect((r.content as any).paragraphs).toEqual(['revised']);
    expect(r.degradedReason).toBeUndefined();
  });

  it('stops early when the first critic returns done', async () => {
    const call = vi.fn(async () => '');
    (call as any).mockResolvedValueOnce('{"units":[]}')
      .mockResolvedValueOnce(JSON.stringify(doc('draft')))
      .mockResolvedValueOnce(clean); // critic done immediately
    const r = await runDeepPipeline(input, { callModel: call, parse });
    expect((r.content as any).paragraphs).toEqual(['draft']);
    expect(call).toHaveBeenCalledTimes(3); // no revise
  });

  it('caps at maxRounds critic→revise iterations', async () => {
    // always finds; each revise valid → should stop at maxRounds=2 revises
    const call = vi.fn(async (_s: string, u: string) =>
      u.includes('<plan>') ? JSON.stringify(doc('draft'))
      : u.includes('<findings>') ? JSON.stringify(doc('rev'))
      : u.includes('units') || !u.includes('<current>') ? '{"units":[]}'
      : findings);
    const r = await runDeepPipeline(input, { callModel: call as any, parse, maxRounds: 2 });
    expect((r.content as any).paragraphs).toEqual(['rev']);
    // outline + draft + (critic+revise)*2 = 6 calls
    expect(call).toHaveBeenCalledTimes(6);
  });

  it('outline failure → single-turn fast path (degraded)', async () => {
    // Only the outline call throws — its system prompt says "planning"; singleTurn
    // uses generateSystem ("composes finished …") and succeeds.
    const call = vi.fn(async (s: string) => {
      if (s.includes('planning')) throw new Error('outline down');
      return JSON.stringify(doc('single'));
    });
    const r = await runDeepPipeline(input, { callModel: call as any, parse });
    expect((r.content as any).paragraphs).toEqual(['single']);
    expect(r.degradedReason).toContain('outline');
  });

  it('invalid draft → self-heal retry → single-turn if still invalid', async () => {
    const d = deps(['{"units":[]}', 'BAD', 'BAD', JSON.stringify(doc('single'))]);
    const r = await runDeepPipeline(input, d);
    expect((r.content as any).paragraphs).toEqual(['single']);
    expect(r.degradedReason).toContain('draft');
  });

  it('invalid revise → keeps the last valid draft', async () => {
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), findings, 'BAD']);
    const r = await runDeepPipeline(input, d);
    expect((r.content as any).paragraphs).toEqual(['draft']); // revise threw → keep draft
  });

  it('unparseable critique → keeps the draft (loop breaks)', async () => {
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), 'not json']);
    const r = await runDeepPipeline(input, d);
    expect((r.content as any).paragraphs).toEqual(['draft']);
  });

  it('budget exceeded → returns best so far before the next round', async () => {
    let t = 0;
    const d = deps(
      ['{"units":[]}', JSON.stringify(doc('draft')), findings, JSON.stringify(doc('rev'))],
      { now: () => (t += 1000), budgetMs: 500 }, // clock jumps past budget on the first loop check
    );
    const r = await runDeepPipeline(input, d);
    expect((r.content as any).paragraphs).toEqual(['draft']); // budget hit before round 1 critic
    expect(r.degradedReason).toContain('budget');
  });

  it('emits stage labels', async () => {
    const onStage = vi.fn();
    const d = deps(['{"units":[]}', JSON.stringify(doc('draft')), clean], { onStage });
    await runDeepPipeline(input, d);
    expect(onStage.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['Outlining…', 'Drafting…', 'Critiquing…']),
    );
  });
});
