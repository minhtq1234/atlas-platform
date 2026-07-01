import { describe, it, expect } from 'vitest';
import { generateUser, generateSystem } from './prompt';
import type { Archetype } from './archetypes';

describe('archetype-aware generate', () => {
  const testArch: Archetype = {
    id: 'testdoc',
    label: 'Test Doc',
    aliases: [],
    sections: ['Alpha Section', 'Beta Section'],
    guidance: 'Use a table for Alpha.',
  };

  it('injects the synthetic archetype skeleton + sectioned shape for a Doc', () => {
    const sys = generateSystem('Doc', 'en', testArch);
    expect(sys).toContain('Alpha Section');
    expect(sys).toContain('Use a table');
    expect(sys).toContain('"sections"');
  });

  it('a Deck is unaffected by archetype', () => {
    const sys = generateSystem('Deck', 'en', testArch);
    expect(sys).toContain('"kind":"Deck"');
    expect(sys).not.toContain('Alpha Section');
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
