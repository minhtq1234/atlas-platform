import type { Archetype } from '../module';

// Aliases are deck-anchored (each contains "deck") on purpose: detectArchetype is
// global across types, so a bare word like "proposal" must not pull a Doc into a
// deck archetype. See docs/artifact-packs/deck/ + the build plan's coordination note.
export const archetypes: Archetype[] = [
  {
    id: 'board',
    label: 'Board Deck',
    aliases: ['board deck', 'board update deck', 'board meeting deck', 'exec update deck'],
    sections: [
      'Cover',
      'TL;DR — 3–5 headline assertions',
      'KPIs vs. plan (with prior-period or target comparison)',
      'Progress by workstream',
      'Risks & issues (with mitigation)',
      'The ask / decisions needed',
      'Next steps + owners',
    ],
    guidance:
      'Board/exec audience: dense, factual, confident, no fluff. Aim for ~10–15 slides. Lead with takeaways; make the ask explicit and put a comparison on every KPI.',
  },
  {
    id: 'pitch',
    label: 'Pitch Deck',
    aliases: ['pitch deck', 'sales deck', 'investor deck', 'proposal deck'],
    sections: [
      'Cover',
      'The problem / why-now',
      'The solution (one line)',
      'How it works',
      'Proof (traction, case, or evidence)',
      'Differentiation',
      'Business model / pricing or cost & plan',
      'The ask / CTA',
    ],
    guidance:
      'Persuasive, narrative, value-first. Aim for ~10–12 slides. Open with the problem, not the product; close with a specific, time-bound call to action.',
  },
];
