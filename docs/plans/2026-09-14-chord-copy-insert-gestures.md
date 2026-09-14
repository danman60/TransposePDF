# Chord Copy and Insert Gestures

## Purpose

This exists so the user can Alt-drag to copy a chord and double-click above lyrics to enter a new chord.

## Contract

- Normal chord drag moves the selected chord only.
- Alt-drag duplicates the chord with a new stable ID; source and every unrelated chord remain unchanged.
- Modifier state is captured at drag start and honored for mouse/pointer and native drag paths.
- Double-clicking an empty or occupied chord-lane position creates a new chord at the nearest free character column and focuses its symbol for immediate replacement.
- Created/copied chords persist, participate in correction learning, transpose/reset, PDF and ChordPro export.
- Performance and companion views remain read-only.

## Verification

- Real Chromium: normal move, Alt-copy same/cross-line, untouched-anchor invariants, double-click insertion at lyric and blank columns, immediate typing, reload, transpose/export, mouse/touch regression.
