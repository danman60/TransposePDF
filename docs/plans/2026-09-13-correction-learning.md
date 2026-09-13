# Correction Learning Plan

## Purpose

This exists so that user chord and enharmonic corrections improve future audio-import guesses.

## Scope

Version 1 learns in the browser used to edit charts. It preserves raw machine analysis, records only explicit saved corrections, applies notation preferences immediately, and applies harmonic chord replacements only when the same key and neighboring-chord context match. Acoustic-model training remains separate because the current analyzer emits no reusable audio feature fingerprint.

## Existing Surfaces Reused

- `UIController.handleAudioUpload()` receives completed audio drafts.
- `UIController.saveAuthoredSong()` has the before/after chart pair on explicit save.
- `SongModel.retainAnalysisMetadata()` preserves timestamps and confidence across editor text parsing.
- `SongModel` remains the canonical representation for manual, PDF, and audio charts.

## Work

1. Add `modules/correctionMemory.js` as a versioned localStorage-backed correction engine.
   - Store raw guess, accepted correction, detected key, adjacent chord context, timing/confidence, correction kind, and confirmation count.
   - Separate enharmonic spelling preferences from harmonic replacements.
   - Never mutate stored raw analysis.
   - Acceptance: module round-trip, cancellation/no-save isolation, reversal/supersession, context matching, malformed-storage recovery.

2. Wire the engine into existing audio import and editor save seams.
   - Capture differences only when saving edits to an audio-source chart.
   - Apply learned rules to a cloned completed result before creating the editable SongModel.
   - Preserve untouched raw analysis in source evidence.
   - Surface the count of applied learned corrections in status text.
   - Acceptance: edit/save/reload/reimport applies corrections; manual/PDF charts do not create audio-learning records.

3. Load and offline-cache the module.
   - Add script before `uiController.js`.
   - Bump service-worker cache and include the new module.
   - Acceptance: fresh load and offline reload resolve the module without console errors.

4. Add real-browser QA coverage.
   - Use persistent browser profile and real Armor of God MP3 plus authoritative lyric sheet.
   - Save one harmonic correction and one enharmonic correction; reimport and verify automatic application.
   - Verify transpose, reset, and downloaded PDF retain learned corrections.
   - Verify a fresh browser profile does not inherit local preferences.

5. Make usable on FIRMAMENT.
   - Use the live FIRMAMENT runtime path established by primary-source inspection.
   - Copy/pull the committed build, configure secret without committing it, start through an existing approved service mechanism, and verify from a real browser on FIRMAMENT.
   - Acceptance: FIRMAMENT URL loads; correction survives reload; audio import, transpose, and export pass.

## Verification

- JavaScript syntax checks for changed modules.
- Python compile check for server path.
- Existing regression checks.
- QA Agent real-browser checklist, followed by direct fallback if it produces no browser result within 120 seconds.
- Screenshot real composed editor and Telegram DM.
- Git diff review, commit, push, FIRMAMENT artifact/runtime verification.

## Execution Notes

- Broker task `transposepdf-correction-memory` blocked twice without producing an artifact; both attempts hit the 420-second idle-write circuit breaker. Direct implementation used under owner authorization.
- Real Armor of God E2E exposed overlapping analyzer anchors and an asynchronous lyric-file test race. Audio drafts now normalize through the editable representation while preserving raw analysis separately; tests wait for lyric-source readiness before uploading audio.
- Final local E2E learned exactly two deliberate corrections, reapplied `B7` and `G#m` on a second analysis, transposed them to `C7` and `Am`, reset them, and exported a five-page PDF with zero console errors.
