# <Type> Pack — Exemplars: Shopping List & Sign-off Log (Phase 1)

⛔ **Sovereignty gate.** No real artifact is stored in `exemplars/<tag>/` or committed
anywhere until it has a row below with owner permission = ✅ and Reviewer sign-off = ✅.
Real docs are confidential, untrusted data.

## Shopping list (what to collect)
| Archetype | Target count | Sources to ask |
|---|---|---|
| <A> | 3–5 | <which teams / where> |
| <B> | 3–5 | <...> |

## Committed synthetic seeds (safe, ship with the repo)
Fully fabricated, generic examples so the pack works out-of-the-box. **No real data.**
- [ ] `seed-<a>.*`
- [ ] `seed-<b>.*`

## De-sensitization checklist (apply to every real exemplar before storage)
- [ ] Real names → roles; client/partner names → placeholders.
- [ ] Real financials/metrics → representative figures.
- [ ] Confidential strategy / specifics removed or generalized.
- [ ] Logos, PII, credentials, internal URLs stripped.

## Storage
- Real de-sensitized artifacts → **gitignored** `exemplars/<tag>/` → server-side exemplar store.
- Synthetic seeds → committed under the pack (safe).

## Sign-off log
| ID | Archetype | Source (role, not name) | Owner permission | De-sensitized | Reviewer sign-off | Notes |
|---|---|---|:-:|:-:|:-:|---|
| _id_ | <A> | _role_ | ☐ | ☐ | ☐ | _what was scrubbed_ |
