import type { ArtifactContent } from '../../types';
import { DocView } from './DocView';
import { DeckView } from './DeckView';
import { SheetView } from './SheetView';
import { DashboardView } from './DashboardView';
import { ReportView } from './ReportView';

/** kind → renderer. A pack team registers its type here (+ ships its <Type>View). */
export function renderArtifact(content: ArtifactContent, page: number) {
  switch (content.kind) {
    case 'Doc': return <DocView c={content} />;
    case 'Deck': return <DeckView c={content} slide={page} />;
    case 'Sheet': return <SheetView c={content} />;
    case 'Dashboard': return <DashboardView c={content} />;
    case 'Report': return <ReportView c={content} />;
  }
}
