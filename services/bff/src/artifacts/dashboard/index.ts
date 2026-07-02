import type { ArtifactTypeModule } from '../module';
import { DashboardContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const dashboardModule: ArtifactTypeModule = {
  type: 'Dashboard',
  schema: DashboardContent,
  shapeHint,
  archetypes,
  exemplarKey: 'dashboard',
  guidance,
};
