import type { ArtifactTypeModule } from '../module';
import { ReportContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const reportModule: ArtifactTypeModule = {
  type: 'Report',
  schema: ReportContent,
  shapeHint,
  archetypes,
  exemplarKey: 'report',
  guidance,
};
