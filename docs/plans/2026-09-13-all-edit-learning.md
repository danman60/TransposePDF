# All-Edit Learning and Chord Drag Plan

## Purpose

This exists so that every saved chart edit—including lyrics, sections, added/removed chords, placement, and drag-driven timing—returns on the next import of that recording.

## Existing Surfaces Reused

- Existing textarea and live structured preview remain the editor.
- Existing `SongModel` remains canonical for manual, PDF, and audio charts.
- Existing `ChordCorrectionMemory` retains cross-song chord/enharmonic rules.
- Existing explicit **Save changes** action remains the only learning boundary.

## Work

1. Extend correction storage from v1 records to backward-compatible v2 records plus exact-recording accepted-chart snapshots.
   - Fingerprint immutable filename, duration, and original supplied/transcribed words.
   - Snapshot title, original key, section labels/order, lyric lines, every chord symbol/addition/deletion/offset/timestamp, and edit time.
   - Apply exact recording snapshot after generalized chord rules; never change `source.rawAnalysis`.

2. Reconcile metadata for arbitrary editable changes.
   - Preserve chord IDs.
   - Match lyric lines by normalized wording, then ordinal fallback.
   - Preserve timing for unchanged anchors; derive moved/added anchor time from timed words or line span.

3. Add drag and keyboard placement editing to existing author preview.
   - Chord tokens become focusable draggable buttons.
   - Horizontal drop changes character offset; vertical drop moves chord to another lyric line.
   - Arrow keys move one column; Shift+Arrow moves four; Up/Down moves line; Escape cancels.
   - Collision avoidance, visible drag/drop states, and aria-live announcements.
   - Textarea stays canonical by serializing the edited draft after each committed move.

4. Add explicit timing adjustment for selected chord.
   - Clicking/focusing a preview chord exposes a seconds input.
   - Saved timing overrides feed the same accepted-chart snapshot.
   - Placement moves derive a new timestamp when no explicit override exists.

5. Verify real Armor of God path and FIRMAMENT deployment.
   - Edit title/key/lyrics/section, symbols, placement, timing, add one chord, remove one chord.
   - Save, reload, real reimport, verify every saved mutation and no canceled mutation.
   - Verify transpose/reset/export and fresh-profile isolation.
   - Deploy clean committed files to FIRMAMENT; verify browser-composited surface and real audio job.

## Acceptance

- Saved exact-recording chart returns byte-equivalent in editable fields after reimport.
- Placement drag and keyboard movement update both preview and textarea.
- Explicit and derived timing persist within 0.1 seconds.
- Different recordings receive generalized chord rules only, never another song's lyric/layout snapshot.
- v1 browser correction records migrate without loss.
- Raw analyzer evidence remains unchanged.
- Real-browser screenshots show coherent desktop and mobile drag controls.
