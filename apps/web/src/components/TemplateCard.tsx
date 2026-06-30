import { useState } from 'react';
import { color, font, radius, shadow } from '../brand/tokens';
import type { ArtifactType } from '../types';
import type { Template } from '../data/templates';

const SRC_GLYPH = (
  <span style={{ width: 8, height: 8, borderRadius: 2, background: color.borderStrong, flex: 'none' }} />
);

function bar(h: string, bg: string) {
  return <div style={{ width: 20, height: h, background: bg, borderRadius: '3px 3px 0 0' }} />;
}

function Thumb({ type }: { type: ArtifactType }) {
  const wrap = { height: 188, overflow: 'hidden' } as const;
  if (type === 'Doc') {
    return (
      <div style={{ ...wrap, background: '#fff', borderBottom: `1px solid ${color.hairline}`, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, color: color.textFaint }}>MEMO · HUMAN RESOURCES</div>
        <div style={{ fontFamily: font.serif, fontSize: 21, fontWeight: 600, lineHeight: 1.15, color: color.ink, marginTop: 2 }}>Q2 Headcount Review</div>
        <div style={{ height: 5, width: '100%', borderRadius: 3, background: '#ECEAE3' }} />
        <div style={{ height: 5, width: '88%', borderRadius: 3, background: '#ECEAE3' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, height: 42, marginTop: 7 }}>
          {bar('54%', color.indigo)}{bar('72%', color.indigo)}{bar('90%', color.indigo)}{bar('64%', color.borderStrong)}
        </div>
      </div>
    );
  }
  if (type === 'Deck') {
    return (
      <div style={{ ...wrap, background: 'linear-gradient(150deg,#1A1A2E,#2D3A8C)', padding: '22px 24px', display: 'flex', flexDirection: 'column', color: '#fff' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)' }}>ATLAS · BOARD DECK</div>
        <div style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.1, marginTop: 'auto', letterSpacing: '-0.01em' }}>Q2 People<br />Review</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Headcount, attrition &amp; hiring plan</div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 13 }}>12 slides</div>
      </div>
    );
  }
  if (type === 'Dashboard') {
    return (
      <div style={{ ...wrap, background: color.surfaceAlt, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', gap: 9 }}>
          <div style={{ flex: 1, background: '#fff', border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: '9px 11px' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>1,248</div>
            <div style={{ fontSize: 9, color: color.textFaint, fontWeight: 600 }}>HEADCOUNT</div>
          </div>
          <div style={{ flex: 1, background: '#fff', border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: '9px 11px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: color.positive }}>+18</div>
            <div style={{ fontSize: 9, color: color.textFaint, fontWeight: 600 }}>NET · Q2</div>
          </div>
        </div>
        <div style={{ flex: 1, background: '#fff', border: `1px solid ${color.borderSoft}`, borderRadius: 9, padding: '11px 12px', display: 'flex', alignItems: 'flex-end', gap: 7 }}>
          {['40%', '58%', '50%', '74%', '66%', '90%'].map((h, i) => (
            <div key={i} style={{ width: 14, height: h, background: i === 5 ? color.coral : i >= 3 ? color.indigo : color.indigo200, borderRadius: 3 }} />
          ))}
          <div style={{ marginLeft: 'auto', width: 40, height: 40, borderRadius: '50%', border: `7px solid ${color.indigo100}`, borderTopColor: color.indigo, borderRightColor: color.indigo }} />
        </div>
      </div>
    );
  }
  if (type === 'Sheet') {
    const rows = [['Org unit', 'Net', 'EoP'], ['TSE', '+18', '342'], ['Platform', '+11', '208'], ['Studios', '+6', '176'], ['G&A', '−2', '94']];
    return (
      <div style={{ ...wrap, background: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderBottom: `1px solid ${color.hairline}` }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: color.positive }}>SHEET</span>
          <span style={{ fontSize: 11, color: color.textFaint }}>Headcount Model</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', borderBottom: `1px solid ${color.hairline2}`, fontSize: 10.5, color: '#54534d' }}>
            <div style={{ width: 34, padding: '6px 0', textAlign: 'center', color: color.textGhost, background: color.surfaceAlt, borderRight: `1px solid ${color.hairline2}` }}>{i + 1}</div>
            <div style={{ flex: 1.6, padding: '6px 10px', borderRight: `1px solid ${color.hairline2}` }}>{r[0]}</div>
            <div style={{ flex: 1, padding: '6px 10px', textAlign: 'right', borderRight: `1px solid ${color.hairline2}` }}>{r[1]}</div>
            <div style={{ flex: 1, padding: '6px 10px', textAlign: 'right' }}>{r[2]}</div>
          </div>
        ))}
      </div>
    );
  }
  // Report
  return (
    <div style={{ ...wrap, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 7, background: color.coral, flex: 'none' }} />
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5, color: color.textFaint }}>MONTHLY REPORT · JUNE 2026</div>
        <div style={{ fontFamily: font.serif, fontSize: 21, fontWeight: 600, lineHeight: 1.15, color: color.ink }}>People &amp; Hiring</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <div style={{ flex: 1, border: `1px solid ${color.borderSoft}`, borderRadius: 7, padding: '7px 9px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.indigo }}>94%</div>
            <div style={{ fontSize: 8.5, color: color.textFaint }}>OFFER ACCEPT</div>
          </div>
          <div style={{ flex: 1, border: `1px solid ${color.borderSoft}`, borderRadius: 7, padding: '7px 9px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.indigo }}>31</div>
            <div style={{ fontSize: 8.5, color: color.textFaint }}>DAYS TO FILL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemplateCard({ tpl, onClick }: { tpl: Template; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        background: '#fff',
        border: `1px solid ${color.borderCard}`,
        borderRadius: radius.card,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hover ? shadow.cardHover : 'none',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'box-shadow .15s ease, transform .15s ease',
      }}
    >
      <Thumb type={tpl.type} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>{tpl.name}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: color.textMuted, background: color.paper, padding: '3px 9px', borderRadius: 7 }}>{tpl.type}</span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: color.textGhost, fontWeight: 500 }}>
          {SRC_GLYPH}
          {tpl.sourceLabel}
        </div>
      </div>
    </button>
  );
}
