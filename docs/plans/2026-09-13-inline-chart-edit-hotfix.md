# Inline Chart Editing Hotfix

## Purpose

This exists so that the user can type/delete text directly where highlighted in the displayed chart.

## Changes

1. Render displayed lyrics and chord symbols as explicit inline-edit targets with stable section/line/chord coordinates.
2. Delegate input, blur, and keyboard handling through the workspace controller; update canonical `SongModel` data, autosave through `SessionStore`, and feed correction memory.
3. Preserve freeform chord placement, transpose display, authoring editor, PDF/ChordPro export, and read-only performance/companion surfaces.
4. Add real-browser lifecycle assertions for direct lyric deletion/typing, chord-symbol replacement, reload persistence, transpose/reset, and export parity.

## Acceptance

- Click highlighted displayed lyric text, type/delete in place, blur, reload: exact edit remains.
- Click displayed chord symbol, replace it in place, blur, reload: exact symbol remains and learns on explicit save boundary.
- No inline editing in performance/companion/PDF layout.
- Existing persistent, Armor, transpose, authoring, and UX suites pass.
