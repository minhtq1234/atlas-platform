export interface Archetype {
  id: string;
  label: string;
  aliases: string[];
  sections: string[];
  guidance: string;
}

export const ARCHETYPES: Record<string, Archetype> = {
  general: {
    id: 'general',
    label: 'Document',
    aliases: [],
    sections: [],
    guidance: 'Structure the document into the logical sections that best fit the request.',
  },
};

/** Lowercase alias match against the brief; first hit wins, else 'general'. */
export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of Object.values(ARCHETYPES)) {
    if (a.aliases.some((alias) => b.includes(alias))) return a.id;
  }
  return 'general';
}

/** Safe lookup; unknown/undefined → general. */
export function archetype(id?: string): Archetype {
  return (id && ARCHETYPES[id]) || ARCHETYPES.general;
}
