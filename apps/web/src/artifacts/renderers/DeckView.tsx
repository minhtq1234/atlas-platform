import { color, shadow } from '../../brand/tokens';
import type { DeckContent, Slide } from '../../types';
import { renderInline } from '../inline';

export function slideKind(s: Slide): 'cover' | 'section' | 'statement' | 'bullets' {
  if (s.isCover) return 'cover';
  if (s.layout === 'section') return 'section';
  if (s.layout === 'statement') return 'statement';
  return 'bullets';
}

export function DeckView({ c, slide = 0 }: { c: DeckContent; slide?: number }) {
  const s = c.slides[Math.min(slide, c.slides.length - 1)];
  if (!s) {
    return (
      <div style={{ width: 680, maxWidth: '100%', aspectRatio: '16 / 9', borderRadius: 10, boxShadow: shadow.artifact, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.textMuted, fontSize: 14 }}>
        This deck has no slides yet.
      </div>
    );
  }
  const frame = {
    width: 680,
    maxWidth: '100%',
    aspectRatio: '16 / 9',
    borderRadius: 10,
    boxShadow: shadow.artifact,
    padding: '44px 52px',
    display: 'flex',
    flexDirection: 'column',
  } as const;

  const kind = slideKind(s);

  const slideEl =
    kind === 'cover' ? (
      <div style={{ ...frame, background: 'linear-gradient(150deg,#1A1A2E,#2D3A8C)', color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)' }}>{c.eyebrow}</div>
        <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.04, marginTop: 'auto', letterSpacing: '-0.01em' }}>{s.title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>{s.subtitle ?? c.subtitle}</div>
      </div>
    ) : kind === 'section' ? (
      <div style={{ ...frame, background: 'linear-gradient(150deg,#2D3A8C,#1A1A2E)', color: '#fff', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, color: 'rgba(255,255,255,0.6)' }}>{c.eyebrow}</div>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, marginTop: 10, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
      </div>
    ) : kind === 'statement' ? (
      <div style={{ ...frame, background: '#fff', justifyContent: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.15, color: color.ink, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
        {s.subtitle ? <div style={{ fontSize: 16, color: color.textMuted, marginTop: 14 }}>{renderInline(s.subtitle)}</div> : null}
      </div>
    ) : (
      <div style={{ ...frame, background: '#fff' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: color.indigo }}>{c.eyebrow}</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, color: color.ink, letterSpacing: '-0.01em' }}>{renderInline(s.title)}</div>
        <ul style={{ marginTop: 18, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(s.bullets ?? []).map((b, i) => (
            <li key={i} style={{ fontSize: 17, lineHeight: 1.4, color: color.textSlate }}>{renderInline(b)}</li>
          ))}
        </ul>
      </div>
    );

  if (!s.notes) return slideEl;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 680, maxWidth: '100%' }}>
      {slideEl}
      <div style={{ fontSize: 13, lineHeight: 1.5, color: color.textMuted, borderLeft: '3px solid #E6E8EF', paddingLeft: 12 }}>
        <span style={{ fontWeight: 700, color: color.textSlate }}>Speaker notes. </span>
        {renderInline(s.notes)}
      </div>
    </div>
  );
}
