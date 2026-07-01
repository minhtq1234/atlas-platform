// Environment configuration. In prod these come from the vault, never code.
export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigins: (process.env.WEB_ORIGINS ?? 'http://localhost:5173,http://localhost:5174').split(','),

  // Agent runtime: 'direct' = BFF calls the model (OpenAI-compatible) itself;
  // 'opencode' = BFF calls an OpenCode server (the production topology — see agent/).
  agentRuntime: (process.env.AGENT_RUNTIME ?? 'direct') as 'direct' | 'opencode',

  // GreenNode is OpenAI-compatible. Empty base URL => BFF serves templated
  // artifacts (no model call), so it runs out-of-the-box for the web fallback.
  model: {
    baseUrl: process.env.MODEL_BASE_URL ?? '', // e.g. https://maas.greennode.ai/v1
    apiKey: process.env.MODEL_API_KEY ?? '',
    // Maps the web's model id (gn-llama3-70b) to the endpoint's model name.
    nameOverride: process.env.MODEL_NAME ?? '',
    timeoutMs: Number(process.env.MODEL_TIMEOUT_MS ?? 30000),
  },

  // OpenCode server (when agentRuntime === 'opencode').
  openCode: {
    url: process.env.OPENCODE_URL ?? 'http://127.0.0.1:4096',
    providerId: process.env.OPENCODE_PROVIDER ?? 'greennode',
    agent: process.env.OPENCODE_AGENT ?? 'hr',
  },
};

export const modelConfigured = () => config.model.baseUrl.trim().length > 0;

/** Can we call a model at all? Direct needs a base URL; OpenCode manages its own. */
export const generationEnabled = () =>
  config.agentRuntime === 'opencode' || modelConfigured();
