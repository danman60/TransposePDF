# Repeat-section chord offer

Purpose: This exists so that naming a section Verse 2, Pre-Chorus 2, or Chorus 2 offers the matching earlier section’s chord changes without copying lyrics.

## Change

1. Treat explicit labels as authoritative over generic stored section type.
2. On empty-chord repeated sections, show a non-blocking `Use chords from …` action.
3. On acceptance, copy exact chord symbols and relative placements line-by-line; never replace lyrics or existing chords.
4. Copied chords receive new IDs, manual provenance, target-line anchors/timing, one save, and normal audio correction learning.
5. Bump cache, verify, deploy.

## Acceptance

- Verse 2 finds earlier Verse 1; numbered pre-chorus/chorus variants behave identically.
- No copy happens without click.
- Offer disappears when target already has chords.
- Lyrics remain byte-identical.
- Copied changes persist and remain independently editable.
- Manual arrangement override remains exact.
