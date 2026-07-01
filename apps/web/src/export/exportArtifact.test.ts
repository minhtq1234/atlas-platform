import { describe, it, expect } from 'vitest';
import { esc } from './exportArtifact';

describe('esc (HTML export escaping)', () => {
  it('encodes angle brackets and ampersands to prevent XSS in exported HTML', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('a & b')).toBe('a &amp; b');
  });
});
