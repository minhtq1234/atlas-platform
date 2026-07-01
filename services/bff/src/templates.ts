import type { ArtifactContent, BuildRequest } from './types';

// Deterministic fallback content — used when no model is configured or when the
// model returns invalid JSON. Keeps the BFF always returning a valid artifact.
const titleOf = (req: BuildRequest, fallback: string) =>
  req.brief?.trim() ? req.brief.trim().slice(0, 64) : fallback;

export function fallbackContent(req: BuildRequest): ArtifactContent {
  switch (req.type) {
    case 'Doc':
      return {
        kind: 'Doc', eyebrow: 'MEMO · HUMAN RESOURCES', title: titleOf(req, 'Q2 Headcount Review'),
        meta: '30 June 2026 · People Analytics',
        paragraphs: [
          'Net headcount rose by 18 in Q2, led by TSE and Platform hiring.',
          'Offer-accept held at 94% and time-to-fill improved to 31 days.',
        ],
        bars: [{ label: 'Apr', value: 0.52 }, { label: 'May', value: 0.68 }, { label: 'Jun', value: 0.92 }],
        callout: { value: '+18', label: 'NET · Q2' },
      };
    case 'Deck':
      return {
        kind: 'Deck', eyebrow: 'ATLAS · BOARD DECK', title: titleOf(req, 'Q2 People Review'),
        subtitle: 'Headcount, attrition & hiring plan',
        slides: [
          { isCover: true, title: titleOf(req, 'Q2 People Review'), subtitle: 'Headcount, attrition & hiring plan' },
          { title: 'Headcount', bullets: ['1,248 total (+18 net)', 'TSE +18, Platform +11'] },
          { title: 'Q3 plan', bullets: ['Hold current pace', 'Prioritise revenue-facing backfills'] },
        ],
      };
    case 'Sheet':
      return {
        kind: 'Sheet', title: titleOf(req, 'Headcount Model'), columns: ['Org unit', 'Net', 'EoP'],
        rows: [['TSE', '+18', 342], ['Platform', '+11', 208], ['Studios', '+6', 176], ['Total', '+35', 726]],
      };
    case 'Dashboard':
      return {
        kind: 'Dashboard', title: titleOf(req, 'Workforce Pulse'), subtitle: 'Headcount · Q2 2026',
        tiles: [{ label: 'HEADCOUNT', value: '1,248', delta: '+18' }, { label: 'OFFER ACCEPT', value: '94%', delta: '+3 pts' }],
        series: {
          label: 'Headcount by month',
          bars: [
            { label: 'Jan', value: 0.46 }, { label: 'Feb', value: 0.58 }, { label: 'Mar', value: 0.64 },
            { label: 'Apr', value: 0.78 }, { label: 'May', value: 0.88 }, { label: 'Jun', value: 1 },
          ],
        },
      };
    case 'Report':
      return {
        kind: 'Report', eyebrow: 'MONTHLY REPORT · JUNE 2026', title: titleOf(req, 'People & Hiring'),
        asOf: 'As of 30 June 2026',
        stats: [{ value: '94%', label: 'OFFER ACCEPT' }, { value: '31', label: 'DAYS TO FILL' }],
        paragraphs: ['June closed with net +18 headcount and a healthy hiring funnel.'],
      };
  }
}

export function fallbackRevise(content: ArtifactContent, instruction: string): ArtifactContent {
  const note = `Revised — ${instruction}`;
  switch (content.kind) {
    case 'Doc': return { ...content, paragraphs: [...(content.paragraphs ?? []), note] };
    case 'Deck': return { ...content, slides: [...content.slides, { title: 'Update', bullets: [instruction] }] };
    case 'Sheet': return { ...content, rows: [...content.rows, ['Note', instruction, '']] };
    case 'Dashboard': return { ...content, subtitle: `${content.subtitle} · ${instruction}` };
    case 'Report': return { ...content, paragraphs: [...content.paragraphs, note] };
  }
}
