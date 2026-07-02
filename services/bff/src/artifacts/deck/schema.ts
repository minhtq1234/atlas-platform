import { z } from 'zod';

export const Slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()).max(30).optional(),
  notes: z.string().optional(),
  layout: z.enum(['section', 'statement']).optional(),
  isCover: z.boolean().optional(),
  subtitle: z.string().optional(),
});
export const DeckContent = z.object({
  kind: z.literal('Deck'),
  eyebrow: z.string(),
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(Slide).min(1).max(100),
});
