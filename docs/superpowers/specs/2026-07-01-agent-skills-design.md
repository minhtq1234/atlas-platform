# Design — Atlas Agent Skills

**Date:** 2026-07-01 · **Status:** approved design (pre-implementation) · **Owner:** Atlas
**Context:** SPEC.md (§3 Studio, §5 generation seam). Supersedes the ad-hoc EDIT/CLARIFY/ANSWER prompt branching in `services/bff/src/prompt.ts` by making it a structural, reusable capability layer.

## 1. Goal & scope
Turn the agent's conversational behavior into a **reusable, structural capability layer** ("skills") instead of one overloaded prompt. Prove it on the **Studio artifact-editing** loop, but design it so the future **governed Data-Query (FDL)** flow reuses the same spine.

- **In scope (v1):** skills `route`, `clarify`, `plan`, `edit`, `answer`; the action contract; a BFF **skill runtime** (orchestrator + tiny state machine); the web/Studio rendering of actions. Works in both `direct` and `opencode` runtime modes.
- **Deferred (FDL phase):** `query-data`, `critique`/self-review, `cite`/provenance; autonomous multi-tool loops.
- **Non-goals:** betting the UX on model tool-calling; a plan-editing UI (confirm is yes/proceed); changing the artifact schema.

## 2. Decisions (from brainstorm)
1. Reusable capability layer, proven on Studio, reused later for Data-Query. 
2. OpenCode-native: OpenCode hosts the **agent + session**; skills are **prompt modules**; real **tools** only where there's an external call (FDL later).
3. **Adaptive** control: clarify if ambiguous → propose+confirm a plan for big/multi-step changes → execute → summarize; small clear edits stay one-shot.
4. Human-in-the-loop is **deterministic** (runtime-owned state), not dependent on model tool-calling.

## 3. The Action contract (core interface)
Every agent turn returns exactly one action:
```ts
type Skill = 'clarify' | 'plan' | 'edit' | 'answer';
interface AgentAction {
  skill: Skill;
  message: string;              // always — shown in chat
  options?: string[];           // clarify: suggested tappable answers
  plan?: { steps: string[] };   // plan: proposed steps
  content?: ArtifactContent;    // edit: the new artifact (zod-validated, kind forced)
}
```
Runtime handling:
| skill | runtime action | version? |
|---|---|---|
| `clarify` | show message + option chips; end turn; user reply = next turn | no |
| `plan` | show steps + Confirm; set `awaiting=plan-confirm`; on confirm → execute turn | no |
| `edit` | validate `content` (zod, force `kind`) → new version; message = summary | yes |
| `answer` | show message | no |

The model emits this as a single JSON object; the runtime parses via the existing `extractJson` + validates with zod. Invalid/parse failure → fall back to a plain `answer` (or template edit) so a turn never hard-fails.

## 4. Skills (each = prompt module + schema)
Location: `services/bff/src/skills/`. Each exports `{ id, buildPrompt(ctx), schema }`.
- **route** — not a separate model call; it's the system-prompt instruction that tells the agent to pick one skill per turn using the adaptive rule (ambiguous→clarify, big/multi-step→plan, clear-small→edit, question→answer). One call returns the chosen action. (Keeps latency at one round-trip.)
- **clarify** — ask ONE question; may include 2–3 `options`. No content.
- **plan** — for big/multi-step/destructive requests: 2–6 `steps`, a one-line `message`. No content yet.
- **edit** — apply the change; return full `content` + a one-sentence summary `message`.
- **answer** — question/small-talk; `message` only.

Domain persona (`hr`/`legal`/`fa`) is composed *around* the skill contract, so governance rules (read-only, governed-by-construction) still apply.

## 5. Skill runtime (BFF)
New module `services/bff/src/skills/runtime.ts`:
- `buildActionPrompt(type, persona, lang, mode, context?)` → system prompt = persona + adaptive router + action-contract shape (+ any `context`).
- **Forward seam:** `runTurn`/`buildActionPrompt` accept an optional `context?: string[]` (extracted attachment text). It's injected into the prompt when present and **empty in v1** — this is the drop-in point for the future *Attachments-as-agent-context* project (separate spec), so that work needs no runtime rework.
- `runTurn(input)` where `input = { type, current, message, modelId, lang, sessionId?, awaiting?, plan?, confirm?, context? }`:
  1. If `awaiting === 'plan-confirm'` **and** `confirm === true` (an explicit signal from the Confirm button — **not** NLP guessing) → send an **execute** turn ("Execute this plan: …" + the stored steps) expecting an `edit`.
  2. Else → one `runModel` call → parse+validate `AgentAction`. (A free-typed reply while awaiting confirm is just a normal turn — typically the model re-plans or edits with the new detail.)
  3. Return `{ action, version?, awaiting }` — `version` set only for `edit`; `awaiting='plan-confirm'` set for `plan`, else `none`.
- Owns the parse/validate/fallback and the tiny state machine. Pure enough to unit-test with a fake `runModel`.

`generate.ts revise()` becomes a thin wrapper over `runTurn`. `runModel` is unchanged (direct or opencode). In `opencode` mode the OpenCode **session** carries history (so plan-confirm and clarify keep context); in `direct` mode the BFF passes `current` + recent turn context.

## 6. Server + web contract
- `POST /revise` request adds `awaiting?`, `plan?`, and `confirm?` (echoed by the client) so the runtime is stateless across HTTP calls; response returns the full `AgentAction` + `version?` + `awaiting?`.
- **Web** (`Studio.tsx` + store): render by `skill` — `message` always; **option chips** (clarify) that send the chosen text as the next message; a **plan card + Confirm button** (plan) — Confirm sends the next `/revise` with `confirm:true` + the stored `awaiting/plan` (deterministic, no free-text). Apply `version` (edit). Keep a per-artifact `awaiting`/`plan` in the store (survives reload), echoed on the next `/revise`.
- `httpEngine.revise` + `GenerationEngine.revise` return type widens from `{version,message}` to the `AgentAction`-shaped result; `mockEngine.revise` returns a simple `edit` action (offline parity).

## 7. Migration path (later, gated)
`query_fdl` (governed data) and `critique` become OpenCode **tools/subagents** the agent calls autonomously; the Action contract stays the UI-facing surface (a tool result feeds an eventual `edit`/`answer`). **Gate:** a tool-calling spike (likely Qwen) confirming a GreenNode model drives OpenCode tools reliably before we depend on it. Until then, everything runs through the deterministic runtime.

## 8. Testing
- Unit: each skill schema/parse with fixtures (valid clarify/plan/edit/answer + malformed→fallback); `runtime` state machine (plan→confirm→edit; clarify→reply; answer no-version).
- Live smoke on GreenNode: one turn per skill (ambiguous→clarify, big→plan→confirm→edit, clear→edit, question→answer).
- Web: store/Studio renders each action type; option-chip and confirm flows.

## 9. Risks & mitigations
- **Model returns wrong/over-eager skill** (e.g. clarifies everything) → prompt biases toward acting; only clarify when ambiguity changes the result; monitor.
- **JSON reliability** across models → reuse hardened `extractJson`; fallback to `answer`/template on parse failure.
- **Direct mode lacks memory** for multi-turn plan-confirm → runtime echoes `awaiting`/`plan` over HTTP so confirm works without server session.

## 10. Open questions
- **Resolved:** persist `awaiting`/`plan` in the store (survives reload); confirm is an explicit `confirm:true` signal, not NLP.
- Should `generate` (initial build) also route through skills (e.g. clarify before building)? (Lean: not v1 — the Configure overlay already gathers constraints.)
