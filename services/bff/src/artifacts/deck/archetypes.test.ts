import { describe, it, expect } from 'vitest';
import { archetypes } from './archetypes';
import { detectArchetype } from '../registry';

describe('Deck archetypes', () => {
  it('defines board and pitch, each with a slide arc', () => {
    const ids = archetypes.map((a) => a.id).sort();
    expect(ids).toEqual(['board', 'pitch']);
    const board = archetypes.find((a) => a.id === 'board')!;
    expect(board.sections.some((s) => s.toLowerCase().includes('ask'))).toBe(true);
    const pitch = archetypes.find((a) => a.id === 'pitch')!;
    expect(pitch.sections.some((s) => s.toLowerCase().includes('problem'))).toBe(true);
  });

  it('never uses the reserved "general" id (it would collide in the registry)', () => {
    expect(archetypes.some((a) => a.id === 'general')).toBe(false);
  });

  it('detects a board-deck brief via the registry', () => {
    expect(detectArchetype('make a board deck for the Q2 review')).toBe('board');
  });
});
