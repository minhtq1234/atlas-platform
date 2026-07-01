import { describe, it, expect, vi } from 'vitest';
import { makeExemplarProvider } from './provider';

describe('ExemplarProvider', () => {
  it('returns the exemplar text and queries archetype-then-type tags', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => ({ exemplar: { text: 'gold body' } }),
    })) as any;
    const p = makeExemplarProvider('http://x', fetchFn);
    const out = await p.getExemplar('Doc', 'brd');
    expect(out).toBe('gold body');
    // tags sent: archetype id first, then the type's exemplarKey ('doc')
    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.tags).toEqual(['brd', 'doc']);
  });

  it('omits archetype tag when none given (type key only)', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ exemplar: null }) })) as any;
    const p = makeExemplarProvider('http://x', fetchFn);
    expect(await p.getExemplar('Deck')).toBeNull();
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).tags).toEqual(['deck']);
  });

  it('returns null (best-effort) when response is not ok', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any;
    expect(await makeExemplarProvider('http://x', fetchFn).getExemplar('Doc')).toBeNull();
  });

  it('returns null (best-effort) when fetch throws', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('down'); }) as any;
    expect(await makeExemplarProvider('http://x', fetchFn).getExemplar('Doc')).toBeNull();
  });
});
