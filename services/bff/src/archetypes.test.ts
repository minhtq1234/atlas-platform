import { describe, it, expect } from 'vitest';
import { detectArchetype, archetype, ARCHETYPES } from './archetypes';

describe('archetypes', () => {
  it('detects BRD from aliases', () => {
    expect(detectArchetype('help me with a BRD')).toBe('brd');
    expect(detectArchetype('draft the business requirements for X')).toBe('brd');
  });
  it('falls back to general', () => {
    expect(detectArchetype('a short memo about lunch')).toBe('general');
  });
  it('archetype() is a safe lookup', () => {
    expect(archetype('brd').label).toBe('BRD');
    expect(archetype('nope').id).toBe('general');
    expect(archetype(undefined).id).toBe('general');
  });
  it('BRD has a section skeleton', () => {
    expect(ARCHETYPES.brd.sections).toContain('Functional Requirements');
  });
});
