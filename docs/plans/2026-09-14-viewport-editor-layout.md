# Viewport-first editor layout

Purpose: This exists so that “it needs to look clean and nice in the editing preview as well” and “the whole app can take up more of the viewport and the left side menu can be smaller and maybe collapsible.”

## Existing surface

- Reuse `session-workspace`, `song-library-sidebar`, and `structured-chart`; no parallel editor.
- Preserve canonical lyric/chord DOM and every existing delegated edit/drag handler.
- Remove the v35 per-section horizontal-scroll workaround.

## Changes

1. `index.html`: add accessible desktop rail-collapse button to existing sidebar.
   - Check: button controls sidebar, exposes expanded state, keyboard reachable.
2. `modules/uiController.js`: restore/persist collapse preference and toggle existing workspace class.
   - Check: collapse survives reload; mobile drawer behavior unchanged.
3. `styles/main.css`: widen application work area, shrink expanded rail, add compact collapsed rail, and make structured columns contain/wrap editable lines without overlap or section scrollbars.
   - Check: 2-column editor uses full available width; no section horizontal scrollbar; lyrics and chord lanes remain within each column.
4. `service-worker.js`: advance cache version so FIRMAMENT receives layout assets immediately.
5. Browser regression: create long 2-column chart, verify bounding boxes/no overlap, edit lyric, drag chord, collapse/expand rail, reload, and capture desktop/mobile screenshots.

## Acceptance

- At desktop width, main chart consumes most viewport.
- Expanded rail is compact; collapsed rail leaves a visible restore control.
- Two-column preview has clean gutters and zero cross-column overlap.
- Editing and chord dragging still work.
- Mobile remains one column with existing Song tools drawer.
