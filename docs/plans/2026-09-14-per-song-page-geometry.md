# Per-song page geometry

Purpose: This exists so that each song can have exact page geometry: page size, orientation, margins, gutter width, and independently draggable column dividers, with editor and PDF staying one-to-one.

## Contract

- Geometry persists under `song.layout`; no lyric, chord, section, attribution, arrangement, or provenance mutation.
- Built-in page sizes: Letter, A4, Legal, Tabloid. Custom width/height accepted in inches. Portrait/landscape explicit.
- Four independent margins, gutter width, and N−1 column-divider positions persist per song.
- Divider positions are bounded so every column remains usable. Two columns expose one divider; three expose two.
- Editor wrapping and PDF X coordinates use the same computed column widths.
- Deviation resolved in v50: v49 initially wrapped both columns at the narrowest width and previewed only CSS widths. Planner now wraps each column independently; pointer movement rerenders an unsaved canonical preview before release.
- Undo/version history covers every geometry edit.

## Files

1. `modules/songModel.js`: normalize geometry and divider positions.
2. `modules/chartPageLayout.js`: compute page dimensions, margins, gutter, ratios, widths, X offsets, wrap limits.
3. `modules/chartRenderer.js` + `styles/main.css`: exact page aspect ratio, unequal column grid, vertical draggable gutter handles and guides.
4. `modules/workspaceController.js` + `modules/uiController.js`: pointer drag and sidebar geometry inputs.
5. `modules/pdfGenerator.js`: initialize/add pages at per-song size and render shared column X positions.
6. Tests: deterministic geometry, browser drag/persistence, editor/PDF parity, content-count invariant.

## Acceptance

- Layout mode immediately shows vertical handles between columns.
- Dragging one handle changes adjacent column widths without changing total printable width.
- Reload retains geometry for that song only.
- Export PDF page dimensions, margins, gutters, divider positions, wrapping, and orientation match editor.
- Armor of God chart content counts remain unchanged.
