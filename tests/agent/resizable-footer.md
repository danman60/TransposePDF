# Resizable footer lifecycle

Test only local/FIRMAMENT TransposePDF data. Never use production endpoints outside supplied URL.

1. Open app and create or select a song with writer, arranger, manual arrangement, and enough lyric lines to show pagination.
2. Confirm last page shows horizontal dashed `Drag footer height` boundary above footer metadata.
3. Record page count, footer top, and stored song `layout.footerRows` in browser state.
4. Drag boundary upward by at least three visible lyric-row heights.
5. Confirm footer becomes taller, chart content repaginates without overlapping footer, and `layout.footerRows` is larger than its measured minimum.
6. Reload. Confirm custom height persists.
7. Focus boundary. Press ArrowUp. Confirm stored height grows one row.
8. Press ArrowDown. Confirm it shrinks one row but never below `data-min-footer-rows`.
9. Double-click boundary. Confirm `layout.footerRows` returns to null and automatic measured height returns.
10. Capture full workspace screenshot. Report exact assertions and console errors.
