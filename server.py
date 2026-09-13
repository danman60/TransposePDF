"""TransposePDF static server and background MP3 analysis API."""

from __future__ import annotations

import json
import subprocess
import tempfile
import threading
import time
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.responses import JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

from audio.chart_builder import ChartBuilder
from audio.chord_analyzer import ChordAnalyzer
from audio.contracts import AudioAnalysis
from audio.transcriber import AudioTranscriber

ROOT = Path(__file__).resolve().parent
MAX_AUDIO_BYTES = 100 * 1024 * 1024
ALLOWED_SUFFIXES = {".mp3", ".wav", ".m4a", ".mp4", ".aac", ".flac", ".ogg"}
JOBS: dict[str, dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()
EXECUTOR = ThreadPoolExecutor(max_workers=2, thread_name_prefix="transpose-audio")
MAX_ACTIVE_JOBS = 4
JOB_TTL_SECONDS = 3600
MAX_LYRICS_CHARACTERS = 500_000
TELEMETRY_ROOT = Path.home() / ".transposepdf" / "telemetry"
TELEMETRY_MAX_BYTES = 20 * 1024 * 1024
TELEMETRY_TTL_SECONDS = 7 * 24 * 3600
TELEMETRY_MAX_REQUEST_BYTES = 512 * 1024
TELEMETRY_MAX_EVENTS = 100
TELEMETRY_ENABLED = __import__("os").environ.get("TRANSPOSEPDF_TELEMETRY", "1") != "0"
TELEMETRY_EVENT_TYPES = {
    "session.started", "screen.changed", "import.started", "import.progress",
    "import.completed", "import.cancelled", "import.failed", "editor.opened",
    "editor.changed", "chord.dragged", "chord.timing_changed", "chart.saved",
    "transpose.changed", "spelling.changed", "export.opened", "export.completed",
    "export.failed", "ui.error", "song.selected", "draft.recovered", "draft.discarded",
}
TELEMETRY_SCREENS = {
    "start", "audio-import", "pdf-import", "author-source", "author-preview",
    "songs", "export", "error",
}


class TelemetryStore:
    """Small, loopback-only semantic event journal and latest-session snapshot."""

    def __init__(self, root: Path = TELEMETRY_ROOT) -> None:
        self.root = root
        self.lock = threading.Lock()
        self.state_path = root / "state.json"
        self.state: dict[str, Any] = {"nextEventId": 1, "sessions": {}}
        self._load()

    def _load(self) -> None:
        try:
            value = json.loads(self.state_path.read_text(encoding="utf-8"))
            if isinstance(value, dict) and isinstance(value.get("sessions"), dict):
                self.state = value
        except (OSError, ValueError):
            pass

    def _save(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        temporary = self.state_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, ensure_ascii=False), encoding="utf-8")
        temporary.replace(self.state_path)

    def _purge(self, now: float) -> None:
        cutoff = now - TELEMETRY_TTL_SECONDS
        if self.root.exists():
            for path in self.root.glob("events-*.jsonl"):
                try:
                    if path.stat().st_mtime < cutoff:
                        path.unlink()
                except OSError:
                    pass
            files = sorted(self.root.glob("events-*.jsonl"), key=lambda item: item.stat().st_mtime)
            total = sum(path.stat().st_size for path in files)
            while files and total > TELEMETRY_MAX_BYTES:
                path = files.pop(0)
                size = path.stat().st_size
                path.unlink(missing_ok=True)
                total -= size
        self.state["sessions"] = {
            key: value for key, value in self.state.get("sessions", {}).items()
            if float(value.get("receivedAtEpoch", now)) >= cutoff
        }

    def append(self, session_id: str, events: list[dict[str, Any]], snapshot: dict[str, Any] | None) -> dict[str, Any]:
        now = time.time()
        received_at = datetime.fromtimestamp(now).astimezone().isoformat()
        with self.lock:
            self._purge(now)
            stored = []
            for event in events:
                event_id = int(self.state.get("nextEventId", 1))
                self.state["nextEventId"] = event_id + 1
                stored.append({**event, "eventId": event_id, "sessionId": session_id, "receivedAt": received_at})
            if stored:
                self.root.mkdir(parents=True, exist_ok=True)
                event_path = self.root / f"events-{datetime.fromtimestamp(now).astimezone():%Y-%m-%d}.jsonl"
                with event_path.open("a", encoding="utf-8") as output:
                    for event in stored:
                        output.write(json.dumps(event, ensure_ascii=False) + "\n")
            current = self.state["sessions"].get(session_id, {})
            revision = int(current.get("snapshotRevision", 0)) + (1 if snapshot is not None else 0)
            if snapshot is not None:
                current = {
                    "sessionId": session_id, "updatedAt": received_at,
                    "receivedAtEpoch": now, "snapshotRevision": revision,
                    "lastEventId": stored[-1]["eventId"] if stored else current.get("lastEventId", 0),
                    "snapshot": snapshot,
                }
                self.state["sessions"][session_id] = current
            elif stored and current:
                current.update(updatedAt=received_at, receivedAtEpoch=now, lastEventId=stored[-1]["eventId"])
            self._save()
            return {"accepted": len(stored), "lastEventId": stored[-1]["eventId"] if stored else None, "snapshotRevision": revision}

    def latest(self, session_id: str | None = None) -> dict[str, Any]:
        with self.lock:
            sessions = self.state.get("sessions", {})
            selected = sessions.get(session_id) if session_id else max(
                sessions.values(), key=lambda item: item.get("receivedAtEpoch", 0), default=None
            )
            summaries = [{key: value for key, value in item.items() if key != "snapshot" and key != "receivedAtEpoch"}
                         for item in sessions.values()]
            return {"activeSessionId": selected.get("sessionId") if selected else None,
                    "sessions": summaries, "snapshot": selected.get("snapshot") if selected else None,
                    "snapshotRevision": selected.get("snapshotRevision", 0) if selected else 0}

    def events(self, session_id: str | None, after: int, limit: int) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        with self.lock:
            for path in sorted(self.root.glob("events-*.jsonl")) if self.root.exists() else []:
                try:
                    for line in path.read_text(encoding="utf-8").splitlines():
                        item = json.loads(line)
                        if int(item.get("eventId", 0)) <= after or (session_id and item.get("sessionId") != session_id):
                            continue
                        found.append(item)
                        if len(found) >= limit:
                            return found
                except (OSError, ValueError):
                    continue
        return found


TELEMETRY = TelemetryStore()


def api_response(payload: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(payload, status_code=status_code, headers={"Cache-Control": "no-store"})


def purge_jobs() -> None:
    cutoff = time.time() - JOB_TTL_SECONDS
    with JOBS_LOCK:
        expired = [job_id for job_id, job in JOBS.items() if job.get("finishedAt", float("inf")) < cutoff]
        for job_id in expired:
            JOBS.pop(job_id, None)


def update_job(job_id: str, **changes: Any) -> None:
    with JOBS_LOCK:
        JOBS[job_id].update(changes)


async def create_audio_job(request) -> JSONResponse:
    purge_jobs()
    form = await request.form()
    upload = form.get("audio")
    if not isinstance(upload, UploadFile):
        return api_response({"error": "Choose an audio file"}, 400)

    suffix = Path(upload.filename or "recording").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        return api_response({"error": "Supported formats: MP3, WAV, M4A, AAC, FLAC, OGG"}, 400)
    authoritative_lyrics = str(form.get("authoritativeLyrics") or "").replace("\r\n", "\n").replace("\r", "\n")
    if len(authoritative_lyrics) > MAX_LYRICS_CHARACTERS:
        return api_response({"error": "Lyric sheet exceeds 500,000 characters"}, 413)

    job_id = uuid.uuid4().hex
    temp_dir = Path(tempfile.mkdtemp(prefix="transposepdf-audio-"))
    audio_path = temp_dir / f"recording{suffix}"
    written = 0
    too_large = False
    try:
        with audio_path.open("wb") as destination:
            while chunk := await upload.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_AUDIO_BYTES:
                    too_large = True
                    break
                destination.write(chunk)
    finally:
        await upload.close()
    if too_large or not written:
        audio_path.unlink(missing_ok=True)
        audio_path.parent.rmdir()
    if too_large:
        return api_response({"error": "Audio file exceeds 100 MB"}, 413)
    if not written:
        return api_response({"error": "Audio file is empty"}, 400)

    title = Path(upload.filename or "Imported Recording").stem
    with JOBS_LOCK:
        active = sum(job.get("status") in {"queued", "processing"} for job in JOBS.values())
        if active >= MAX_ACTIVE_JOBS:
            audio_path.unlink(missing_ok=True)
            audio_path.parent.rmdir()
            return api_response({"error": "Audio queue is full; retry after a current job completes"}, 429)
        JOBS[job_id] = {
            "id": job_id,
            "status": "queued",
            "stage": "Queued",
            "progress": 0,
            "result": None,
            "error": None,
        }
    EXECUTOR.submit(process_audio_job, job_id, audio_path, title, authoritative_lyrics)
    return api_response({"jobId": job_id}, 202)


async def get_audio_job(request) -> JSONResponse:
    job_id = request.path_params["job_id"]
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        snapshot = dict(job) if job else None
    if snapshot is None:
        return api_response({"error": "Audio job not found"}, 404)
    return api_response(snapshot)


async def cancel_audio_job(request) -> JSONResponse:
    job_id = request.path_params["job_id"]
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is None:
            return api_response({"error": "Audio job not found"}, 404)
        if job["status"] not in {"complete", "error"}:
            job.update(status="cancelled", stage="Cancelled", finishedAt=time.time())
        snapshot = dict(job)
    return api_response(snapshot)


def job_cancelled(job_id: str) -> bool:
    with JOBS_LOCK:
        return JOBS[job_id].get("status") == "cancelled"


def process_audio_job(job_id: str, audio_path: Path, title: str, authoritative_lyrics: str = "") -> None:
    try:
        if job_cancelled(job_id):
            return
        update_job(job_id, status="processing", stage="Reading recording", progress=10)
        duration = audio_duration(audio_path)
        if job_cancelled(job_id):
            return

        update_job(job_id, stage="Detecting chords", progress=25)
        chords = ChordAnalyzer().analyze(audio_path)
        if job_cancelled(job_id):
            return

        update_job(job_id, stage="Transcribing lyrics", progress=55)
        transcript_text, words = AudioTranscriber().transcribe(audio_path)
        if job_cancelled(job_id):
            return

        update_job(job_id, stage="Aligning lyrics and chords", progress=85)
        key = infer_key(chords)
        analysis = AudioAnalysis(
            title=title,
            duration=duration,
            key=key,
            words=words,
            chords=chords,
        )
        song = ChartBuilder().build(analysis, authoritative_lyrics=authoritative_lyrics)
        song.setdefault("source", {}).update({
            "filename": f"{title}{audio_path.suffix}",
            "duration": duration,
            "transcriptText": transcript_text,
            "authoritativeLyrics": authoritative_lyrics or None,
            "lyricsMode": "authoritative" if authoritative_lyrics.strip() else "transcribed",
        })
        update_job(job_id, status="complete", stage="Draft ready", progress=100, result=song, finishedAt=time.time())
    except Exception as error:  # surfaced verbatim to the single requesting user
        if not job_cancelled(job_id):
            update_job(job_id, status="error", stage="Analysis failed", error=str(error), finishedAt=time.time())
    finally:
        try:
            audio_path.unlink(missing_ok=True)
            audio_path.parent.rmdir()
        except OSError:
            pass


def audio_duration(path: Path) -> float:
    completed = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    payload = json.loads(completed.stdout)
    return float(payload["format"]["duration"])


def infer_key(chords) -> str:
    if not chords:
        return "C"
    totals: dict[str, float] = {}
    for chord in chords:
        totals[chord.symbol] = totals.get(chord.symbol, 0) + max(0, chord.end - chord.start)
    return max(totals, key=totals.get)


def telemetry_client_allowed(request) -> bool:
    host = request.client.host if request.client else ""
    return host in {"127.0.0.1", "::1", "localhost", "testclient"}


def clean_telemetry_value(value: Any, depth: int = 0) -> Any:
    if depth > 12:
        return None
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return "".join(character for character in value if character >= " " or character in "\n\t")[:2000]
    if isinstance(value, list):
        return [clean_telemetry_value(item, depth + 1) for item in value[:1000]]
    if isinstance(value, dict):
        forbidden = {"rawanalysis", "transcripttext", "authoritativelyrics", "textitems", "audio", "pdf", "path", "bytes", "stack"}
        return {
            str(key)[:80]: clean_telemetry_value(item, depth + 1)
            for key, item in list(value.items())[:500]
            if str(key).lower() not in forbidden
        }
    return str(value)[:2000]


async def post_telemetry_events(request) -> JSONResponse:
    if not TELEMETRY_ENABLED:
        return api_response({"error": "Telemetry disabled"}, 503)
    if not telemetry_client_allowed(request):
        return api_response({"error": "Telemetry is loopback-only"}, 403)
    body = await request.body()
    if len(body) > TELEMETRY_MAX_REQUEST_BYTES:
        return api_response({"error": "Telemetry payload exceeds 512 KiB"}, 413)
    try:
        payload = json.loads(body)
    except (TypeError, ValueError):
        return api_response({"error": "Invalid JSON"}, 400)
    session_id = str(payload.get("sessionId", ""))
    try:
        uuid.UUID(session_id)
    except ValueError:
        return api_response({"error": "Invalid sessionId"}, 400)
    raw_events = payload.get("events", [])
    if not isinstance(raw_events, list) or len(raw_events) > TELEMETRY_MAX_EVENTS:
        return api_response({"error": "events must contain at most 100 items"}, 400)
    events = []
    for raw in raw_events:
        if not isinstance(raw, dict) or raw.get("eventType") not in TELEMETRY_EVENT_TYPES:
            return api_response({"error": "Invalid telemetry eventType"}, 400)
        screen = raw.get("screen")
        if screen is not None and screen not in TELEMETRY_SCREENS:
            return api_response({"error": "Invalid telemetry screen"}, 400)
        events.append(clean_telemetry_value({
            "schemaVersion": 1,
            "clientSeq": raw.get("clientSeq"),
            "occurredAt": raw.get("occurredAt"),
            "eventType": raw["eventType"],
            "screen": screen,
            "songId": raw.get("songId"),
            "sourceType": raw.get("sourceType"),
            "sourceId": raw.get("sourceId"),
            "data": raw.get("data", {}),
        }))
    raw_snapshot = payload.get("snapshot")
    if raw_snapshot is not None and not isinstance(raw_snapshot, dict):
        return api_response({"error": "snapshot must be an object"}, 400)
    snapshot = clean_telemetry_value(raw_snapshot) if raw_snapshot is not None else None
    return api_response(TELEMETRY.append(session_id, events, snapshot), 202)


async def get_telemetry_state(request) -> JSONResponse:
    if not TELEMETRY_ENABLED:
        return api_response({"error": "Telemetry disabled"}, 503)
    if not telemetry_client_allowed(request):
        return api_response({"error": "Telemetry is loopback-only"}, 403)
    return api_response(TELEMETRY.latest(request.query_params.get("sessionId")))


async def get_telemetry_events(request) -> JSONResponse:
    if not TELEMETRY_ENABLED:
        return api_response({"error": "Telemetry disabled"}, 503)
    if not telemetry_client_allowed(request):
        return api_response({"error": "Telemetry is loopback-only"}, 403)
    try:
        after = max(0, int(request.query_params.get("after", "0")))
        limit = min(1000, max(1, int(request.query_params.get("limit", "200"))))
    except ValueError:
        return api_response({"error": "after and limit must be integers"}, 400)
    events = TELEMETRY.events(request.query_params.get("sessionId"), after, limit)
    return api_response({"events": events, "count": len(events)})


routes = [
    Route("/api/telemetry/events", post_telemetry_events, methods=["POST"]),
    Route("/api/telemetry/events", get_telemetry_events, methods=["GET"]),
    Route("/api/telemetry/state", get_telemetry_state, methods=["GET"]),
    Route("/api/audio-jobs", create_audio_job, methods=["POST"]),
    Route("/api/audio-jobs/{job_id}", get_audio_job, methods=["GET"]),
    Route("/api/audio-jobs/{job_id}", cancel_audio_job, methods=["DELETE"]),
    Mount("/", StaticFiles(directory=ROOT, html=True), name="static"),
]
app = Starlette(routes=routes)


if __name__ == "__main__":
    import uvicorn

    print("TransposePDF server: http://127.0.0.1:8000")
    print("Audio endpoint: POST /api/audio-jobs (no production default)")
    uvicorn.run(app, host="127.0.0.1", port=8000)
