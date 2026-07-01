import { describe, it, expect } from 'vitest';
import { generateUser, generateSystem } from './prompt';
import { archetype } from './archetypes';

describe('archetype-aware generate', () => {
  it('injects the BRD skeleton + sectioned shape for a Doc', () => {
    const sys = generateSystem('Doc', 'en', archetype('brd'));
    expect(sys).toContain('Functional Requirements');   // skeleton
    expect(sys).toContain('"sections"');                // sectioned shape offered
    expect(sys).toMatch(/requirement.*priority/i);      // guidance
  });
  it('a Deck is unaffected by archetype', () => {
    const sys = generateSystem('Deck', 'en', archetype('brd'));
    expect(sys).toContain('"kind":"Deck"');
    expect(sys).not.toContain('Functional Requirements');
  });
});

describe('generateUser', () => {
  it('embeds context passages inside <context> when given', () => {
    const u = generateUser(
      { brief: 'b', type: 'Doc', modelId: 'm' } as any,
      ['[a.md] hi'],
    );
    expect(u).toContain('<context>');
    expect(u).toContain('[a.md] hi');
  });

  it('falls back to <files> when no context is given', () => {
    const u = generateUser(
      { brief: 'b', type: 'Doc', modelId: 'm', uploads: [{ id: 'u1', name: 'a.md', sizeBytes: 1, mime: 'text/markdown' }] } as any,
      [],
    );
    expect(u).not.toContain('<context>');
    expect(u).toContain('<files>a.md</files>');
  });
});
