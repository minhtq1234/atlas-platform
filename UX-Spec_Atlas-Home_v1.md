# UX Spec — Atlas Home (v1)

> **STATUS (1 Jul 2026): mostly BUILT.** Home, composer (output-type · source · **model picker** · upload), template gallery, Configure overlay, Build (with real streamed progress) and **Studio** are implemented; the **GreenNode model picker** is live. Deferred as designed: data-source connection (UI-only), refreshable-report live refresh, full VN shell. Authoritative status: **`Atlas_Architecture-AsBuilt_v1.md`** (§3). This spec remains the design intent.

**Owner:** Andy Tran (DTO, product) · **Author:** product/design
**Date:** 30 June 2026 · **Status:** Draft for team → implemented
**Scope:** Home screen + composer, template gallery, configure overlay, build → Studio handoff. VNG-internal, artifact generation only.
**Reference UX:** coworker.ai (app.coworker.ai) — adopt its *structure and controls*, keep Atlas's Strata brand.
**Supersedes:** the `Atlas Home.dc.html` prototype (which this builds on directly).

---

## 1. TL;DR

Atlas is an **AI-native Smart Artifact generator**: connect a data source, describe (or pick a template), and Atlas builds a finished, on-brand deliverable — Doc, Deck, Sheet, Dashboard, or Report. The user refines it in a chat-driven Studio.

The prototype is ~80% right. This spec locks the structure and adds the **two controls it's missing**: a **model picker** and a **prominent "Connect data sources"** entry point. Governance (per-user masking, provenance) stays **subtle** — it lives *behind* the source picker, never as a lecture.

---

## 2. Scope & non-goals

**In scope (v1):**
- Home: greeting, composer, template gallery, recent artifacts.
- Composer with output-type, **data-source scope**, and **model** selectors.
- Configure overlay (preview + chat-to-tailor).
- Build progress → **Studio** (chat-left + canvas-right editor).
- Five artifact types: **Doc · Deck · Sheet · Dashboard · Report**.

**Explicitly NOT in v1** (resist coworker.ai's breadth):
- Discover / Trending / community gallery, use-stats ("People helped").
- Calendar / Notetaker / meeting capture.
- `@people` multiplayer collaboration.
- `Apps` / `Websites` artifact types.
- Multi-tenant / external customers (VNG-internal only — but pick primitives that generalize later).
- Write-back to source systems.

---

## 3. Brand & tokens (from the prototype — do not reinvent)

| Token | Value | Use |
|---|---|---|
| Paper | `#F4F2EC` | App background |
| Ink | `#1A1A2E` | Text, primary buttons |
| Indigo | `#2D3A8C` | Primary accent, data viz, links |
| Indigo tints | `#7D86D4` `#C7CEE8` `#EDEFF7` | Charts, chips, avatars |
| Coral | `#F0997B` | Brand highlight, report accent |
| Positive | `#0F6E56` | Deltas (+18), positive stats |
| Muted | `#8A887F` | Secondary text |
| Borders | `#E3E1DA` `#ECEAE3` `#E9E7E0` | Cards, dividers |
| Orb | `conic-gradient(from 140deg,#F0997B,#2D3A8C,#1A1A2E,#F0997B)` | Atlas intelligence motif (hero, build, assistant avatar) |

**Type:** `Be Vietnam Pro` (UI, full VN diacritics), `Newsreader` serif (artifact titles). **Self-host both** — strip the Google Fonts `<link>`/`preconnect` from the prototype (sovereignty invariant #6).

**Radii:** cards 16px · composer 18px · buttons 10–11px · pills 999px. **Card shadow:** `0 2px 14px rgba(26,26,46,.05)`; hover `0 8px 26px rgba(26,26,46,.1)` + `translateY(-2px)`.

> Keep the Strata skin. coworker.ai is neutral/grey by design; Atlas's warmth + serif is a differentiator, not a thing to flatten.

---

## 4. Home screen

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] Atlas                          [Connect data sources] [LP]│  ← top bar
├─────────────────────────────────────────────────────────────┤
│                       🟠 Evening, Linh                        │  ← hero + orb
│         Describe it, or start from a template.                │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  Describe the artifact you want to build…             │ │  ← composer
│   │  [📄 Doc ▾]  [◳ Source: HRCore ▾]   [Model ▾]  [🎤] [↑]│ │
│   └───────────────────────────────────────────────────────┘ │
│                                                               │
│   Start from a template          [All|Docs|Decks|Sheets|…]   │  ← gallery
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│   │+ Blank│ │ Memo │ │ Deck │ │ Dash │ …                      │
│   └──────┘ └──────┘ └──────┘ └──────┘                        │
│                                                               │
│   Recent artifacts  ▾                                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Top bar
- Logo (stacked coral/indigo/ink bars) + **Atlas** wordmark.
- **`Connect data sources`** — primary CTA, top-right, persistent. **NEW vs prototype.** This is the product's front door; it must be the loudest affordance on the bar. Opens the source-connection panel (§7).
- User avatar → account menu. Library access lives here or in the left rail.

### 4.2 Hero
- Animated orb + time-of-day greeting (`Morning/Afternoon/Evening, {firstName}`).
- One-line value sub: *"Describe it, or start from a template. Atlas builds a finished, on-brand artifact — ready to share."*

### 4.3 Composer (the heart of the screen)
Single text input + a control row beneath it. Controls, left→right:

| Control | Behaviour | Notes |
|---|---|---|
| **Output type** | `📄 Doc ▾` → menu: Doc / Deck / Sheet / Dashboard / Report | Defaults to Doc. Sets the artifact kind. |
| **Data source** | `◳ Source ▾` → list of *connected* governed sources the user is cleared for | **NEW (elevated).** Replaces the prototype's dashed "+ Add data" toast. If none connected, this routes to Connect data sources (§7). **Governance lives here, silently** — masking is applied behind the selected source; no governance UI. |
| **Model** | `Model ▾` → GreenNode-hosted models | **NEW.** The MaaS control — make the model visible and switchable (coworker shows "Kimi 2.6"/"Sonnet 4.6"; we show GreenNode models). Default to the recommended model. |
| **Mic** | voice → text | Optional v1. |
| **Send ↑** | starts the flow | Empty input + no template → inline hint, not an error. |

**Behaviour:** Enter submits. Empty submit shows a gentle nudge ("Describe what you want, or pick a template below."). A free-text submit goes straight to the Build flow using the current type/source/model selection.

### 4.4 Template gallery
- Section header "Start from a template" + filter tabs: **All · Docs · Decks · Sheets · Dashboards · Reports** (filter by type, not domain — VNG-internal, HR-led set for v1).
- Responsive grid, `minmax(312px, 1fr)`.
- **Blank artifact** card first (dashed, "+", "Describe it · Atlas builds from scratch").
- Template cards: thumbnail preview (188px) + footer with **name**, **type tag**, and a **source row** (e.g. "HRCore · headcount view"). The source row is the *only* governance signal on the card — quiet, factual.
- Hover: lift + shadow. Click → Configure overlay (§5).

### 4.5 Recent artifacts
- Collapsed list of the user's recent builds (name, type, when, re-open). Replaces a heavy "Library" page for v1; full Library is a stretch.

---

## 5. Configure overlay

Modal, opened from a template card. Two panes + footer.

- **Header:** `CONFIGURE · {Type}` + artifact name + close.
- **Left (preview):** live, brand-accurate mock of the chosen type (the prototype already has all five — reuse).
- **Right (chat-to-tailor):**
  - Assistant opener: *"I'll build a {type} from **{source}**. Tell me how to tailor it — period, scope, language, or style."*
  - **Applied** chips area (removable) as the user adds constraints.
  - **Quick chips:** `Q2 2026` · `TSE only` · `In Vietnamese` · `Minimal style`. (Note: *In Vietnamese* = output language as a one-tap config.)
  - Input + send.
  - Footer of pane: `Data from {source}  ·  Change ▾` and the model in use.
- **Footer:** `Build {Type}` (primary) + meta `~30s · lands in your library`.

---

## 6. Build → Studio

- **Build overlay:** orb + `Building {name}`, staged status ("Reading the template…", "Pulling data from {source}…", "Composing {type}…", "Almost there…"), progress bar. Persist build intent (so a refresh/return restores state).
- On complete → route to **Studio** (`Atlas Studio`).

### 6.1 Studio (chat-left + canvas-right) — coworker.ai pattern
```
┌───────────────┬───────────────────────────────────────────┐
│ {Artifact}    │ {Section}   [View|Edit]  ‹ 1/7 ›  [Shared] ⋯│
│ Model ▾       │                                            │
│               │                                            │
│ assistant:    │          ████ canvas (live render) ████    │
│ "I've loaded  │                                            │
│  X. Tell me   │                                            │
│  what to      │                                            │
│  change —     │          [—  100%  +]                       │
│  content,     │   ┌──┐┌──┐┌──┐┌──┐┌──┐  ← filmstrip         │
│  data sources,│   └──┘└──┘└──┘└──┘└──┘                      │
│  layout…"     │                                            │
│ [Ask follow-up]│                                           │
└───────────────┴───────────────────────────────────────────┘
```
Adopt: **View/Edit toggle**, **page/slide pager + filmstrip**, **version history** (clock), **Make a copy in new chat**, **Share** (within governance boundary). The assistant opener explicitly lists *data sources* as an editable dimension — keeps data subtle and in-flow.

---

## 7. Connect data sources

- Triggered by the top-bar CTA or an empty source picker.
- Lists available governed sources (HRCore / headcount view, Finance, ATS… for v1) with connect state and "what you're cleared for" shown as a plain fact, not a permissions dialog.
- Once connected, sources populate the composer's **Source ▾** and template source rows.
- **Governance is implicit:** selecting a source = querying it under the user's identity with masking applied downstream (FDL MCP → Trino). The UI never explains masking; it just shows the source and the (already-masked) result.

---

## 8. Cross-cutting requirements

- **Model surfacing (MaaS):** the model picker appears in the composer **and** in Studio. This is strategically load-bearing — make the GreenNode model visible wherever generation happens.
- **Bilingual:** UI supports VN/EN; output language is selectable per build (`In Vietnamese` chip). Decide v1 default shell language (see open questions).
- **Refreshable Report/Dashboard (flag):** Reports/Dashboards should carry an **"as-of {date}"** stamp and a **refresh** affordance (re-query under the viewer's identity). Strategically important (recurring inference = recurring MaaS burn) — target v1.1 if not v1, but design the card/Studio to accommodate it now.
- **States to design (not happy-path only):** empty (no sources connected), building, error, **permission-denied** (source not cleared), and **"no governed data for that"** as a legitimate assistant answer.
- **Accessibility:** real focus states for all controls; check `#8A887F` on `#F4F2EC` (~3:1) for small text — darken secondary text to meet WCAG AA.
- **Sovereignty:** no public CDN/font/asset calls at runtime; self-host fonts; data + inference stay in GreenNode.

---

## 9. Open questions / decisions needed

1. **Shell language default** — VN-first or EN-first UI for VNG back-office?
2. **Model list** — which GreenNode models surface in the picker, and the default? (ties to D3 / spike T4)
3. **Library depth** — "Recent artifacts" list (v1) vs a full Library page; and **artifact retention/storage** (Open Q #3, D4) given stored artifacts are masked-at-build snapshots.
4. **Refreshable reports** — v1 or v1.1? (decides how much Studio/canvas must support live re-query now).
5. **Source-connection UX** — self-serve connect vs admin-provisioned sources for v1.

---

## 10. Build delta from the prototype (punch-list)

1. **Add model picker** to composer (+ Studio header). *(strategic)*
2. **Elevate "Connect data sources"** to a primary top-bar CTA. *(strategic)*
3. **Replace "+ Add data" toast** with a real **Source ▾** selector wired to connected sources.
4. **Strip Google Fonts** links/preconnect; self-host Be Vietnam Pro + Newsreader.
5. **Build out Studio** on the chat+canvas pattern (View/Edit, filmstrip, version history, copy-in-new-chat).
6. **Add states:** permission-denied, empty-sources, error, "no governed data."
7. **Darken secondary text** for AA contrast.
8. **(v1.1)** as-of stamp + refresh on Report/Dashboard.
```
