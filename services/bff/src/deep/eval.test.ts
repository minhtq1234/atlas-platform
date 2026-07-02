import { describe, it, expect } from 'vitest';
import { generate } from '../generate';
import { runModel } from '../modelClient';
import { judgeDepth } from './judge';

const MODEL = process.env.EVAL_MODEL ?? 'gn-llama3-70b';
const EVAL_SET = [
  { type: 'Doc' as const, brief: 'A one-page product strategy for a sovereign, AI-native document generator for VN enterprises.' },
  { type: 'Deck' as const, brief: 'A 6-slide board update on Q3 progress for an internal AI platform.' },
];

describe.skipIf(!process.env.RUN_DEEP_EVAL)('deep eval (live; RUN_DEEP_EVAL=1 + model env)', () => {
  const callModel = (s: string, u: string) => runModel(s, u, MODEL).then((r) => r.text);
  for (const item of EVAL_SET) {
    it(`deep depth >= fast depth for ${item.type}`, async () => {
      const base = { brief: item.brief, type: item.type, modelId: MODEL };
      const fast = await generate({ ...base, mode: 'fast' } as any, 'eval');
      const deep = await generate({ ...base, mode: 'deep' } as any, 'eval');
      const f = await judgeDepth(callModel, item.type, JSON.stringify(fast.versions[0].content), item.brief);
      const d = await judgeDepth(callModel, item.type, JSON.stringify(deep.versions[0].content), item.brief);
      console.log(`[eval ${item.type}] fast=${f.score} deep=${d.score} — ${d.rationale}`);
      expect(d.score).toBeGreaterThanOrEqual(f.score);
    }, 180000);
  }
});
