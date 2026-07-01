import { color, font, shadow } from '../../brand/tokens';
import type { ReportContent } from '../../types';
import { renderInline } from '../inline';

export function ReportView({ c }: { c: ReportContent }) {
  return (
    <div style={{ width: 600, maxWidth: '100%', background: '#fff', borderRadius: 6, boxShadow: shadow.artifact, overflow: 'hidden' }}>
      <div style={{ height: 8, background: color.coral }} />
      <div style={{ padding: '34px 44px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: color.textMuted }}>{c.eyebrow}</div>
        <div style={{ fontFamily: font.serif, fontSize: 34, fontWeight: 600, lineHeight: 1.1, color: color.ink }}>{c.title}</div>
        <div style={{ fontSize: 11.5, color: color.textGhost }}>{c.asOf}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {c.stats.map((st, i) => (
            <div key={i} style={{ flex: 1, border: `1px solid ${color.borderSoft}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: color.indigo }}>{st.value}</div>
              <div style={{ fontSize: 9, color: color.textMuted }}>{st.label}</div>
            </div>
          ))}
        </div>
        {c.paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: color.textSlate }}>{renderInline(p)}</p>
        ))}
      </div>
    </div>
  );
}
