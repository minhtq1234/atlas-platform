import { describe, it, expect } from 'vitest';
import { proposePlan, buildAgentPrompt } from './run';
import type { BuildRequest } from '../types';

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
    expect(p).toContain('emit_artifact');
    expect(p).toMatch(/untrusted user data/i);  // INJECTION_NOTE
  });
});
