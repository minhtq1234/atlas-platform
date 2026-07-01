import { color, font } from '../../brand/tokens';
import type { DocSection, DocBlock } from '../../types';
import { renderInline } from '../inline';

function BlockView({ b }: { b: DocBlock }) {
  if (b.type === 'paragraph') return <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: color.textSlate }}>{renderInline(b.text)}</p>;
  if (b.type === 'bullets') return <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: color.textSlate }}>{renderInline(it)}</li>)}</ul>;
  if (b.type === 'numbers') return <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>{b.items.map((it, i) => <li key={i} style={{ fontSize: 14, lineHeight: 1.55, color: color.textSlate }}>{renderInline(it)}</li>)}</ol>;
  if (b.type === 'callout') return <div style={{ background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 8, padding: '10px 12px' }}><div style={{ fontFamily: font.serif, fontSize: 18, fontWeight: 600, color: color.positive }}>{renderInline(b.value)}</div><div style={{ fontSize: 11, color: color.textMuted }}>{b.label}</div></div>;
  if (b.type === 'bars') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {b.bars.map((bar, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 120, flexShrink: 0, fontSize: 11, color: color.textMuted, textAlign: 'right' }}>{bar.label}</span>
          <div style={{ flex: 1, height: 14, background: color.trackBg, borderRadius: 4, overflow: 'hidden' }}><div style={{ width: `${Math.max(2, Math.round(bar.value * 100))}%`, height: '100%', background: color.indigo, borderRadius: 4 }} /></div>
        </div>
      ))}
    </div>
  );
  // table
  const cols = b.columns;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${color.border}`, color: color.textMuted, fontWeight: 700, fontSize: 11, letterSpacing: 0.3 }}>{c}</th>)}</tr></thead>
        <tbody>{b.rows.map((row, ri) => (
          <tr key={ri}>{cols.map((_, ci) => <td key={ci} style={{ padding: '6px 10px', borderBottom: `1px solid ${color.hairline}`, color: color.textSlate, verticalAlign: 'top' }}>{renderInline(row[ci] ?? '')}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function SectionedDoc({ sections }: { sections: DocSection[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: font.serif, fontSize: 18, fontWeight: 600, color: color.ink }}>{s.heading}</div>
          {s.blocks.map((b, bi) => <BlockView key={bi} b={b} />)}
        </div>
      ))}
    </div>
  );
}
