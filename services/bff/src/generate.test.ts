import { describe, it, expect } from 'vitest';
import { extractJson } from './generate';

describe('extractJson (robust model-output parsing)', () => {
  it('unwraps a fenced ```json block', () => {
    expect(JSON.parse(extractJson('```json\n{"a":1}\n```')).a).toBe(1);
  });

  it('grabs the first balanced object, ignoring trailing prose that contains braces', () => {
    const out = extractJson('Here is the JSON: {"a":{"b":2}} — hope that helps! :}');
    expect(JSON.parse(out).a.b).toBe(2);
  });

  it('respects braces inside strings', () => {
    expect(JSON.parse(extractJson('{"a":"}{"}')).a).toBe('}{');
  });

  it('ignores a stray leading brace in prose', () => {
    // first '{' starts the real object here
    expect(JSON.parse(extractJson('{"ok":true} trailing')).ok).toBe(true);
  });
});
