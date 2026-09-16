# Chord Row Hotkey and Notation Deletion

## Purpose

This exists so that the user can get from lyrics to the chord row with a hotkey and remove an accidental notation line without damaging nearby lyrics or chords.

## Changes

1. `Alt+ArrowUp` on lyrics focuses the nearest chord at the caret, or inserts and focuses a new chord when the row is empty.
2. `Alt+ArrowDown` on a chord returns to its lyric position.
3. Delete/Backspace on a focused notation row removes that row. Right-click exposes `Delete notation line`.
4. Deleting notation discards only that notation row; it never moves its chords onto another lyric row. A sole notation row becomes one empty lyric row.
5. Section right-click exposes `Delete all chords in this section` and `Copy chords to <destination>` for chord-free destination sections.

## Acceptance

- Real Chromium proves both hotkeys, insertion at the lyric caret, notation keyboard deletion, context-menu deletion, undo, reload, and neighboring-line preservation.
- Existing inline edit, structured notation, syntax, and FIRMAMENT live gates pass.
- Section chord deletion and source-to-destination copying preserve all lyrics and create independent chord IDs.
