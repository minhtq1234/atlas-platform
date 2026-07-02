import { describe, it, expect, vi } from 'vitest';

// Force generation on (bypass model-config gate) and stub the pipeline.
vi.mock('./config', async (orig) => ({ ...(await orig<typeof import('./config')>()), generationEnabled: () => true }));
vi.mock('./deep/pipeline', () => ({
  runDeepPipeline: vi.fn(async () => ({ content: { kind: 'Doc', eyebrow: 'E', title: 'T', meta: 'm', paragraphs: ['deep'] } })),
}));

import { generate } from './generate';
import { runDeepPipeline } from './deep/pipeline';

describe('produceContent routing', () => {
  it('routes mode:deep through the deep pipeline and returns its content', async () => {
    const art = await generate({ brief: 'b', type: 'Doc', modelId: 'm', mode: 'deep' } as any, 'n');
    expect(runDeepPipeline).toHaveBeenCalledOnce();
    expect(art.versions[0].content).toMatchObject({ kind: 'Doc', paragraphs: ['deep'] });
  });
});
