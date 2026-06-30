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
- ⛔ **Not executed in this sandbox** — there is no OpenCode binary or live
  GreenNode endpoint here. Validate `opencode.json` against your installed
  OpenCode version (config keys can shift between releases).
- The BFF's `opencode` runtime adapter (`services/bff/src/modelClient.ts`,
  `openCodeRun`) is a marked seam — implement it against the OpenCode session
  API once the server is running. The **verified** path today is
  `AGENT_RUNTIME=direct` (BFF → OpenAI-compatible model), which exercises the
  same prompt + JSON contract the OpenCode agents use.

## Files

- `opencode.json` — server config (provider, model, MCP, agents)
- `agents/{hr,legal,fa}.md` — per-domain agent prompts (read-only, JSON output)
- `.env.example` — provider + MCP endpoints
