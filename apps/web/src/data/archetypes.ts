export interface WebArchetype { id: string; label: string; aliases: string[] }

export const WEB_ARCHETYPES: WebArchetype[] = [
  { id: 'general', label: 'Document', aliases: [] },
];

export function detectArchetype(brief: string): string {
  const b = brief.toLowerCase();
  for (const a of WEB_ARCHETYPES) if (a.aliases.some((x) => b.includes(x))) return a.id;
  return 'general';
}
