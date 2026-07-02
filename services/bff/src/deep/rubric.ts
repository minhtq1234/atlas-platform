/** The shared depth bar the critic optimizes to and the eval judge scores against. */
export const DEPTH_RUBRIC = [
  'A DEEP artifact scores high on ALL of:',
  '- Specificity: concrete claims, names, and details — not generic statements that fit any company.',
  '- Non-obviousness: at least one insight, tradeoff, or risk a template would miss.',
  '- Quantification: numbers where the brief supports them, internally consistent across the artifact.',
  '- No filler: every section/slide/bullet earns its place; no restated headings or empty transitions.',
].join('\n');
