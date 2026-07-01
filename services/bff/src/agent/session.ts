import { createOpencodeClient } from '@opencode-ai/sdk';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config';
import { toStep } from './steps';
import type { AgentSession, SandboxHandle } from './types';

// Initial write + up to (MAX_ATTEMPTS - 1) self-heal re-prompts.
const MAX_ATTEMPTS = 3;

/** Loose view of the OpenCode event-stream items we render as working-steps chips. */
interface LoosePart {
  type?: string;
  tool?: string;
  sessionID?: string;
  state?: { status?: string; input?: Record<string, unknown>; output?: string; error?: string };
}
interface LooseEvent { type?: string; properties?: { part?: LoosePart } }

/**
 * Real AgentSession over an OpenCode server.
 *
 * Capture is file-based (no custom OpenCode tool needed): the `builder` agent writes
 * its artifact JSON to `<agentDir>/out/artifact.json` with its native `write` tool.
 * `session.prompt` resolves when the agent turn completes, so afterward we read
 * `<workdir>/out/artifact.json`, validate via `tools.emitArtifact`, and on failure
 * re-prompt with the error (bounded self-heal). Native tool activity is streamed to
 * the working-steps UI. The session is created with `directory: projectDir` so
 * OpenCode resolves the greennode provider + `builder` agent from agent/opencode.json.
 *
 * LIVE-GATED: unit tests use the mock session (FakeSandbox) from run.test.ts.
 */
export function makeOpenCodeSession(handle: SandboxHandle, modelId: string): AgentSession {
  const client = createOpencodeClient({ baseUrl: handle.opencodeUrl });
  return {
    async run({ prompt, tools, onEvent, signal }) {
      const created = await client.session.create({
        query: { directory: handle.projectDir },
        body: { title: 'atlas-agent' },
      });
      if (created.error || !created.data) throw new Error('OpenCode session.create failed');
      const id = created.data.id;

      // Best-effort: stream native tool activity as working-steps chips.
      const pumpCtrl = new AbortController();
      const events = await client.event.subscribe({ signal: pumpCtrl.signal }).catch(() => null);
      const pump = (async () => {
        const stream = events?.stream as AsyncIterable<LooseEvent> | undefined;
        if (!stream) return;
        try {
          for await (const ev of stream) {
            if (signal.aborted) break;
            if (ev.type !== 'message.part.updated') continue;
            const part = ev.properties?.part;
            if (!part || part.type !== 'tool' || part.sessionID !== id) continue;
            const s = part.state?.status;
            const state = s === 'completed' ? 'completed' : s === 'error' ? 'error' : 'start';
            const step = toStep({ type: 'tool', name: part.tool, state, args: part.state?.input, output: part.state?.output ?? part.state?.error });
            if (step) onEvent(step);
          }
        } catch { /* stream closed */ }
      })();

      const outPath = join(handle.workdir, 'out', 'artifact.json');
      const ask = async (text: string) => {
        const res = await client.session.prompt({
          path: { id },
          body: {
            model: { providerID: config.openCode.providerId, modelID: modelId.replace(/^gn-/, '') },
            agent: 'builder',
            parts: [{ type: 'text', text }],
          },
          signal,
        });
        if (res.error) throw new Error('OpenCode agent prompt failed');
      };
      const capture = async (): Promise<boolean> => {
        let raw: string;
        try { raw = await readFile(outPath, 'utf8'); } catch { return false; }
        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { return false; }
        return tools.emitArtifact(parsed).ok;
      };

      try {
        let inputFiles: string[] = [];
        try { inputFiles = await readdir(join(handle.workdir, 'inputs')); } catch { /* no inputs dir */ }
        const inputsLine = inputFiles.length
          ? `Read these input files first (in ${handle.agentDir}/inputs): ${inputFiles.join(', ')}. Derive facts from them.`
          : `There are NO input files. Build the artifact from the brief alone — do NOT search for or list files.`;
        const preamble = [
          `Your working directory is ${handle.agentDir}.`,
          inputsLine,
          `Then write your FINAL artifact as a single JSON object to ${handle.agentDir}/out/artifact.json using your write tool (create the out/ directory). Do not print the JSON in chat — just write the file.`,
        ].join('\n');
        await ask(`${preamble}\n\n${prompt}`);

        for (let attempt = 1; attempt < MAX_ATTEMPTS && !signal.aborted; attempt++) {
          if (await capture()) return;
          await ask(
            `I could not read a valid artifact from ${handle.agentDir}/out/artifact.json. ` +
              `Write (or fix) that exact file as a single valid JSON object matching the required shape, then stop.`,
          );
        }
        await capture(); // final read after the last re-prompt (uncaptured → runAgent degrades)
      } finally {
        pumpCtrl.abort();
        await pump.catch(() => {});
        await client.session.delete({ path: { id } }).catch(() => {});
      }
    },
  };
}
