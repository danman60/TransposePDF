# Loop Debug: chord cross-line drag and Alt-copy
URL: http://127.0.0.1:8000 on FIRMAMENT
Started: 2026-09-16
Status: IN_PROGRESS

## Attempt 1 — 2026-09-16
### Evidence Gathered
- Existing live generic inline drag suite passes 10/10, including cross-line mouse and touch movement.
- That suite targets a destination line that already contains chords and does not begin with the user's single-click selection gesture.
- Non-editing `.inline-chord-edit` text remains browser-selectable, competing with pointer drag initiation on the visible symbol.

### Hypothesis
Coverage misses selected-symbol to empty-lane and selected-symbol Alt-copy paths. Browser text selection on the non-editing symbol makes physical drag initiation unreliable despite synthetic pointer movement passing.

### Fix Applied
- Disabled browser text selection on non-editing chord symbols so pointer movement starts drag reliably.
- Kept text selection enabled only after double-click enters chord edit mode.
- Prevented default pointer-down text selection while preserving click selection, double-click edit, move, and Alt-copy.

### Result After Deploy
- Local exact-path gate 8/8; full chord/edit regression matrix 49/49.
- Deployment verification pending.
