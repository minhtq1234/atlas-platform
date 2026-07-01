import type { Archetype } from '../module';

export const shapeHint = `{"kind":"Doc","eyebrow":string,"title":string,"meta":string, and EITHER "paragraphs":string[] (a short memo) OR "sections":[{"heading":string,"blocks":[{"type":"paragraph","text":string}|{"type":"bullets","items":string[]}|{"type":"numbers","items":string[]}|{"type":"table","columns":string[],"rows":string[][]}|{"type":"callout","value":string,"label":string}|{"type":"bars","label":string?,"bars":[{"label":string,"value":number 0..1}]}]}] (a structured document). Only add a "bars" block when the brief has real quantitative data.}`;

/** Doc steering: the sections skeleton + guidance ('' when the archetype has no sections). */
export function guidance(arch?: Archetype): string {
  if (!arch || !arch.sections.length) return '';
  return `Use these sections in order: ${arch.sections.join('; ')}.\n${arch.guidance}`;
}
