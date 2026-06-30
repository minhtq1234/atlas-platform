"""Atlas artifact export service — turns governed artifact content into real Office files."""
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from .docx_builder import build_doc
from .pptx_builder import build_deck
from .models import ExportRequest
from .xlsx_builder import build_sheet

app = FastAPI(title="Atlas Artifacts", version="1.0.0")

# Dev origins. In prod this is fronted by the BFF inside the sovereign network.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

MIME = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

# Which artifact kinds export to which Office format.
KIND_EXT = {"Doc": "docx", "Sheet": "xlsx", "Deck": "pptx"}


def _filename(name: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "-", name).strip("-") or "artifact"
    return f"{base[:60]}.{ext}"


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/export")
def export(req: ExportRequest):
    kind = req.content.kind
    ext = KIND_EXT.get(kind)
    if not ext:
        raise HTTPException(
            status_code=415,
            detail=f"{kind} exports as HTML (handled client-side), not an Office file.",
        )

    if kind == "Doc":
        data = build_doc(req.content, req.name)
    elif kind == "Sheet":
        data = build_sheet(req.content, req.name)
    else:  # Deck
        data = build_deck(req.content, req.name)

    return Response(
        content=data,
        media_type=MIME[ext],
        headers={"Content-Disposition": f'attachment; filename="{_filename(req.name, ext)}"'},
    )
