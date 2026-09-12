"""Align timed lyric words and chord segments into the canonical song model."""

from __future__ import annotations

import re
from dataclasses import asdict

from audio.contracts import AudioAnalysis, ChordSegment, TimedLyricLine, TranscriptWord
from audio.lyric_reconciler import LyricReconciler


class ChartBuilder:
    max_words_per_line = 9
    line_gap_seconds = 1.2
    section_pattern = re.compile(
        r"^\[?(verse|chorus|bridge|pre-chorus|intro|outro|instrumental)(?:\s+\d+)?\]?:?$",
        re.IGNORECASE,
    )

    def build(self, analysis: AudioAnalysis, authoritative_lyrics: str = "") -> dict:
        if authoritative_lyrics.strip():
            sections, timed_targets = self._authoritative_sections(authoritative_lyrics, analysis.words)
            if not timed_targets:
                empty_line = self._build_authoritative_line(TimedLyricLine("", None, None, 0.0))
                sections[-1]["lines"].append(empty_line)
                timed_targets.append((TimedLyricLine("", None, None, 0.0), empty_line))
            for chord in analysis.chords:
                line_index = self._authoritative_line_for_chord(chord, [target[0] for target in timed_targets])
                timed_line, output_line = timed_targets[line_index]
                output_line["chords"].append(self._authoritative_anchor(chord, timed_line))
        else:
            word_lines = self._split_lines(analysis.words) or [[]]
            lines = [self._build_line(words) for words in word_lines]
            for chord in analysis.chords:
                line_index = self._line_for_chord(chord, word_lines)
                lines[line_index]["chords"].append(self._anchor(chord, word_lines[line_index]))
            sections = [{"id": "section-1", "type": "section", "label": "", "lines": lines}]

        for section in sections:
            for line in section["lines"]:
                line["chords"].sort(key=lambda item: (item["characterOffset"], item["timestamp"]))

        confidences = [chord.confidence for chord in analysis.chords]
        return {
            "title": analysis.title or "Imported Recording",
            "artist": "",
            "originalKey": analysis.key or "C",
            "currentKey": analysis.key or "C",
            "transposition": 0,
            "tempo": analysis.tempo,
            "timeSignature": "",
            "sourceType": "audio",
            "keyConfidence": sum(confidences) / len(confidences) if confidences else None,
            "sections": sections,
            "source": {"duration": analysis.duration},
            "chords": [asdict(chord) for chord in analysis.chords],
            "textItems": [],
        }

    def _split_lines(self, words: list[TranscriptWord]) -> list[list[TranscriptWord]]:
        lines: list[list[TranscriptWord]] = []
        current: list[TranscriptWord] = []
        for word in words:
            gap = word.start - current[-1].end if current else 0
            if current and (gap >= self.line_gap_seconds or len(current) >= self.max_words_per_line):
                lines.append(current)
                current = []
            current.append(word)
            if word.text.rstrip().endswith((".", "?", "!")):
                lines.append(current)
                current = []
        if current:
            lines.append(current)
        return lines

    @staticmethod
    def _build_line(words: list[TranscriptWord]) -> dict:
        return {
            "lyrics": " ".join(word.text for word in words),
            "chords": [],
            "startTime": words[0].start if words else None,
            "endTime": words[-1].end if words else None,
        }

    @staticmethod
    def _build_authoritative_line(line: TimedLyricLine) -> dict:
        return {
            "lyrics": line.text,
            "chords": [],
            "startTime": line.start,
            "endTime": line.end,
            "lyricConfidence": line.confidence,
            "timedWords": [asdict(word) for word in line.words],
        }

    def _authoritative_sections(
        self, authoritative_lyrics: str, transcript_words: list[TranscriptWord]
    ) -> tuple[list[dict], list[tuple[TimedLyricLine, dict]]]:
        raw_lines = authoritative_lyrics.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        headings = {index: self.section_pattern.match(line.strip()) for index, line in enumerate(raw_lines)}
        alignment_text = "\n".join("" if headings[index] else line for index, line in enumerate(raw_lines))
        timed_lines = LyricReconciler().reconcile(alignment_text, transcript_words)
        if not timed_lines:
            timed_lines = [TimedLyricLine("", None, None, 1.0) for _ in raw_lines]

        sections: list[dict] = []
        current = {"id": "section-1", "type": "section", "label": "", "lines": []}
        targets: list[tuple[TimedLyricLine, dict]] = []
        for index, timed_line in enumerate(timed_lines):
            heading = headings[index]
            if heading:
                if current["lines"] or current["label"]:
                    sections.append(current)
                current = {
                    "id": f"section-{len(sections) + 1}",
                    "type": heading.group(1).lower(),
                    "label": raw_lines[index].strip(),
                    "lines": [],
                }
                continue
            output_line = self._build_authoritative_line(timed_line)
            current["lines"].append(output_line)
            if timed_line.words:
                targets.append((timed_line, output_line))
        if current["lines"] or current["label"]:
            sections.append(current)
        if not sections:
            sections = [{"id": "section-1", "type": "section", "label": "", "lines": []}]
        return sections, targets

    @staticmethod
    def _authoritative_line_for_chord(chord: ChordSegment, lines: list[TimedLyricLine]) -> int:
        populated = [(index, line) for index, line in enumerate(lines) if line.start is not None and line.end is not None]
        if not populated:
            return 0
        midpoint = (chord.start + chord.end) / 2
        for index, line in populated:
            if line.start <= midpoint <= line.end:  # type: ignore[operator]
                return index
        return min(
            populated,
            key=lambda item: min(abs(midpoint - item[1].start), abs(midpoint - item[1].end)),  # type: ignore[arg-type]
        )[0]

    @staticmethod
    def _authoritative_anchor(chord: ChordSegment, line: TimedLyricLine) -> dict:
        offset = 0
        if line.words:
            nearest = min(line.words, key=lambda word: abs(word.start - chord.start))
            offset = nearest.character_offset
        return {
            "symbol": chord.symbol,
            "characterOffset": offset,
            "timestamp": chord.start,
            "confidence": chord.confidence,
        }

    @staticmethod
    def _line_for_chord(chord: ChordSegment, lines: list[list[TranscriptWord]]) -> int:
        populated = [(index, words) for index, words in enumerate(lines) if words]
        if not populated:
            return 0
        midpoint = (chord.start + chord.end) / 2
        for index, words in populated:
            if words[0].start <= midpoint <= words[-1].end:
                return index
        return min(
            populated,
            key=lambda item: min(abs(midpoint - item[1][0].start), abs(midpoint - item[1][-1].end)),
        )[0]

    @staticmethod
    def _anchor(chord: ChordSegment, words: list[TranscriptWord]) -> dict:
        offset = 0
        if words:
            nearest_index = min(range(len(words)), key=lambda index: abs(words[index].start - chord.start))
            offset = sum(len(word.text) + 1 for word in words[:nearest_index])
        return {
            "symbol": chord.symbol,
            "characterOffset": offset,
            "timestamp": chord.start,
            "confidence": chord.confidence,
        }
