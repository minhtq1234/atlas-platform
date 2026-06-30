// Lightweight i18n scaffold. EN default; VN keys stubbed for the bilingual pass.
export type Lang = 'en' | 'vi';

const en = {
  connectSources: 'Connect data sources',
  library: 'Library',
  heroSub:
    'Describe it, or start from a template. Atlas builds a finished, on-brand artifact — ready to share.',
  composerPlaceholder: 'Describe the artifact you want to build…',
  startFromTemplate: 'Start from a template',
  startFromTemplateSub:
    'Polished, on-brand artifacts — configure in seconds and Atlas builds it.',
  blankTitle: 'Blank artifact',
  blankSub: 'Describe it · Atlas builds from scratch',
  buildMeta: '~30s · lands in your library',
  recentArtifacts: 'Recent artifacts',
  emptyLibrary: 'Nothing built yet — describe something above or pick a template.',
} as const;

const vi: Record<keyof typeof en, string> = {
  connectSources: 'Kết nối nguồn dữ liệu',
  library: 'Thư viện',
  heroSub:
    'Mô tả, hoặc bắt đầu từ mẫu. Atlas tạo ra tài liệu hoàn chỉnh, đúng thương hiệu — sẵn sàng chia sẻ.',
  composerPlaceholder: 'Mô tả tài liệu bạn muốn tạo…',
  startFromTemplate: 'Bắt đầu từ mẫu',
  startFromTemplateSub:
    'Tài liệu chỉn chu, đúng thương hiệu — cấu hình trong vài giây và Atlas sẽ tạo.',
  blankTitle: 'Tài liệu trống',
  blankSub: 'Mô tả · Atlas tạo từ đầu',
  buildMeta: '~30 giây · lưu vào thư viện của bạn',
  recentArtifacts: 'Tài liệu gần đây',
  emptyLibrary: 'Chưa có gì — mô tả ở trên hoặc chọn một mẫu.',
};

const dict: Record<Lang, Record<string, string>> = { en, vi };

export function t(key: keyof typeof en, lang: Lang = 'en'): string {
  return dict[lang][key] ?? en[key];
}
