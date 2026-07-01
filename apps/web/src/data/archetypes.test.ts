import { describe, it, expect } from 'vitest';
import { WEB_ARCHETYPES, detectArchetype } from './archetypes';

describe('web archetypes', () => {
  it('detects BRD + falls back to general', () => {
    expect(detectArchetype('a BRD please')).toBe('brd');
    expect(detectArchetype('random note')).toBe('general');
  });
  it('exposes a labeled list for the dropdown', () => {
    expect(WEB_ARCHETYPES.find((a) => a.id === 'brd')?.label).toBe('BRD');
    expect(WEB_ARCHETYPES.find((a) => a.id === 'general')?.label).toBe('Document');
  });
});
