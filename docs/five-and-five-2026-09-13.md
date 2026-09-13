# Ten and Ten — TransposePDF

## Killer Features

1. **Setlist builder and library search** `[industry-standard]` — Multiple named setlists, search, recent songs, add/remove, drag reorder, and duplicate session. `modules/libraryStore.js:186` — ~half-day
2. **Performance mode** `[industry-standard]` — Fullscreen chart, font/column controls, wake lock, next/previous gestures, and restrained reduced-motion-aware transitions. `modules/uiController.js:1110` — ~half-day
3. **Footswitch, MIDI, and keyboard navigation** `[creative]` — Map pedals and MIDI program changes to song navigation, scrolling, transpose, and reset. `modules/uiController.js:1844` — ~half-day
4. **Timed rehearsal playback** `[creative]` — Moving playhead, current line/chord highlight, and tap-to-seek using existing timestamps. `modules/songModel.js:12` — multi-session
5. **Nashville Numbers, capo, and instrument views** `[industry-standard]` — Concert chords, numbers, capo position, and transposing-instrument views from one canonical chart. `modules/musicTheory.js:146` — multi-session
6. **Low-confidence review queue** `[boring-overlooked]` — A finite “Review 7 items” pass for uncertain chords/lyrics, with a single gentle entry pulse. `modules/songModel.js:18` — ~half-day
7. **ChordPro import/export** `[industry-standard]` — Portable structured charts compatible with established music-chart workflows. `modules/songModel.js:75` — ~half-day
8. **Version history and named checkpoints** `[boring-overlooked]` — Diff, restore, and checkpoints for bad edits or accidental changes. `modules/libraryStore.js:115` — multi-session
9. **Shared team library and links** `[industry-standard]` — Authenticated sync for songs, setlists, and reviewed corrections across devices. `modules/correctionMemory.js:6` — multi-session
10. **Live companion view** `[creative]` — Read-only second screen for active song, key, section, and next chord, with purposeful crossfades. `server.py:401` — ~half-day

## Streamlines

11. **Split the 1,917-line UI hub by workflow** — Extract persistence, imports, editor, session, and export services behind the current facade. `modules/uiController.js:6` — multi-session
12. **One authoritative session state** — Replace three-way synchronization among memory, IndexedDB, and session items with one reducer and derived view. `modules/uiController.js:318` — ~half-day
13. **Delegated actions instead of inline handlers** — One workspace listener for Edit/spelling/transpose/reset; simpler rerenders and stronger CSP. `modules/uiController.js:1191` — ~1hr
14. **Separate SoloTranscribe from this product** — Remove unrelated app/setup/dependency surface from TransposePDF. `README.md:34` — ~half-day
15. **Stop versioning dependencies and generated media** — Clean tracked `node_modules`, screenshots, PDFs, caches, and transient reports with an exact fixture policy. `package.json:14` — ~1hr
16. **One QA entry point** — Replace dummy npm test and root debug-script sprawl with one lifecycle suite and report location. `package.json:10` — ~half-day
17. **Trim speculative service-worker handlers** — Keep deterministic offline cache and update prompt; remove dead push/background-export paths. `service-worker.js:266` — ~1hr
18. **Self-host pinned runtime libraries** — First-party PDF.js, Tonal, and jsPDF assets make first load and offline use deterministic. `index.html:19` — ~half-day
19. **Unify logger and telemetry** — One structured, privacy-filtered event adapter for status, durations, and errors. `app.js:7` — ~half-day
20. **Stream audio progress over SSE** — Replace one-second polling with reconnectable stage events and cancellation. `modules/uiController.js:483` — ~half-day
