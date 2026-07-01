import { describe, it, expect } from 'vitest';
import { WEB_ARCHETYPES, detectArchetype } from './archetypes';

describe('web archetypes', () => {
  it('detectArchetype always returns general', () => {
    expect(detectArchetype('anything at all')).toBe('general');
  });
  it('exposes a labeled list for the dropdown', () => {
    expect(WEB_ARCHETYPES.find((a) => a.id === 'general')?.label).toBe('Document');
  });
});
