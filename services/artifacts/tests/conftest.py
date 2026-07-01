"""Point the attachments SQLite store at a throwaway temp DB for the whole test
session, so tests never touch the real ./attachments.db. Set before `app.attachments`
is imported (module-level `_DB` reads this env at import time)."""
import os
import tempfile

os.environ.setdefault(
    "ATTACHMENTS_DB",
    os.path.join(tempfile.gettempdir(), "atlas-attachments-test.db"),
)
