# Loop Debug: added section overlaps bottom credits
URL: http://127.0.0.1:8000 on FIRMAMENT
Started: 2026-09-16
Status: RESOLVED

## Attempt 1 — 2026-09-16
### Evidence Gathered
- User screenshot shows final Chorus chord/lyric rows crossing Writer, Arrangement by, and Recording footer rows.
- Shared planner reserves one row per credit and four rows for Arrangement: 10 rows with empty editable metadata.
- Rendered footer uses 18pt Arrangement at 4.8em plus six 13pt rows, grid gaps, and `.7em` top padding: approximately 14 chart-row units.
- Footer is correctly fixed below flex content; content overlap means planner reservation is too small.

### Hypothesis
Under-reserved footer height lets newly inserted section rows remain on final page when they must wrap to another page/column.

### Fix Applied
- Footer reservation now derives from actual 18pt Arrangement height, 13pt credit rows, grid gaps, top padding, and border in shared chart-row units.
- At 13pt this changes editable footer reservation from 10 to 14 rows, forcing newly added content onto the next page/column before collision.

### Result After Deploy
- Local and FIRMAMENT live populated-section lifecycles pass 6/6. Added Chorus reflows to page 2 with zero chart-line/footer intersection.
- Existing page-boundary 10/10, editor/PDF parity 6/6, page geometry 9/9, and publication 11/11 pass.
- FIRMAMENT serves HTTP 200 and cache `transpose-app-v62`.
