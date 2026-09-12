"""Align timed lyric words and chord segments into the canonical song model."""

from __future__ import annotations

from dataclasses import asdict

from audio.contracts import AudioAnalysis, ChordSegment, TranscriptWord


class ChartBuilder:
    max_words_per_line = 9
    line_gap_seconds = 1.2

    def build(self, analysis: AudioAnalysis) -> dict:
        word_lines = self._split_lines(analysis.words)
        if not word_lines:
            word_lines = [[]]

        lines = [self._build_line(words) for words in word_lines]
        for chord in analysis.chords:
            line_index = self._line_for_chord(chord, word_lines)
            lines[line_index]["chords"].append(self._anchor(chord, word_lines[line_index]))

        for line in lines:
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
            "sections": [{
                "id": "section-1",
                "type": "section",
                "label": "",
                "lines": lines,
            }],
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
