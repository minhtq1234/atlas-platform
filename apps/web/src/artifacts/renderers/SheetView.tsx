import { color, shadow } from '../../brand/tokens';
import type { SheetContent } from '../../types';

const COLNAMES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function SheetView({ c }: { c: SheetContent }) {
  return (
    <div style={{ width: 560, maxWidth: '100%', background: '#fff', borderRadius: 9, boxShadow: shadow.artifact, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', borderBottom: `1px solid ${color.hairline}` }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: color.positive }}>SHEET</span>
        <span style={{ fontSize: 13, color: color.textMuted }}>{c.title}</span>
      </div>
      {/* column header row */}
      <div style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: color.textGhost, background: color.surfaceAlt, borderBottom: `1px solid ${color.hairline2}` }}>
        <div style={{ width: 34, flex: 'none', padding: '7px 0', textAlign: 'center', borderRight: `1px solid ${color.hairline2}` }} />
        {c.columns.map((_, i) => (
          <div key={i} style={{ flex: i === 0 ? 1.6 : 1, padding: '7px 12px', borderRight: i < c.columns.length - 1 ? `1px solid ${color.hairline2}` : 'none' }}>{COLNAMES[i]}</div>
        ))}
      </div>
      {/* labelled header */}
      <div style={{ display: 'flex', fontSize: 12.5, fontWeight: 700, color: color.textSlate, borderBottom: `1px solid ${color.hairline2}` }}>
        <div style={{ width: 34, flex: 'none', padding: '8px 0', textAlign: 'center', color: color.textGhost, background: color.surfaceAlt, borderRight: `1px solid ${color.hairline2}` }}>1</div>
        {c.columns.map((col, i) => (
          <div key={i} style={{ flex: i === 0 ? 1.6 : 1, padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', borderRight: i < c.columns.length - 1 ? `1px solid ${color.hairline2}` : 'none' }}>{col}</div>
        ))}
      </div>
      {c.rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', fontSize: 12.5, color: color.textSlate, borderBottom: `1px solid ${color.hairline2}` }}>
          <div style={{ width: 34, flex: 'none', padding: '8px 0', textAlign: 'center', color: color.textGhost, background: color.surfaceAlt, borderRight: `1px solid ${color.hairline2}` }}>{r + 2}</div>
          {row.map((cell, i) => (
            <div key={i} style={{ flex: i === 0 ? 1.6 : 1, padding: '8px 12px', textAlign: i === 0 ? 'left' : 'right', fontWeight: i === 0 ? 500 : 400, fontVariantNumeric: 'tabular-nums', borderRight: i < row.length - 1 ? `1px solid ${color.hairline2}` : 'none' }}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
