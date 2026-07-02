import { describe, it, expect } from 'vitest';
import {
  outlineSystem, draftSystem, draftUser,
  critiqueSystem, critiqueUser, CritiqueResult,
  reviseSystem, reviseUser,
} from './prompts';

const req = { brief: 'ship X', type: 'Doc', modelId: 'm' } as any;

describe('deep prompt builders', () => {
  it('outlineSystem asks for a JSON plan of units+points, not the artifact', () => {
    const s = outlineSystem('Doc', 'en');
    expect(s).toContain('"units"');
    expect(s).toContain('points');
    expect(s.toLowerCase()).toContain('plan');
  });
  it('draftSystem extends generateSystem with a plan-expansion instruction; draftUser carries <plan>', () => {
    const s = draftSystem('Doc', 'en');
    expect(s).toContain('"kind":"Doc"');       // inherited from generateSystem SHAPE
    expect(s).toContain('<plan>');
    const u = draftUser(req, [], null, '{"units":[]}');
    expect(u).toContain('<brief>ship X</brief>');
    expect(u).toContain('<plan>\n{"units":[]}\n</plan>');
  });
  it('critiqueSystem is rubric-anchored and demands findings-not-scores', () => {
    const s = critiqueSystem('Doc');
    expect(s).toContain('"done"');
    expect(s).toContain('"findings"');
    expect(s.toLowerCase()).toContain('do not give a score');
    expect(s).toContain('Specificity'); // from the rubric
  });
  it('critiqueUser wraps brief + current', () => {
    expect(critiqueUser('{"kind":"Doc"}', 'b')).toBe('<brief>b</brief>\n<current>\n{"kind":"Doc"}\n</current>');
  });
  it('CritiqueResult validates the shape', () => {
    expect(CritiqueResult.safeParse({ done: false, findings: ['x'] }).success).toBe(true);
    expect(CritiqueResult.safeParse({ done: true, findings: [] }).success).toBe(true);
    expect(CritiqueResult.safeParse({ findings: ['x'] }).success).toBe(false);
  });
  it('reviseSystem extends generateSystem; reviseUser wraps current + findings', () => {
    expect(reviseSystem('Doc', 'en')).toContain('<findings>');
    expect(reviseUser('{"kind":"Doc"}', ['a', 'b'])).toBe('<current>\n{"kind":"Doc"}\n</current>\n<findings>\n- a\n- b\n</findings>');
  });
});
