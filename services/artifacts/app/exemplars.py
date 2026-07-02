"""Exemplar library: store curated gold-standard artifacts and serve one as a
few-shot reference during generation. Mirrors attachments.py (SQLite, on-demand
tables). An exemplar is stored under a lookup TAG (an archetype id like 'brd' or a
type key like 'doc'); retrieval tries the caller's tags in priority order and
returns the most recent match, or None."""
import os
import sqlite3
import threading
import uuid

_DB = os.environ.get(
    "EXEMPLARS_DB",
    os.path.join(os.path.dirname(__file__), "..", "exemplars.db"),
)
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    con = sqlite3.connect(_DB)
    con.execute(
        "CREATE TABLE IF NOT EXISTS exemplars("
        "id TEXT PRIMARY KEY, tag TEXT, title TEXT, text TEXT, created_at REAL)"
    )
    return con


def store_exemplar(tag: str, title: str, text: str, now: float) -> dict:
    ex_id = "ex-" + uuid.uuid4().hex[:12]
    with _lock, _conn() as con:
        con.execute(
            "INSERT INTO exemplars VALUES (?,?,?,?,?)",
            (ex_id, tag, title, text, now),
        )
    return {"id": ex_id, "tag": tag, "title": title, "chars": len(text)}


def retrieve_exemplar(tags: list[str]) -> dict | None:
    """Most-recent exemplar whose tag matches, honoring the ORDER of `tags`
    (first tag with any match wins). None if nothing matches."""
    with _conn() as con:
        for tag in tags:
            row = con.execute(
                "SELECT id, tag, title, text FROM exemplars WHERE tag=? "
                "ORDER BY created_at DESC LIMIT 1",
                (tag,),
            ).fetchone()
            if row:
                return {"id": row[0], "tag": row[1], "title": row[2], "text": row[3]}
    return None


def count() -> int:
    with _conn() as con:
        return con.execute("SELECT COUNT(*) FROM exemplars").fetchone()[0]
