# Attachments as Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Let attached files (MD/TXT/CSV/DOCX/XLSX/PPTX/PDF) feed the agent as context. Phase 1 = extract → store → inject the (capped) text into generation. Phase 2 (gated) = RAG for large docs.

**Architecture:** `services/artifacts` gains an extractor + SQLite store + `/attachments` (upload) and `/attachments/retrieve` (query→passages) endpoints. A BFF `ContextProvider` calls retrieve and fills the existing skills `context` seam; `generate()` uses it. The web composer uploads the file and carries a `docId`. Spec: `docs/superpowers/specs/2026-07-01-attachments-context-design.md`.

**Tech Stack:** Python/FastAPI + python-docx/openpyxl/python-pptx/**pypdf** + SQLite; TS/Fastify + zod; React.

---

## File structure
```
services/artifacts/
  app/attachments.py     # extractors (per format) + chunker + SQLite store + retrieve
  app/main.py            # + POST /attachments (multipart), POST /attachments/retrieve  (MODIFY)
  requirements.txt       # + pypdf  (MODIFY)
  tests/test_attachments.py
services/bff/src/
  context/provider.ts    # ContextProvider (HTTP → artifacts /attachments/retrieve)
  context/provider.test.ts
  config.ts              # + artifactsUrl  (MODIFY)
  prompt.ts              # generateUser takes context[]  (MODIFY)
  generate.ts            # produceContent fills context from uploads  (MODIFY)
  types.ts               # UploadRef.docId?  (MODIFY)
apps/web/src/
  types.ts               # UploadRef docId?/chars?/preview?  (MODIFY)
  components/Composer.tsx # upload file → /api/attachments → chip + docId  (MODIFY)
```

---

## Task 1 — Extractors + chunker (Python, pure functions) — TDD

**Files:** Create `services/artifacts/app/attachments.py`, `services/artifacts/tests/test_attachments.py`; Modify `services/artifacts/requirements.txt` (+`pypdf`).

- [ ] **Step 1: add dep** — append `pypdf>=4.0` to `requirements.txt`; `services/artifacts/.venv/bin/pip install pypdf`.

- [ ] **Step 2: failing test** `tests/test_attachments.py`:
```python
from app.attachments import extract_text, chunk_text

def test_extract_md_and_csv():
    assert "Hello" in extract_text(b"# Hello\nworld", "text/markdown", "a.md")
    assert "a,b" in extract_text(b"a,b\n1,2", "text/csv", "a.csv")

def test_chunk_splits_large_text_with_overlap():
    chunks = chunk_text("x" * 2500, size=1000, overlap=150)
    assert len(chunks) == 3
    assert all(len(c) <= 1000 for c in chunks)
```
Run: `cd services/artifacts && .venv/bin/python -m pytest tests/test_attachments.py -q` → FAIL (module missing).

- [ ] **Step 3: implement `app/attachments.py`** (extractors + chunker):
```python
import csv, io
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation
from pypdf import PdfReader

MAX_UPLOAD_BYTES = 10 * 1024 * 1024

def extract_text(data: bytes, mime: str, name: str) -> str:
    n = name.lower()
    if n.endswith((".md", ".txt")) or mime.startswith("text/"):
        return data.decode("utf-8", "replace")
    if n.endswith(".csv"):
        rows = list(csv.reader(io.StringIO(data.decode("utf-8", "replace"))))
        return "\n".join(", ".join(r) for r in rows)
    if n.endswith(".docx"):
        return "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs if p.text)
    if n.endswith(".xlsx"):
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        out = []
        for ws in wb.worksheets:
            out.append(f"# {ws.title}")
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None]
                if cells:
                    out.append(", ".join(cells))
        return "\n".join(out)
    if n.endswith(".pptx"):
        out = []
        for i, s in enumerate(Presentation(io.BytesIO(data)).slides, 1):
            out.append(f"# Slide {i}")
            for sh in s.shapes:
                if sh.has_text_frame and sh.text_frame.text.strip():
                    out.append(sh.text_frame.text)
        return "\n".join(out)
    if n.endswith(".pdf"):
        return "\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(data)).pages)
    raise ValueError(f"unsupported file type: {name}")

def chunk_text(text: str, size: int = 1000, overlap: int = 150) -> list[str]:
    if len(text) <= size:
        return [text]
    step = max(1, size - overlap)
    return [text[i:i + size] for i in range(0, len(text), step)]
```
- [ ] **Step 4: run → PASS.**
- [ ] **Step 5: commit** `feat(attachments): text extractors (md/csv/docx/xlsx/pptx/pdf) + chunker`.

## Task 2 — SQLite store + `POST /attachments` — TDD

**Files:** Modify `app/attachments.py` (store), `app/main.py` (endpoint); Test `tests/test_attachments.py`.

- [ ] **Step 1: failing test** (via FastAPI TestClient):
```python
from fastapi.testclient import TestClient
from app.main import app

def test_upload_returns_docid_and_preview():
    c = TestClient(app)
    r = c.post("/attachments", files={"file": ("memo.md", b"# Q3\nHeadcount up 18.", "text/markdown")})
    assert r.status_code == 200
    j = r.json()
    assert j["doc_id"] and j["chars"] > 0 and "Q3" in j["preview"]
```
Run → FAIL (no endpoint).

- [ ] **Step 2: implement store in `app/attachments.py`**:
```python
import os, sqlite3, uuid, threading
WHOLE_CAP = 8000
_DB = os.environ.get("ATTACHMENTS_DB", os.path.join(os.path.dirname(__file__), "..", "attachments.db"))
_lock = threading.Lock()

def _conn():
    con = sqlite3.connect(_DB)
    con.execute("CREATE TABLE IF NOT EXISTS attachments(doc_id TEXT PRIMARY KEY, name TEXT, mime TEXT, chars INT, chunk_count INT, created_at REAL)")
    con.execute("CREATE TABLE IF NOT EXISTS chunks(doc_id TEXT, ord INT, text TEXT, embedding BLOB)")
    return con

def store_attachment(data: bytes, mime: str, name: str, now: float) -> dict:
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("file too large")
    text = extract_text(data, mime, name)
    chunks = [text] if len(text) <= WHOLE_CAP else chunk_text(text)
    doc_id = "doc-" + uuid.uuid4().hex[:12]
    with _lock, _conn() as con:
        con.execute("INSERT INTO attachments VALUES (?,?,?,?,?,?)", (doc_id, name, mime, len(text), len(chunks), now))
        con.executemany("INSERT INTO chunks(doc_id, ord, text, embedding) VALUES (?,?,?,NULL)",
                        [(doc_id, i, c) for i, c in enumerate(chunks)])
    return {"doc_id": doc_id, "name": name, "chars": len(text), "chunk_count": len(chunks), "preview": text[:200]}
```
- [ ] **Step 3: endpoint in `app/main.py`** (add imports `from fastapi import UploadFile, File`; `import time`; `from .attachments import store_attachment, retrieve_context`):
```python
@app.post("/attachments")
async def attachments(file: UploadFile = File(...)):
    data = await file.read()
    try:
        return store_attachment(data, file.content_type or "application/octet-stream", file.filename or "file", time.time())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
```
- [ ] **Step 4: run → PASS.**
- [ ] **Step 5: gitignore** — add `attachments.db*` to `services/artifacts/.gitignore`. Commit `feat(attachments): SQLite store + POST /attachments`.

## Task 3 — `POST /attachments/retrieve` (Phase-1: whole text, capped) — TDD

**Files:** Modify `app/attachments.py` (`retrieve_context`), `app/main.py` (endpoint); Test.

- [ ] **Step 1: failing test**:
```python
def test_retrieve_returns_passages_for_docids():
    c = TestClient(app)
    doc = c.post("/attachments", files={"file": ("m.md", b"Alpha beta gamma.", "text/markdown")}).json()["doc_id"]
    r = c.post("/attachments/retrieve", json={"doc_ids": [doc], "query": "beta", "k": 6})
    assert r.status_code == 200
    ps = r.json()["passages"]
    assert ps and ps[0]["name"] == "m.md" and "beta" in ps[0]["text"]
```
- [ ] **Step 2: implement `retrieve_context`** (Phase 1: return each doc's whole text, capped; embeddings ignored):
```python
TOTAL_CAP = 24000
def retrieve_context(doc_ids: list[str], query: str, k: int = 6) -> list[dict]:
    passages, budget = [], TOTAL_CAP
    with _conn() as con:
        for doc_id in doc_ids:
            meta = con.execute("SELECT name FROM attachments WHERE doc_id=?", (doc_id,)).fetchone()
            if not meta:
                continue
            rows = con.execute("SELECT text FROM chunks WHERE doc_id=? ORDER BY ord", (doc_id,)).fetchall()
            text = "\n".join(r[0] for r in rows)[:budget]
            if not text:
                continue
            passages.append({"doc_id": doc_id, "name": meta[0], "text": text})
            budget -= len(text)
            if budget <= 0:
                break
    return passages
```
- [ ] **Step 3: endpoint in `app/main.py`**:
```python
from pydantic import BaseModel
class RetrieveReq(BaseModel):
    doc_ids: list[str]
    query: str = ""
    k: int = 6
@app.post("/attachments/retrieve")
def attachments_retrieve(req: RetrieveReq):
    return {"passages": retrieve_context(req.doc_ids, req.query, req.k)}
```
- [ ] **Step 4: run full python suite → PASS.** `cd services/artifacts && .venv/bin/python -m pytest -q`
- [ ] **Step 5: commit** `feat(attachments): POST /attachments/retrieve (whole-text, capped)`.

## Task 4 — BFF `ContextProvider` — TDD

**Files:** Create `services/bff/src/context/provider.ts`, `services/bff/src/context/provider.test.ts`; Modify `services/bff/src/config.ts`.

- [ ] **Step 1: config** — add to `config` in `config.ts`: `artifactsUrl: process.env.ARTIFACTS_URL ?? 'http://127.0.0.1:8742',`.

- [ ] **Step 2: failing test** `provider.test.ts` (inject a fake fetch):
```ts
import { describe, it, expect, vi } from 'vitest';
import { makeContextProvider } from './provider';

it('maps passages to name-prefixed strings; no-op when no docIds', async () => {
  const fetchFn = vi.fn(async () => ({ ok: true, json: async () => ({ passages: [{ name: 'r.pdf', text: 'hello' }] }) })) as any;
  const p = makeContextProvider('http://x', fetchFn);
  expect(await p.getContext([], 'q')).toEqual([]);
  expect(fetchFn).not.toHaveBeenCalled();
  expect(await p.getContext(['doc-1'], 'q')).toEqual(['[r.pdf] hello']);
});
```
Run: `cd services/bff && npx vitest run src/context` → FAIL.

- [ ] **Step 3: implement `provider.ts`**:
```ts
import { config } from '../config';

export interface ContextProvider { getContext(docIds: string[], query: string): Promise<string[]>; }

export function makeContextProvider(
  artifactsUrl: string = config.artifactsUrl,
  fetchFn: typeof fetch = fetch,
): ContextProvider {
  return {
    async getContext(docIds, query) {
      if (!docIds || docIds.length === 0) return [];
      try {
        const res = await fetchFn(`${artifactsUrl}/attachments/retrieve`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_ids: docIds, query, k: 6 }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { passages?: { name: string; text: string }[] };
        return (data.passages ?? []).map((p) => `[${p.name}] ${p.text}`);
      } catch {
        return []; // attachments are best-effort context — never fail the turn
      }
    },
  };
}
export const contextProvider = makeContextProvider();
```
- [ ] **Step 4: run → PASS.** Commit `feat(context): BFF ContextProvider over artifacts /attachments/retrieve`.

## Task 5 — Wire context into generation — TDD

**Files:** Modify `services/bff/src/types.ts` (UploadRef.docId), `services/bff/src/prompt.ts` (generateUser context), `services/bff/src/generate.ts` (fill context).

- [ ] **Step 1: `types.ts`** — add `docId: z.string().max(200).optional()` to `UploadRef`.

- [ ] **Step 2: `prompt.ts`** — `generateUser` takes optional context and appends it:
```ts
export function generateUser(req: BuildRequest, context: string[] = []): string {
  const lines = [`<brief>${req.brief}</brief>`];
  if (req.sourceKey) lines.push(`<source>${req.sourceKey}</source>`);
  if (req.brief_chips?.length) lines.push(`<constraints>${req.brief_chips.join(', ')}</constraints>`);
  if (context.length) lines.push(`<context>\n${context.join('\n---\n')}\n</context>`);
  else if (req.uploads?.length) lines.push(`<files>${req.uploads.map((u) => u.name).join(', ')}</files>`);
  return lines.join('\n');
}
```
- [ ] **Step 3: `generate.ts`** — in `produceContent`, fetch context from uploads' docIds and pass it:
```ts
import { contextProvider } from './context/provider';
// inside produceContent, before runModel:
const docIds = (req.uploads ?? []).map((u) => u.docId).filter((d): d is string => !!d);
const context = docIds.length ? await contextProvider.getContext(docIds, req.brief) : [];
// then: generateUser(req, context)
```
- [ ] **Step 4: test** `generate` still builds (template path, no docIds) — existing server tests must stay green; add one asserting `generateUser` embeds `<context>` when given passages (unit test in a new `prompt.test.ts`):
```ts
import { generateUser } from './prompt';
it('embeds context passages', () => {
  const u = generateUser({ brief: 'b', type: 'Doc', modelId: 'm' } as any, ['[a.md] hi']);
  expect(u).toContain('<context>'); expect(u).toContain('[a.md] hi');
});
```
- [ ] **Step 5: typecheck + full bff tests → PASS.** Commit `feat(context): inject attachment context into generate`.

## Task 6 — Web upload → docId + chip

**Files:** Modify `apps/web/src/types.ts` (UploadRef), `apps/web/src/components/Composer.tsx`.

- [ ] **Step 1: `types.ts`** — `UploadRef` add `docId?: string; chars?: number; preview?: string;`.
- [ ] **Step 2: `Composer.tsx`** — in `onFiles`, after size check, upload and enrich the chip:
```tsx
const form = new FormData(); form.append('file', f);
const u: UploadRef = { id: `up-${crypto.randomUUID()}`, name: f.name, sizeBytes: f.size, mime: f.type || 'application/octet-stream' };
s.addUpload(u);
try {
  const res = await fetch('/api/attachments', { method: 'POST', body: form });
  if (res.ok) { const d = await res.json(); s.updateUpload(u.id, { docId: d.doc_id, chars: d.chars, preview: d.preview }); }
  else s.showToast(`Couldn't read "${f.name}".`);
} catch { s.showToast('Attachment upload failed.'); }
```
- [ ] **Step 3: store** — add `updateUpload(id, patch)` to `useAppStore` (`uploads: s.uploads.map(u => u.id===id ? {...u, ...patch} : u)`). Chip renders `{u.chars ? `· ${Math.round(u.chars/1000)}k chars` : ''}`.
- [ ] **Step 4: build + tests → PASS.** Commit `feat(web): upload attachments to /api/attachments, carry docId`.

## Task 7 — Live verify + SPEC

- [ ] **Step 1:** Start artifacts + BFF (direct GreenNode) + web. Attach a small `.md`/`.pdf` in the composer → build → confirm the artifact reflects the file's content (not generic). `curl` check: `POST /api/attachments` returns a `doc_id`; `POST /attachments/retrieve` returns passages.
- [ ] **Step 2:** Update `SPEC.md` §3/§8 — attachments now feed context (Phase 1). Commit `docs: SPEC — attachments-as-context (phase 1)`.

---

## Phase 2 — RAG (separate, gated) — outline only
Do **after** an embeddings spike confirms GreenNode `POST /v1/embeddings` works for `baai/bge-m3`:
1. Spike: `curl` the embeddings endpoint; confirm vector output.
2. `attachments.py`: on store, if `chars > WHOLE_CAP`, embed each chunk (`bge-m3`) → `chunks.embedding`. Add `MODEL_BASE_URL`/`MODEL_API_KEY` env to the artifacts service.
3. `retrieve_context`: for large docs, embed `query`, cosine-rank chunks, return top-k; small docs keep whole-text path.
4. Tests: cosine retrieval returns the relevant chunk; small docs unchanged.
Same endpoints/contract — no BFF/web change.

---

## Self-review
- **Spec coverage:** extractor+formats (T1) · store+`/attachments` (T2) · `/attachments/retrieve` whole-text (T3) · `ContextProvider` (T4) · wire into generate + UploadRef.docId (T5) · web upload+chip (T6) · live+docs (T7) · RAG gated (Phase 2). v1 = generate only (revise-attach deferred, per spec).
- **Placeholders:** none — code shown for every code step.
- **Type consistency:** `doc_id` (python/JSON) ↔ `docId` (TS UploadRef); `getContext(docIds, query)` used consistently; `retrieve_context` request `{doc_ids, query, k}` matches provider body.
- **Watch:** artifacts service needs `python-multipart` for `UploadFile` (add to requirements if the FastAPI TestClient errors on multipart); keep `attachments.db` gitignored.
