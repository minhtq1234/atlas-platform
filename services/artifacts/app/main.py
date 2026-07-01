"""Atlas artifact export service — turns governed artifact content into real Office files."""
import re
import time
from urllib.parse import quote

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from .attachments import retrieve_context, store_attachment
from .exports.registry import EXPORTERS
from .models import ExportRequest

app = FastAPI(title="Atlas Artifacts", version="1.0.0")

# Dev origins. In prod this is fronted by the BFF inside the sovereign network.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


def _filename(name: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-") or "artifact"
    return f"{base[:60]}.{ext}"


def _disposition(name: str, ext: str) -> str:
    """Content-Disposition with an ASCII fallback + RFC 5987 UTF-8 name so
    Vietnamese titles survive. Percent-encoding also neutralizes CRLF/quotes."""
    ascii_name = _filename(name, ext)
    utf8 = quote(f"{name[:80]}.{ext}", safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8}"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/export")
def export(req: ExportRequest):
    entry = EXPORTERS.get(req.content.kind)
    if not entry:
        raise HTTPException(
            status_code=415,
            detail=f"{req.content.kind} exports as HTML (handled client-side), not an Office file.",
        )
    ext, builder = entry
    try:
        data = builder(req.content, req.name)
    except ValueError as e:  # malformed-but-schema-valid input → clean 4xx, not 500
        raise HTTPException(status_code=422, detail=f"Could not build {req.content.kind}: {e}")

    return Response(
        content=data,
        media_type=MIME[ext],
        headers={"Content-Disposition": _disposition(req.name, ext)},
    )


@app.post("/attachments")
async def attachments(file: UploadFile = File(...)):
    data = await file.read()
    try:
        return store_attachment(
            data,
            file.content_type or "application/octet-stream",
            file.filename or "file",
            time.time(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


class RetrieveReq(BaseModel):
    doc_ids: list[str]
    query: str = ""
    k: int = 6


@app.post("/attachments/retrieve")
def attachments_retrieve(req: RetrieveReq):
    return {"passages": retrieve_context(req.doc_ids, req.query, req.k)}
