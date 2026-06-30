import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, modelConfigured } from './config';
import { generate, revise } from './generate';
import { GenerateBody, ReviseBody } from './types';

export function buildServer() {
  const app = Fastify({ logger: false });
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

  app.post('/revise', async (request, reply) => {
    const parsed = ReviseBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { type, current, instruction, modelId, lang } = parsed.data;
    return revise(type, current, instruction, modelId, lang);
  });

  return app;
}
