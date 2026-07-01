import time

from app.exemplars import store_exemplar, retrieve_exemplar


def test_store_then_retrieve_by_tag():
    tag = "t1-doc"
    store_exemplar(tag, "Gold Doc", "A well-structured example.", time.time())
    ex = retrieve_exemplar([tag])
    assert ex and ex["tag"] == tag and "well-structured" in ex["text"]


def test_retrieve_honors_tag_priority_order():
    now = time.time()
    store_exemplar("t2-doc", "Type-level", "type body", now)
    store_exemplar("t2-brd", "Archetype-level", "archetype body", now)
    # archetype tag first → wins even though both match
    ex = retrieve_exemplar(["t2-brd", "t2-doc"])
    assert ex and ex["tag"] == "t2-brd"
    # falls through to the type tag when the archetype tag has nothing
    ex2 = retrieve_exemplar(["t2-missing", "t2-doc"])
    assert ex2 and ex2["tag"] == "t2-doc"


def test_retrieve_returns_none_when_no_match():
    assert retrieve_exemplar(["t3-nope"]) is None
    assert retrieve_exemplar([]) is None


def test_retrieve_picks_most_recent_for_a_tag():
    store_exemplar("t4-doc", "old", "old body", 1000.0)
    store_exemplar("t4-doc", "new", "new body", 2000.0)
    ex = retrieve_exemplar(["t4-doc"])
    assert ex and ex["title"] == "new"


from fastapi.testclient import TestClient
from app.main import app


def test_upload_exemplar_and_retrieve_via_api():
    c = TestClient(app)
    r = c.post(
        "/exemplars",
        files={"file": ("gold.md", b"# Gold\nA clear, well-sectioned brief.", "text/markdown")},
        data={"tag": "api-doc", "title": "Gold Brief"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["tag"] == "api-doc" and j["chars"] > 0

    r2 = c.post("/exemplars/retrieve", json={"tags": ["api-doc"]})
    assert r2.status_code == 200
    ex = r2.json()["exemplar"]
    assert ex and "well-sectioned" in ex["text"]


def test_retrieve_api_returns_null_when_no_match():
    c = TestClient(app)
    r = c.post("/exemplars/retrieve", json={"tags": ["api-nope"]})
    assert r.status_code == 200
    assert r.json()["exemplar"] is None


def test_upload_exemplar_rejects_unsupported_type():
    c = TestClient(app)
    r = c.post(
        "/exemplars",
        files={"file": ("x.bin", b"\x00\x01", "application/octet-stream")},
        data={"tag": "api-doc"},
    )
    assert r.status_code == 422
