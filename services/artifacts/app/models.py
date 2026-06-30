"""Pydantic models mirroring the web app's ArtifactContent (src/types.ts)."""
from typing import Any, Literal, Union
from pydantic import BaseModel, Field


class Bar(BaseModel):
    label: str
    value: float  # 0..1


class Callout(BaseModel):
    value: str
    label: str


class DocContent(BaseModel):
    kind: Literal["Doc"]
    eyebrow: str
    title: str
    meta: str
    paragraphs: list[str]
    bars: list[Bar] | None = None
    callout: Callout | None = None


class Slide(BaseModel):
    title: str
    bullets: list[str] | None = None
    isCover: bool | None = None
    subtitle: str | None = None


class DeckContent(BaseModel):
    kind: Literal["Deck"]
    eyebrow: str
    title: str
    subtitle: str
    slides: list[Slide]


class SheetContent(BaseModel):
    kind: Literal["Sheet"]
    title: str
    columns: list[str]
    rows: list[list[Any]]


class Tile(BaseModel):
    label: str
    value: str
    delta: str | None = None


class Series(BaseModel):
    label: str
    bars: list[float]


class DashboardContent(BaseModel):
    kind: Literal["Dashboard"]
    title: str
    subtitle: str
    tiles: list[Tile]
    series: Series


class Stat(BaseModel):
    value: str
    label: str


class ReportContent(BaseModel):
    kind: Literal["Report"]
    eyebrow: str
    title: str
    asOf: str
    stats: list[Stat]
    paragraphs: list[str]


ArtifactContent = Union[
    DocContent, DeckContent, SheetContent, DashboardContent, ReportContent
]


class ExportRequest(BaseModel):
    name: str
    content: ArtifactContent = Field(discriminator="kind")
