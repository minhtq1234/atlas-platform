import type { ArtifactContent } from '../types';
import { renderArtifact } from './renderers/registry';

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
  return renderArtifact(content, page);
}
