# Deck Pack — Charter (Phase 0)

**Type:** `Deck` · **Reference pack:** yes (first worked instance of the [Playbook](../PLAYBOOK.md))
**Status:** chartered 2026-07-01 · module exists at `services/bff/src/artifacts/deck/`

## Why Deck first
Highest-visibility business artifact and the natural "wow" companion to Docs for exec
communication. Today it's a bare *title + bullets* transport (no notes, no layouts, no
archetypes, **no Deck-specific prompt guidance**) — so it produces generic decks. Biggest
quality lever per unit of effort.

## Target archetypes (2 for the first pack)
- **Board / Exec Update** — leadership audience; report vs. plan and surface an ask.
- **Pitch / Proposal** — persuade a buyer or funder (external MaaS sale *or* internal initiative).

Deferred to a later cycle: QBR (customer-facing), Project Kickoff/Status.

## Audience & context
VNG/GreenNode back-office and GTM teams. Decks are read by execs, boards, and prospects —
terse, on-brand, and defensible. Sovereignty applies: no fabricated data presented as fact.

## Definition of done
- The two anchor archetypes generate decks that **pass `RUBRIC.md`** on the full `EVAL-PROMPTS.md` set (all ★, no fabrication).
- Speaker notes + section dividers supported end-to-end (schema → renderer → pptx notes pane).
- `guidance(archetypeId)` and the `archetypes` array are populated (board, pitch).
- ≥1 committed synthetic seed per archetype; real exemplars de-sensitized + logged in `EXEMPLARS.md`.
- All three suites green; pptx opens clean in PowerPoint/Keynote.

## Scope guardrail (YAGNI)
In: assertion-title guidance, per-archetype arc, speaker notes, section dividers, a small
`layout` enum. **Out (this cycle):** chart slides, images/headshots, nested sub-bullets,
transitions/builds. Chart slides can borrow Doc's `bars` block in a later cycle.

## Build scope, ranked (feeds the build plan)
- **P0** — `guidance(archetypeId)` (assertion titles + per-archetype arc + slide-count); populate `archetypes` (board, pitch); **speaker notes** (`notes?` → renderer + pptx notesSlide).
- **P1** — section dividers + a small `layout?` enum (`cover|section|bullets|statement`).
- **P2 / deferred** — two-column & big-number layouts; chart slides.
