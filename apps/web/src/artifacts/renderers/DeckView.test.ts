import { describe, it, expect } from 'vitest';
import { DeckView, slideKind } from './DeckView';
import type { DeckContent } from '../../types';

describe('slideKind', () => {
  it('classifies cover, section, statement, and bullets', () => {
    expect(slideKind({ title: 'x', isCover: true })).toBe('cover');
    expect(slideKind({ title: 'x', layout: 'section' })).toBe('section');
    expect(slideKind({ title: 'x', layout: 'statement' })).toBe('statement');
    expect(slideKind({ title: 'x', bullets: ['a'] })).toBe('bullets');
  });
});

describe('DeckView', () => {
  const deck: DeckContent = {
    kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
    slides: [
      { title: 'Cover', isCover: true },
      { title: 'Part Two', layout: 'section' },
      { title: 'Growth up 40%', bullets: ['Enterprise led'], notes: 'Mention the deal.' },
    ],
  };
  it('is a function component that builds every slide kind without throwing', () => {
    expect(typeof DeckView).toBe('function');
    expect(DeckView({ c: deck, slide: 0 })).toBeTruthy(); // cover
    expect(DeckView({ c: deck, slide: 1 })).toBeTruthy(); // section
    expect(DeckView({ c: deck, slide: 2 })).toBeTruthy(); // bullets + notes
  });
});
