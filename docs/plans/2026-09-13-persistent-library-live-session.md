# Persistent Library and Live Session Plan

## Purpose

This exists so the user can load Armor of God, edit it immediately, keep multiple songs and sessions, return after reload, and let SpyBalloon follow the active FIRMAMENT workflow live.

## Verified Baseline

- `UIController.currentSongs` already supports several songs but only in memory.
- Imported/manual/audio charts share `SongModel`; editor, transpose, spelling, learning, and PDF export already reuse it.
- Results render read-only chord spans. The only Edit button sits at the top of a potentially long chart and scrolls away.
- No library, setlist-session persistence, autosave draft, recovery, active-song selector, or telemetry endpoint exists.
- Audio job state is volatile server memory and is not user library state.

## Product Contract

1. Offline-first song library.
   - IndexedDB stores versioned canonical SongModel records with stable UUIDs.
   - Import/manual/audio all upsert through one repository.
   - Reload restores songs without audio/PDF blobs or duplicated raw transcripts.

2. Saved editing sessions.
   - A session owns ordered song references, active song, per-session name, and updated time.
   - Existing renderer/exporter receives the hydrated ordered songs.
   - One active chart displays at a time; selector changes active chart without losing work.

3. Editing and recovery.
   - Sticky Edit action remains reachable throughout results.
   - Opening analyzed/imported charts enters existing full editor; no parallel inline editor.
   - Editor changes autosave to a recovery draft after a debounce and on page hide.
   - Explicit Save commits library revision and clears draft.
   - Newer draft offers Restore or Discard rather than overwriting silently.

4. FIRMAMENT-local telemetry.
   - Browser posts allowlisted semantic events plus latest active-session snapshot.
   - Server stores bounded JSONL/state under the Windows user profile, outside repo.
   - `GET /api/telemetry/state` and `/events` stay loopback-only; SpyBalloon reads via SSH.
   - Snapshot includes chart sections/chords/placement needed to follow edits, but excludes media bytes, local paths, raw analysis, and duplicate transcripts.
   - Telemetry failure never blocks authoring.

5. Workspace UI.
   - Persistent header shows session name and save state.
   - Desktop song selector sidebar; compact mobile selector.
   - New/import actions remain existing workflows.
   - Selector exposes title, key, active state, and Edit.

## Files

- `modules/libraryStore.js`: IndexedDB schema, song/session/draft CRUD, migrations, sanitation.
- `modules/sessionTelemetry.js`: session identity, event batching, redacted snapshots.
- `server.py`: bounded local telemetry store and state/events endpoints.
- `modules/uiController.js`: restore/hydrate, active-song selection, persistence/autosave, telemetry hooks, sticky edit transition.
- `modules/songModel.js`: stable durable identity compatibility if required.
- `index.html`: session header, song selector, recovery notice, new modules.
- `styles/main.css`, `styles/mobile.css`: one-song workspace, sticky controls, responsive selector/status.
- `service-worker.js`: cache new local modules and bump version.
- `tests/e2e_persistent_session.py`: real-browser persistence/edit/telemetry/recovery/export checks.

## Acceptance

- Armor of God result has a visible Edit action at top, middle, and bottom scroll positions.
- Editing opens exact existing chart and Save returns the edited chart.
- Three songs survive reload with exact chord text, placement, timing, key, and spelling.
- Session selector shows all three but renders one active chart; exported PDF retains session order.
- Unsaved edit survives reload through explicit recovery choice.
- Live telemetry state advances after editor open, text edit, chord move, save, transpose, and export.
- Telemetry inspection contains no audio/PDF bytes, local path, raw analysis, or transcript evidence.
- Mobile 375px and desktop 1440px work with keyboard/touch; zero console errors.
- Existing Armor all-edit learning regression remains passing.
