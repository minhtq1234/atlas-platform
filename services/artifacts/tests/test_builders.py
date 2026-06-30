import io

from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

from app.docx_builder import build_doc
from app.models import DeckContent, DocContent, SheetContent
from app.pptx_builder import build_deck
from app.xlsx_builder import build_sheet

OOXML_MAGIC = b"PK\x03\x04"


def test_doc_is_valid_docx_with_title_and_paragraphs():
    c = DocContent(
        kind="Doc", eyebrow="MEMO · HR", title="Q2 Headcount Review",
        meta="30 June 2026", paragraphs=["First para.", "Second para."],
        bars=[{"label": "Apr", "value": 0.5}], callout={"value": "+18", "label": "NET"},
    )
    data = build_doc(c, "Headcount Memo")
    assert data[:4] == OOXML_MAGIC
    doc = Document(io.BytesIO(data))
    texts = "\n".join(p.text for p in doc.paragraphs)
    assert "Q2 Headcount Review" in texts
    assert "First para." in texts


def test_sheet_is_valid_xlsx_with_live_sum_formula():
    c = SheetContent(
        kind="Sheet", title="Headcount Model", columns=["Org unit", "Net", "EoP"],
        rows=[["TSE", "+18", 342], ["Platform", "+11", 208], ["Total", "+29", 550]],
    )
    data = build_sheet(c, "Headcount Model")
    assert data[:4] == OOXML_MAGIC
    wb = load_workbook(io.BytesIO(data))
    ws = wb.active
    assert ws["A2"].value == "Org unit"
    # a real SUM formula must exist somewhere in the last column
    formulas = [cell.value for row in ws.iter_rows() for cell in row
                if isinstance(cell.value, str) and cell.value.startswith("=SUM")]
    assert formulas, "expected a live =SUM formula"


def test_deck_is_valid_pptx_with_one_slide_per_input():
    c = DeckContent(
        kind="Deck", eyebrow="ATLAS · BOARD DECK", title="Q2 People Review",
        subtitle="Headcount & hiring",
        slides=[
            {"isCover": True, "title": "Q2 People Review", "subtitle": "Headcount & hiring"},
            {"title": "Headcount", "bullets": ["1,248 total", "+18 net"]},
        ],
    )
    data = build_deck(c, "People Review")
    assert data[:4] == OOXML_MAGIC
    prs = Presentation(io.BytesIO(data))
    assert len(prs.slides) == 2
    all_text = " ".join(
        run.text
        for slide in prs.slides
        for shape in slide.shapes
        if shape.has_text_frame
        for para in shape.text_frame.paragraphs
        for run in para.runs
    )
    assert "Q2 People Review" in all_text
    assert "1,248 total" in all_text
