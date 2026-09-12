"""Lightweight chroma-based chord detection using FFmpeg and NumPy."""

from __future__ import annotations

import subprocess
from pathlib import Path

import numpy as np

from audio.contracts import ChordSegment


class ChordAnalyzer:
    """Detect major/minor triads and return consolidated timed segments."""

    sample_rate = 22050
    frame_seconds = 1.0
    hop_seconds = 0.25
    note_names = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")

    def analyze(self, audio_path: str | Path) -> list[ChordSegment]:
        samples = self._decode(audio_path)
        if samples.size < self.sample_rate // 2:
            return []

        frame_size = int(self.frame_seconds * self.sample_rate)
        hop_size = int(self.hop_seconds * self.sample_rate)
        window = np.hanning(frame_size)
        frequencies = np.fft.rfftfreq(frame_size, 1 / self.sample_rate)
        useful = (frequencies >= 55.0) & (frequencies <= 1760.0)
        pitch_classes = np.mod(np.rint(12 * np.log2(frequencies[useful] / 440.0) + 69), 12).astype(int)

        templates, labels = self._templates()
        observations: list[tuple[float, str, float]] = []
        final_start = max(1, samples.size - frame_size + 1)
        for start in range(0, final_start, hop_size):
            frame = samples[start : start + frame_size]
            if frame.size < frame_size:
                frame = np.pad(frame, (0, frame_size - frame.size))
            spectrum = np.abs(np.fft.rfft(frame * window))
            chroma = np.zeros(12, dtype=float)
            np.add.at(chroma, pitch_classes, np.sqrt(spectrum[useful]))
            total = float(chroma.sum())
            if total <= 1e-8:
                observations.append((start / self.sample_rate, "N", 0.0))
                continue
            chroma /= total
            scores = templates @ chroma
            best = int(np.argmax(scores))
            ordered = np.partition(scores, -2)
            margin = max(0.0, float(ordered[-1] - ordered[-2]))
            confidence = min(1.0, 0.45 + margin * 5.0)
            observations.append((start / self.sample_rate, labels[best], confidence))

        smoothed = self._smooth(observations)
        return self._segments(smoothed, samples.size / self.sample_rate)

    def _decode(self, audio_path: str | Path) -> np.ndarray:
        completed = subprocess.run(
            [
                "ffmpeg", "-v", "error", "-i", str(audio_path), "-vn",
                "-ac", "1", "-ar", str(self.sample_rate), "-f", "f32le", "pipe:1",
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )
        return np.frombuffer(completed.stdout, dtype="<f4").astype(float)

    @staticmethod
    def _templates() -> tuple[np.ndarray, list[str]]:
        templates: list[np.ndarray] = []
        labels: list[str] = []
        names = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
        for root, name in enumerate(names):
            for suffix, intervals in (("", (0, 4, 7)), ("m", (0, 3, 7))):
                template = np.full(12, -0.15, dtype=float)
                template[[(root + interval) % 12 for interval in intervals]] = (1.0, 0.8, 0.7)
                template /= np.linalg.norm(template)
                templates.append(template)
                labels.append(f"{name}{suffix}")
        return np.vstack(templates), labels

    @staticmethod
    def _smooth(observations: list[tuple[float, str, float]]) -> list[tuple[float, str, float]]:
        if len(observations) < 3:
            return observations
        result = list(observations)
        for index in range(1, len(observations) - 1):
            left, current, right = observations[index - 1 : index + 2]
            if left[1] == right[1] != current[1]:
                result[index] = (current[0], left[1], (left[2] + right[2]) / 2)
        return result

    def _segments(self, observations: list[tuple[float, str, float]], duration: float) -> list[ChordSegment]:
        if not observations:
            return []
        segments: list[ChordSegment] = []
        start, symbol = observations[0][0], observations[0][1]
        confidences = [observations[0][2]]
        for timestamp, next_symbol, confidence in observations[1:]:
            if next_symbol == symbol:
                confidences.append(confidence)
                continue
            if symbol != "N" and timestamp - start >= self.hop_seconds * 2:
                segments.append(ChordSegment(symbol, start, timestamp, float(np.mean(confidences))))
            start, symbol, confidences = timestamp, next_symbol, [confidence]
        if symbol != "N" and duration - start >= self.hop_seconds * 2:
            segments.append(ChordSegment(symbol, start, duration, float(np.mean(confidences))))
        return segments
