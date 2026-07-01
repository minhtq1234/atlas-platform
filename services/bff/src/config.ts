// Environment configuration. In prod these come from the vault, never code.
export const config = {
  port: Number(process.env.PORT ?? 8787),
  webOrigins: (process.env.WEB_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Agent runtime: 'direct' = BFF calls the model (OpenAI-compatible) itself;
  // 'opencode' = BFF calls an OpenCode server (the production topology — see agent/).
  agentRuntime: (process.env.AGENT_RUNTIME ?? 'direct') as 'direct' | 'opencode',

  // Artifact service — extracts and serves attachment text as generation context.
  artifactsUrl: process.env.ARTIFACTS_URL ?? 'http://127.0.0.1:8742',

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
    // Bound the OpenCode call — it blocks/retries when its provider is down.
    timeoutMs: Number(process.env.OPENCODE_TIMEOUT_MS ?? 60000),
  },
};

export const modelConfigured = () => config.model.baseUrl.trim().length > 0;

/** Can we call a model at all? Direct needs a base URL; OpenCode manages its own. */
export const generationEnabled = () =>
  config.agentRuntime === 'opencode' || modelConfigured();

// Sovereignty: give the "no public egress on inference paths" invariant code teeth.
// Loopback is always allowed (dev/stub). Any other host must be https AND, when
// MODEL_ALLOWED_HOSTS is set, appear on that allowlist. Fails fast at startup.
const allowedHosts = (process.env.MODEL_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isLoopback(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function assertEgressUrl(label: string, raw: string) {
  if (!raw.trim()) return;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`[bff] ${label} is not a valid URL: ${raw}`);
  }
  const host = u.hostname.toLowerCase();
  if (isLoopback(host)) return;
  if (u.protocol !== 'https:') {
    throw new Error(`[bff] ${label} must use https for non-loopback hosts (got ${u.protocol}//${host}). Sovereignty egress guard.`);
  }
  if (allowedHosts.length && !allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new Error(`[bff] ${label} host ${host} is not in MODEL_ALLOWED_HOSTS (${allowedHosts.join(', ')}).`);
  }
}

/** Validate configured egress targets. Call at startup; throws on violation. */
export function validateEgress() {
  assertEgressUrl('MODEL_BASE_URL', config.model.baseUrl);
  if (config.agentRuntime === 'opencode') assertEgressUrl('OPENCODE_URL', config.openCode.url);
}
