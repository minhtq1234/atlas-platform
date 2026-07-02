import type { ArtifactTypeModule } from '../module';
import { DeckContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';

export const deckModule: ArtifactTypeModule = {
  type: 'Deck',
  schema: DeckContent,
  shapeHint,
  archetypes,
  exemplarKey: 'deck',
  guidance,
};
