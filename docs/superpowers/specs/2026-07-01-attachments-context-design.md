# Design — Attachments as Context (`parse_file` / RAG)

**Date:** 2026-07-01 · **Status:** approved design (pre-implementation) · **Owner:** Atlas
**Context:** SPEC.md; the skill runtime's `context?: string[]` seam (`services/bff/src/skills/`); `services/artifacts` (already has python-docx/openpyxl/python-pptx). Related: `2026-07-01-agent-skills-design.md` (§7 — tool-calling spike PASSED, so this extractor also becomes a `parse_file` tool later).

## 1. Goal & scope
Let users attach files (MD/TXT/CSV, DOCX/XLSX/PPTX, PDF) and have the agent **use their content** when generating/revising artifacts. Today uploads are metadata-only; this fills the existing `context` seam with real, relevant file text.

**Decisions (locked in brainstorm):**
- One **extractor**, exposed as **context-injection now**; the same function becomes a `parse_file` **tool** when the multi-step agent lands (no rework).
- Formats: MD/TXT/CSV + DOCX/XLSX/PPTX + **PDF (born-digital text)**. Images/OCR/scanned = out.
- **Hybrid retrieval, built in phases:** small file → inject whole; large file → RAG (chunk + `bge-m3` embed + cosine top-k). One `ContextProvider` interface.
- Store: **local SQLite in `services/artifacts`** (brute-force cosine at pilot scale — no ANN index). AgentBase Memory (Context) = sovereign production upgrade (deferred).

**Non-goals v1:** images/OCR/scanned PDF; cross-document ranking; the `parse_file` *tool* wiring (needs the multi-step loop — seam-ready); AgentBase Memory store; attachments on *revise* (v1 = generate/composer; revise-attach is a fast-follow).

## 2. The seam (unchanged contract)
All output fills the existing `context?: string[]` on `TurnInput`/generate. Downstream (skills, renderers) is untouched — the agent just receives relevant, name-prefixed file text (e.g. `"[report.pdf] …passage…"`). User file content is **untrusted data** — it's already wrapped in `<context>` tags by the prompt's injection note.

## 3. Extraction + store — `services/artifacts` (Python)
New module `app/attachments.py` + SQLite (`attachments.db`, path via env, gitignored):
```
attachments(doc_id TEXT PK, name, mime, chars INT, chunk_count INT, created_at)
chunks(doc_id TEXT, ord INT, text TEXT, embedding BLOB NULL)   -- embedding NULL for small/whole docs
```
Endpoints (reached from web via the existing `/api` proxy):
- **`POST /attachments`** (multipart) → extract text by format → if `chars <= WHOLE_CAP` store one whole chunk (no embedding); else split into ~1000-char chunks (~150 overlap), embed each (Phase 2). Returns `{ doc_id, name, chars, chunk_count, preview }` (preview = first ~200 chars).
- **`POST /attachments/retrieve`** `{ doc_ids[], query, k=6 }` → for each doc: whole doc → return its text (capped); large doc → embed `query`, cosine-rank its chunks, return top-k. Response `{ passages: [{ doc_id, name, text, score? }] }`.
Extractors: MD/TXT/CSV = decode; DOCX = python-docx paragraphs; XLSX = openpyxl rows→CSV-ish; PPTX = python-pptx slide text; PDF = `pypdf` page text (new dep). Malformed/oversized → `422`. Max upload size enforced (e.g. 10 MB) + `chars` hard cap.

## 4. Retrieval + threshold (hybrid)
`WHOLE_CAP` (~8k chars): at/below → stored + returned whole; above → chunk+embed+cosine. Total context returned is capped (~24k chars across passages) and truncation is flagged in the `preview`/response so it's never silently lossy. Pilot scale = brute-force cosine over one doc's chunks (fast; no index).

## 5. Web upload flow
- On 📎 attach (`Composer.tsx`): `POST /api/attachments` with the file → `{ doc_id, name, chars, preview }`. Show a real chip: `📎 report.pdf · 12k chars`. On oversize/parse error → toast.
- `UploadRef` gains `docId?`, `chars?`, `preview?`; `BuildRequest.uploads` carries `{ docId, name }` (not raw text). Retrieval is **server-side at turn time** (the query — brief/message — only exists then).

## 6. Wiring — BFF `ContextProvider`
New unit `services/bff/src/context/provider.ts`:
```ts
export interface ContextProvider { getContext(docIds: string[], query: string): Promise<string[]>; }
```
- HTTP impl calls `services/artifacts` `/attachments/retrieve`, maps passages → `["[name] text", …]`.
- **v1:** wired in `generate()` (query = brief, docIds from the composer) to fill `context`. The skills `runTurn()` seam stays ready and lights up with the revise-attach fast-follow (query = user message; docIds = the artifact's stored source attachments).
- A no-op provider when there are no `docIds` (zero overhead for attachment-free turns).
- This same retrieval is what registers as the `parse_file`/`read_attachment` **tool** for the future agent loop.

## 7. Phasing
- **Phase 1 — ships the feature (no embeddings):** extractors + `/attachments` (whole store) + `/attachments/retrieve` (returns capped whole text) + web upload chip + `ContextProvider` + wiring into `generate()`. Attachments work end-to-end for reasonably-sized files.
- **Phase 2 — RAG for large docs:** chunk + `bge-m3` embed at upload, cosine top-k at retrieve. **Gate:** a spike confirming GreenNode exposes an **embeddings endpoint** for `bge-m3` (`POST /v1/embeddings`, model `baai/bge-m3`) — same style as the tool-calling spike. Artifacts service gets `MODEL_BASE_URL`/`MODEL_API_KEY` env to call it. Behind the same endpoints — no web/BFF change.

## 8. Testing
- Python: one extractor test per format (fixtures incl. a tiny PDF/DOCX/XLSX/PPTX), chunker, retrieve (small→whole, large→top-k after Phase 2), size caps, malformed→422.
- BFF: `ContextProvider` (maps passages; no-op when empty) with a faked artifacts endpoint.
- Web: upload chip renders `{chars}`; `BuildRequest` carries `docId`; oversize→toast.
- Live: attach a real doc → generate references its content; (Phase 2) attach a large doc → retrieval pulls the relevant section.

## 9. Risks & mitigations
- **`bge-m3` embeddings endpoint may differ / not be exposed** → Phase-2 spike gates it; Phase 1 ships without embeddings regardless.
- **Extraction fidelity** (messy PDFs/xlsx) → cap + preview; "text only" expectation set in UI copy.
- **Store growth** → attachments are pruned by age/session (simple TTL); pilot volume is small.
- **Trust** — uploaded content is user data, not governed FDL; kept as `<context>` (injection-safe), never elevated to instructions.

## 10. Open questions
- Attachment lifetime/retention (per-session vs persistent + TTL)? (Lean: persistent with an age-based prune; revisit with the broader retention decision D4.)
- Revise-time attach UI (bring a new file mid-conversation) — fast-follow after v1.
