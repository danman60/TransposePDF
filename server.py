"""TransposePDF static server and background MP3 analysis API."""

from __future__ import annotations

import json
import subprocess
import tempfile
import threading
import time
import uuid
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


routes = [
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
