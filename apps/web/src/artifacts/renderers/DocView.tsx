import { color, font, shadow } from '../../brand/tokens';
import type { DocContent } from '../../types';
import { renderInline, plainLength } from '../inline';
import { SectionedDoc } from './SectionedDoc';

export function DocView({ c }: { c: DocContent }) {
  return (
    <div style={{ width: 620, maxWidth: '100%', background: '#fff', borderRadius: 6, boxShadow: shadow.artifact, padding: '48px 56px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.6, color: color.textMuted }}>{c.eyebrow}</div>
      <div style={{ fontFamily: font.serif, fontSize: 38, fontWeight: 600, lineHeight: 1.08, color: color.ink }}>{c.title}</div>
      <div style={{ fontSize: 12, color: color.textGhost }}>{c.meta}</div>
      <div style={{ height: 1, background: color.hairline, margin: '6px 0' }} />
      {c.sections && c.sections.length ? (
        <SectionedDoc sections={c.sections} />
      ) : (
        (c.paragraphs ?? []).map((p, i) => (
          <p key={i} style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: color.textSlate }}>{renderInline(p)}</p>
        ))
      )}
      {c.bars && (() => {
        const bars = c.bars!;
        const last = bars.length - 1;
        const horizontal = c.barsLayout === 'horizontal';
        const co = c.callout;
        // Highlighted stat (e.g. "+37%"): big serif for short values; shrink + wrap
        // long ones so they never overflow.
        const calloutEl = co
          ? (() => {
              const stat = plainLength(co.value) <= 16;
              return (
                <div style={{ marginLeft: horizontal ? 0 : 8, marginTop: horizontal ? 4 : 0, alignSelf: horizontal ? 'flex-start' : 'center', maxWidth: 220 }}>
                  <div style={{ fontFamily: font.serif, fontSize: stat ? 30 : 14, fontWeight: 600, color: color.positive, lineHeight: stat ? 1 : 1.35, wordBreak: 'break-word' }}>{renderInline(co.value)}</div>
                  <div style={{ fontSize: 10, color: color.textMuted, marginTop: stat ? 0 : 4 }}>{co.label}</div>
                </div>
              );
            })()
          : null;

        if (horizontal) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, margin: '12px 0' }}>
              {bars.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 104, flexShrink: 0, fontSize: 11, color: color.textMuted, textAlign: 'right' }}>{b.label}</span>
                  <div style={{ flex: 1, height: 16, background: color.trackBg, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(2, Math.round(b.value * 100))}%`, height: '100%', background: i === last ? color.coral : color.indigo, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              {calloutEl}
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, minHeight: 96, margin: '12px 0', flexWrap: 'wrap' }}>
            {bars.map((b, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 30, height: `${Math.round(b.value * 80)}px`, background: i === last ? color.coral : color.indigo, borderRadius: '3px 3px 0 0' }} />
                <span style={{ fontSize: 10, color: color.textMuted }}>{b.label}</span>
              </div>
            ))}
            {calloutEl}
          </div>
        );
      })()}
    </div>
  );
}
