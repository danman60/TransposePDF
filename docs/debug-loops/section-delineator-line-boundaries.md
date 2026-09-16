# Loop Debug: section delineator line boundaries
URL: http://127.0.0.1:8000 on FIRMAMENT
Started: 2026-09-16
Status: RESOLVED

## Attempt 1 — 2026-09-16
### Evidence Gathered
- `updateSectionDropIndicator()` creates candidates only at each section block's top and bottom.
- No lyric-row boundary is considered.
- The nearest whole-section edge therefore wins when the pointer is inside Verse 1, producing the reported jump above the intended line.
- Screenshot `photo_20260916_134529_AQADOw1r.jpg` shows a chord/lyric unit clipped at the page bottom. `.paginated-chart .chord-line` inherits global `.25rem` bottom margin that the row planner never budgets; this accumulates down the page.

### Hypothesis
Missing line-level candidates cause the delineator jump. Unbudgeted browser-only row margin independently causes page-edge clipping.

### Fix Applied
- Added lyric-row drop candidates. Pointer positions inside a chord/lyric row now resolve to that exact row rather than whichever row-top edge is closest.
- Moving a delineator into a row splits the target section before that row and prepends the suffix under the moved heading. Stable line/chord IDs and exact undo are preserved.
- Removed the unbudgeted paginated chord-row bottom margin and aligned notation row height with the shared 1.2em planner budget.

### Result After Deploy
- Local and FIRMAMENT live real-browser gates: 10/10 each.
- Existing section drag: 6/6. Publication: 11/11. Geometry: 9/9. Editor/PDF parity: 6/6. Chord/notation lifecycle: 15/15.
- FIRMAMENT HTTP 200, cache `transpose-app-v57`, and exact SHA-256 identity for all four runtime files. Live URL reopened in Chrome.
