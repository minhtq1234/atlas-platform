import { describe, it, expect } from 'vitest';
import { guidance } from './prompt';
import { archetypes } from './archetypes';

describe('Deck guidance', () => {
  it('always includes the craft rules (assertion titles, notes)', () => {
    const g = guidance();
    expect(g).toContain('assertion');
    expect(g).toContain('notes');
  });

  it('adds the board slide arc for the board archetype', () => {
    const board = archetypes.find((a) => a.id === 'board')!;
    const g = guidance(board);
    expect(g).toContain('Use these slides in order');
    expect(g.toLowerCase()).toContain('the ask');
  });

  it('ignores a foreign (Doc) archetype — no slide arc leaks in', () => {
    const foreign = { id: 'testdoc', label: 'X', aliases: [], sections: ['Alpha Section'], guidance: 'x' };
    const g = guidance(foreign);
    expect(g).toContain('assertion'); // craft rules still present
    expect(g).not.toContain('Alpha Section'); // foreign arc NOT applied
  });
});
