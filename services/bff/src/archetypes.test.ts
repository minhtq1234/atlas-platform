import { describe, it, expect } from 'vitest';
import { detectArchetype, archetype, ARCHETYPES } from './archetypes';

describe('archetypes', () => {
  it('falls back to general for any brief', () => {
    expect(detectArchetype('help me with anything')).toBe('general');
  });
  it('archetype() is a safe lookup', () => {
    expect(archetype('nope').id).toBe('general');
    expect(archetype(undefined).id).toBe('general');
  });
  it('ARCHETYPES.general exists', () => {
    expect(ARCHETYPES.general).toBeDefined();
  });
});
