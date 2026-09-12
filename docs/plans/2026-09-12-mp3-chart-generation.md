# MP3-to-Chord-Chart Plan

Status: local MVP implemented and E2E-verified 2026-09-12. Production hardening remains below.

## Purpose

This exists so users can import an MP3 recording, receive an editable draft chord chart with timed lyrics and chord changes, then correct, transpose, and export it.

## Architecture

- Browser remains editor and review surface.
- Python/Starlette server serves static app and background audio-job API.
- FFmpeg decodes audio locally.
- NumPy/SciPy chroma-template analysis produces timestamped major/minor chord candidates.
- OpenAI transcription produces timestamped lyric words using configured `OPENAI_API_KEY`.
- Alignment builder converts both streams into canonical Song/Section/Line/ChordAnchor JSON.
- Imported draft enters existing `SongModel`, editor, transpose, and export paths.

## Step 1 — Audio contracts and local chord probe

Files: `audio/contracts.py`, `audio/chord_analyzer.py`.

- Define transcript-word, chord-segment, analysis-result shapes.
- Decode MP3 through FFmpeg without loading entire compressed input into memory.
- Extract pitch-class energy and score major/minor triad templates.
- Smooth adjacent identical chords and expose confidence.

Acceptance: generated C/F/G/Am sample returns ordered nonempty chord segments with timestamps.

## Step 2 — Timed lyrics and chart alignment

Files: `audio/transcriber.py`, `audio/chart_builder.py`.

- Submit audio to OpenAI transcription using word timestamps.
- Break timed words into editable lyric lines.
- Attach chord changes to nearest timed word as character offsets.
- Emit canonical song JSON with timestamps/confidence preserved.

Acceptance: deterministic fixture aligns chords to expected lines and retains every chord segment.

## Step 3 — Background job server

File: `server.py`.

- Serve existing static application.
- POST upload creates a job and returns ID immediately.
- GET job reports queued/processing/complete/error.
- Worker validates size/type, runs transcription/chord/alignment, and deletes temporary audio.
- Never default tests to a production endpoint.

Acceptance: synthetic MP3 job completes locally and returns canonical song JSON.

## Step 4 — Audio import/review UI

Files: `index.html`, `modules/uiController.js`, `styles/main.css`, `styles/mobile.css`, `service-worker.js`.

- Enable Import recording card and accept MP3/WAV/M4A.
- Show upload/analysis status and explicit error state.
- Add completed draft to existing collection.
- Open draft in existing editor for correction.
- Preserve timestamps/confidence through edits where anchors survive.

Acceptance: recording upload produces editable chart, transposes, resets, and exports.

## Step 5 — Verification

- Syntax/static checks.
- Local synthetic chord MP3 analysis.
- Timed-word/chord alignment fixture.
- Real browser upload through local API.
- Generated chart edit/transpose/export.
- Desktop/mobile screenshots to Telegram.
- Final code review, explicit-path commit, push.

## Deferred production hardening

- Persistent database/object storage for jobs.
- Durable queue and restart recovery.
- Vocal/instrument separation.
- Advanced chord qualities, inversions, downbeat/measure grid, and repeated-section detection.
- Production hosting and secrets configuration.
