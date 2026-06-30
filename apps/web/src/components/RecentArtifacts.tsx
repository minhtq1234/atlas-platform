import { useNavigate } from 'react-router-dom';
import { color, radius } from '../brand/tokens';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n/strings';

const TYPE_ICON: Record<string, string> = {
  Doc: '📄', Deck: '🖥', Sheet: '▦', Dashboard: '📊', Report: '📈',
};

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function RecentArtifacts() {
  const lang = useAppStore((s) => s.lang);
  const library = useAppStore((s) => s.library);
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 1160, width: '100%', margin: '0 auto', padding: '0 26px 70px' }}>
      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 14 }}>
        {t('recentArtifacts', lang)}
      </div>
      {library.length === 0 ? (
        <div style={{ border: `1.5px dashed ${color.borderStrong}`, borderRadius: radius.card, padding: '28px 24px', textAlign: 'center', color: color.textMuted, fontSize: 13.5 }}>
          {t('emptyLibrary', lang)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {library.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => navigate(`/studio/${a.id}`)}
              style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 13, background: '#fff', border: `1px solid ${color.borderCard}`, borderRadius: 12, padding: '12px 15px' }}
            >
              <span style={{ width: 32, height: 32, borderRadius: 8, background: color.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flex: 'none' }}>{TYPE_ICON[a.type] ?? '📄'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: color.textMuted }}>{a.type} · {a.versions.length} version{a.versions.length > 1 ? 's' : ''} · {ago(a.createdAt)}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: color.indigo }}>Open →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
