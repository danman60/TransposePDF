# Loop Debug: chord row hotkey and delete notation line
URL: http://127.0.0.1:8000 on FIRMAMENT
Started: 2026-09-16
Status: IN_PROGRESS

## Attempt 1 — 2026-09-16
### Evidence Gathered
- Notation context menu contains layout and insertion actions but no deletion action.
- Keyboard handler deletes empty lyric rows only; notation rows have no Delete/Backspace branch.
- Generic line deletion transfers removed chords to a neighboring lyric line, unsafe for notation deletion.
- No Alt+Arrow chord-row navigation exists.

### Hypothesis
The reported behavior is caused by missing command paths, not focus or persistence failure.

### Fix Applied
- `modules/workspaceController.js`: chord-row hotkeys, notation Delete/Backspace, notation context deletion, and section chord actions.
- `modules/uiController.js`: safe notation-row deletion and section-wide chord clearing through existing undo/persistence paths.
- `service-worker.js`: cache v56.
- Real-browser regression: `tests/e2e_chord_hotkey_notation_delete.py` passes 15/15.

### Result After Deploy
- PENDING
