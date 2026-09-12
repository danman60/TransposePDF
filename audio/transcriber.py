"""Timed lyric transcription through the OpenAI audio API."""

from __future__ import annotations

import json
import mimetypes
import os
import secrets
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from audio.contracts import TranscriptWord


class AudioTranscriber:
    endpoint = "https://api.openai.com/v1/audio/transcriptions"

    def __init__(self, api_key: str | None = None, model: str = "whisper-1") -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or self._read_shared_key()
        self.model = model

    def transcribe(self, audio_path: str | Path) -> tuple[str, list[TranscriptWord]]:
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")

        with tempfile.TemporaryDirectory(prefix="transposepdf-transcribe-") as temp_dir:
            path = Path(temp_dir) / "speech.mp3"
            self._normalize(Path(audio_path), path)
            if path.stat().st_size > 24 * 1024 * 1024:
                raise RuntimeError("Recording is too long to transcribe in one pass (maximum normalized size: 24 MB)")
            return self._request(path)

    def _request(self, path: Path) -> tuple[str, list[TranscriptWord]]:
        boundary = f"----TransposePDF{secrets.token_hex(12)}"
        body = self._multipart_body(path, boundary)
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
        )

        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")[:800]
            raise RuntimeError(f"Transcription request failed ({error.code}): {detail}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"Transcription service unavailable: {error.reason}") from error

        words = [
            TranscriptWord(
                text=str(word.get("word", word.get("text", ""))).strip(),
                start=float(word.get("start", 0)),
                end=float(word.get("end", word.get("start", 0))),
                confidence=float(word["confidence"]) if word.get("confidence") is not None else None,
            )
            for word in payload.get("words", [])
            if str(word.get("word", word.get("text", ""))).strip()
        ]
        return str(payload.get("text", "")).strip(), words

    @staticmethod
    def _normalize(source: Path, destination: Path) -> None:
        subprocess.run(
            [
                "ffmpeg", "-v", "error", "-i", str(source), "-vn", "-ac", "1",
                "-ar", "16000", "-b:a", "48k", "-f", "mp3", str(destination),
            ],
            check=True,
            capture_output=True,
            timeout=300,
        )

    def _multipart_body(self, path: Path, boundary: str) -> bytes:
        fields = [
            ("model", self.model),
            ("response_format", "verbose_json"),
            ("timestamp_granularities[]", "word"),
        ]
        chunks: list[bytes] = []
        for name, value in fields:
            chunks.extend([
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode(),
                b"\r\n",
            ])

        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode(),
            f"Content-Type: {content_type}\r\n\r\n".encode(),
            path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ])
        return b"".join(chunks)

    @staticmethod
    def _read_shared_key() -> str:
        key_file = Path.home() / ".env.keys"
        if not key_file.exists():
            return ""
        for line in key_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
        return ""
