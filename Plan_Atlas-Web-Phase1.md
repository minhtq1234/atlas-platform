# Atlas Web — Phase 1 Implementation Plan

> **STATUS (1 Jul 2026): ✅ DELIVERED and extended.** All milestones M0–M5 shipped, plus work beyond this plan — a Node/Fastify BFF, a Python artifact-export service, a real OpenCode integration, and a **live GreenNode MaaS** connection. For the current, authoritative picture see **`Atlas_Architecture-AsBuilt_v1.md`**. This plan is kept as the historical Phase-1 record.

> **For agentic workers:** execute task-by-task; steps use `- [ ]` checkboxes. TDD where logic warrants; runnable verification for UI.

**Goal:** Ship a runnable, clickable Atlas web app — the AI-native artifact-generation product — implementing the v2 design end to end, with all external dependencies stubbed behind clean interfaces.

**Architecture:** A Vite + React + TypeScript SPA. The full product loop (Home → composer → configure → build → Studio → library) runs **client-side** against a **mock generation engine** that lives behind a single async interface. Artifacts render as **branded HTML** in the Studio canvas for all five types. When GreenNode models, the Python artifact services, real data sources, and SSO are ready, they swap in **behind the existing interfaces** without changing the UI.

**Tech Stack:** Vite, React 18, TypeScript, React Router, Zustand (state), @fontsource (self-hosted Be Vietnam Pro + Newsreader — no runtime CDN), Vitest + Testing Library. No backend in Phase 1.

---

## Scope — real vs stubbed

| Area | Phase 1 | Deferred (behind interface) |
|---|---|---|
| Product loop (Home→Studio) | **Real** | — |
| Brand / design system | **Real** (Strata tokens, self-hosted fonts) | — |
| Generation | **Mock** `generateArtifact()` — deterministic, template-driven | GreenNode model + Python svcs |
| Artifact output | **HTML render** (5 types) in canvas | `.docx/.xlsx/.pptx` export |
| Model picker | **Real UI**, GreenNode model list (static) | real routing |
| Data sources | **UI only** (picker + connect overlay, mock state) | FDL MCP / Trino / masking |
| Auth | **Stub user** ("Linh") | WSO2 SSO |
| Library / persistence | **localStorage** | Postgres / MinIO |
| i18n | **Scaffold** (EN default, VN keys stubbed) | full VN translation |

**Non-goals (Phase 1):** real inference, real data, file export, multi-tenant, write-back.

---

## File structure (monorepo per kickoff)

```
atlas/
  apps/web/
    index.html
    package.json  vite.config.ts  tsconfig.json  vitest.config.ts
    src/
      main.tsx                      # entry + router
      app/Router.tsx                # / (Home), /studio/:id
      brand/tokens.ts               # Strata colors, type, radii, shadows, orb
      brand/fonts.css               # @fontsource imports (self-hosted)
      i18n/strings.ts               # en/vi key maps + t()
      types.ts                      # Artifact, ArtifactType, BuildRequest, …
      generation/
        engine.ts                   # generateArtifact() interface
        mockEngine.ts               # deterministic mock impl
        engine.test.ts
      store/
        useAppStore.ts              # composer, library, build state (Zustand)
        useAppStore.test.ts
      components/
        TopBar.tsx  Orb.tsx  Composer.tsx  Dropdown.tsx
        TemplateGallery.tsx  TemplateCard.tsx
        ConfigureOverlay.tsx  BuildOverlay.tsx  ConnectSourcesOverlay.tsx
        Toast.tsx
      artifacts/
        renderers/{DocView,DeckView,SheetView,DashboardView,ReportView}.tsx
        ArtifactCanvas.tsx          # switches on type
      pages/
        Home.tsx
        Studio.tsx                  # chat-left + canvas-right
      data/templates.ts             # seed templates (HR set from v2 design)
```

Files that change together live together (generation, artifacts, store each cohesive). Renderers are split per type so each stays focused.

---

## Milestones & tasks

### M0 — Scaffold & design system
- [ ] **T0.1** `npm create vite@latest apps/web -- --template react-ts`; add deps (react-router-dom, zustand, @fontsource/be-vietnam-pro, @fontsource/newsreader, vitest, @testing-library/react, jsdom). `git init`.
- [ ] **T0.2** `brand/tokens.ts` — export the exact Strata tokens from the UX spec (paper `#F4F2EC`, ink `#1A1A2E`, indigo `#2D3A8C`, coral `#F0997B`, positive `#0F6E56`, muted `#6E6C64`, borders, radii, shadows, orb gradient).
- [ ] **T0.3** `brand/fonts.css` self-host Be Vietnam Pro (400/500/600/700/800) + Newsreader (500/600); import in `main.tsx`. **No Google Fonts.**
- [ ] **T0.4** Router with Home + Studio routes; global styles (paper bg, box-sizing, scrollbar, `risein`/`orb` keyframes).
- [ ] **Verify:** `npm run dev` renders an empty branded shell; `npm run build` passes.

### M1 — Home
- [ ] **T1.1** `types.ts` — `ArtifactType = 'Doc'|'Deck'|'Sheet'|'Dashboard'|'Report'`; `BuildRequest`, `Artifact`, `SourceOption`, `ModelOption`.
- [ ] **T1.2** `store/useAppStore.ts` (TDD) — composer state (draft, output, source, model), menus, library, build state, toast; selectors. Test reducers.
- [ ] **T1.3** `Orb`, `TopBar` (logo, Library, **Connect data sources**, avatar), `Dropdown` (reusable, a11y: focus + Esc + outside-click).
- [ ] **T1.4** `Composer` — input + output-type / source / **model** dropdowns (GreenNode list) + send. **Add an attach/upload control** (the new grounding mechanism) next to source.
- [ ] **T1.5** `data/templates.ts` + `TemplateGallery` + `TemplateCard` + type tabs; Blank card.
- [ ] **Verify:** Home matches v2 visually; pickers open/select; tabs filter; contrast uses `#6E6C64`.

### M2 — Configure → Build
- [ ] **T2.1** `ConfigureOverlay` — preview pane (per-type mock) + chat-to-tailor (applied chips, quick chips incl. *In Vietnamese*, input) + footer Build button.
- [ ] **T2.2** `BuildOverlay` — orb + staged status + progress; on complete navigate to `/studio/:id`. Build copy reflects **prompt/upload** (not "Pulling data from…") unless a source is selected.
- [ ] **T2.3** `ConnectSourcesOverlay` — list w/ connected / connect / **no-access** states (mock); subtle governance line. (UI only.)
- [ ] **Verify:** template → configure → build → routes to Studio with the built artifact in the store.

### M3 — Generation engine + artifact renderers
- [ ] **T3.1** `generation/engine.ts` — `export interface GenerationEngine { generate(req: BuildRequest): Promise<Artifact> }` + `generateArtifact` facade.
- [ ] **T3.2** (TDD) `generation/mockEngine.ts` — deterministic content per type from brief + template + (parsed upload if any). Tests assert shape per type (Doc sections, Deck slides, Sheet rows/cols, Dashboard tiles+series, Report sections+stats).
- [ ] **T3.3** Five renderers (`DocView`…`ReportView`) + `ArtifactCanvas` switch. Brand-accurate, reuse v2 preview markup.
- [ ] **Verify:** each type renders from a mock `Artifact`; `engine.test.ts` green.

### M4 — Studio
- [ ] **T4.1** `Studio.tsx` — chat-left + canvas-right; loads artifact by id; header (name, model, View/Edit, pager, Shared, ⋯).
- [ ] **T4.2** Canvas = `ArtifactCanvas` + zoom + slide/page filmstrip + pager.
- [ ] **T4.3** Chat: assistant opener ("I've loaded X… tell me what to change — content, layout, colors, data sources"); **follow-up regenerates** via `generateArtifact` and pushes a new **version**; version history + restore.
- [ ] **T4.4** "Make a copy in new chat" + Share (internal stub).
- [ ] **Verify:** open built artifact; ask a follow-up → canvas updates + version added; switch versions.

### M5 — Library, states, polish
- [ ] **T5.1** `store` persists library to localStorage; `Home` "Recent artifacts"; re-open routes to Studio.
- [ ] **T5.2** States: empty library, build error, unsupported/oversized upload, "no artifacts yet".
- [ ] **T5.3** Polish: finish `#8A887F`→`#6E6C64` contrast pass; focus rings on all controls; i18n scaffold wired (EN default).
- [ ] **Verify:** full loop survives reload; `npm run build` clean; a quick a11y pass (keyboard-only) works.

---

## Verification strategy
- **Unit (Vitest):** store reducers, mock generation engine (shape per type), template filtering.
- **Runnable:** `npm run dev` after each milestone; compare against the decoded v2 design.
- **Build gate:** `npm run build` must pass at the end of every milestone.

## Self-review (spec coverage)
- UX spec §4 Home → M1; §5 Configure → M2.1; §6 Build/Studio → M2.2/M4; §7 Connect sources → M2.3 (UI-only, deferred per scope); §8 model picker → M1.4, bilingual/states/a11y → M5; §3 brand/fonts → M0.
- Backlog mapping: ATL-10..14 → M1; ATL-15 upload → M1.4; ATL-20/21/22 → M2–M3; ATL-50..54 → M3 (HTML form); ATL-60..63 → M4; ATL-70/72/73 → M5. Parked items (data/identity) stay UI-only.

## Git
`git init` at scaffold; local commits per task (trunk-based, per kickoff). **No push** unless asked.
