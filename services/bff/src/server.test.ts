import { describe, it, expect } from 'vitest';
import { buildServer } from './server';

// No MODEL_BASE_URL in test env → BFF uses the deterministic template path.
// This verifies the contract/shape; the real model wire is verified against
// the stub in BFF2 (running processes).

describe('BFF /generate + /revise (template path)', () => {
  it('generates a valid Deck artifact', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { name: 'People Review', req: { brief: 'Q2 people review', type: 'Deck', modelId: 'gn-llama3-70b' } },
    });
    expect(res.statusCode).toBe(200);
    const a = res.json();
    expect(a.type).toBe('Deck');
    expect(a.versions[0].content.kind).toBe('Deck');
    expect(a.versions[0].content.slides.length).toBeGreaterThan(0);
    expect(a.currentVersion).toBe(0);
  });

  it('generates a Sheet with rows matching columns', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/generate',
      payload: { name: 'Model', req: { brief: 'headcount', type: 'Sheet', modelId: 'gn-llama3-70b' } },
    });
    const a = res.json();
    const c = a.versions[0].content;
    for (const row of c.rows) expect(row.length).toBe(c.columns.length);
  });

  it('revise returns a typed action + version (template path)', async () => {
    const app = buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/revise',
      payload: {
        type: 'Doc',
        modelId: 'gn-llama3-70b',
        instruction: 'add a Q3 outlook',
        current: { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['p'] },
      },
    });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r.action.skill).toBeDefined();       // template path → 'edit'
    expect(r.version.content.kind).toBe('Doc');
  });

  it('rejects an invalid body with 400', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'POST', url: '/generate', payload: { name: 'x' } });
    expect(res.statusCode).toBe(400);
  });
});
