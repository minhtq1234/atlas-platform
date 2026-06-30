import { color, shadow } from '../brand/tokens';
import { LogoMark } from './Orb';
import { useAppStore } from '../store/useAppStore';

export function ConnectSourcesOverlay() {
  const open = useAppStore((s) => s.connectOpen);
  const sources = useAppStore((s) => s.sources);
  const closeConnect = useAppStore((s) => s.closeConnect);
  const toggleSourceConnected = useAppStore((s) => s.toggleSourceConnected);
  const showToast = useAppStore((s) => s.showToast);
  if (!open) return null;

  return (
    <div onClick={closeConnect} style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 35 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '100%', background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: shadow.modal, animation: 'risein .2s ease' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${color.borderSoft}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: color.textMuted }}>DATA SOURCES</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 5, letterSpacing: '-0.01em' }}>Connect governed sources</div>
            {/* Subtle, single-line governance note — not a lecture. */}
            <div style={{ fontSize: 12.5, color: color.textMuted, marginTop: 4, lineHeight: 1.5 }}>
              Atlas queries these under your identity — you only see what you're cleared for.
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={closeConnect} style={{ cursor: 'pointer', border: 'none', background: color.paper, width: 30, height: 30, borderRadius: 8, color: color.textMuted, fontSize: 17, flex: 'none' }}>×</button>
        </div>
        <div style={{ padding: '14px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sources.map((src) => {
            const denied = !src.accessible;
            const label = denied ? 'No access' : src.connected ? 'Connected' : 'Connect';
            const btnStyle = {
              cursor: denied ? 'default' : 'pointer',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              flex: 'none',
              border: '1px solid',
              ...(src.connected
                ? { borderColor: color.okBorder, background: color.okBg, color: color.okText }
                : denied
                  ? { borderColor: color.warnBorder, background: color.warnBg, color: color.warnText }
                  : { borderColor: color.ink, background: color.ink, color: '#fff' }),
            } as const;
            return (
              <div key={src.key} style={{ display: 'flex', alignItems: 'center', gap: 13, border: `1px solid ${color.borderSoft}`, borderRadius: 12, padding: '13px 15px' }}>
                <LogoMark scale={0.9} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{src.key}</div>
                  <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.45 }}>{src.desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    denied
                      ? showToast("You're not provisioned for this source — request access from your admin.")
                      : toggleSourceConnected(src.key)
                  }
                  style={btnStyle}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
