# Songwide Spelling Rules Plan

## Purpose

This exists so chord spellings stay musically coherent across each song and transposition, while any explicit user spelling remains authoritative and persists as an override.

## Existing Surfaces Reused

- Extend `MusicTheory`; do not create a parallel theory engine.
- Keep canonical user-entered symbols in `SongModel.sections` unchanged.
- Reuse song controls and correction-memory snapshots.

## Rules

1. Parse roots and slash bass separately from quality/extensions/alterations.
2. Maintain pitch class separately from spelling.
3. Generate each target major/minor key with one occurrence of each letter name.
4. Diatonic chord roots and bass notes use target-key spelling.
5. Contextual chromatic spelling recognizes secondary dominants, leading-tone diminished chords, and common borrowed `bIII`, `bVI`, and `bVII` roots from neighboring harmony.
6. Preserve extension text (`b9`, `#11`, `add9`, `no3`) and `N.C.` exactly.
7. At zero transposition, preserve every user-entered symbol exactly.
8. Per-song override policy: `contextual`, `flats`, `sharps`, or `preserve`.
9. User-selected policy and saved chord edits persist in the accepted-chart snapshot.

## Work

1. Add pitch/letter/key-signature tables, structured chord parsing, target-key spelling, sequence context, and slash-bass handling to `modules/musicTheory.js`.
2. Add `spellingPolicy` to `SongModel` and correction snapshots.
3. Render structured songs from one sequence-aware spelling pass; add per-song spelling override control.
4. Test all 12 major keys, representative minor keys, slash chords, secondary dominants, leading-tone diminished chords, borrowed roots, extensions, `N.C.`, user overrides, save/reimport, transpose/reset, and PDF export.
5. Capture real browser surfaces, commit/push, and update FIRMAMENT.

## Chord Placement Constraint

- Snap vertically to the single chord baseline above each lyric line.
- Keep horizontal placement free across the line at character-column granularity, including blank space before, between, and after lyric words.
- Do not snap horizontally to words, chords, beats, detected syllables, or audio timestamps.
- Prevent only actual chord-symbol overlap; moving placement may derive timing, but timing never constrains placement.

## Acceptance

- F major uses `Bb`; E major uses `F#`; no diatonic A#/Gb substitutions.
- Valid chromatic functional spellings remain possible in flat and sharp keys.
- Roots and slash bass follow chosen policy; suffix alterations remain unchanged.
- Zero-transposition user spelling is byte-preserved.
- Per-song override persists through save/reimport.
- Existing all-edit learning and PDF import/export remain working.
- Dragging reaches blank spaces and arbitrary lyric columns while all chord symbols stay aligned on the chord baseline.
