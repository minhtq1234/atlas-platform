import { createOpencodeClient } from '@opencode-ai/sdk';
import type { Event, ToolPart } from '@opencode-ai/sdk';
import { config } from '../config';
import { toStep } from './steps';
import type { AgentSession, AgentTools, SandboxHandle, Step } from './types';

/**
 * Translate a real SDK ToolPart into a RawToolEvent shape that toStep accepts.
 * The SDK's EventMessagePartUpdated carries a Part; when that Part is a ToolPart
 * (type === "tool") we map its state into the args/output/state that toStep expects.
 */
function toolPartToStep(part: ToolPart): Step | null {
  const { tool, state } = part;
  // Map SDK ToolState → RawToolEvent's state/args/output fields
  let rawState: 'start' | 'completed' | 'error';
  let args: Record<string, unknown> | undefined;
  let output: string | undefined;

  if (state.status === 'pending') {
    rawState = 'start';
    args = state.input;
  } else if (state.status === 'running') {
    rawState = 'start';
    args = state.input;
  } else if (state.status === 'completed') {
    rawState = 'completed';
    args = state.input;
    output = state.output;
  } else {
    // error
    rawState = 'error';
    args = state.input;
    output = state.error;
  }

  return toStep({ type: 'tool', name: tool, state: rawState, args, output });
}

/**
 * Extract Atlas custom-tool invocations from ToolPart state input so we can
 * service them in-process (update_task_list, emit_artifact).
 */
function dispatchAtlasTool(part: ToolPart, tools: AgentTools): void {
  const { tool, state } = part;
  if (state.status !== 'running' && state.status !== 'pending') return; // only dispatch at start
  const input = state.input;
  if (tool === 'update_task_list' && Array.isArray(input.tasks)) {
    tools.updateTaskList(input.tasks as never);
  } else if (tool === 'emit_artifact' && input.content !== undefined) {
    tools.emitArtifact(input.content);
  }
}

/**
 * Real AgentSession over an OpenCode server running inside the sandbox.
 *
 * Event flow:
 *   1. Subscribe to the global /event SSE stream (filtered by sessionID).
 *   2. On each EventMessagePartUpdated where part.type === "tool":
 *      - Route atlas custom tools (emit_artifact, update_task_list) in-process.
 *      - Translate all tool parts to display Steps via toStep.
 *   3. Await EventSessionIdle (or EventSessionStatus {status.type: "idle"}) for
 *      the created session to signal completion, then resolve.
 *
 * LIVE-GATED: the event filtering and ToolPart → Step translation are verified in
 * Task 13. CI uses the mock session (FakeSandbox + mockSession) from run.test.ts.
 *
 * SDK signatures relied on:
 *   client.event.subscribe(options?: Options<EventSubscribeData>):
 *     Promise<ServerSentEventsResult<EventSubscribeResponses, unknown>>
 *   where ServerSentEventsResult = { stream: AsyncGenerator<Event, void, unknown> }
 *   and Event = EventMessagePartUpdated | EventSessionIdle | EventSessionStatus | …
 */
export function makeOpenCodeSession(handle: SandboxHandle, modelId: string): AgentSession {
  const client = createOpencodeClient({ baseUrl: handle.opencodeUrl });
  return {
    async run({ prompt, tools, onEvent, signal }) {
      // 1. Create the session
      const created = await client.session.create({ body: { title: 'atlas-agent' }, signal });
      if (created.error || !created.data) throw new Error('OpenCode session.create failed');
      const sessionId = created.data.id;

      try {
        // 2. Subscribe to the global event stream; filter to this session
        const subscribed = await client.event.subscribe({ signal }).catch(() => null);

        // 3. Pump events in the background — resolves when session goes idle or signal aborts
        let resolveIdle!: () => void;
        const idlePromise = new Promise<void>((res) => { resolveIdle = res; });

        const pumpPromise = (async () => {
          if (!subscribed?.stream) return;
          for await (const ev of subscribed.stream as AsyncIterable<Event>) {
            if (signal.aborted) break;

            if (ev.type === 'message.part.updated') {
              const { part } = ev.properties;
              if (part.type === 'tool' && part.sessionID === sessionId) {
                // Dispatch atlas-custom tools and surface steps for all tools
                dispatchAtlasTool(part, tools);
                const step = toolPartToStep(part);
                if (step) onEvent(step);
              }
            } else if (
              (ev.type === 'session.idle' && ev.properties.sessionID === sessionId) ||
              (ev.type === 'session.status' &&
                ev.properties.sessionID === sessionId &&
                ev.properties.status.type === 'idle')
            ) {
              resolveIdle();
              break;
            }
          }
          resolveIdle(); // ensure we don't hang if stream ends without idle
        })();

        // 4. Fire the prompt with the builder agent
        const res = await client.session.prompt({
          path: { id: sessionId },
          body: {
            model: { providerID: config.openCode.providerId, modelID: modelId.replace(/^gn-/, '') },
            agent: 'builder',
            parts: [{ type: 'text', text: prompt }],
          },
          signal,
        });
        if (res.error) throw new Error('OpenCode agent prompt failed');

        // 5. Wait for the session to go idle (agent done) or for abort
        await Promise.race([idlePromise, pumpPromise]);
      } finally {
        await client.session.delete({ path: { id: sessionId } }).catch(() => {});
      }
    },
  };
}
