import { color, shadow } from '../../brand/tokens';
import type { DashboardContent } from '../../types';

export function DashboardView({ c }: { c: DashboardContent }) {
  return (
    <div style={{ width: 600, maxWidth: '100%', background: '#fff', borderRadius: 9, boxShadow: shadow.artifact, overflow: 'hidden' }}>
      <div style={{ padding: '20px 22px 0' }}>
        <div style={{ fontSize: 19, fontWeight: 700 }}>{c.title}</div>
        <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>{c.subtitle}</div>
      </div>
      <div style={{ padding: '16px 22px', display: 'flex', gap: 10 }}>
        {c.tiles.map((t, i) => (
          <div key={i} style={{ flex: 1, border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: 13 }}>
            <div style={{ fontSize: 9, color: color.textMuted, fontWeight: 600 }}>{t.label}</div>
            <div style={{ fontSize: 23, fontWeight: 700, marginTop: 4 }}>{t.value}</div>
            {t.delta && <div style={{ fontSize: 11, color: color.positive, fontWeight: 600 }}>{t.delta}</div>}
          </div>
        ))}
      </div>
      <div style={{ padding: '0 22px 22px' }}>
        <div style={{ border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: '15px 17px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: color.textMuted, letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase' }}>{c.series.label}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 96 }}>
            {c.series.bars.map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${Math.round(h * 100)}%`, background: i === c.series.bars.length - 1 ? color.coral : i >= c.series.bars.length - 3 ? color.indigo : color.indigo200, borderRadius: '3px 3px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
