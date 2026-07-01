import { color, shadow } from '../../brand/tokens';
import type { DeckContent } from '../../types';
import { renderInline } from '../inline';

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

  if (s.isCover) {
    return (
      <div style={{ ...frame, background: 'linear-gradient(150deg,#1A1A2E,#2D3A8C)', color: '#fff' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: 'rgba(255,255,255,0.55)' }}>{c.eyebrow}</div>
        <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.04, marginTop: 'auto', letterSpacing: '-0.01em' }}>{s.title}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>{s.subtitle ?? c.subtitle}</div>
      </div>
    );
  }
  return (
    <div style={{ ...frame, background: '#fff' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: color.indigo }}>{c.eyebrow}</div>
      <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, color: color.ink, letterSpacing: '-0.01em' }}>{s.title}</div>
      <ul style={{ marginTop: 18, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(s.bullets ?? []).map((b, i) => (
          <li key={i} style={{ fontSize: 17, lineHeight: 1.4, color: color.textSlate }}>{renderInline(b)}</li>
        ))}
      </ul>
    </div>
  );
}
