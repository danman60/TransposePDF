# Visual, Beauty, and Function Audit Fix Plan

## Purpose

This exists so TransposePDF feels polished, readable, and dependable during real chart authoring—not merely functional.

## Verified Baseline

- Desktop editor stacks source and full preview, burying Save on long songs.
- Mobile editor renders both full source and preview, producing excessive scrolling.
- Native HTML drag lacks reliable touch behavior.
- White text on cyan surfaces fails normal-text contrast.
- Audio/text file labels wrapping hidden inputs are not keyboard-operable.
- Progress, global status, loading, and errors lack complete accessible semantics.

## Work

1. Recompose authoring without replacing existing editor logic.
   - Desktop bounded split workspace: source left, preview right, independent scrolling.
   - Sticky action footer keeps Save visible.
   - Mobile Source/Preview tabs show one pane at a time.
   - Selected-chord toolbar stays visible inside preview.

2. Make placement dependable across pointer types.
   - Preserve free horizontal character-column placement and vertical baseline snapping.
   - Add pointer-event dragging for mouse/touch/pen with movement threshold.
   - Add tap-select movement buttons for precise mobile fallback.
   - Keep exact drop caret and actual-overlap-only collision rule.

3. Correct visual hierarchy and contrast.
   - Use dark ink on cyan primary surfaces.
   - Unify Export with primary action color; reserve green for success state.
   - Tighten header height, improve chart rhythm, section-label contrast, focus/pressed states, and mobile control wrapping.
   - Remove visible glyph-weight mismatch from start actions.

4. Repair functional accessibility.
   - Real buttons trigger recording and lyric inputs.
   - Live status/progress semantics and busy states.
   - Alert-dialog focus entry/restore and Escape behavior.
   - Explicit transpose accessible names; suppress global shortcuts inside editable controls.
   - Semantic main/articles and labelled sections.

5. Verify.
   - Desktop/mobile screenshots: start, editor source, editor preview with selected chord, long chart with sticky Save.
   - Pointer/keyboard placement into blank columns and across lyric lines.
   - Manual/PDF/audio authoring, spelling policies, transpose/reset, correction persistence, export, offline update.
   - 200% zoom and keyboard-only pass; zero console errors.
   - Commit/push and copy runtime files to FIRMAMENT.

## Acceptance

- Save remains reachable without scrolling outside editor workspace.
- Mobile displays one authoring pane at a time and offers touch movement controls.
- Chords can land on arbitrary blank columns; only actual overlap changes requested offset.
- Primary text and controls meet WCAG AA contrast and visible focus requirements.
- File imports, progress, errors, and transpose controls are keyboard/screen-reader understandable.
- Existing Armor of God all-edit learning and PDF output remain passing.
