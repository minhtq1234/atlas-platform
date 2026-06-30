"""Strata brand constants for Office documents (mirrors src/brand/tokens.ts)."""
from docx.shared import RGBColor as DocxRGB
from pptx.dml.color import RGBColor as PptxRGB


# hex (no #)
INK = "1A1A2E"
INDIGO = "2D3A8C"
CORAL = "F0997B"
POSITIVE = "0F6E56"
MUTED = "6E6C64"
PAPER = "F4F2EC"
WHITE = "FFFFFF"
BORDER = "E3E1DA"

UI_FONT = "Be Vietnam Pro"
SERIF_FONT = "Newsreader"


def docx_rgb(hex6: str) -> DocxRGB:
    return DocxRGB.from_string(hex6)


def pptx_rgb(hex6: str) -> PptxRGB:
    return PptxRGB.from_string(hex6)
