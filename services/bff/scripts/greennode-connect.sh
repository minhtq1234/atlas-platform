#!/usr/bin/env bash
# Atlas ⇄ GreenNode MaaS connection helper.
#
# Verifies (and optionally provisions) access to GreenNode's OpenAI-compatible
# LLM endpoint, lists the model `path`s you can use, runs a smoke chat call,
# and prints the exact env block to wire into the BFF.
#
# Read-only by default. It NEVER creates a resource unless you pass --create-key.
#
# Usage:
#   # A) already have an AIP key:
#   AIP_KEY=<key> bash scripts/greennode-connect.sh [--model <path>]
#
#   # B) have IAM service-account creds (lists models + reuses an existing key):
#   GREENNODE_CLIENT_ID=... GREENNODE_CLIENT_SECRET=... bash scripts/greennode-connect.sh
#
#   # C) provision a new AIP key (explicit, creates a resource on your account):
#   GREENNODE_CLIENT_ID=... GREENNODE_CLIENT_SECRET=... \
#     bash scripts/greennode-connect.sh --create-key atlas-bff
set -euo pipefail

IAM_URL="https://iam.api.vngcloud.vn/accounts-api/v2/auth/token"
MGMT="https://aiplatform-hcm.api.vngcloud.vn"
LLM="${MODEL_BASE_URL:-https://maas-llm-aiplatform-hcm.api.vngcloud.vn/v1}"
MODEL="${MODEL:-}"
CREATE_KEY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="$2"; shift 2 ;;
    --create-key) CREATE_KEY="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

need() { command -v "$1" >/dev/null || { echo "ERROR: '$1' is required" >&2; exit 1; }; }
need curl; need jq

iam_token() {
  : "${GREENNODE_CLIENT_ID:?set GREENNODE_CLIENT_ID or provide AIP_KEY}"
  : "${GREENNODE_CLIENT_SECRET:?set GREENNODE_CLIENT_SECRET or provide AIP_KEY}"
  curl -s -X POST "$IAM_URL" -u "$GREENNODE_CLIENT_ID:$GREENNODE_CLIENT_SECRET" \
    -d "grant_type=client_credentials" -H "Content-Type: application/x-www-form-urlencoded" \
    | jq -r '.access_token // empty'
}

echo "▸ GreenNode MaaS: $LLM"

# --- Management token (needed to list models / manage keys) -------------------
TOKEN=""
if [ -n "${GREENNODE_CLIENT_ID:-}" ] && [ -n "${GREENNODE_CLIENT_SECRET:-}" ]; then
  TOKEN="$(iam_token)"
  [ -n "$TOKEN" ] && echo "✓ IAM token acquired" || { echo "✗ IAM token failed"; exit 1; }
fi

# --- List models (path = the value you pass as 'model') -----------------------
if [ -n "$TOKEN" ]; then
  echo "▸ Available models (name · path · status):"
  curl -s "$MGMT/v1/models?page=1&size=50" -H "Authorization: Bearer $TOKEN" \
    | jq -r '.listData[]? | "  - \(.name)  ·  \(.path)  ·  \(.modelStatus)"' || echo "  (could not list models)"
  [ -z "$MODEL" ] && MODEL="$(curl -s "$MGMT/v1/models?page=1&size=50" -H "Authorization: Bearer $TOKEN" | jq -r '.listData[0].path // empty')"
fi

# --- Resolve an AIP key (provided > existing > create-if-asked) ---------------
if [ -z "${AIP_KEY:-}" ] && [ -n "$TOKEN" ]; then
  AIP_KEY="$(curl -s "$MGMT/v1/api-keys?page=1&size=50" -H "Authorization: Bearer $TOKEN" \
    | jq -r '(.listData[]? | select(.status=="ACTIVE") | .key) // empty' | head -1)"
  [ -n "$AIP_KEY" ] && echo "✓ Reusing an existing ACTIVE AIP key"
fi

if [ -z "${AIP_KEY:-}" ] && [ -n "$CREATE_KEY" ] && [ -n "$TOKEN" ]; then
  echo "▸ Creating AIP key '$CREATE_KEY' (async)…"
  curl -s -X POST "$MGMT/v1/api-keys" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" -d "{\"name\":\"$CREATE_KEY\"}" >/dev/null
  for _ in $(seq 1 15); do
    st="$(curl -s "$MGMT/v1/api-keys/$CREATE_KEY" -H "Authorization: Bearer $TOKEN" | jq -r '.data.status // empty')"
    echo "  status: ${st:-?}"; [ "$st" = "ACTIVE" ] && break; sleep 3
  done
  AIP_KEY="$(curl -s "$MGMT/v1/api-keys/$CREATE_KEY" -H "Authorization: Bearer $TOKEN" | jq -r '.data.key // empty')"
fi

if [ -z "${AIP_KEY:-}" ]; then
  echo "✗ No AIP key. Provide AIP_KEY=<key>, or pass --create-key <name> with IAM creds." >&2
  exit 1
fi
[ -z "$MODEL" ] && { echo "✗ No model path. Pass --model <path> (see list above)." >&2; exit 1; }

# --- Smoke: a tiny chat completion against the LLM endpoint -------------------
echo "▸ Smoke test → model: $MODEL"
resp="$(curl -s -X POST "$LLM/chat/completions" -H "Authorization: Bearer $AIP_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the single word: OK\"}],\"max_tokens\":8}")"
reply="$(echo "$resp" | jq -r '.choices[0].message.content // empty')"
if [ -n "$reply" ]; then
  echo "✓ Model replied: $(echo "$reply" | tr -d '\n' | head -c 60)"
else
  echo "✗ Chat call failed: $(echo "$resp" | head -c 300)"; exit 1
fi

# --- Print the env block to wire into the BFF --------------------------------
cat <<EOF

────────────────────────────────────────────────────────────
✓ Connected. Wire the BFF (direct mode) with:

  export AGENT_RUNTIME=direct
  export MODEL_BASE_URL=$LLM
  export MODEL_API_KEY=$AIP_KEY
  export MODEL_NAME=$MODEL
  export MODEL_ALLOWED_HOSTS=vngcloud.vn   # egress allowlist

Then:  npm --prefix services/bff run dev

For the OpenCode topology instead, set the same GREENNODE_BASE_URL / API key
in agent/.env and use a model whose id == "$MODEL" (see agent/README.md).
────────────────────────────────────────────────────────────
EOF
