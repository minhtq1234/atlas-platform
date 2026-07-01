from app.attachments import extract_text, chunk_text


def test_extract_md_and_csv():
    assert "Hello" in extract_text(b"# Hello\nworld", "text/markdown", "a.md")
    assert "a,b" in extract_text(b"a,b\n1,2", "text/csv", "a.csv")


def test_chunk_splits_large_text_with_overlap():
    chunks = chunk_text("x" * 2500, size=1000, overlap=150)
    assert len(chunks) == 3
    assert all(len(c) <= 1000 for c in chunks)
