# Resizable song footer

Purpose: This exists so that bottom text should be draggable/resizable to make it fit when needed.

## Changes

1. Persist an optional per-song `layout.footerRows` override while retaining the measured automatic minimum.
2. Use the effective footer row count in the shared editor/PDF page planner.
3. Render a horizontal footer splitter in the editable chart; pointer drag and arrow keys preview and save height.
4. Double-click the splitter to restore automatic sizing.
5. Add focused layout and real-browser lifecycle coverage, then deploy and verify on FIRMAMENT.

## Acceptance

- Dragging upward enlarges footer space and repaginates chart content.
- Dragging downward never permits text overlap.
- Saved footer height survives reload and is used by PDF planning.
- Double-click restores automatic sizing.
- Existing footer reflow, page geometry, and PDF parity checks pass.
