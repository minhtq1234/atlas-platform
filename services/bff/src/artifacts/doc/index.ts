import type { ArtifactTypeModule } from '../module';
import { DocContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const docModule: ArtifactTypeModule = {
  type: 'Doc',
  schema: DocContent,
  shapeHint,
  archetypes,
  exemplarKey: 'doc',
  guidance: (archetypeId) => guidance(archetypeId, archetypes),
};
