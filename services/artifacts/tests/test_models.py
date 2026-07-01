from app.models import DocContent


def test_doc_accepts_sections():
    d = DocContent.model_validate({
        "kind": "Doc", "eyebrow": "E", "title": "T", "meta": "m",
        "sections": [{"heading": "Purpose", "blocks": [
            {"type": "paragraph", "text": "why"},
            {"type": "table", "columns": ["ID", "Req"], "rows": [["FR-1", "Login"]]},
        ]}],
    })
    assert d.sections and d.sections[0].heading == "Purpose"


def test_doc_still_accepts_flat():
    d = DocContent.model_validate({"kind": "Doc", "eyebrow": "E", "title": "T", "meta": "m", "paragraphs": ["p"]})
    assert d.paragraphs == ["p"]
