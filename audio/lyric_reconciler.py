"""Align authoritative lyric text with machine-transcribed word timing."""

from __future__ import annotations

import re
from difflib import SequenceMatcher

from audio.contracts import TimedLyricLine, TimedLyricWord, TranscriptWord


class LyricReconciler:
    token_pattern = re.compile(r"\S+")

    def reconcile(self, authoritative_text: str, transcript_words: list[TranscriptWord]) -> list[TimedLyricLine]:
        if not authoritative_text.strip():
            return []

        raw_lines = authoritative_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        tokens: list[tuple[int, str, int]] = []
        for line_index, line in enumerate(raw_lines):
            tokens.extend((line_index, match.group(), match.start()) for match in self.token_pattern.finditer(line))

        authoritative = [self._normalize(item[1]) for item in tokens]
        machine = [self._normalize(word.text) for word in transcript_words]
        timing: list[tuple[float, float, float] | None] = [None] * len(tokens)

        matcher = SequenceMatcher(a=authoritative, b=machine, autojunk=False)
        for tag, a_start, a_end, b_start, b_end in matcher.get_opcodes():
            if tag == "equal":
                for offset in range(a_end - a_start):
                    word = transcript_words[b_start + offset]
                    timing[a_start + offset] = (word.start, word.end, 1.0)
            elif tag == "replace" and b_end > b_start:
                target_count = a_end - a_start
                span_start = transcript_words[b_start].start
                span_end = transcript_words[b_end - 1].end
                slot = max(0.0, span_end - span_start) / max(1, target_count)
                for offset in range(target_count):
                    source_index = b_start + min(b_end - b_start - 1, int(offset * (b_end - b_start) / max(1, target_count)))
                    word = transcript_words[source_index]
                    similarity = SequenceMatcher(None, authoritative[a_start + offset], machine[source_index]).ratio()
                    start = span_start + slot * offset
                    timing[a_start + offset] = (start, start + slot, max(0.2, similarity * 0.65))

        self._interpolate(timing, max((word.end for word in transcript_words), default=0.0))
        words_by_line: list[list[TimedLyricWord]] = [[] for _ in raw_lines]
        for index, (line_index, text, character_offset) in enumerate(tokens):
            start, end, confidence = timing[index] or (0.0, 0.0, 0.0)
            words_by_line[line_index].append(TimedLyricWord(text, character_offset, start, end, confidence))

        lines: list[TimedLyricLine] = []
        for text, words in zip(raw_lines, words_by_line):
            confidence = sum(word.confidence for word in words) / len(words) if words else 1.0
            lines.append(TimedLyricLine(
                text=text,
                start=words[0].start if words else None,
                end=words[-1].end if words else None,
                confidence=confidence,
                words=words,
            ))
        return lines

    @staticmethod
    def _normalize(token: str) -> str:
        return "".join(character for character in token.casefold() if character.isalnum() or character == "'")

    @staticmethod
    def _interpolate(timing: list[tuple[float, float, float] | None], max_time: float) -> None:
        for index, value in enumerate(timing):
            if value is not None:
                continue
            previous = next((position for position in range(index - 1, -1, -1) if timing[position] is not None), None)
            following = next((position for position in range(index + 1, len(timing)) if timing[position] is not None), None)
            if previous is not None and following is not None:
                previous_end = timing[previous][1]  # type: ignore[index]
                following_start = timing[following][0]  # type: ignore[index]
                slots = following - previous
                start = previous_end + (following_start - previous_end) * ((index - previous - 1) / slots)
                end = previous_end + (following_start - previous_end) * ((index - previous) / slots)
            elif previous is not None:
                start = min(max_time, timing[previous][1] + 0.3 * (index - previous - 1))  # type: ignore[index]
                end = min(max_time, start + 0.3)
            elif following is not None:
                distance = following - index
                end = max(0.0, timing[following][0] - 0.05 - 0.3 * (distance - 1))  # type: ignore[index]
                start = max(0.0, end - 0.25)
            else:
                start = index * 0.3
                end = start + 0.3
            timing[index] = (start, max(start, end), 0.2)
