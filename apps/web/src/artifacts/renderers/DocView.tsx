import { color, font, shadow } from '../../brand/tokens';
import type { DocContent } from '../../types';

export function DocView({ c }: { c: DocContent }) {
  return (
    <div style={{ width: 620, maxWidth: '100%', background: '#fff', borderRadius: 6, boxShadow: shadow.artifact, padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: color.textMuted }}>{c.eyebrow}</div>
      <div style={{ fontFamily: font.serif, fontSize: 38, fontWeight: 600, lineHeight: 1.08, color: color.ink }}>{c.title}</div>
      <div style={{ fontSize: 12, color: color.textGhost }}>{c.meta}</div>
      <div style={{ height: 1, background: color.hairline, margin: '6px 0' }} />
      {c.paragraphs.map((p, i) => (
        <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: color.textSlate }}>{p}</p>
      ))}
      {c.bars && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 96, margin: '12px 0' }}>
          {c.bars.map((b, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 30, height: `${Math.round(b.value * 80)}px`, background: i === c.bars!.length - 1 ? color.coral : color.indigo, borderRadius: '3px 3px 0 0' }} />
              <span style={{ fontSize: 10, color: color.textMuted }}>{b.label}</span>
            </div>
          ))}
          {c.callout && (
            <div style={{ marginLeft: 8, alignSelf: 'center' }}>
              <div style={{ fontFamily: font.serif, fontSize: 30, fontWeight: 600, color: color.positive, lineHeight: 1 }}>{c.callout.value}</div>
              <div style={{ fontSize: 10, color: color.textMuted }}>{c.callout.label}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
