# Independent editor columns

## Purpose

This exists so that the two- and three-column editor packs sections cleanly with no false blank rows, matching the printable chart.

## Steps

1. Add a real-browser regression proving multi-column charts use independent column flow rather than shared CSS Grid rows.
   - Check: two-column computed layout uses two CSS columns; sections do not inherit a tall neighbor's row height.
2. Replace desktop structured-chart Grid columns with CSS multi-column flow.
   - Check: sections stay intact, editable, and full column width; credits and Add section span all columns.
3. Preserve mobile single-column presentation and advance offline cache.
   - Check: mobile reports one column; cache version advances.
4. Run focused editor, section-drag, PDF, and deployed-browser regression checks; capture and review final screenshot.

