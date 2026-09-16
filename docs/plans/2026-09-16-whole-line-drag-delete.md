# Whole-line drag and delete

Purpose: This exists so that “need to be able to DRAG whole lines (incld chords) and delete whole lines (incld chords).”

## Reuse

- Extend `WorkspaceController` delegated HTML5 drag lifecycle already used by chords and sections.
- Extend canonical `SongModel` section line arrays through `UIController`; no parallel state.
- Render controls through existing planned chart rows in `ChartRenderer`.
- Use existing inline undo, persistence, correction learning, telemetry, and rerender path.

## Changes

1. Render one line drag handle on the final visual segment for each editable canonical lyric/notation line.
2. Resolve pointer to before/after row boundaries and render a full-width insertion rule.
3. Move or Alt-copy the complete canonical line across or within sections without modifying chord anchors.
4. Add whole-line deletion to row context menus. Preserve section validity with one blank row when deleting its only line.
5. Add real-browser lifecycle coverage for move, cross-section move, Alt-copy IDs, delete-with-chords, undo, and reload.
6. Reserve a chord lane above every lyric segment in the shared planner, including new/empty-chord lines.
7. Add left-side multi-select checkboxes with batch Delete, Ctrl/Cmd+C/V, and grouped move/Alt-copy drag.

## Acceptance

- Lyrics and all chords move together; chord IDs and offsets remain unchanged on move.
- Alt-copy creates independent line and chord IDs.
- Delete removes the complete line and all its chords.
- Drop position matches visible rule; same-section index math is exact.
- Ctrl/Cmd+Z and reload preserve exact structures.
- Existing chord drag, section drag, editing, and editor/PDF parity tests remain green.
