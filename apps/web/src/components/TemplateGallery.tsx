import { color, radius } from '../brand/tokens';
import { useAppStore } from '../store/useAppStore';
import { TABS, TEMPLATES, TYPE_TO_TAB } from '../data/templates';
import { TemplateCard } from './TemplateCard';
import { t } from '../i18n/strings';

export function TemplateGallery() {
  const lang = useAppStore((s) => s.lang);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const openConfigureFromTemplate = useAppStore((s) => s.openConfigureFromTemplate);
  const draft = useAppStore((s) => s.draft);
  const showToast = useAppStore((s) => s.showToast);
  const beginBuild = useAppStore((s) => s.beginBuild);
  const composerRequest = useAppStore((s) => s.composerRequest);

  const visible = TEMPLATES.filter((tp) => tab === 'all' || TYPE_TO_TAB[tp.type] === tab);

  const onBlank = () => {
    const brief = draft.trim();
    if (!brief) {
      showToast('Describe what you want above, then Atlas builds from scratch.');
      return;
    }
    const name = brief.length > 42 ? brief.slice(0, 42) + '…' : brief;
    beginBuild(composerRequest(brief), name);
  };

  return (
    <div style={{ maxWidth: 1160, width: '100%', margin: '46px auto 0', padding: '0 26px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{t('startFromTemplate', lang)}</div>
          <div style={{ fontSize: 13.5, color: color.textMuted, marginTop: 3 }}>{t('startFromTemplateSub', lang)}</div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} role="tablist" aria-label="Filter templates">
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(tb.key)}
                style={{
                  cursor: 'pointer',
                  borderRadius: radius.pill,
                  padding: '7px 15px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${active ? color.ink : '#E0DDD4'}`,
                  background: active ? color.ink : '#fff',
                  color: active ? '#fff' : color.textSlate,
                }}
              >
                {tb.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(312px,1fr))', gap: 20 }}>
        {/* Blank */}
        <button
          type="button"
          onClick={onBlank}
          style={{
            cursor: 'pointer',
            textAlign: 'left',
            background: 'none',
            border: `1.5px dashed ${color.borderStrong}`,
            borderRadius: radius.card,
            minHeight: 286,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 13,
            color: color.textMuted,
          }}
        >
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fff', border: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 300, color: color.indigo }}>+</div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: color.ink }}>{t('blankTitle', lang)}</div>
          <div style={{ fontSize: 12, color: color.textMuted }}>{t('blankSub', lang)}</div>
        </button>

        {visible.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} onClick={() => openConfigureFromTemplate(tpl)} />
        ))}
      </div>
    </div>
  );
}
