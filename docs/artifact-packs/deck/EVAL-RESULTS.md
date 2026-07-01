# Deck Pack — Phase-4 Eval Results

Run 2026-07-02 against live GreenNode (`minimax/minimax-m2.5`), scored with
[RUBRIC.md](RUBRIC.md) over the frozen [EVAL-PROMPTS.md](EVAL-PROMPTS.md) set.
★ = ship-critical rubric item.

| # | Prompt | ★Assertion titles | ★Concision | ★Arc | ★Grounded | Notes | Length |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Board (no source) | ✓ | ✓ | ✓ | ⚠︎ invented numbers | ✓ | 11 ✓ |
| 2 | Pitch — external | ✓ | ✓ | ✓ | ✓ qualitative | ✓ | 8 |
| 3 | Pitch — internal funding | ✓ | ✓ | ✓ | ⚠︎ invented numbers | ✓ | 8 |
| 4 | Board — "5-slide" terse | ✓ | ✓ | ✓ | ⚠︎ invented numbers | ✓ | **5 ✓ (no padding)** |
| 5 | Underspecified | ~ mostly | ✓ | ✓ | ✓ no fabrication | ✓ | 9 |
| 6 | Board — grounded on upload | ✓ | ✓ | ✓ | **✓✓ every doc number, 0 invented** | ✓ | 11 ✓ |

## Verdict
- **Craft & structure ★ (assertion titles, concision, arc) — strong across all six.** Distinct
  arcs per archetype, single-idea slides, speaker notes on every slide, section/statement
  layouts used, and #4 proved it respects a tight slide count instead of padding.
- **Grounding ★ — flawless with a source, and the one caveat without one.** #6 used *every*
  number from the uploaded doc with zero fabrication; #2/#5 stayed safely qualitative. #1/#3/#4
  (metrics-heavy briefs, no source) invent plausible-but-fake numbers stated as fact.
- **#5 (no archetype)** produced a few topic-label titles — confirming the archetype arc is what
  fully enforces assertions; `DECK_RULES` alone gets ~most of the way.

## Actions taken from these results
- **Grounding of facts** is the attachments path (proven in #6) — attach a source for metrics decks.
- **Craft consistency** (esp. the #5 no-archetype case) is lifted by **Deck exemplars** — added
  synthetic gold seeds under `services/artifacts/seeds/exemplars/{board,pitch,deck}/`. These are
  few-shot structure/tone references (not fact sources).

## Still open
- Real (de-sensitized) VNG board/pitch decks as exemplars — a human-curator Phase-1 task
  (`EXEMPLARS.md`); the synthetic seeds are the out-of-the-box floor.
- Chart slides (deferred P2).
