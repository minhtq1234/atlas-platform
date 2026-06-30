import { config } from './config';

/** Call an OpenAI-compatible Chat Completions endpoint (the GreenNode MaaS contract). */
async function chatJSON(system: string, user: string, modelId: string): Promise<string> {
  const model = config.model.nameOverride || modelId;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), config.model.timeoutMs);
  try {
    const res = await fetch(`${config.model.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.model.apiKey ? { Authorization: `Bearer ${config.model.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`model HTTP ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('model returned empty content');
    return content;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Production topology routes through an OpenCode server (configure-don't-fork,
 * invariant #5). Not exercised in this sandbox — the adapter is a clearly-marked
 * seam. See agent/README.md.
 */
async function openCodeRun(_system: string, _user: string, _modelId: string): Promise<string> {
  throw new Error(
    `AGENT_RUNTIME=opencode not wired in this build. Run OpenCode (see agent/) and ` +
      `implement this adapter against ${config.openCodeUrl}, or use AGENT_RUNTIME=direct.`,
  );
}

/** Returns raw model JSON text, or throws. Caller validates + falls back. */
export function runModel(system: string, user: string, modelId: string): Promise<string> {
  return config.agentRuntime === 'opencode'
    ? openCodeRun(system, user, modelId)
    : chatJSON(system, user, modelId);
}
