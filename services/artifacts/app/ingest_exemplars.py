"""Ingest exemplar files into the store. Walks <root>/<tag>/* folders, extracts
text via the attachments extractor, and stores each file under its folder-name tag.

Run once after checkout (out-of-the-box seeds + any org docs):
    cd services/artifacts && . .venv/bin/activate && python -m app.ingest_exemplars

Ingests the committed safe seeds (services/artifacts/seeds/exemplars) plus, if
present, the gitignored repo-root exemplars/ folder (the org's real sourced docs —
never committed)."""
import os
import time

from .attachments import extract_text
from .exemplars import store_exemplar

_HERE = os.path.dirname(__file__)
SEEDS_ROOT = os.path.join(_HERE, "..", "seeds", "exemplars")
# repo root is three levels up from app/ (app -> artifacts -> services -> repo)
REPO_EXEMPLARS_ROOT = os.path.join(_HERE, "..", "..", "..", "exemplars")


def ingest_dir(root: str, now: float | None = None) -> int:
    """Store every file under root/<tag>/*; returns the count stored. Unsupported
    file types (extract_text raises ValueError) are skipped."""
    if not os.path.isdir(root):
        return 0
    stamp = time.time() if now is None else now
    count = 0
    for tag in sorted(os.listdir(root)):
        tag_dir = os.path.join(root, tag)
        if not os.path.isdir(tag_dir):
            continue
        for fname in sorted(os.listdir(tag_dir)):
            path = os.path.join(tag_dir, fname)
            if not os.path.isfile(path):
                continue
            with open(path, "rb") as f:
                data = f.read()
            try:
                text = extract_text(data, "", fname)
            except ValueError:
                continue  # skip unsupported file types
            store_exemplar(tag, fname, text, stamp)
            count += 1
    return count


def main() -> None:
    n = ingest_dir(SEEDS_ROOT) + ingest_dir(REPO_EXEMPLARS_ROOT)
    print(f"ingested {n} exemplar(s)")


if __name__ == "__main__":
    main()
