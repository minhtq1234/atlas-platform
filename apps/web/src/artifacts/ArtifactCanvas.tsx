import type { ArtifactContent } from '../types';
import { DocView } from './renderers/DocView';
import { DeckView } from './renderers/DeckView';
import { SheetView } from './renderers/SheetView';
import { DashboardView } from './renderers/DashboardView';
import { ReportView } from './renderers/ReportView';

/** How many pages/slides this content has (for the pager + filmstrip). Never < 1. */
export function pageCount(content: ArtifactContent): number {
  return content.kind === 'Deck' ? Math.max(1, content.slides.length) : 1;
}

export function pageLabel(content: ArtifactContent, page: number): string {
  if (content.kind === 'Deck') {
    const s = content.slides[page];
    return s?.isCover ? 'Cover' : s?.title ?? `Slide ${page + 1}`;
  }
  return content.kind;
}

export function ArtifactCanvas({ content, page = 0 }: { content: ArtifactContent; page?: number }) {
  switch (content.kind) {
    case 'Doc': return <DocView c={content} />;
    case 'Deck': return <DeckView c={content} slide={page} />;
    case 'Sheet': return <SheetView c={content} />;
    case 'Dashboard': return <DashboardView c={content} />;
    case 'Report': return <ReportView c={content} />;
  }
}
