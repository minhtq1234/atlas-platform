# <Type> Pack — Eval Prompts (Phase 2 · frozen)

A **fixed** set of 5–10 prompts, run live in Phase 4 and scored with `RUBRIC.md`. Frozen so
runs are comparable across `guidance` iterations. Change only by adding.

| # | Archetype | Prompt | Tests |
|---|---|---|---|
| 1 | <A> | "<realistic prompt, with an input if relevant>" | <what this probes> |
| 2 | <B> | "<...>" | <...> |
| 3 | <A/B> | "<a tight-size prompt>" | no padding / concision |
| 4 | (ambiguous) | "<underspecified prompt>" | sensible default / clarify, no hallucination |
| 5 | <A> | "<attach a doc> turn this into a <type>" | attachments path; faithful, no fabrication |

## How to run (Phase 4)
1. Bring the stack up (BFF → live model; artifacts service for export).
2. Generate each; upload inputs first where the prompt needs one.
3. Export and open each — check the fidelity row of the rubric.
4. Score against `RUBRIC.md`; iterate `guidance(archetypeId)` until the set passes.
5. Save the scorecard to the Phase 4 notes.
