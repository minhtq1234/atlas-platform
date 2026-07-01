import type { Archetype } from '../module';

export const shapeHint = `{"kind":"Doc","eyebrow":string,"title":string,"meta":string, and EITHER "paragraphs":string[] (a short memo) OR "sections":[{"heading":string,"blocks":[{"type":"paragraph","text":string}|{"type":"bullets","items":string[]}|{"type":"numbers","items":string[]}|{"type":"table","columns":string[],"rows":string[][]}|{"type":"callout","value":string,"label":string}|{"type":"bars","label":string?,"bars":[{"label":string,"value":number 0..1}]}]}] (a structured document). Only add a "bars" block when the brief has real quantitative data.}`;

/** Type/archetype steering appended to the prompt ('' when none). */
export function guidance(archetypeId: string | undefined, archetypes: Archetype[]): string {
  const a = archetypes.find((x) => x.id === archetypeId);
  if (!a || !a.sections.length) return '';
  return `Use these sections in order: ${a.sections.join('; ')}.\n${a.guidance}`;
}
