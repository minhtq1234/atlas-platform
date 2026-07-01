# Connecting Atlas to GreenNode (MaaS)

Atlas generates through GreenNode's **OpenAI-compatible LLM endpoint** (AI Platform / MaaS):

- **LLM endpoint:** `https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1`
- **Management API:** `https://aiplatform-hcm.api.vngcloud.vn` (list models, manage AIP keys)
- **Auth:** an **AIP API key** (Bearer) for inference; an **IAM service-account** token for management.

Two things are needed to go live: an **AIP API key** and a **model `path`** (from the models list — use `path`, not `code`).

## 1. Get credentials

From the [IAM console](https://iam.console.vngcloud.vn/service-accounts) create a service account with `AiPlatformFullAccess` and copy its **Client ID + Client Secret**. Then either create an AIP key in the [models console](https://aiplatform.console.vngcloud.vn/models) → **API Keys**, or let the helper below do it.

## 2. Verify / provision (one command)

```bash
# A) You already have an AIP key — just verify + list model paths:
AIP_KEY=<key> bash services/bff/scripts/greennode-connect.sh

# B) You have IAM creds — verify, list models, reuse an existing key:
GREENNODE_CLIENT_ID=... GREENNODE_CLIENT_SECRET=... \
  bash services/bff/scripts/greennode-connect.sh

# C) Provision a new AIP key (explicit — creates a resource on your account):
GREENNODE_CLIENT_ID=... GREENNODE_CLIENT_SECRET=... \
  bash services/bff/scripts/greennode-connect.sh --create-key atlas-bff
```

The script lists model `path`s, runs a smoke chat call, and prints the exact env block. It is **read-only unless** you pass `--create-key`.

## 3. Wire it

**Direct mode (simplest — BFF → GreenNode):**
```bash
cd services/bff && cp .env.example .env    # then fill in:
#   AGENT_RUNTIME=direct
#   MODEL_API_KEY=<aip key>
#   MODEL_NAME=<model path>
#   MODEL_ALLOWED_HOSTS=vngcloud.vn
npm run dev
```

**OpenCode mode (full topology — BFF → OpenCode → GreenNode):**
```bash
cd agent && cp .env.example .env           # set GREENNODE_BASE_URL / GREENNODE_API_KEY
opencode serve --port 4096
cd services/bff && AGENT_RUNTIME=opencode OPENCODE_URL=http://127.0.0.1:4096 npm run dev
```
In OpenCode mode the model id sent to the endpoint is the provider model key in
`agent/opencode.json` — set that key (and the BFF's `modelId`, minus the `gn-`
prefix) to the real GreenNode model **path**.

**Agent mode (multi-step tool agent — v1):**
- **Dev (`local` sandbox):** with an OpenCode server already running (above), set `SANDBOX=local` (the default). `/agent/run` seeds attachment text into a temp workdir and drives the running OpenCode `builder` agent. No container needed. This exercises the whole plan→run→emit loop; the `emit_artifact` self-heal (synchronous tool return) is the piece to shake out live — see SPEC §8.
- **Prod (`container` sandbox — gated ops):**
  1. Build the sandbox image `atlas/agent-sandbox:latest` (or set `AGENT_IMAGE`): a base with `opencode` + `python3` and `python-docx`/`openpyxl`/`python-pptx`/`pypdf` installed, entrypoint `opencode serve`.
  2. Create a restricted docker network so the sandbox can reach **only** the sovereign model host: `docker network create atlas-egress` then apply egress firewall rules (allow `*.vngcloud.vn:443` + the BFF's emit endpoint; deny all else). This is the network-level enforcement of the `MODEL_ALLOWED_HOSTS` invariant.
  3. Run the BFF with `SANDBOX=container` (+ `AGENT_MAX_STEPS`, `AGENT_TIMEOUT_MS` as needed). Each `/agent/run` gets a fresh, firewalled, workspace-mounted container that is destroyed when the run ends.

## Notes
- The **egress allowlist** (`MODEL_ALLOWED_HOSTS`) must include `vngcloud.vn`, or the BFF refuses to start (sovereignty guard). Loopback is always allowed. In `container` agent mode the same invariant is enforced at the sandbox's network firewall.
- Keys live in `.env` (gitignored) or the vault — never in code/images.
- If nothing is configured, the BFF serves **template** artifacts and the web app still works (degraded); connecting a key upgrades every build to model-authored with no code change.
