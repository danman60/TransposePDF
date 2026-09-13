# Current Work - TransposePDF

## Last Session Summary

Built browser-local correction learning for audio charts. Explicit saved chord and enharmonic edits now persist and automatically affect later imports while raw analyzer evidence remains preserved. Deployed exact committed app to FIRMAMENT with a desktop launcher and verified real Armor of God processing there.

## What Changed

- `ae691ef` — added versioned correction memory, editor/audio integration, offline cache update, QA flow, implementation plan, and FIRMAMENT launcher.
- `2377263` — made Windows launcher noninteractive so SSH and desktop starts both work.
- FIRMAMENT deployment — `C:\Users\danie\projects\TransposePDF`, isolated `.venv`, app-specific `OPENAI_API_KEY`, desktop shortcut `C:\Users\danie\Desktop\TransposePDF.lnk`, loopback server on `127.0.0.1:8000`.
- Existing 462 tracked `node_modules` deletions remain untouched and uncommitted.

## Build Status

PASSING. JavaScript syntax, Python compilation, diff integrity, deterministic correction cases, local real-browser E2E, and FIRMAMENT runtime checks passed.

## Known Bugs & Issues

- QA Agent report `transposepdf-correction-learning-20260912-232613` contains 10 infrastructure errors because `minimax-m2.7:cloud` returned HTTP 402; it performed no checklist interactions. Direct browser fallback is authoritative.
- Audio import without authoritative lyrics can log `Invalid root note: B#` during some analyses. Final authoritative-lyrics E2E logged zero console errors.
- Correction learning is browser-profile local. It does not sync across browsers or machines.
- Current learning adjusts notation and context/song-position choices; it does not retrain the acoustic chord analyzer.

## Incomplete Work

- None for requested browser-local correction-learning scope.

## Tests

- 2026-09-12 23:39 Eastern: Armor of God local E2E passed. Two deliberate edits learned; second import applied 30 corrections; exact `G#m` and `B7` returned; transpose produced `Am` and `C7`; reset restored learned symbols; five-page 18,084-byte PDF contained both corrections; fresh browser profile had no inherited memory; zero console errors.
- 2026-09-12 23:47 Eastern: FIRMAMENT HTTP 200 and Chrome-composited surface passed. Real FIRMAMENT audio job `833bcc40642f4fb1a516aeb7b117f42d` completed with authoritative lyrics, 7 sections, 163 anchors, and no error.
- Deterministic review passed insertion/deletion isolation, shifted-token matching, overlapping-anchor collapse, reversal, repeated confirmation, same-song placement, cross-song context isolation, and raw-analysis preservation.

## Next Steps (priority order)

1. Use FIRMAMENT desktop shortcut and make real musical corrections; verify learned behavior against additional songs.
2. Add account/cloud synchronization if corrections must follow a user between browser profiles or machines.
3. Add audio feature fingerprints and a reviewed training pipeline before attempting acoustic-model learning.

## Gotchas for Next Session

- Wait until lyric-source status reports `.txt` loaded before selecting audio; the file read is asynchronous.
- Raw analyzer anchors can overlap and collapse into fewer visible editor tokens. Learning diffs the editable representation and maps changes back to preserved raw evidence.
- Same-recording harmonic corrections use song fingerprint plus lyric line/position; cross-song harmonic corrections require exact key and neighboring-chord context. Enharmonic preferences apply globally in that browser profile.
- FIRMAMENT server intentionally binds loopback only. Desktop shortcut starts it and opens `http://127.0.0.1:8000`.

## Files Touched This Session

- `modules/correctionMemory.js`
- `modules/uiController.js`
- `index.html`
- `service-worker.js`
- `start-transposepdf.cmd`
- `tests/agent/flow-correction-learning.md`
- `docs/plans/2026-09-13-correction-learning.md`
- `CURRENT_WORK.md`
