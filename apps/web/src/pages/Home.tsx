import { color } from '../brand/tokens';
import { TopBar } from '../components/TopBar';
import { Orb } from '../components/Orb';
import { Composer } from '../components/Composer';
import { TemplateGallery } from '../components/TemplateGallery';
import { Toast } from '../components/Toast';
import { useAppStore } from '../store/useAppStore';
import { t } from '../i18n/strings';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export function Home() {
  const lang = useAppStore((s) => s.lang);
  return (
    <div style={{ minHeight: '100vh', background: color.paper, color: color.ink, display: 'flex', flexDirection: 'column' }}>
      <TopBar />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '34px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Orb />
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.025em' }}>{greeting()}, Linh</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 15, color: color.textMuted, textAlign: 'center', maxWidth: 520, lineHeight: 1.55 }}>
          {t('heroSub', lang)}
        </div>
        <Composer />
      </div>

      <TemplateGallery />
      <Toast />
    </div>
  );
}
