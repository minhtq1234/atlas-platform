import { describe, it, expect, vi } from 'vitest';
import { makeContextProvider } from './provider';

describe('ContextProvider', () => {
  it('maps passages to name-prefixed strings; no-op when no docIds', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ passages: [{ name: 'r.pdf', text: 'hello' }] }),
    })) as any;
    const p = makeContextProvider('http://x', fetchFn);
    expect(await p.getContext([], 'q')).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await p.getContext(['doc-1'], 'q')).toEqual(['[r.pdf] hello']);
  });

  it('returns [] (best-effort) when the response is not ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any;
    const p = makeContextProvider('http://x', fetchFn);
    expect(await p.getContext(['doc-1'], 'q')).toEqual([]);
  });

  it('returns [] (best-effort) when fetch throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('network down');
    }) as any;
    const p = makeContextProvider('http://x', fetchFn);
    expect(await p.getContext(['doc-1'], 'q')).toEqual([]);
  });
});
