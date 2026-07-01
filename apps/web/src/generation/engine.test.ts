import { describe, it, expect } from 'vitest';
import { generateArtifact, reviseArtifact, mockEngine } from './engine';
import { makeResilientEngine } from './httpEngine';
import type { BuildRequest, ArtifactType } from '../types';

function req(type: ArtifactType, over: Partial<BuildRequest> = {}): BuildRequest {
  return { brief: 'Q2 headcount review for the board', type, modelId: 'gn-llama3-70b', ...over };
}

describe('generateArtifact (mock engine)', () => {
  it('returns an artifact with one initial version and matching type', async () => {
    const a = await generateArtifact(req('Doc'), 'Headcount Memo');
    expect(a.type).toBe('Doc');
    expect(a.name).toBe('Headcount Memo');
    expect(a.versions).toHaveLength(1);
    expect(a.currentVersion).toBe(0);
    expect(a.versions[0].content.kind).toBe('Doc');
    expect(a.versions[0].note).toMatch(/initial/i);
  });

  it('Doc content has a title and paragraphs', async () => {
    const a = await generateArtifact(req('Doc'), 'Memo');
    const c = a.versions[0].content;
    if (c.kind !== 'Doc') throw new Error('wrong kind');
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.paragraphs.length).toBeGreaterThan(0);
  });

  it('Deck has a cover slide plus content slides', async () => {
    const a = await generateArtifact(req('Deck'), 'Review');
    const c = a.versions[0].content;
    if (c.kind !== 'Deck') throw new Error('wrong kind');
    expect(c.slides.length).toBeGreaterThan(1);
    expect(c.slides[0].isCover).toBe(true);
  });

  it('Sheet rows all match the column count', async () => {
    const a = await generateArtifact(req('Sheet'), 'Model');
    const c = a.versions[0].content;
    if (c.kind !== 'Sheet') throw new Error('wrong kind');
    expect(c.columns.length).toBeGreaterThan(1);
    for (const row of c.rows) expect(row).toHaveLength(c.columns.length);
  });

  it('Dashboard has tiles and a non-empty series', async () => {
    const a = await generateArtifact(req('Dashboard'), 'Pulse');
    const c = a.versions[0].content;
    if (c.kind !== 'Dashboard') throw new Error('wrong kind');
    expect(c.tiles.length).toBeGreaterThan(0);
    expect(c.series.bars.length).toBeGreaterThan(0);
  });

  it('Report has stats and paragraphs', async () => {
    const a = await generateArtifact(req('Report'), 'Monthly');
    const c = a.versions[0].content;
    if (c.kind !== 'Report') throw new Error('wrong kind');
    expect(c.stats.length).toBeGreaterThan(0);
    expect(c.paragraphs.length).toBeGreaterThan(0);
  });

  it('uses the brief as the title seed for a blank build', async () => {
    const a = await generateArtifact(req('Doc', { brief: 'Engineering attrition deep dive' }), 'Engineering attrition deep dive');
    const c = a.versions[0].content;
    if (c.kind !== 'Doc') throw new Error('wrong kind');
    expect(c.title.toLowerCase()).toContain('attrition');
  });

  it('reviseArtifact returns an edit turn with a new version + a reply', async () => {
    const a = await generateArtifact(req('Doc'), 'Memo');
    const turn = await reviseArtifact(a, 'make it shorter and add Q3 outlook');
    expect(turn.action.skill).toBe('edit');
    expect(turn.awaiting).toBe('none');
    expect(turn.version).not.toBeNull();
    expect(turn.version!.content.kind).toBe('Doc');
    expect(turn.version!.note).toContain('Q3 outlook');
    expect(turn.version!.id).not.toBe(a.versions[0].id);
    expect(turn.action.message).toBeTruthy();
  });
});

describe('makeResilientEngine — agent methods', () => {
  it('forwards agentPlan + agentRun to the primary engine', async () => {
    const calls: string[] = [];
    const primary = {
      ...mockEngine,
      agentPlan: async () => { calls.push('plan'); return { steps: ['from primary'] }; },
      agentRun: async (r: BuildRequest, n: string) => { calls.push('run'); return mockEngine.generate(r, n); },
    };
    const eng = makeResilientEngine(primary, mockEngine);
    const plan = await eng.agentPlan!(req('Doc'));
    expect(plan.steps).toEqual(['from primary']);
    await eng.agentRun!(req('Doc'), 'M', { steps: ['x'] }, () => {});
    expect(calls).toEqual(['plan', 'run']);
  });
});
