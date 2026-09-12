"""Shared typed contracts for audio analysis and chart alignment."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class TranscriptWord:
    text: str
    start: float
    end: float
    confidence: float | None = None


@dataclass(frozen=True)
class ChordSegment:
    symbol: str
    start: float
    end: float
    confidence: float


@dataclass(frozen=True)
class TimedLyricWord:
    text: str
    character_offset: int
    start: float
    end: float
    confidence: float


@dataclass(frozen=True)
class TimedLyricLine:
    text: str
    start: float | None
    end: float | None
    confidence: float
    words: list[TimedLyricWord] = field(default_factory=list)


@dataclass
class AudioAnalysis:
    title: str
    duration: float
    key: str
    tempo: float | None = None
    words: list[TranscriptWord] = field(default_factory=list)
    chords: list[ChordSegment] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
