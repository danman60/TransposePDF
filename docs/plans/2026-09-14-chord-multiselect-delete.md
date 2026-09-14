# Chord multi-select and delete

Purpose: This exists so that a chord symbol can be single-click selected, Shift-click added to selection, Delete removes selected symbols, and Alt+Z restores them.

## Existing surface

- Main chart chord elements: `ChartRenderer.renderChordAnchors`.
- Delegated chart gestures: `WorkspaceController`.
- Canonical mutation/persistence: `UIController.moveInlineChord` and `persistSong`.

## Changes

1. Add browser lifecycle coverage first: single selection, replacement selection, Shift-toggle, multi-delete, reload persistence, and editable-text deletion isolation.
2. Store selected chord IDs in `WorkspaceController`, expose selection through `aria-pressed` and a visible selected state, and keep clicks compatible with drag.
3. Add one `UIController` batch-delete mutation and exact snapshot undo. Delete exact IDs, preserve all untouched chord records byte-for-byte, persist once, rerender once, and let Alt+Z restore the exact pre-delete chart.
4. Bump service-worker cache, run regression suite, inspect composited screenshots, deploy to FIRMAMENT, and test deployed path.

## Acceptance

- Click selects exactly one chord.
- Shift-click adds/removes chords without clearing the others.
- Delete removes all selected chords and nothing else; Backspace remains available for editing chord text.
- Alt+Z restores the exact deleted chord records and positions.
- Keyboard deletion inside editable lyrics/chords/metadata retains normal text-edit behavior.
- Selection is visibly distinct and accessible through `aria-pressed`.
- Deletion persists after reload; remaining chord IDs, placement, symbols, and metadata remain unchanged.
- Drag, Alt-drag copy, double-click insertion, inline chord editing, and PDF export regressions pass.
