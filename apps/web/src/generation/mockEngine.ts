// Deterministic mock generation. Swap behind engine.ts for the real
// GreenNode model + Python artifact services later — same return shapes.
import type {
  ArtifactContent,
  BuildRequest,
  DashboardContent,
  DeckContent,
  DocContent,
  ReportContent,
  SheetContent,
} from '../types';

export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function titleFromBrief(brief: string, fallback: string): string {
  const b = (brief || '').trim();
  if (!b) return fallback;
  const titled = b.charAt(0).toUpperCase() + b.slice(1);
  return titled.length > 64 ? titled.slice(0, 64) + '…' : titled;
}

function scopeNote(req: BuildRequest): string {
  const chips = req.brief_chips ?? [];
  const scope = chips.find((c) => /only|TSE|platform|studios/i.test(c));
  const src = req.sourceKey ? ` drawn from ${req.sourceKey}` : '';
  return scope ? `Scope: ${scope}${src}.` : `Company-wide${src}.`;
}

function docContent(req: BuildRequest): DocContent {
  return {
    kind: 'Doc',
    eyebrow: 'MEMO · HUMAN RESOURCES',
    title: titleFromBrief(req.brief, 'Q2 Headcount Review'),
    meta: '30 June 2026 · People Analytics',
    paragraphs: [
      `${scopeNote(req)} Net headcount rose by 18 in Q2, led by TSE and Platform hiring, partially offset by planned G&A reductions.`,
      'Offer-accept held at 94% and time-to-fill improved to 31 days. Attrition remained stable at 6.2%, below the trailing-year average.',
      'Recommendation: hold the current hiring pace into Q3 while prioritising backfills in revenue-facing teams.',
    ],
    bars: [
      { label: 'Apr', value: 0.52 },
      { label: 'May', value: 0.68 },
      { label: 'Jun', value: 0.92 },
      { label: 'Plan', value: 0.6 },
    ],
    callout: { value: '+18', label: 'NET · Q2' },
  };
}

function deckContent(req: BuildRequest): DeckContent {
  return {
    kind: 'Deck',
    eyebrow: 'ATLAS · BOARD DECK',
    title: titleFromBrief(req.brief, 'Q2 People Review'),
    subtitle: 'Headcount, attrition & hiring plan',
    slides: [
      { isCover: true, title: titleFromBrief(req.brief, 'Q2 People Review'), subtitle: 'Headcount, attrition & hiring plan' },
      { title: 'Headcount', bullets: ['1,248 total (+18 net in Q2)', 'TSE +18, Platform +11, Studios +6', 'G&A −2 on planned consolidation'] },
      { title: 'Hiring & offers', bullets: ['Offer-accept 94% (+3 pts)', 'Time-to-fill 31 days (−4)', 'Pipeline weighted to engineering'] },
      { title: 'Attrition', bullets: ['6.2% trailing-12mo', 'Regretted attrition 3.1%', 'Stable vs. prior quarter'] },
      { title: 'Q3 plan', bullets: ['Hold current pace', 'Prioritise revenue-facing backfills', 'Revisit G&A in September'] },
    ],
  };
}

function sheetContent(req: BuildRequest): SheetContent {
  return {
    kind: 'Sheet',
    title: titleFromBrief(req.brief, 'Headcount Model'),
    columns: ['Org unit', 'Net', 'EoP'],
    rows: [
      ['TSE', '+18', 342],
      ['Platform', '+11', 208],
      ['Studios', '+6', 176],
      ['G&A', '−2', 94],
      ['Total', '+33', 820],
    ],
  };
}

function dashboardContent(req: BuildRequest): DashboardContent {
  return {
    kind: 'Dashboard',
    title: titleFromBrief(req.brief, 'Workforce Pulse'),
    subtitle: 'Headcount · Q2 2026 · TSE',
    tiles: [
      { label: 'HEADCOUNT', value: '1,248', delta: '+18' },
      { label: 'OFFER ACCEPT', value: '94%', delta: '+3 pts' },
      { label: 'ATTRITION', value: '6.2%', delta: '−0.4 pts' },
    ],
    series: {
      label: 'Headcount by month',
      bars: [
        { label: 'Jan', value: 0.46 }, { label: 'Feb', value: 0.58 }, { label: 'Mar', value: 0.64 },
        { label: 'Apr', value: 0.78 }, { label: 'May', value: 0.88 }, { label: 'Jun', value: 1 },
      ],
    },
  };
}

function reportContent(req: BuildRequest): ReportContent {
  return {
    kind: 'Report',
    eyebrow: 'MONTHLY REPORT · JUNE 2026',
    title: titleFromBrief(req.brief, 'People & Hiring'),
    asOf: 'As of 30 June 2026',
    stats: [
      { value: '94%', label: 'OFFER ACCEPT' },
      { value: '31', label: 'DAYS TO FILL' },
      { value: '6.2%', label: 'ATTRITION' },
    ],
    paragraphs: [
      `${scopeNote(req)} June closed with net +18 headcount and a healthy hiring funnel.`,
      'Engineering remains the largest open-req category; G&A is on plan for consolidation.',
    ],
  };
}

export function buildContent(req: BuildRequest): ArtifactContent {
  switch (req.type) {
    case 'Doc': return docContent(req);
    case 'Deck': return deckContent(req);
    case 'Sheet': return sheetContent(req);
    case 'Dashboard': return dashboardContent(req);
    case 'Report': return reportContent(req);
  }
}

/** Apply a free-text instruction to existing content (mock: light, visible mutation). */
export function reviseContent(content: ArtifactContent, instruction: string): ArtifactContent {
  const note = `Revised — ${instruction}`;
  switch (content.kind) {
    case 'Doc':
      return { ...content, paragraphs: [...content.paragraphs, note] };
    case 'Deck':
      return { ...content, slides: [...content.slides, { title: 'Update', bullets: [instruction] }] };
    case 'Sheet':
      return { ...content, rows: [...content.rows, ['Note', instruction, ''] as (string | number)[]] };
    case 'Dashboard':
      return { ...content, subtitle: `${content.subtitle} · ${instruction}` };
    case 'Report':
      return { ...content, paragraphs: [...content.paragraphs, note] };
  }
}
