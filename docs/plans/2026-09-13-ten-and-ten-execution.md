# TransposePDF Ten-and-Ten Execution Plan

## Purpose

This exists so TransposePDF becomes a complete musician-facing chart library: fast to author, reliable in rehearsal and performance, portable between music tools, recoverable, observable, offline-capable, and shareable with a team.

## Invariants

- `SongModel` remains canonical; stored chord symbols stay concert-pitch source symbols.
- Display views, capo, instruments, Nashville numbers, transpose, PDF, and ChordPro use one transform contract.
- User edits never silently disappear or lose to another tab/device.
- Motion communicates state only, lasts 120–240 ms, and collapses under reduced motion.
- Audio/PDF bytes, local paths, raw analyzer evidence, and transcripts never enter telemetry or team sync.
- Existing public UIController APIs remain compatible until full browser lifecycle proves replacements.

## Wave 0 — Reproducible Foundation

Items: 15, 16, 18.

- Establish one explicit-URL QA entry point and master lifecycle checklist.
- Self-host pinned PDF.js 3.11.174, Tonal 5.0.0, jsPDF 2.5.1, worker, cMaps, licenses, and checksums.
- Remove CDN runtime dependence.
- Add exact ignore/fixture policy; stop tracking dependencies and generated outputs only after replacement QA covers unique behavior.

Acceptance: clean install; offline cold-start/import/transpose/export; zero external runtime requests; QA leaves clean tree.

## Wave 1 — State and Controller Boundary

Items: 11, 12, 13, 19.

- Add authoritative `SessionStore` above `LibraryStore`; expose hydrated songs as compatibility view.
- Serialize state commands and surface revision conflicts.
- Extract workspace, authoring, import, export, and chart rendering controllers behind UIController facade.
- Replace inline handlers with delegated actions and move inline bootstrap code into modules.
- Route logger/status/error/duration signals through one structured observability adapter.

Acceptance: no direct `currentSongs` mutation; rapid operations and two-tab conflicts safe; no inline event attributes; existing 29 lifecycle checks pass.

## Wave 2 — Library and Portable Music Views

Items: 1, 5, 7, 8.

- IndexedDB v2: versions, metadata, search fields, sync outbox.
- Multiple named setlists, search, recent songs, add/remove, duplicate, drag/keyboard reorder.
- Version checkpoints/diffs/restore-as-new-head.
- Unified concert/Nashville/capo/Bb/Eb/F instrument display.
- ChordPro parse/serialize with directives, inline chords, placement, slash chords, and canonical/display export modes.

Acceptance: two setlists sharing songs with different views/order; exact reload/export; history restore; ChordPro round trip; screen/PDF parity.

## Wave 3 — Rehearsal and Performance

Items: 2, 3, 4, 6.

- Fullscreen-capable Performance mode with wake lock, font/columns, scroll, next/previous, position memory.
- Keyboard footswitch and Web MIDI learnable bindings with conflict handling.
- Low-confidence chord/lyric review queue with persistence and correction-learning integration.
- Timestamp-driven rehearsal transport, seek, loop, speed, active lyric/chord, follow/pause behavior.

Acceptance: desktop/mobile/reduced-motion/keyboard; exact one-action pedal behavior; finite review flow; timed playback follows stored anchors without changing canonical chart.

## Wave 4 — Runtime Delivery and Companion

Items: 10, 17, 20.

- Reconnectable SSE audio progress with ordered event IDs and polling fallback.
- Read-only companion screen from sanitized live state, reconnection, current/upcoming chord and lyric.
- Trim speculative service-worker handlers; add safe update-ready UX that cannot reload over a dirty draft.

Acceptance: reconnect/no duplicate progress; companion exact and redacted; deterministic offline update; existing audio cancellation and telemetry pass.

## Wave 5 — Team Sync

Item: 9.

- Dedicated Supabase schema: teams, memberships, songs, sessions, versions, corrections, change cursor.
- RLS owner/editor/viewer boundaries and revision-checked mutations.
- IndexedDB outbox, idempotent operations, offline retry, conflict copies/merge surfaces, tombstones.
- Auth/team picker/sync state/shared links; only publishable key in browser.

Binding gate: provision or select a dedicated TransposePDF Supabase project. Never reuse another product tenant. Local schema/client/outbox work proceeds before binding.

Acceptance: two accounts/devices, offline changes, explicit conflicts, permission matrix, no forbidden payloads or service credential exposure.

## Wave 6 — Separation and Release Gate

Item: 14 plus full regression.

- Preserve SoloTranscribe in sibling `SoloTranscribeCLI`, prove CLI smoke, then remove its code/dependency surface from TransposePDF forward-only.
- Run complete QA on FIRMAMENT: manual/PDF/audio/ChordPro, correction learning, sessions/history/views, rehearsal/performance/controls, companion, offline/update, team sync.
- Capture and Telegram desktop/mobile/performance/companion customer surfaces.

Acceptance: every selected item has a real-browser assertion; zero console errors and required-request failures; FIRMAMENT deployed and live state readable from SpyBalloon.
