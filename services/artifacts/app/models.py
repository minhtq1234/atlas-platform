"""Pydantic models mirroring the web app's ArtifactContent (src/types.ts)."""
from typing import Any, Literal, Union
from pydantic import BaseModel, Field


class Bar(BaseModel):
    label: str
    value: float  # 0..1


class Callout(BaseModel):
    value: str
    label: str


class TableBlock(BaseModel):
    type: Literal["table"]
    columns: list[str]
    rows: list[list[str]]

class TextBlock(BaseModel):
    type: Literal["paragraph"]
    text: str

class ListBlock(BaseModel):
    type: Literal["bullets", "numbers"]
    items: list[str]

class CalloutBlock(BaseModel):
    type: Literal["callout"]
    value: str
    label: str

class BarsBlock(BaseModel):
    type: Literal["bars"]
    label: str | None = None
    bars: list[Bar]

Block = Union[TextBlock, ListBlock, TableBlock, CalloutBlock, BarsBlock]

class Section(BaseModel):
    heading: str
    blocks: list[Block]

class DocContent(BaseModel):
    kind: Literal["Doc"]
    eyebrow: str
    title: str
    meta: str
    paragraphs: list[str] | None = Field(default=None, max_length=200)
    sections: list[Section] | None = Field(default=None, max_length=30)
    bars: list[Bar] | None = Field(default=None, max_length=50)
    barsLayout: Literal["vertical", "horizontal"] | None = None
    callout: Callout | None = None


class Slide(BaseModel):
    title: str
    bullets: list[str] | None = Field(default=None, max_length=30)
    isCover: bool | None = None
    subtitle: str | None = None


class DeckContent(BaseModel):
    kind: Literal["Deck"]
    eyebrow: str
    title: str
    subtitle: str
    slides: list[Slide] = Field(max_length=100)


class SheetContent(BaseModel):
    kind: Literal["Sheet"]
    title: str
    # min_length=1 rejects a zero-column sheet with a clean 422 (was a 500 crash).
    columns: list[str] = Field(min_length=1, max_length=50)
    rows: list[list[Any]] = Field(default_factory=list, max_length=5000)


class Tile(BaseModel):
    label: str
    value: str
    delta: str | None = None


class Series(BaseModel):
    label: str
    bars: list[float] = Field(max_length=1000)


class DashboardContent(BaseModel):
    kind: Literal["Dashboard"]
    title: str
    subtitle: str
    tiles: list[Tile] = Field(max_length=24)
    series: Series


class Stat(BaseModel):
    value: str
    label: str


class ReportContent(BaseModel):
    kind: Literal["Report"]
    eyebrow: str
    title: str
    asOf: str
    stats: list[Stat] = Field(max_length=24)
    paragraphs: list[str] = Field(max_length=200)


ArtifactContent = Union[
    DocContent, DeckContent, SheetContent, DashboardContent, ReportContent
]


class ExportRequest(BaseModel):
    name: str
    content: ArtifactContent = Field(discriminator="kind")
