# Atlas Agent Runtime — OpenCode (configure, don't fork)

This directory is the **OpenCode server configuration** for Atlas. Per architecture
invariant #5 we run OpenCode as a server and add config/MCP/tools — we do **not**
fork it.

## Topology

```
apps/web ──> services/bff ──(AGENT_RUNTIME=opencode)──> OpenCode server ──> GreenNode model (MaaS)
                                                              │
                                                              └── MCP: fdl  (governed query, per-user masking)
```

- **OpenCode** hosts the domain agents (HR / Legal / FA), each a read-only
  primary agent (`agents/*.md`) that produces an artifact as a single JSON
  object matching the BFF's content contract.
- **GreenNode** is the model provider, configured as an OpenAI-compatible
  provider in `opencode.json`.
- **FDL MCP** is the only governed-data tool (parked until the data layer lands —
  `FDL_MCP_URL`). Masking is applied by FDL/Trino under the **end user's**
  identity, never here.
- **Artifact export** (`services/artifacts`) is downstream of content generation:
  the BFF/web call it after the agent returns content. (Alternatively it can be
  wrapped as an MCP tool the agent calls — a design option, not required for v1.)

## Run (when OpenCode + a GreenNode endpoint are available)

```bash
cp .env.example .env   # set GREENNODE_BASE_URL / GREENNODE_API_KEY / FDL_MCP_URL
opencode serve --port 4096            # runs with this opencode.json
```

Then point the BFF at it:

```bash
# services/bff
AGENT_RUNTIME=opencode OPENCODE_URL=http://localhost:4096 npm run dev
```

## Status / what's verified

- ✅ Configuration authored: provider, models, domain agents, MCP wiring.
- ✅ **OpenCode runs headless** — `opencode serve` (v1.17.12) boots and exposes
  its OpenAPI at `/doc`; the custom `greennode` provider loads from `opencode.json`.
- ✅ **BFF → OpenCode adapter implemented and verified** — `services/bff`
  (`AGENT_RUNTIME=opencode`) drives the server via `@opencode-ai/sdk`
  (`session.create` → `session.prompt`), selecting provider/model/agent per
  request and extracting the assistant's text part. Verified end-to-end:
  `web → BFF → OpenCode → provider → model → validated artifact`.
- ⚠️ **Model was a local OpenAI-compatible stub**, standing in for GreenNode
  (no live MaaS endpoint in this sandbox). Point `GREENNODE_BASE_URL`/`API_KEY`
  at the real endpoint to go live — no code change.
- ⛔ **FDL MCP not exercised** (data layer parked). The `mcp.fdl` block is wired
  but disabled for local runs.

### Verified local run (stub model)

```bash
# 1. model stub (stands in for GreenNode, OpenAI-compatible + streaming)
cd services/bff && STUB_PORT=8788 npm run stub

# 2. opencode serve with a config whose greennode provider → the stub
#    (see the provider block in opencode.json; set options.baseURL to the stub)
opencode serve --port 4096

# 3. BFF in OpenCode mode
cd services/bff && AGENT_RUNTIME=opencode OPENCODE_URL=http://127.0.0.1:4096 npm run dev
# POST /generate now flows BFF → OpenCode → provider → model
```

## Files

- `opencode.json` — server config (provider, model, MCP, agents)
- `agents/{hr,legal,fa}.md` — per-domain agent prompts (read-only, JSON output)
- `.env.example` — provider + MCP endpoints
