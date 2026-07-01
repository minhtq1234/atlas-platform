import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, modelConfigured } from './config';
import { generate, generateStreaming, revise } from './generate';
import { GenerateBody, ReviseBody } from './types';

export function buildServer() {
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024 }); // 512 KB cap
  app.register(cors, { origin: config.webOrigins, methods: ['GET', 'POST'] });

  app.get('/health', () => ({
    ok: true,
    runtime: config.agentRuntime,
    modelConfigured: modelConfigured(),
  }));

  app.post('/generate', async (request, reply) => {
    const parsed = GenerateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { req, name } = parsed.data;
    return generate(req, name);
  });

  // Streaming variant: emits `stage` events, then a final `done` (artifact) or `error`.
  app.post('/generate/stream', async (request, reply) => {
    const parsed = GenerateBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { req, name } = parsed.data;

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Heartbeat so idle-timeout proxies don't kill a long (up to 60s) generation.
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), 15000);
    try {
      const artifact = await generateStreaming(req, name, (label) => send('stage', { label }));
      send('done', artifact);
    } catch (err) {
      send('error', { message: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      raw.end();
    }
  });

  app.post('/revise', async (request, reply) => {
    const parsed = ReviseBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { type, current, instruction, modelId, lang, opencodeSessionId } = parsed.data;
    return revise(type, current, instruction, modelId, lang, opencodeSessionId);
  });

  return app;
}
