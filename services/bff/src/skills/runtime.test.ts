import { describe, it, expect } from 'vitest';
import { runTurn } from './runtime';
import type { TurnInput } from './types';

const doc = { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] } as const;
const base: TurnInput = { type: 'Doc', current: doc as any, message: 'x', modelId: 'm' };

describe('runTurn (no model → deterministic template)', () => {
  it('returns an edit + version when no model is configured', async () => {
    const r = await runTurn({ ...base, message: 'add a line' });
    expect(r.action.skill).toBe('edit');
    expect(r.version).not.toBeNull();
    expect(r.awaiting).toBe('none');
  });

  it('confirm on plan-confirm executes to an edit', async () => {
    const r = await runTurn({ ...base, awaiting: 'plan-confirm', confirm: true, plan: { steps: ['a', 'b'] }, message: 'yes' });
    expect(r.action.skill).toBe('edit');
    expect(r.version).not.toBeNull();
  });
});
