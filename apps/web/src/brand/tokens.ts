// Atlas — Strata brand tokens. Single source of truth for color, type, radius, shadow.
// Derived from UX-Spec_Atlas-Home_v1.md §3 and the v2 design.

export const color = {
  paper: '#F4F2EC',
  ink: '#1A1A2E',
  indigo: '#2D3A8C',
  indigo400: '#7D86D4',
  indigo200: '#C7CEE8',
  indigo100: '#EDEFF7',
  coral: '#F0997B',
  positive: '#0F6E56',
  white: '#FFFFFF',

  // text
  textMuted: '#6E6C64', // AA-safe secondary (replaces #8A887F)
  textFaint: '#8A887F', // decorative only (never small body text)
  textSlate: '#54534D',
  textSlate2: '#4A4A55',
  textGhost: '#B4B2A9',

  // surfaces / borders
  border: '#E3E1DA',
  borderSoft: '#ECEAE3',
  borderCard: '#E9E7E0',
  borderStrong: '#D6D3CA',
  hairline: '#F0EEE7',
  hairline2: '#F2F0E9',
  surfaceAlt: '#FBFAF6',
  trackBg: '#E6E3DA',

  // status — connected
  okBg: '#E1F5EE',
  okBorder: '#DCE7DF',
  okText: '#0F6E56',
  // status — no access / connect
  warnBg: '#F6ECDD',
  warnBorder: '#E7D3B8',
  warnText: '#8A4F1E',
} as const;

export const font = {
  ui: "'Be Vietnam Pro', ui-sans-serif, system-ui, sans-serif",
  serif: "'Newsreader', Georgia, serif",
} as const;

export const radius = {
  pill: '999px',
  card: '16px',
  composer: '18px',
  menu: '12px',
  button: '11px',
  buttonSm: '10px',
} as const;

export const shadow = {
  card: '0 2px 14px rgba(26,26,46,0.05)',
  cardHover: '0 8px 26px rgba(26,26,46,0.1)',
  menu: '0 12px 34px rgba(26,26,46,0.16)',
  modal: '0 24px 70px rgba(26,26,46,0.3)',
  artifact: '0 10px 36px rgba(26,26,46,0.16)',
} as const;

export const orbGradient =
  'conic-gradient(from 140deg,#F0997B,#2D3A8C,#1A1A2E,#F0997B)';

export const tokens = { color, font, radius, shadow, orbGradient };
export default tokens;
