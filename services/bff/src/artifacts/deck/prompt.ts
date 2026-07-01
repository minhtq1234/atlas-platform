import type { Archetype } from '../module';
import { archetypes } from './archetypes';

export const shapeHint = `{"kind":"Deck","eyebrow":string,"title":string,"subtitle":string,"slides":[{"title":string,"bullets":string[]?,"notes":string?,"layout":("section"|"statement")?,"isCover":boolean?,"subtitle":string?}] (first slide isCover:true; use layout:"section" for a divider slide in a long deck, layout:"statement" for a single big-idea slide; put presenter detail in "notes", never on the slide)}`;

// Deck-wide craft rules — applied to every deck, with or without an archetype.
const DECK_RULES =
  'Deck craft: every content-slide title must be an assertion (the takeaway, e.g. "Enterprise drove 40% of new ARR"), not a topic label ("Revenue"). One idea per slide, ≤ ~40 words of body. Put presenter detail in "notes", not on the slide. Add a layout:"section" divider slide when a deck runs longer than ~10 slides.';

/**
 * Deck steering: the craft rules, plus the slide arc when the resolved archetype is
 * one of Deck's OWN (board/pitch). Foreign archetypes (e.g. a Doc archetype that a
 * global brief-match happened to select) are ignored, so no other type's skeleton
 * leaks into a deck.
 */
export function guidance(arch?: Archetype): string {
  const parts = [DECK_RULES];
  const own = arch ? archetypes.find((a) => a.id === arch.id) : undefined;
  if (own && own.sections.length) {
    parts.push(`Use these slides in order: ${own.sections.join('; ')}.`);
    if (own.guidance) parts.push(own.guidance);
  }
  return parts.join('\n');
}
