import type { ArtifactTypeModule } from '../module';
import { SheetContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const sheetModule: ArtifactTypeModule = {
  type: 'Sheet',
  schema: SheetContent,
  shapeHint,
  archetypes,
  exemplarKey: 'sheet',
  guidance,
};
