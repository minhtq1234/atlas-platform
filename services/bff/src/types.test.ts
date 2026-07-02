import { describe, it, expect } from 'vitest';
import { ArtifactContent, BuildRequest } from './types';

const sectioned = {
  kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm',
  sections: [
    { heading: 'Purpose', blocks: [{ type: 'paragraph', text: 'Why.' }] },
    { heading: 'Requirements', blocks: [
      { type: 'table', columns: ['ID', 'Requirement', 'Priority'], rows: [['FR-1', 'Login', 'High']] },
      { type: 'bullets', items: ['a', 'b'] },
    ] },
  ],
};

describe('DocContent sectioned', () => {
  it('accepts a sectioned Doc', () => {
    const r = ArtifactContent.safeParse(sectioned);
    expect(r.success).toBe(true);
  });
  it('still accepts a flat memo (paragraphs only)', () => {
    const r = ArtifactContent.safeParse({ kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown block type', () => {
    const bad = { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', sections: [{ heading: 'H', blocks: [{ type: 'video', src: 'x' }] }] };
    expect(ArtifactContent.safeParse(bad).success).toBe(false);
  });
});

describe('BuildRequest.mode', () => {
  it('accepts fast/deep and defaults undefined', () => {
    expect(BuildRequest.parse({ brief: 'b', type: 'Doc', modelId: 'm' }).mode).toBeUndefined();
    expect(BuildRequest.parse({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'deep' }).mode).toBe('deep');
    expect(BuildRequest.safeParse({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'nope' }).success).toBe(false);
  });
});
