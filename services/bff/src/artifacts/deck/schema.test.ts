import { describe, it, expect } from 'vitest';
import { DeckContent } from './schema';

describe('Deck schema', () => {
  it('accepts speaker notes and a layout on a slide', () => {
    const parsed = DeckContent.parse({
      kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
      slides: [
        { title: 'Cover', isCover: true },
        { title: 'Agenda', layout: 'section' },
        { title: 'Growth up 40%', bullets: ['Enterprise led'], notes: 'Mention the Q2 deal.' },
      ],
    });
    expect(parsed.slides[1].layout).toBe('section');
    expect(parsed.slides[2].notes).toContain('Q2 deal');
  });

  it('rejects an unknown layout value', () => {
    expect(() =>
      DeckContent.parse({
        kind: 'Deck', eyebrow: 'E', title: 'T', subtitle: 's',
        slides: [{ title: 'x', layout: 'carousel' }],
      }),
    ).toThrow();
  });
});
