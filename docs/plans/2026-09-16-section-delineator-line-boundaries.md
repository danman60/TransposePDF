# Section Delineator Line-Boundary Drag

## Purpose

This exists so that a section delineator can be dragged to the exact lyric-line boundary where the user wants the next section to begin.

## Changes

1. Include every canonical lyric/notation line boundary in section-drag hit-testing.
2. Render a full-width insertion rule at the selected line.
3. On drop, keep lines above the boundary in the target section and transfer the boundary line plus following lines under the dragged section heading, before any existing content in that section.
4. Preserve stable line/chord IDs, manual anchors, undo, persistence, columns, and wrapped-line behavior.
5. Remove legacy editor-only row margin so every chord/lyric unit wraps to the next page before crossing the physical page edge.

## Acceptance

- Five-line Verse 1 accepts a dragged Bridge delineator before line 3.
- Verse 1 retains lines 1–2; Bridge owns lines 3–5 followed by its prior content.
- Marker is on the requested lyric row, not a section edge.
- Ctrl+Z and reload preserve exact structures.
- No rendered chart row extends below any `.chart-page-body` boundary.
