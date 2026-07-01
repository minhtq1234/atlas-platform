import { describe, it, expect } from 'vitest';
import { generateUser } from './prompt';

describe('generateUser', () => {
  it('embeds context passages inside <context> when given', () => {
    const u = generateUser(
      { brief: 'b', type: 'Doc', modelId: 'm' } as any,
      ['[a.md] hi'],
    );
    expect(u).toContain('<context>');
    expect(u).toContain('[a.md] hi');
  });

  it('falls back to <files> when no context is given', () => {
    const u = generateUser(
      { brief: 'b', type: 'Doc', modelId: 'm', uploads: [{ id: 'u1', name: 'a.md', sizeBytes: 1, mime: 'text/markdown' }] } as any,
      [],
    );
    expect(u).not.toContain('<context>');
    expect(u).toContain('<files>a.md</files>');
  });
});
