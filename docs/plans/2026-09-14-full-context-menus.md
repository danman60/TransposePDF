# Full chart context menus

Purpose: This exists so every chart object exposes the editing commands relevant to it, and section insertion happens at the clicked position instead of the bottom of the whole chart.

## Menus

- Chord: edit, delete, duplicate, copy, copy/move to section or adjacent line, mark canonical, timing, review.
- Lyric line: add/split/join, paste lyrics, clear chords, copy matching chord pattern.
- Section: add above/below, rename, duplicate, copy chords/whole section, reorder/column move, delete.
- Blank chord lane: add/paste chord, paste sequence, add N.C., copy matching section chords.

## Rules

- Context is exact song/section/line/chord/character offset under pointer.
- Blank chart insertion resolves nearest visual section, not song end.
- Every mutation uses existing persistence and audio-learning path.
- Manual input and accepted copies remain canonical.
- Destructive actions separated visually; uncommon actions grouped under More.

## Acceptance

- Correct menu appears for each target type.
- Add-here uses clicked/nearest position.
- Actions modify only selected target and persist once.
- Escape/outside click/scroll closes menu; keyboard focus begins at first action.
- Existing drag, double-click, inline edit, selection, and native text editing remain usable.
