import { describe, it, expect } from 'vitest';
import { judgeSystem, judgeUser, DepthScore } from './judge';

describe('depth judge', () => {
  it('judgeSystem is rubric-anchored on a 1-5 scale', () => {
    const s = judgeSystem('Doc');
    expect(s).toContain('1');
    expect(s).toContain('5');
    expect(s).toContain('Specificity');   // from the shared rubric
    expect(s).toContain('"score"');
  });
  it('judgeUser wraps brief + artifact', () => {
    expect(judgeUser('{"kind":"Doc"}', 'b')).toBe('<brief>b</brief>\n<artifact>\n{"kind":"Doc"}\n</artifact>');
  });
  it('DepthScore validates 1-5 + rationale', () => {
    expect(DepthScore.safeParse({ score: 4, rationale: 'ok' }).success).toBe(true);
    expect(DepthScore.safeParse({ score: 9, rationale: 'x' }).success).toBe(false);
  });
});
