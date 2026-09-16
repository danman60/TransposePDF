# Loop Debug: page break visible in right-click menu
URL: http://127.0.0.1:8000 on FIRMAMENT
Started: 2026-09-16
Status: RESOLVED

## Attempt 1 — 2026-09-16
### Evidence Gathered
- Playwright CLI launch failed before navigation because Chromium sandboxing is unavailable on this host.
- Live app serves v59 and HTTP 200.
- `WorkspaceController.handleContextMenu()` includes `Start new page after this line` only in notation and lyric branches.
- Chord, chord-lane, and section-heading branches omit page-break actions.

### Hypothesis
The menu is target-dependent. Right-clicking the chord area or section heading—the normal places users invoke chart layout—cannot expose page-break creation.

### Fix Applied
- Added line-level page/column break commands to chord-symbol and chord-lane menus.
- Renamed section flow commands to explicit `Add page break before this section` and `Add column break before this section` labels.

### Result After Deploy
- Local and FIRMAMENT live real-browser gates pass 10/10 across lyric, chord, lane, and section menus; page-break creation persists through reload.
- FIRMAMENT serves HTTP 200 and cache `transpose-app-v60`.
