from fastapi.testclient import TestClient

from app.attachments import extract_text, chunk_text
from app.main import app


def test_extract_md_and_csv():
    assert "Hello" in extract_text(b"# Hello\nworld", "text/markdown", "a.md")
    assert "a,b" in extract_text(b"a,b\n1,2", "text/csv", "a.csv")


def test_chunk_splits_large_text_with_overlap():
    chunks = chunk_text("x" * 2500, size=1000, overlap=150)
    assert len(chunks) == 3
    assert all(len(c) <= 1000 for c in chunks)


def test_upload_returns_docid_and_preview():
    c = TestClient(app)
    r = c.post("/attachments", files={"file": ("memo.md", b"# Q3\nHeadcount up 18.", "text/markdown")})
    assert r.status_code == 200
    j = r.json()
    assert j["doc_id"] and j["chars"] > 0 and "Q3" in j["preview"]
