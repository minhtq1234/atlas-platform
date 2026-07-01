# Atlas Artifact Service

Turns artifact content (the web app's `ArtifactContent`) into **real, brand-styled Office files**:
Doc → `.docx`, Sheet → `.xlsx` (with a live `=SUM` formula), Deck → `.pptx`.
Dashboard/Report export as self-contained HTML **client-side** (this service returns `415` for them).

## Run

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --host 127.0.0.1 --port 8742    # see note on port
pytest -q                                            # 3 builder tests
```

> **Port:** 8742, not 8000 — on macOS Docker grabs IPv6 `:8000` and `localhost` resolves there first. The web dev server proxies `/api` → `http://127.0.0.1:8742` (see `apps/web/vite.config.ts`).

## API

`POST /export` — body `{ "name": string, "content": <ArtifactContent> }` → file bytes with `Content-Disposition`. `GET /health` → `{ "ok": true }`.

## Structure

- `app/models.py` — pydantic mirror of the web `ArtifactContent`
- `app/{docx,xlsx,pptx}_builder.py` — one builder per Office format
- `app/brand.py` — Strata colors/fonts
- `app/main.py` — FastAPI app + CORS

This service consumes already-composed content; it never queries data directly (architecture invariant).

**Exposure:** today the web app calls `/export` **directly** via the Vite `/api` proxy (dev) — CORS (pinned origins, `Content-Type` only) is the front-line control, and inputs are bounded (column/row/array caps → `422`, not `500`) and formula-injection-safe (string cells starting with `= + - @` are neutralized). In production this should sit **behind the BFF** inside the sovereign network; that routing isn't wired yet.
