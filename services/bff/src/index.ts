import 'dotenv/config'; // load services/bff/.env (gitignored) if present
import { buildServer } from './server';
import { config, modelConfigured, validateEgress } from './config';

validateEgress(); // fail fast if an inference target violates the egress policy
const app = buildServer();
app
  .listen({ port: config.port, host: '127.0.0.1' })
  .then(() => {
    console.log(
      `[bff] listening on http://127.0.0.1:${config.port} · runtime=${config.agentRuntime} · model=${modelConfigured() ? 'configured' : 'template-fallback'}`,
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
