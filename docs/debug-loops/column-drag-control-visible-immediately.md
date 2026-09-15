# Loop Debug: column drag control visible immediately
URL: http://127.0.0.1:18000/
Started: 2026-09-14T22:18:36-0400
Status: IN_PROGRESS

## Attempt 1 — 2026-09-14T22:18:36-0400
### Evidence Gathered
- FIRMAMENT serves cache v47 and renderer/UI files byte-identical to commit `cf685b5`.
- Renderer emits draggable dotted boundary only when `song.layout.layoutMode` is true and a manual break already exists.
- Layout mode alone emits only invisible drop targets. User therefore sees no draggable control.

### Proven Cause
Implementation modeled only existing manual breaks, not current automatic column/page termination.

### Fix Applied
- `modules/chartRenderer.js`: render current automatic column/page terminations as labeled dotted handles when Layout mode opens.
- `modules/workspaceController.js`: existing pointer drag promotes automatic termination to a manual semantic break.
- `styles/main.css`: larger outlined handle and drag cursor.

### Result After Deploy
- LOCAL PASS: 7/7 browser lifecycle checks. Automatic handle visible before any right-click; pointer drag reanchors and persists.
- PENDING LIVE
