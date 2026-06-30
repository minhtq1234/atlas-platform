import type { ArtifactType, BuildRequest } from './types';

// Per-type JSON shape hints handed to the model. Keep terse but exact.
const SHAPE: Record<ArtifactType, string> = {
  Doc: `{"kind":"Doc","eyebrow":string,"title":string,"meta":string,"paragraphs":string[],"bars":[{"label":string,"value":number 0..1}]?,"callout":{"value":string,"label":string}?}`,
  Deck: `{"kind":"Deck","eyebrow":string,"title":string,"subtitle":string,"slides":[{"title":string,"bullets":string[]?,"isCover":boolean?,"subtitle":string?}] (first slide isCover:true)}`,
  Sheet: `{"kind":"Sheet","title":string,"columns":string[],"rows":(string|number)[][] (each row length == columns length)}`,
  Dashboard: `{"kind":"Dashboard","title":string,"subtitle":string,"tiles":[{"label":string,"value":string,"delta":string?}],"series":{"label":string,"bars":number[] 0..1}}`,
  Report: `{"kind":"Report","eyebrow":string,"title":string,"asOf":string,"stats":[{"value":string,"label":string}],"paragraphs":string[]}`,
};

export function generateSystem(type: ArtifactType, lang: 'en' | 'vi'): string {
  return [
    'You are Atlas, an assistant that composes finished, on-brand business artifacts for VNG back-office teams.',
    `Produce a ${type}. Respond with ONLY a single JSON object — no markdown, no prose — matching exactly this shape:`,
    SHAPE[type],
    'Keep content concise, realistic, and professional. Numbers should be internally consistent.',
    lang === 'vi' ? 'Write all human-readable text in Vietnamese.' : 'Write all human-readable text in English.',
  ].join('\n');
}

export function generateUser(req: BuildRequest): string {
  const lines = [`Brief: ${req.brief}`];
  if (req.sourceKey) lines.push(`Data source: ${req.sourceKey}`);
  if (req.brief_chips?.length) lines.push(`Constraints: ${req.brief_chips.join(', ')}`);
  if (req.uploads?.length) lines.push(`Attached files: ${req.uploads.map((u) => u.name).join(', ')}`);
  return lines.join('\n');
}

export function reviseSystem(type: ArtifactType, lang: 'en' | 'vi'): string {
  return [
    `You are Atlas. You will be given an existing ${type} as JSON and an instruction.`,
    'Apply the instruction and respond with ONLY the full updated JSON object of the same shape. No prose.',
    SHAPE[type],
    lang === 'vi' ? 'Keep human-readable text in Vietnamese.' : 'Keep human-readable text in English.',
  ].join('\n');
}

export function reviseUser(currentJson: string, instruction: string): string {
  return `Current:\n${currentJson}\n\nInstruction: ${instruction}`;
}
