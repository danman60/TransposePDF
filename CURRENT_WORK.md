# Current Work - TransposePDF

## Active Task — 2026-09-13 Ten-and-Ten Release

All 20 selected feature/streamline items implemented in local release tree. Dedicated team sync is configuration-ready but intentionally unbound until a TransposePDF Supabase project is provisioned.

## Recent Changes

- `fc48dc9` deployed as FIRMAMENT v21: Alt-drag copies chords, chord-lane double-click inserts/focuses a new chord, and song controls moved from the blue chart header into responsive sidebar navigation.
- Authoritative lyric files are awaited before audio submission, eliminating mismatched recording fingerprints during immediate imports.
- `04fa365` deployed as FIRMAMENT v20: Enter splits lyrics at the live caret into a new chart line/chord lane; `+ line` inserts a blank row; Backspace/Delete removes an empty non-sole row. Immediate unblurred typing is preserved.
- `af0f3e4` hotfix: imported songs now edit directly on the main chart. Lyrics support in-place typing/deletion; chord symbols support direct replacement and independently anchored same-line/cross-line dragging over syllables or blank space. Performance remains read-only.
- Named setlists/library search, history with readable line diffs, ChordPro, Nashville/capo/instrument views.
- Performance mode, swipe/keyboard/MIDI controls, timed rehearsal, low-confidence review, companion view.
- Serialized SessionStore, delegated workspace actions, extracted chart/authoring controllers, unified observability.
- SSE audio progress/cancellation, deterministic self-hosted runtime, safe service-worker update/offline UI.
- Team sync settings/auth/team/outbox/conflict/share-link surface with local-only default.
- SoloTranscribe moved to sibling `../SoloTranscribeCLI` commit `111257a`.
- 462 tracked dependency files and 204 obsolete generated/debug files removed from release tree; canonical PDF fixture retained.

## Verification

- FIRMAMENT v21: chord copy/insert 10/10, persistent desktop/mobile 17/17, inline mouse/touch edit/drag 9/9; gesture telemetry HTTP 202; zero console/page/telemetry failures.
- FIRMAMENT v20: line insertion 9/9, inline editing/drag 9/9, persistent lifecycle 17/17; zero console/page/telemetry errors.
- FIRMAMENT v18 inline chart lifecycle: 6/6. Untouched chord IDs/section/line/offsets remained byte-identical after another chord moved; reload persistence passed; zero console/page errors.
- Persistent lifecycle: 17/17, zero console/page/telemetry errors.
- UX gaps: 6/6.
- Team sync contract: 10/10; mocked dedicated-endpoint browser smoke: 10/10.
- Armor of God lifecycle: 3 consecutive clean post-fix runs. Startup import now waits for IndexedDB/session hydration.
- Syntax, Python compile, and `git diff --check`: pass.

## Blockers

- Live team-sync acceptance requires a dedicated TransposePDF Supabase project, migration, auth provider/redirect configuration, and two-account RLS/push/pull testing. No credentials embedded or borrowed.

## Next Steps

1. Commit/push release tree.
2. Deploy to FIRMAMENT and rerun full remote lifecycle.
3. Provision dedicated Supabase project when live cross-device sync is desired.

## Last Session Summary

Persistent multi-song library/session workspace, immediately reachable editing, recovery autosave, and FIRMAMENT-local live telemetry shipped and passed full lifecycle testing. Plan: `docs/plans/2026-09-13-persistent-library-live-session.md`.

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
- Authoring workspace keeps Save visible, presents independent source/preview scrolling on desktop, and switches between panes on mobile.
- Touch/pen chord placement and four directional fallback controls preserve blank-space and cross-line placement.
- File pickers, progress, busy states, error focus, transpose labels, contrast, and editable-field shortcut suppression received accessibility fixes.
- Section parsing recognizes Final Chorus, Tag, Interlude, Vamp, Refrain, and bracketed custom headings.
- PDF validation accepts MIME, filename extension, or `%PDF-` signature and refuses partial imports when any page cannot be read.

## Build Status

PASSING. JavaScript syntax, 28 focused theory checks, 30/30 visual/function browser checks, full Armor of God E2E, PDF export, and FIRMAMENT runtime verification passed.

## Known Bugs & Issues

- QA Agent report `transposepdf-correction-learning-20260912-232613` contains 10 infrastructure errors because `minimax-m2.7:cloud` returned HTTP 402; it performed no checklist interactions. Direct browser fallback is authoritative.
- Correction learning is browser-profile local. It does not sync across browsers or machines.
- Current learning adjusts notation and context/song-position choices; it does not retrain the acoustic chord analyzer.

## Incomplete Work

- None for persistent workspace and telemetry scope.

## Tests

- 2026-09-12 23:39 Eastern: Armor of God local E2E passed. Two deliberate edits learned; second import applied 30 corrections; exact `G#m` and `B7` returned; transpose produced `Am` and `C7`; reset restored learned symbols; five-page 18,084-byte PDF contained both corrections; fresh browser profile had no inherited memory; zero console errors.
- 2026-09-12 23:47 Eastern: FIRMAMENT HTTP 200 and Chrome-composited surface passed. Real FIRMAMENT audio job `833bcc40642f4fb1a516aeb7b117f42d` completed with authoritative lyrics, 7 sections, 163 anchors, and no error.
- Deterministic review passed insertion/deletion isolation, shifted-token matching, overlapping-anchor collapse, reversal, repeated confirmation, same-song placement, cross-song context isolation, and raw-analysis preservation.
- 2026-09-13 09:29 Eastern: full all-edit Armor E2E passed. Two real analyses completed in 16.61s and 15.52s; exact editor text/title/key/timing returned; transpose/reset passed; PDF was 18,356 bytes; raw analyzer evidence stayed unchanged across both saves; fresh profile isolated; zero console errors.
- 2026-09-13 09:33 Eastern: commit `9750b51` pushed. Eight runtime files copied to FIRMAMENT; live app returned HTTP 200, served cache v6, and Chrome produced a 66,765-byte composited screenshot.
- 2026-09-13: songwide spelling browser checks passed: source `A#` preserved, flat override rendered `Bb`, contextual F→F# rendered `F# B C#7 N.C.`, screen/PDF parity exact, zero console errors. Full Armor regression passed 12/12 with two real analyses (15.61s/13.56s), 18,333-byte PDF, exact edits/timing/policy persistence, and raw-analysis preservation.
- 2026-09-13: commit `a10a73d` pushed and runtime files copied to FIRMAMENT. Live server returned HTTP 200 and served `spellChordForKey` plus offline cache v7.
- 2026-09-13 10:31 Eastern: visual/function audit passed 30/30 checks at desktop, mobile, and 200%-equivalent reflow. Blank-space and cross-line chord placement, mobile tabs/nudges, keyboard file pickers, progress semantics, error focus restoration, and sticky Save passed with zero console errors and zero failed requests. Full Armor regression passed 12/12; two analyses completed in 19.62s and 21.57s; PDF was 18,039 bytes.
- 2026-09-13 10:34 Eastern: commit `dda8565` pushed and audited runtime files copied to FIRMAMENT. Live server returned HTTP 200, served cache v8 and new authoring/accessibility markup, and Chrome produced a 67,937-byte composited screenshot.
- 2026-09-13 11:55 Eastern: commit `7ca5558` deployed to FIRMAMENT; persistent server task created. FIRMAMENT lifecycle passed 17/17 through SSH tunnel: three-song exact reload, one-song selector, sticky Edit, recovery, immediate spelling and rapid transpose persistence, export, mobile, telemetry, and zero browser errors. Armor of God lifecycle passed 12/12 with two real analyses (24.76s/10.49s), exact edits/timing/spelling, immutable raw evidence, transpose/reset, 33,201-byte PDF, fresh-profile isolation, and zero console errors.

## Next Steps (priority order)

1. Use FIRMAMENT desktop shortcut and make real musical corrections; verify learned behavior against additional songs.
2. Add account/cloud synchronization if corrections must follow a user between browser profiles or machines.
3. Add audio feature fingerprints and a reviewed training pipeline before attempting acoustic-model learning.

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
