# Current Work - TransposePDF

## Last Session Summary

Extended browser-local learning across the accepted audio chart and added songwide, key-aware chord spelling with authoritative per-song user overrides. Drag placement remains free horizontally at character-column granularity and snaps only to lyric-line chord baselines.

## What Changed

- `ae691ef` — added versioned correction memory, editor/audio integration, offline cache update, QA flow, implementation plan, and FIRMAMENT launcher.
- `2377263` — made Windows launcher noninteractive so SSH and desktop starts both work.
- FIRMAMENT deployment — `C:\Users\danie\projects\TransposePDF`, isolated `.venv`, app-specific `OPENAI_API_KEY`, desktop shortcut `C:\Users\danie\Desktop\TransposePDF.lnk`, loopback server on `127.0.0.1:8000`.
- Existing 462 tracked `node_modules` deletions remain untouched and uncommitted.
- Correction storage migrates v1 rules into v2 state while retaining the legacy storage key.
- Exact-recording snapshot uses immutable filename, duration, and original supplied/transcribed words; generalized chord rules remain available across recordings.
- Chord IDs persist through drag operations; placement changes derive timing unless the user set an explicit time.
- Contextual spelling now follows major/minor key grammar, retains functional chromatic alterations, handles slash bass independently, preserves suffix alterations and `N.C.`, and avoids double accidentals by default.
- Per-song spelling control: Contextual, Prefer flats, Prefer sharps, Preserve. Typed source symbols remain unchanged; rendering/export use the selected policy.

## Build Status

PASSING locally. JavaScript syntax, 28 focused theory checks, real-browser spelling/UI/PDF parity, and full Armor of God E2E passed. FIRMAMENT update pending this commit.

## Known Bugs & Issues

- QA Agent report `transposepdf-correction-learning-20260912-232613` contains 10 infrastructure errors because `minimax-m2.7:cloud` returned HTTP 402; it performed no checklist interactions. Direct browser fallback is authoritative.
- Correction learning is browser-profile local. It does not sync across browsers or machines.
- Current learning adjusts notation and context/song-position choices; it does not retrain the acoustic chord analyzer.

## Incomplete Work

- Commit/push and FIRMAMENT runtime-file update for songwide spelling rules.

## Tests

- 2026-09-12 23:39 Eastern: Armor of God local E2E passed. Two deliberate edits learned; second import applied 30 corrections; exact `G#m` and `B7` returned; transpose produced `Am` and `C7`; reset restored learned symbols; five-page 18,084-byte PDF contained both corrections; fresh browser profile had no inherited memory; zero console errors.
- 2026-09-12 23:47 Eastern: FIRMAMENT HTTP 200 and Chrome-composited surface passed. Real FIRMAMENT audio job `833bcc40642f4fb1a516aeb7b117f42d` completed with authoritative lyrics, 7 sections, 163 anchors, and no error.
- Deterministic review passed insertion/deletion isolation, shifted-token matching, overlapping-anchor collapse, reversal, repeated confirmation, same-song placement, cross-song context isolation, and raw-analysis preservation.
- 2026-09-13 09:29 Eastern: full all-edit Armor E2E passed. Two real analyses completed in 16.61s and 15.52s; exact editor text/title/key/timing returned; transpose/reset passed; PDF was 18,356 bytes; raw analyzer evidence stayed unchanged across both saves; fresh profile isolated; zero console errors.
- 2026-09-13 09:33 Eastern: commit `9750b51` pushed. Eight runtime files copied to FIRMAMENT; live app returned HTTP 200, served cache v6, and Chrome produced a 66,765-byte composited screenshot.
- 2026-09-13: songwide spelling browser checks passed: source `A#` preserved, flat override rendered `Bb`, contextual F→F# rendered `F# B C#7 N.C.`, screen/PDF parity exact, zero console errors. Full Armor regression passed 12/12 with two real analyses (15.61s/13.56s), 18,333-byte PDF, exact edits/timing/policy persistence, and raw-analysis preservation.

## Next Steps (priority order)

1. Commit, push, and copy runtime files to FIRMAMENT.
2. Use FIRMAMENT desktop shortcut and make real musical corrections; verify learned behavior against additional songs.
3. Add account/cloud synchronization if corrections must follow a user between browser profiles or machines.

## Gotchas for Next Session

- Wait until lyric-source status reports `.txt` loaded before selecting audio; the file read is asynchronous.
- Raw analyzer anchors can overlap and collapse into fewer visible editor tokens. Learning diffs the editable representation and maps changes back to preserved raw evidence.
- Same-recording harmonic corrections use song fingerprint plus lyric line/position; cross-song harmonic corrections require exact key and neighboring-chord context. Enharmonic preferences apply globally in that browser profile.
- Learning occurs only on explicit **Save changes**. Cancel never writes correction state.
- Exact saved chart overlays fresh analysis for deterministic reimport; fresh analyzer output remains preserved in `source.rawAnalysis`.
- Automatic key normalization runs on machine-analyzed chords before learned user corrections. Manual/PDF source spelling is authoritative at zero transposition.
- Enharmonic learned rules are key-scoped; a flat correction in one key no longer leaks into a sharp-key song.
- FIRMAMENT server intentionally binds loopback only. Desktop shortcut starts it and opens `http://127.0.0.1:8000`.

## Files Touched This Session

- `modules/correctionMemory.js`
- `modules/uiController.js`
- `modules/songModel.js`
- `modules/musicTheory.js`
- `modules/pdfGenerator.js`
- `index.html`
- `styles/main.css`
- `service-worker.js`
- `tests/agent/flow-correction-learning.md`
- `tests/e2e_all_edits.py`
- `docs/plans/2026-09-13-all-edit-learning.md`
- `docs/plans/2026-09-13-songwide-spelling-rules.md`
- `CURRENT_WORK.md`
