# Deck Pack — Exemplars: Shopping List & Sign-off Log (Phase 1)

⛔ **Sovereignty gate.** No real deck is stored in `exemplars/deck/` or committed anywhere
until it has a row below with owner permission = ✅ and Reviewer sign-off = ✅. Real decks
are confidential, untrusted data.

## Shopping list (what to collect)
| Archetype | Target count | Sources to ask |
|---|---|---|
| Board / Exec Update | 3–5 | past VNG board updates / QBRs / exec reviews |
| Pitch / Proposal | 3–5 | GreenNode sales & pitch decks; internal funding proposals |

## Committed synthetic seeds (safe, ship with the repo)
Fully fabricated, generic-company decks so the pack works out-of-the-box. **No real data.**
- [ ] `seed-board.*` — a synthetic board update for a fictional company.
- [ ] `seed-pitch.*` — a synthetic pitch for a fictional product.

## De-sensitization checklist (apply to every real exemplar before storage)
- [ ] Real names → roles ("VP Sales"); client/partner names → placeholders ("a fintech customer").
- [ ] Real financials/metrics → representative figures.
- [ ] Confidential strategy / roadmap specifics removed or generalized.
- [ ] Logos, PII, credentials, internal URLs stripped.

## Storage
- Real de-sensitized decks → **gitignored** `exemplars/deck/` → server-side exemplar store.
- Synthetic seeds → committed under the pack (safe).

## Sign-off log
| ID | Archetype | Source (role, not name) | Owner permission | De-sensitized | Reviewer sign-off | Notes |
|---|---|---|:-:|:-:|:-:|---|
| _e.g. brd-01_ | Board | _VP Ops_ | ☐ | ☐ | ☐ | _what was scrubbed_ |
