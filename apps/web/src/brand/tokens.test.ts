import { describe, it, expect } from 'vitest';
import { color, orbGradient } from './tokens';

describe('brand tokens', () => {
  it('uses the AA-safe muted text, not the faint decorative one, as secondary', () => {
    expect(color.textMuted).toBe('#6E6C64');
  });
  it('exposes the Strata core palette', () => {
    expect(color.paper).toBe('#F4F2EC');
    expect(color.ink).toBe('#1A1A2E');
    expect(color.indigo).toBe('#2D3A8C');
    expect(color.coral).toBe('#F0997B');
  });
  it('defines the orb gradient motif', () => {
    expect(orbGradient).toContain('conic-gradient');
  });
});
