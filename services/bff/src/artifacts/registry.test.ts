import { describe, it, expect } from 'vitest';
import { MODULES, ArtifactContent, SHAPE, moduleFor, ARCHETYPES, detectArchetype, archetype } from './registry';

describe('artifact module registry', () => {
  it('has all five types, each conforming to the contract', () => {
    const types = MODULES.map((m) => m.type).sort();
    expect(types).toEqual(['Dashboard', 'Deck', 'Doc', 'Report', 'Sheet']);
    for (const m of MODULES) {
      expect(typeof m.shapeHint).toBe('string');
      expect(typeof m.guidance).toBe('function');
      expect(Array.isArray(m.archetypes)).toBe(true);
      expect(typeof m.exemplarKey).toBe('string');
      // schema's kind literal matches the module type (public ZodLiteral getter, not internals)
      expect(m.schema.shape.kind.value).toBe(m.type);
    }
  });
  it('composes a union that parses every kind', () => {
    expect(ArtifactContent.safeParse({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] }).success).toBe(true);
    expect(ArtifactContent.safeParse({ kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's', slides: [{ title: 'c', isCover: true }] }).success).toBe(true);
  });
  it('SHAPE + moduleFor cover every type', () => {
    for (const m of MODULES) { expect(SHAPE[m.type]).toBe(m.shapeHint); expect(moduleFor(m.type)).toBe(m); }
  });
  it('archetype registry ships only general; detection falls back', () => {
    expect(Object.keys(ARCHETYPES)).toEqual(['general']);
    expect(detectArchetype('anything at all')).toBe('general');
    expect(archetype('nope').id).toBe('general');
  });
});
