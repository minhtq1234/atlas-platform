import { describe, it, expect } from 'vitest';
import { SectionedDoc } from './SectionedDoc';

describe('SectionedDoc', () => {
  it('is a function component that accepts sections', () => {
    expect(typeof SectionedDoc).toBe('function');
    // render smoke: React element construction doesn't throw
    const el = SectionedDoc({ sections: [{ heading: 'H', blocks: [{ type: 'paragraph', text: 'x' }] }] });
    expect(el).toBeTruthy();
  });
});
