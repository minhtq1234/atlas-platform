# Atlas Web

The Atlas Smart Artifact generator — AI-native web app. Phase 1: the full product loop runs client-side against a **mock generation engine**; GreenNode models, Python artifact services, real data sources, and SSO swap in later behind the existing interfaces.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest (19 tests)
npm run build      # type-check + production build
```

## Flow

Home → composer (output type · data source · **GreenNode model** · attach) **or** pick a template → Configure (live preview + chat-to-tailor) → Build → **Studio** (chat-left + canvas-right; follow-ups regenerate into new versions) → saved to a localStorage-backed Library.

## What's real vs stubbed (Phase 1)

| Real | Stubbed behind an interface |
|---|---|
| Product loop, brand, 5 artifact renderers (HTML), Studio, library | Generation (`src/generation/engine.ts` → mock), GreenNode models (static list), data sources (UI only), SSO (stub user), file export |

## Swapping in real generation

`src/generation/engine.ts` exposes `GenerationEngine` and `setEngine()`. Provide a GreenNode-model-backed implementation of `generate()` / `revise()` and call `setEngine(realEngine)` at startup — no UI changes needed.

## Key paths

- `src/brand/tokens.ts` — Strata design tokens (single source of truth)
- `src/store/useAppStore.ts` — Zustand store (composer, build, library)
- `src/generation/` — engine interface + mock
- `src/artifacts/renderers/` — Doc/Deck/Sheet/Dashboard/Report views
- `src/pages/` — Home, Studio

Fonts (Be Vietnam Pro, Newsreader) are **self-hosted** via `@fontsource` — no runtime CDN (sovereignty).
