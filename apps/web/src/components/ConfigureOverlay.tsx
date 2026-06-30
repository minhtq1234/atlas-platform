import { color, radius, shadow } from '../brand/tokens';
import { useAppStore } from '../store/useAppStore';
import { ArtifactCanvas } from '../artifacts/ArtifactCanvas';
import { buildContent } from '../generation/mockEngine';

const QUICK_CHIPS = ['Q2 2026', 'TSE only', 'In Vietnamese', 'Minimal style'];

export function ConfigureOverlay() {
  const s = useAppStore();
  const cfg = s.configure;
  if (!cfg) return null;

  const previewContent = buildContent({
    brief: cfg.name,
    type: cfg.type,
    sourceKey: cfg.sourceKey,
    modelId: s.modelId,
    brief_chips: s.chips,
    lang: s.lang,
  });

  const sourceText = cfg.sourceLabel ?? 'your brief';

  const onBuild = () => {
    s.beginBuild(
      {
        brief: cfg.name,
        type: cfg.type,
        templateId: cfg.templateId,
        sourceKey: cfg.sourceKey,
        modelId: s.modelId,
        brief_chips: s.chips,
        lang: s.lang,
      },
      cfg.name,
    );
  };

  return (
    <div onClick={s.closeConfigure} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        {/* header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${color.borderSoft}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flex: 'none' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: color.textMuted }}>CONFIGURE · {cfg.type.toUpperCase()}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 5, letterSpacing: '-0.01em' }}>{cfg.name}</div>
          </div>
          <button type="button" aria-label="Close" onClick={s.closeConfigure} style={closeBtn}>×</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* preview */}
          <div style={{ flex: 1.18, background: '#EDEBE4', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', minWidth: 0 }}>
            <div style={{ transform: 'scale(0.74)', transformOrigin: 'center' }}>
              <ArtifactCanvas content={previewContent} />
            </div>
          </div>

          {/* chat config */}
          <div style={{ width: 344, flex: 'none', borderLeft: `1px solid ${color.borderSoft}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'conic-gradient(from 130deg,#F0997B,#2D3A8C,#1A1A2E,#F0997B)', flex: 'none', marginTop: 1 }} />
                <div style={{ fontSize: 13, lineHeight: 1.55, color: color.ink }}>
                  I'll build a {cfg.type.toLowerCase()} from <strong>{sourceText}</strong>. Tell me how to tailor it — period, scope, language, or style.
                </div>
              </div>

              {s.chips.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 33 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: color.textMuted }}>APPLIED</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {s.chips.map((chip, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color.indigo100, color: color.indigo, borderRadius: radius.pill, padding: '5px 11px', fontSize: 12, fontWeight: 600 }}>
                        {chip}
                        <button type="button" aria-label={`Remove ${chip}`} onClick={() => s.removeChip(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: color.indigo400, padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 'none', padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {QUICK_CHIPS.map((label) => (
                  <button key={label} type="button" onClick={() => s.addChip(label)} style={{ cursor: 'pointer', background: '#fff', border: `1px dashed ${color.borderStrong}`, borderRadius: radius.pill, padding: '6px 11px', fontSize: 12, fontWeight: 600, color: color.textMuted }}>
                    + {label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: color.paper, border: `1px solid ${color.border}`, borderRadius: 12, padding: '7px 7px 7px 13px' }}>
                <input
                  value={s.configDraft}
                  onChange={(e) => s.setConfigDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); s.addChip(s.configDraft); } }}
                  placeholder="e.g. just TSE, in Vietnamese…"
                  aria-label="Tailor the artifact"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontFamily: 'inherit', fontSize: 13, color: color.ink, padding: '5px 0' }}
                />
                <button type="button" aria-label="Add" onClick={() => s.addChip(s.configDraft)} style={{ cursor: 'pointer', border: 'none', background: color.ink, color: '#fff', width: 32, height: 32, borderRadius: 8, fontSize: 14, flex: 'none' }}>↑</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${color.borderSoft}`, paddingTop: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color.borderStrong, flex: 'none' }} />
                <span style={{ fontSize: 12, color: color.textMuted }}>Data from <span style={{ color: color.textSlate, fontWeight: 600 }}>{sourceText}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${color.borderSoft}`, display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <button type="button" onClick={onBuild} style={{ cursor: 'pointer', border: 'none', background: color.ink, color: '#fff', padding: '11px 22px', borderRadius: radius.buttonSm, fontSize: 13.5, fontWeight: 600 }}>
            Build {cfg.type}
          </button>
          <span style={{ fontSize: 12, color: color.textMuted }}>~30s · lands in your library</span>
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.32)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 30,
} as const;

const modal = {
  width: 920, maxWidth: '100%', maxHeight: '90vh', background: '#fff',
  borderRadius: 18, overflow: 'hidden', boxShadow: shadow.modal,
  animation: 'risein .2s ease', display: 'flex', flexDirection: 'column',
} as const;

const closeBtn = {
  cursor: 'pointer', border: 'none', background: color.paper, width: 30, height: 30,
  borderRadius: 8, color: color.textMuted, fontSize: 17, flex: 'none',
} as const;
