# Deck Pack — Eval Prompts (Phase 2 · frozen)

A **fixed** set of 6 prompts, run against the live model in Phase 4 and scored with
`RUBRIC.md`. Frozen so results are comparable across `guidance` iterations. Change only by
adding — never silently edit an existing prompt (it breaks comparability).

| # | Archetype | Prompt | Tests |
|---|---|---|---|
| 1 | Board | "Q2 2026 board update for GreenNode MaaS — cover revenue, pipeline, product milestones, and one funding ask." **(+ attach a metrics doc)** | grounded use of an input; the ask; assertion titles |
| 2 | Pitch | "Pitch deck to sell GreenNode MaaS to a mid-market fintech CTO." | persuasive arc; differentiation (sovereignty); CTA |
| 3 | Pitch | "Proposal deck to get exec funding for the Atlas rollout to back-office teams." | internal-funding arc; cost & plan; the ask |
| 4 | Board | "5-slide exec summary of our Q2 hiring plan." | **no padding** — respects a tight length; concision |
| 5 | (ambiguous) | "Make me a deck about our platform." | sensible default / clarify behavior; doesn't hallucinate specifics |
| 6 | Board | **(attach a BRD or report doc)** "Turn this into a board deck." | attachments → deck path; faithful compression, no fabrication |

## How to run (Phase 4)
1. Ensure the local stack is up (BFF → live GreenNode; artifacts service for export).
2. Generate each prompt; for #1 and #6, upload the input first (attachments path).
3. Export each to pptx and open it — check row 10 of the rubric.
4. Score every output against `RUBRIC.md`; iterate `guidance(archetypeId)` until the set passes.
5. Save the scorecard (prompt × check) to the Phase 4 notes.
