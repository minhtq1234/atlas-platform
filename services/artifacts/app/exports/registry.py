from ..docx_builder import build_doc
from ..xlsx_builder import build_sheet
from ..pptx_builder import build_deck

# kind -> (extension, builder(content, name) -> bytes)
EXPORTERS = {
    "Doc": ("docx", build_doc),
    "Sheet": ("xlsx", build_sheet),
    "Deck": ("pptx", build_deck),
}
