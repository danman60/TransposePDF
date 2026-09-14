# Current Work - TransposePDF

## Active Task — 2026-09-14 Font Size and Verse Safety

FIRMAMENT v45 deployed. Per-song chart text is user-selectable from 10–18pt, defaults to 13pt, and drives the same editor/PDF wrapping plan. Canonical lyric lines retain one `+ line` control even when visually wrapped.

## Recent Changes

- v45 live: persisted font-size selector in sidebar; 13pt default; exact editor/PDF/ChordPro font round-trip; restored `+ line` after v42 planned renderer dropped it. Live Armor snapshot retains six exact Verse 1 lines and renders without overflow.
- v44 live: fixed editor-only doubled height for wrapped lyric continuations, removed inherited lyric bottom margin, and added overflow/row-height assertions. Editor page contents now fit the same planned rows as PDF.
- v43/v44: retained 16pt chart type while tightening shared line height from 21.5pt to 19.2pt, reducing false blank space without shrinking lyrics.
- v42 candidate: editor is paginated A4 preview from `ChartPageLayout`; PDF renders the same plan. Wrapped visual segments map edits and chord drops back to canonical source coordinates. Browser geometry parity passes 6/6; editing/drag/layout regressions pass 35/35.
- v42 final candidate: 16pt lyrics and 18pt arrangement; half-inch margins; atomic chord/lyric wrap units; repeated continuation headings; balanced final-page columns; full-width last-page credits; single-song PDFs omit title page. Local exact editor/PDF gate passes 6/6 and full Armor lifecycle exports 36,697-byte searchable PDF with zero errors.
- Shared A4 parity engine started: fixed 11pt typography, deterministic wrapping with canonical source ranges, section-aware page/column planning, and credits packing that prevents metadata-only pages. Planner gate passes 7/7; renderer integration remains active work and is not deployed yet.
- Structured PDF renderer now consumes `ChartPageLayout` pages directly; v41 geometry snapshots and 6.6pt scaling removed. Local searchable PDF gate passes 9/9 at fixed 11pt. Editor integration remains before deployment.
- v41 candidate: active structured chart geometry is captured at export; PDF consumes editor section-column assignments and row font ratios, removing its separate character-count wrapping decisions.
- v40 candidate: moved the existing Export PDF action into the always-visible sidebar area and enlarged Arrangement to a 5.8rem, 1.25rem-type wrapping panel.
- v39 candidate: independent CSS columns remove false vertical gaps beside uneven section heights; sections stay intact, full-width, editable, and draggable; credits and Add section span all columns; mobile remains one column.
- v38 section gestures: drag targets insertion boundaries in blank chart space with a visible cyan rule; Ctrl/Cmd/Alt+Z works even after drag leaves focus outside workspace; Alt-drag duplicates an entire section with independent section/line/chord IDs.
- v37 viewport editor: editor expands from the old 800px cap to the available 1680px workspace; desktop song-tools rail is 220px expanded/56px collapsed with persisted state; 2/3-column lines fit inside their column without section scrollbars or cross-column overlap.
- `5290675` deployed as FIRMAMENT v36: audio-imported and other canonical section charts now use structured 1/2/3-column PDF export; positional imported PDFs retain source layout only when `source.preserveLayout === true`.
- `db86809` deployed as FIRMAMENT v35: legacy `NS`/`No section`/`New section` blocks merge into prior labeled section or disappear when empty; pending labels resolve on blur; 2/3-column cells contain long lyric/chord rows without cross-column collision.
- `6f6791d` deployed as FIRMAMENT v34: context menu stays open while internally scrolling; empty sections show named `Use chords from <section>` choices with same-family matches first.
- `35b1f7f` deployed as FIRMAMENT v33: `Add section here` splits a long section at the clicked lyric-row boundary instead of placing the new section after the entire chart.
- `8de4a02` deployed as FIRMAMENT v32: every chart right-click menu exposes section placement; Ctrl/Cmd/Alt+Z use a 50-step exact persisted-chart undo stack while active unsaved text keeps native undo.
- `5b5bf47` deployed as FIRMAMENT v31: full target-aware context menus for chords, lyric lines, sections, and blank chord lanes; blank-space section insertion uses nearest clicked visual position instead of chart end.
- `8a4b30c` deployed as FIRMAMENT v30: right-click chart context menu creates a section above/below the clicked section or at chart end; native editable-field context menus remain intact.
- `592b7f5` deployed as FIRMAMENT v29: explicit labels drive section family; empty Verse/Pre-Chorus/Chorus repeats offer chord changes from the earlier matching section without replacing lyrics.
- `f890e8e` deployed as FIRMAMENT v28: persistent main-chart `+ Add section` appends a blank section and selects its label for immediate naming.
- `4d4dafe` deployed as FIRMAMENT v27: single-click chord selection, Shift-click multi-selection, Delete batch removal, and Alt+Z exact deletion undo.
- `d652ca6` deployed as FIRMAMENT v26: persistent 1/2/3-column charts, labeled/reorderable sections, syllable-stable chord anchors, editable writer/arranger credits, inferred arrangement order with exact manual override, and matching searchable PDF/ChordPro metadata.
- `3a6aa41` deployed as FIRMAMENT v22: loaded sessions hide the large create/import card section; compact create/import navigation now lives in the desktop sidebar and mobile Song tools sheet.
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

- v45 deployed through FIRMAMENT tunnel: font/layout 21/21; canonical line insertion 9/9; editor/PDF parity 6/6; structured PDF 9/9; inline edit/drag 10/10; section move/copy/undo 6/6. Full Armor lifecycle passed with two analyses, immutable raw evidence, exact edits, transpose/reset, 34,916-byte PDF, and zero console errors. Exact saved Armor screenshot inspected and sent to Telegram (`16981`).
- v44 deployed through FIRMAMENT tunnel: live cache `transpose-app-v44`; editor/PDF parity 6/6 with zero page overflow; inline editing/freeform drag 10/10; searchable structured PDF 9/9. Live composite visually reviewed and sent to Telegram (`16965`).
- v41 deployed through FIRMAMENT tunnel: editor/export geometry capture 20/20, searchable structured PDF 9/9, persistent session and actual download 17/17, full Armor manual-entry/transpose lifecycle clean with a 36,324-byte PDF. Live cache is `transpose-app-v41`; rendered A4 output inspected and sent to Telegram.
- v40 deployed through FIRMAMENT tunnel: export/arrangement/layout 19/19, inline editing/drag 10/10, persistent session/export/telemetry 17/17, section lifecycle 6/6, deterministic PDF/schema/ChordPro 31/31. Live cache is `transpose-app-v40`. Cloud QA Agent attempted 5/5 checklist items but Anthropic returned HTTP 400 before browser control.
- v39 deployed through FIRMAMENT tunnel: layout 17/17, section move/copy/undo 6/6, inline lyric/chord editing and freeform drag 10/10. Deterministic PDF/schema/ChordPro checks 40/40. Live cache is `transpose-app-v39`. Cloud QA Agent attempted 5/5 checklist items but Anthropic returned HTTP 400 before browser control; direct real-browser regression is authoritative.
- v38 deployed section lifecycle: 6/6 real-browser checks pass through FIRMAMENT tunnel for boundary move, marker cleanup, body-focused Ctrl+Z, Alt-drag copy, unique IDs, and reload persistence. Existing inline lyric/chord drag lifecycle passes 10/10; anchor/schema 12 groups; structured PDF 16/16. Live cache is `transpose-app-v38`.
- v37 deployed browser layout: 16/16 passed through FIRMAMENT tunnel at desktop/mobile. Proves 1/2/3-column state, zero two-column overlap, zero per-section horizontal scrollbars, collapsed rail width, chart expansion, reload persistence, metadata/history, and mobile one-column fallback. PDF/schema/ChordPro deterministic gates: 31/31. Live assets serve `transpose-app-v37`.
- v36 deployed final hop: live service worker `transpose-app-v36`; 31/31 deterministic PDF/schema/ChordPro checks; 9/9 real Chromium-generated audio-source PDF checks. A4 output uses both columns, searchable text, clean continuation pages, credits, arrangement, and manual chord spelling. QA Agent cloud route executed 0/15 steps because MiniMax returned HTTP 402; no local model used.
- v31 deterministic gates: 26/26; JavaScript syntax and diff checks pass; FIRMAMENT serves `transpose-app-v31`. QA Agent cloud browser routes remain unavailable (400/402); no local model used.
- v29 deterministic gates: 26/26. FIRMAMENT serves `transpose-app-v29`.
- User ArmorOfGod state verified in live telemetry snapshot: active session `98015584-762a-44b3-b0b9-4692c2553e35`, one saved song, edits through 11:03 PM Eastern. FIRMAMENT Chrome Local Storage contains correction key `transposepdf.chord-corrections.v1`, schema v2, with persisted ArmorOfGod harmonic records.
- v27 JavaScript syntax and diff checks pass; FIRMAMENT serves `transpose-app-v27`. Browser interaction gate not executed: configured QA Agent cloud routes returned 400/402 and local models remain prohibited. Existing clean-HEAD `lyric_anchor_schema.test.js` has an unrelated stale expectation (`Verse 1` vs current `Sec1`).
- Local release gates: 73/73 passed. Armor lifecycle: zero failures and zero console errors. Desktop/mobile composited screenshots reviewed; blank credit fields expose visible edit affordances.
- FIRMAMENT live primary source: loopback HTTP 200; service worker `transpose-app-v26`; arrangement module served. Final deployed QA Agent run executed 0/10 app steps because three configured cloud routes returned HTTP 400/402 before browser control. No local model used.
- FIRMAMENT v22: start section computed `display:none` and `0x0` after song load on desktop/mobile; persistent 17/17, copy/insert 10/10, inline edit/drag and line operations pass; zero console/page/telemetry errors.
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

1. Run final deployed QA Agent lifecycle when a configured cloud route accepts requests.
2. Provision dedicated Supabase project when live cross-device sync is desired.

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
