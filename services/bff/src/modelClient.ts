import { createOpencodeClient } from '@opencode-ai/sdk';
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

/** Map the web's model id (gn-llama3-70b) to an OpenCode provider/model pair. */
function toOpenCodeModel(modelId: string): { providerID: string; modelID: string } {
  return { providerID: config.openCode.providerId, modelID: modelId.replace(/^gn-/, '') };
}

/**
 * Production topology (invariant #5): the BFF drives an OpenCode server, which
 * runs the domain agent and calls the model. We create a session, send the
 * combined prompt as a text part, and return the assistant's text.
 */
async function openCodeRun(system: string, user: string, modelId: string): Promise<string> {
  const client = createOpencodeClient({ baseUrl: config.openCode.url });

  const created = await client.session.create({ body: { title: 'atlas-generate' } });
  if (created.error || !created.data) throw new Error('OpenCode session.create failed');

  const res = await client.session.prompt({
    path: { id: created.data.id },
    body: {
      model: toOpenCodeModel(modelId),
      agent: config.openCode.agent,
      parts: [{ type: 'text', text: `${system}\n\n${user}` }],
    },
  });
  if (res.error || !res.data) throw new Error('OpenCode prompt failed');

  const parts = (res.data.parts ?? []) as { type: string; text?: string }[];
  const text = parts
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('')
    .trim();
  if (!text) throw new Error('OpenCode returned no text part');
  return text;
}

/** Returns raw model JSON text, or throws. Caller validates + falls back. */
export function runModel(system: string, user: string, modelId: string): Promise<string> {
  return config.agentRuntime === 'opencode'
    ? openCodeRun(system, user, modelId)
    : chatJSON(system, user, modelId);
}
