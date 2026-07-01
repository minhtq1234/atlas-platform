import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, modelConfigured, generationEnabled } from './config';
import { generate, generateStreaming, revise, assemble } from './generate';
import { GenerateBody, ReviseBody, AgentPlanBody, AgentRunBody } from './types';
import { proposePlan, runAgent, defaultRunDeps } from './agent/run';
import { contextProvider } from './context/provider';
import { fallbackContent } from './templates';

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
    const { type, current, instruction, modelId, lang, opencodeSessionId, awaiting, plan, confirm, context } = parsed.data;
    return revise(type, current, instruction, modelId, lang, opencodeSessionId, { awaiting, plan, confirm, context });
  });

  app.post('/agent/plan', async (request, reply) => {
    const parsed = AgentPlanBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { req } = parsed.data;
    const docIds = (req.uploads ?? []).map((u) => u.docId).filter((d): d is string => !!d);
    const context = docIds.length ? await contextProvider.getContext(docIds, req.brief) : [];
    return { plan: await proposePlan(req, context) };
  });

  app.post('/agent/run', async (request, reply) => {
    const parsed = AgentRunBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { req, name, plan } = parsed.data;

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const send = (event: string, data: unknown) => raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), 15000);
    const abort = new AbortController();
    request.raw.on('close', () => abort.abort()); // client disconnect = Stop
    try {
      // Guard here (NOT in runAgent, which is the pure injectable core): with no
      // model/opencode configured, stream a template artifact — keeps this route
      // hermetic in tests and never provisions a sandbox it can't use.
      const produced = generationEnabled()
        ? await runAgent({ req, plan }, defaultRunDeps(req.modelId, (s) => send('step', s), abort.signal))
        : { content: fallbackContent(req), viaModel: false };
      send('done', assemble(req, name, produced));
    } catch (err) {
      send('error', { message: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      raw.end();
    }
  });

  return app;
}
