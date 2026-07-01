"""Attachments-as-context: extract text from uploaded files, chunk it, store it,
and serve relevant passages so the agent can use file content when generating.

Phase 1: extract -> store (SQLite) -> return whole (capped) text on retrieve.
Phase 2 (gated, not implemented here): embeddings + RAG for large docs. The
`chunks.embedding` column exists but stays NULL in Phase 1.
"""
import csv
import io

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
