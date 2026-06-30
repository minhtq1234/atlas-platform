import { color, radius } from '../brand/tokens';
import { LogoMark, LogoMarkLight } from './Orb';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n/strings';

export function TopBar() {
  const lang = useAppStore((s) => s.lang);
  const openConnect = useAppStore((s) => s.openConnect);
  const showToast = useAppStore((s) => s.showToast);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 26px' }}>
      <LogoMark />
      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Atlas</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={() => showToast("Your library — every artifact you've built, re-downloadable.")}
          style={{ cursor: 'pointer', border: 'none', background: 'none', color: color.textMuted, fontSize: 13, fontWeight: 600 }}
        >
          {t('library', lang)}
        </button>
        <button
          type="button"
          onClick={openConnect}
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            background: color.ink,
            color: '#fff',
            borderRadius: radius.buttonSm,
            padding: '9px 15px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <LogoMarkLight />
          {t('connectSources', lang)}
        </button>
        <div
          aria-label="Linh P"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: color.indigo100,
            color: color.indigo,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          LP
        </div>
      </div>
    </div>
  );
}
