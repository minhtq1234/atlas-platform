# Artifact Pack Playbook

**The operating model every Pack team follows to take one artifact type from a thin
module to genuinely good.** A pack is ~30% coding. The rest — sourcing real exemplars,
defining archetypes, and setting a measurable quality bar — is content and judgment work
that has to happen *around* the code. This playbook makes all of it first-class.

Read alongside:
- `docs/superpowers/specs/2026-07-01-artifact-platform-program.md` — the program map (Platform vs. Packs, the `ArtifactTypeModule` contract, per-team charters, file isolation).
- `docs/artifact-packs/AUTHORING.md` — the *coding* detail for Phase 3 (Platform team, WS-0). This playbook wraps it with the content + process work.
- `docs/artifact-packs/deck/` — the **worked example**. The Deck pack is the filled-in reference; copy `docs/artifact-packs/_TEMPLATE/` to start a new one.

---

## Roles (hats, not headcount)

One person can wear several hats; a pack needs all three covered.

| Hat | Owns | Phases |
|---|---|---|
| **Curator / Domain Expert** | Knows what a *great* artifact of this type looks like. Sources exemplars, defines archetypes, writes the rubric. | 0 · 1 · 2 |
| **Engineer** | The code: schema · prompt · renderer · export · exemplar wiring. Runs the eval. | 3 · 4 · 5 |
| **Reviewer** | Quality + sovereignty sign-off. The two hard gates are theirs to hold. | 1 · 2 · 4 |

---

## The two hard gates (non-negotiable)

Everything else in this playbook is lightweight and self-organized. These two are not:

> ⛔ **Sovereignty gate** (end of Phase 1) — **no real VNG/GreenNode content is stored or
> committed** without (a) the artifact owner's permission and (b) a completed
> de-sensitization pass, both logged and signed off by the Reviewer. Real docs are
> untrusted, confidential data.

> ⛔ **Quality gate** (end of Phase 4) — **a pack does not merge until it passes its own
> rubric** on its fixed eval-prompt set (all ★ must-haves met, no fabrication). This is
> what stops the "it just pulled a random template" regression.

---

## The six phases

| Phase | What happens | Owner | Exit criteria |
|---|---|---|---|
| **0 · Charter** | Pick 2–4 target archetypes, name the audience, define "done". | Curator | 1-page `CHARTER.md` |
| **1 · Collect & curate** ⛔ | Source 3–10 real gold artifacts *per archetype*; get permission; **de-sensitize**; tag; pick committable synthetic seeds. | Curator + Reviewer | **Sovereignty gate:** every exemplar signed off + logged; ≥1 safe seed per archetype |
| **2 · Define** | Per archetype: structure, tone, must-haves, failure modes → `ARCHETYPES.md`. Write `RUBRIC.md` + `EVAL-PROMPTS.md`. | Curator + Reviewer | catalog + rubric + eval prompts committed |
| **3 · Build** | Clone the reference pack → `schema · shapeHint · guidance · archetypes · renderer · export · exemplar wiring`. TDD. | Engineer | contract tests pass; renders + exports; all suites green |
| **4 · Evaluate & harden** ⛔ | Generate against the eval prompts (live); score vs. rubric; iterate the prompt; export-fidelity check; red-team exemplar/attachment injection. | Engineer + Reviewer | **Quality gate:** rubric-pass on the eval set |
| **5 · Ship** | Pack `README` + archetype catalog; safe seeds committed, real exemplars gitignored; program doc → "done". | Engineer | merged; suites green; program doc updated |

### Phase 1 detail — the "artifact collecting"

This is the highest-leverage work in the whole pack and the easiest to under-invest in.
It also has **long calendar lead time** (you're waiting on busy people), so **start it
early — in parallel with WS-0 and Phase 0**, don't gate it on code being ready.

1. **Intake.** Ask 3–5 artifact owners for their best examples of each archetype
   ("share 2–3 board decks you're proud of"). Aim for 3–10 per archetype.
2. **De-sensitize** (every real doc, before it is stored anywhere):
   - Real names → roles ("VP Sales"); client/partner names → placeholders ("a fintech customer").
   - Real financials/metrics → representative figures; remove confidential strategy.
   - Strip logos, PII, credentials, internal URLs.
3. **Sign-off & log.** Record each exemplar in `EXEMPLARS.md`: source, owner-permission (y),
   what was scrubbed, Reviewer sign-off. **No entry, no storage.**
4. **Store.** Real (de-sensitized) exemplars go in the **gitignored** `exemplars/<tag>/`
   folder → server-side store (the exemplar toolkit). Ship **1–2 fully synthetic, safe
   seeds** committed to the repo so the pack works out-of-the-box.

### Phase 2 & 4 detail — measurable quality

- **`RUBRIC.md`** is 8–12 concrete checks, with the ship-critical ones marked ★. A check is
  a yes/no a Reviewer can apply by looking at one output — not a vibe ("good structure").
- **`EVAL-PROMPTS.md`** is a *fixed* set of 5–10 representative prompts, deliberately spanning
  the archetypes, the terse/underspecified cases, and the attachments path. Frozen so runs
  are comparable across iterations.
- Phase 4 = generate against the set → score each output against the rubric → iterate the
  `guidance`/prompt until the whole set passes. Record the final scorecard.

---

## Deliverables per pack

```
docs/artifact-packs/<type>/
  CHARTER.md        # Phase 0 — archetypes, audience, definition of done
  ARCHETYPES.md     # Phase 2 — the catalog: structure, tone, failures per archetype
  RUBRIC.md         # Phase 2 — the ship gate checklist (★ = critical)
  EVAL-PROMPTS.md   # Phase 2 — the fixed eval set
  EXEMPLARS.md      # Phase 1 — shopping list + de-sensitization / sign-off log
  README.md         # Phase 5 — what shipped, how to extend
exemplars/<tag>/    # gitignored — the real de-sensitized docs (never committed)
+ code: the ArtifactTypeModule + renderer + export (Phase 3)
```

## How to start a pack

1. Confirm WS-0 has frozen the `ArtifactTypeModule` contract (your type's thin module exists under `services/bff/src/artifacts/<type>/`).
2. `cp -r docs/artifact-packs/_TEMPLATE docs/artifact-packs/<type>` and fill in Phase 0.
3. **Kick off Phase 1 collection immediately** — it has the longest lead time.
4. Work Phases 2→5. Use the superpowers flow (brainstorm → spec → plan → subagent build) for the Phase 3 code.
5. Hold the two ⛔ gates. Keep the three suites green.
