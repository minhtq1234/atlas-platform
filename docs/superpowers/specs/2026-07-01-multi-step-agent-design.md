# Multi-Step Tool Agent — Design

Status: **approved** (2026-07-01) · Owner: Atlas
Related: [agent-skills design](2026-07-01-agent-skills-design.md) · [attachments-context design](2026-07-01-attachments-context-design.md)

## 1. Summary

Atlas today answers each user message with **one model turn** — the skills runtime
(`clarify | plan | edit | answer`) in `services/bff/src/skills/`. That is the right
default: fast, cheap, governed.

This design adds a second, heavier runtime: an **autonomous multi-step tool agent**.
In "Agent mode" the user's request is handed to OpenCode, which runs its native
plan → call-tool → observe → iterate → finish loop **inside a per-session ephemeral
container** with a full developer toolset (bash / python / filesystem). The agent
uses code to *derive* the artifact — parse an uploaded PPTX, compute from a real
xlsx, transform data — then calls a terminal `emit_artifact` tool whose payload is
the **same `ArtifactContent` JSON** the rest of the platform already renders,
versions, exports, and governs.

The user watches a coworker.ai-style **working-steps panel**: a confirmed task list
with live check-off plus a feed of tool-call chips.

### Why this shape
- **Tool-calling is verified** on all three GreenNode models — the gate is cleared.
- **OpenCode already exists for this.** Its native tools *are* bash/read/write/edit;
  letting it drive is the least new agent-loop code and it is why `AGENT_RUNTIME=opencode`
  was wired.
- **Keeping the JSON contract** means the entire canvas / version / export /
  governance pipeline downstream is untouched. The agent only gets smarter at
  deriving content.
- **Per-session container** turns the sovereignty egress guard from a startup URL
  check into a real network boundary.

## 2. Goals / Non-goals

**Goals**
- An explicit, per-conversation **Agent mode** that runs a real multi-step tool loop.
- Full developer tools (bash/python/fs) executing **only** inside a per-session
  ephemeral, network-firewalled container.
- Deliverable is validated `ArtifactContent` JSON via a terminal `emit_artifact` tool.
- **Plan-gate → autonomous**: one confirmation before any code runs, then it runs to
  completion; Stop always available.
- A **working-steps UI**: task list with check-off + tool-chip feed.
- Reuse existing machinery: the `plan-confirm` state, the SSE stream, the
  `ArtifactContent` zod schema, the OpenCode SDK client, the degraded-fallback path.
- Build + verify the full loop against a **`local` sandbox** (no Docker in CI); ship
  the **`container`** provisioner as the prod default.

**Non-goals (v1)**
- Step-gated per-action approvals (the hybrid gate) — growth path only.
- Auto-escalation from the fast path into agent mode — explicit toggle only.
- File-as-artifact outputs (raw .docx/.xlsx as the deliverable) — JSON contract only.
- Warm container pool, multi-container orchestration.
- RAG over attachments (tracked separately as attachments Phase 2).

## 3. Architecture

Two runtimes coexist. The fast path is unchanged. Agent mode is selected per
conversation from the web and routed in the BFF.

```
Studio (web)
  │ agentMode? ──no──▶ existing single-turn skills path (runTurn)   [UNCHANGED]
  │       │yes
  ▼       ▼
BFF  runAgent(req)
  1. provision sandbox           ──▶  per-session ephemeral CONTAINER
  2. seed uploaded attachments into /workspace/inputs as real files
  3. start OpenCode session       (dev tools + emit_artifact + update_task_list)
  4. PLAN-GATE ── user confirms ──▶ autonomous loop
  5. subscribe to OpenCode events ──▶ normalized SSE "steps" ──▶ working-steps panel
  6. capture emit_artifact(content) ──▶ zod-validate ──▶ Artifact
  7. destroy sandbox
  ▼
Canvas / versions / export        [UNCHANGED — same ArtifactContent contract]

        ┌─────────────── sandbox container ───────────────┐
        │ opencode serve · python + docx/xlsx/pptx libs    │
        │ firewall: egress ONLY → sovereign model host      │
        │            + BFF emit endpoint. Nothing else.     │
        └───────────────────────────────────────────────────┘
```

### 3.1 Components (units, each with one purpose)

**`Sandbox` provisioner** — `services/bff/src/agent/sandbox.ts`
- Interface: `provision(sessionId: string, files: SeedFile[]): Promise<SandboxHandle>`
  where `SandboxHandle = { opencodeUrl: string; workdir: string; destroy(): Promise<void> }`.
- Two implementations behind `config.sandbox` (`'container' | 'local'`):
  - **`ContainerSandbox`** (prod): launches an ephemeral container running
    `opencode serve`, seeds `/workspace/inputs`, applies an egress firewall allowing
    only the model host + the BFF emit endpoint, returns its URL; `destroy()` kills +
    removes it. Provider/runtime detail (docker/podman) behind an internal helper.
  - **`LocalSandbox`** (dev/CI): creates a temp workdir under the scratch area, seeds
    files, points at the already-running local `opencode serve`; `destroy()` removes
    the workdir. No isolation — for building/testing the loop only.
- What it depends on: config, the OS container runtime (container impl only).
- Consumers see only the interface; swapping impls cannot break them.

**Agent runtime** — `services/bff/src/agent/run.ts`
- `runAgent(req, hooks): Promise<TurnResult>` orchestrates: provision → seed →
  start OpenCode session with the builder agent + tool config → drive the
  plan-gate → stream normalized steps → capture `emit_artifact` → assemble Artifact
  → destroy. Enforces step/time budgets and Stop.
- Depends on: `Sandbox`, the OpenCode SDK client (`modelClient`), the tool handlers,
  `ArtifactContent`, the `plan-confirm` state.

**Atlas tools** — `services/bff/src/agent/tools.ts`
- `emit_artifact(content)` — validates `content` with `ArtifactContent.safeParse`;
  on failure returns a structured error string (the zod issues) so the agent
  self-corrects; on success stores the validated content on the run and signals
  completion. Hosted by the BFF and exposed to OpenCode as a custom tool; the
  container reaches it over the firewall-allowed BFF endpoint.
- `update_task_list(tasks)` — `tasks: { id, title, status: 'pending'|'active'|'done' }[]`;
  replaces/updates the run's task list; emits a `task` step for the UI.

**Event normalizer** — `services/bff/src/agent/steps.ts`
- Pure function `toStep(openCodeEvent): Step | null` mapping OpenCode session events
  to the compact wire shape:
  `Step = { kind:'tool'|'task'|'text', name:string, status:'start'|'ok'|'err', detail?:string }`.
- Friendly tool names: `bash`→"Running terminal command", `python`/`*.py`→"Running
  Python", `read`→"Reading <file>", `edit`/`write`→"Editing <file>",
  `update_task_list`→"Updating task list", `emit_artifact`→"Finalizing artifact".
- Pure + isolated → unit-testable without OpenCode.

**Web — working-steps** — `apps/web/src/components/WorkingSteps.tsx` + store
- `WorkingSteps` renders the task list (check-off from `task` steps) + a scrolling
  chip feed (from `tool`/`text` steps), each chip collapsible to its `detail`.
- Store (`useAppStore`): `agentMode: boolean` (persisted, per-conversation),
  `steps: Step[]`, `taskList: Task[]`, plus a Stop action.
- Studio: an "Agent" toggle; when on, sends `agentMode:true` and renders the panel
  in place of / beside the chat stream during a run.

### 3.2 Data flow (one Agent-mode turn)

1. Web sends the message with `agentMode:true` (+ `uploads`/`docIds`, `modelId`, `lang`).
2. BFF `runAgent` provisions the sandbox and seeds attachment bytes into
   `/workspace/inputs` (fetched from the artifacts store by `docId`, or from the
   upload excerpt).
3. OpenCode session starts with the builder agent, the dev toolset, and the two
   Atlas tools; system prompt instructs plan-first + finish-with-`emit_artifact`.
4. The agent's first output is a plan via `update_task_list`. BFF sets
   `awaiting:'plan-confirm'`, streams the task list as `task` steps, and **pauses**.
5. On the user's `confirm:true`, the run resumes autonomously. Each OpenCode event
   is normalized and streamed as an SSE `step`.
6. The agent calls `emit_artifact(content)`. On valid content the run captures it and
   finishes; on invalid, the tool returns errors and the agent retries (bounded).
7. BFF assembles the `Artifact` (same `assemble()`), destroys the sandbox, returns it.
   Canvas renders, version is recorded, export works — all unchanged.

## 4. Contracts

**Request** (`services/bff/src/types.ts`) — add to the build/revise bodies:
- `agentMode?: boolean` — route to `runAgent` when true (and `AGENT_RUNTIME=opencode`).
- Reuse existing `awaiting`/`plan`/`confirm` for the plan-gate; reuse `uploads`/`context`.

**SSE step** (new, streamed during a run):
```
event: step
data: {"kind":"tool"|"task"|"text","name":string,"status":"start"|"ok"|"err","detail"?:string}
```
Existing `stage`/`result`/`error` SSE events are unchanged; `step` is additive.

**Tool schemas** (exposed to OpenCode):
- `emit_artifact`: `{ content: <ArtifactContent> }` → `{ ok:true } | { ok:false, errors:string }`.
- `update_task_list`: `{ tasks: {id:string,title:string,status:"pending"|"active"|"done"}[] }` → `{ ok:true }`.

**Config** (`services/bff/src/config.ts`):
- `sandbox: 'container' | 'local'` (env `SANDBOX`, default `local` in dev).
- `agent.image`, `agent.maxSteps`, `agent.timeoutMs` (budgets), `agent.emitToolUrl`.
- Egress: the firewall allowlist is derived from the existing `MODEL_ALLOWED_HOSTS`.

## 5. Error handling, budgets, safety

- **Budgets**: `maxSteps` and wall-clock `timeoutMs` per run; on exceed → stop, emit a
  `text` step explaining, degrade to template.
- **Provision / OpenCode failure**: caught → degraded fallback to the single-turn
  path or template; reuse the AbortSignal + timeout + session cleanup already in
  `openCodeRun` so a down provider never hangs.
- **Invalid emit loop**: after `N` invalid `emit_artifact` calls → degrade to template,
  set `degradedReason`.
- **Stop**: aborts the OpenCode session and destroys the container.
- **Sovereignty / injection**: uploads are data, never instructions (extends the
  existing `INJECTION_NOTE`); the container firewall means even a prompt-injected
  agent cannot exfiltrate — it can reach only the model host + emit endpoint.
- **Secrets**: no new secrets in code; sandbox image built from a pinned base; the
  model key is passed to OpenCode via env inside the container, never written to the
  workspace.

## 6. Testing

- **Unit**: `emit_artifact` validation (valid / invalid / self-heal message shape);
  `toStep` normalizer over representative OpenCode events; `update_task_list` state;
  mode routing (agentMode true/false); `Sandbox` interface against a **fake** impl.
- **Integration**: a mock OpenCode session that emits a tool sequence then
  `emit_artifact` → assert (a) the captured Artifact equals the emitted content,
  (b) the streamed steps match, (c) the plan-gate pauses then resumes on confirm,
  (d) a Stop mid-run destroys the sandbox. Fully hermetic — no Docker, no network.
- **Live** (manual, `local` sandbox against GreenNode): "parse this PPTX and rebuild
  it as a 6-slide exec summary" → verify working-steps + a schema-valid deck; and a
  numeric case ("summarize this xlsx into a dashboard") to exercise python compute.

## 7. Build order (feeds writing-plans)

1. **Contracts + config**: request `agentMode`, `Step` type, `Sandbox` interface,
   `config.sandbox`/budgets. Fake sandbox for tests.
2. **Tools**: `emit_artifact` + `update_task_list` (+ unit tests).
3. **Normalizer**: `toStep` (+ unit tests).
4. **Runtime**: `runAgent` with plan-gate + budgets + capture + degrade, against the
   `LocalSandbox`; integration test with a mock OpenCode session.
5. **BFF wiring**: route `agentMode` in generate/revise; stream `step` SSE.
6. **Agent config**: builder agent + tool registration in `agent/opencode.json`.
7. **Web**: `agentMode` toggle, `WorkingSteps` panel, store fields, Stop, chip feed.
8. **ContainerSandbox**: prod impl + unit tests (live Docker/firewall bring-up gated).
9. **Live verify** (`local`) + update `SPEC.md` + merge.

## 8. Open questions / risks

- **OpenCode custom-tool mechanism**: confirm whether tools are best exposed via
  OpenCode's config tool definitions or as an MCP server the BFF hosts; pick the one
  that gives synchronous validation return for `emit_artifact` self-heal. (Resolve in
  step 2 of the plan with a tiny probe; fall back to the workspace-file capture +
  one re-prompt if synchronous return is awkward.)
- **Container egress firewall on macOS/dev**: real per-container firewalling is an ops
  task; dev uses `local`. Document the prod recipe; do not block v1 on it.
- **First-token latency** from cold container boot is hidden behind the plan-gate; add
  a warm pool only if measured latency warrants it.
