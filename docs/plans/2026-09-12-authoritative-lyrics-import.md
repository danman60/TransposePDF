# Authoritative Lyrics Audio Import Plan

Status: implemented, E2E-verified, and blocker re-review passed 2026-09-12.

## Purpose

This exists so users can supply authoritative pasted or `.txt` lyrics with an MP3, preserving exact wording while audio transcription contributes timing and chord placement.

## Step 1 — Reconciliation contract and helper

Files: `audio/contracts.py`, `audio/lyric_reconciler.py`.

- Represent authoritative lines and their timed word offsets explicitly.
- Align normalized authoritative tokens to machine-transcribed tokens with sequence matching.
- Preserve authoritative spelling, punctuation, capitalization, blank lines, and line order.
- Interpolate timestamps for unmatched authoritative words; expose line confidence.

Acceptance: a fixture with machine mishearings returns exact supplied lyrics, monotonic timestamps, and mismatch confidence below exact-match confidence.

## Step 2 — Chart-building and API wiring

Files: `audio/chart_builder.py`, `server.py`.

- Accept optional `authoritativeLyrics` in the existing multipart audio upload.
- Reconcile before chart construction.
- Use authoritative line boundaries and character offsets for chord placement.
- Store raw transcript and supplied lyrics separately in song source metadata.
- Preserve current no-lyrics behavior unchanged.

Acceptance: API job result uses exact supplied text while retaining raw transcript evidence and timed chord anchors.

## Step 3 — Audio-import UI

Files: `index.html`, `modules/uiController.js`, `styles/main.css`, `styles/mobile.css`, `service-worker.js`.

- Add optional paste field and `.txt` picker to recording-import surface.
- Loading a text file populates the same editable textarea.
- Send supplied text with audio; label it authoritative.
- Clear both audio and lyrics on cancel/success while retaining text after recoverable failure.

Acceptance: paste and `.txt` flows each submit exact text and open generated chart in existing editor.

## Step 4 — Verification

- Python/JavaScript syntax and reconciliation fixture.
- Real local API job with deliberately misspelled/misheard machine input.
- Browser E2E for pasted lyrics and `.txt` upload through edit, transpose/reset, and PDF export.
- Desktop/mobile screenshots sent to Telegram.
- Read-only review, explicit-path commit, push.
