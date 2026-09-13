# QA Artifact Preservation and Removal Manifest

Inventory taken from git HEAD and reconciled during the approved repository cleanup on 2026-09-13.

## Preserve

- `test_files/test_chord_chart.pdf` — small deterministic PDF fixture.
- `tests/agent/flow-correction-learning.md` — current correction-learning QA contract.
- `tests/agent/flow-master-lifecycle.md` — canonical lifecycle QA contract.
- `tests/e2e_all_edits.py` — focused Armor recording/edit/export regression.
- `tests/e2e_persistent_session.py` — persistent multi-song lifecycle regression.
- `tests/testSuite.js` — deterministic music/parser regression coverage.

## Completed Cleanup

### Installed dependencies

- 462 tracked files under `node_modules/` removed from the working tree. `package-lock.json` remains the reproducible source.

### Generated media

- Generated `.png`/`.pdf` files are excluded from source control. The sole committed PDF is the deterministic fixture named above.

### Root test/debug JavaScript

The 33 root scripts below were removed after assertion mapping:

`comprehensive_transpose_test.js`, `create_test_pdf.js`, `debug_song_display.js`, `debug_upload_test.js`, `detailed_test_analysis.js`, `final_comprehensive_test.js`, `final_transpose_test.js`, `golden_test_1_pdf_loading.js`, `golden_test_2_transposition.js`, `golden_test_3_export.js`, `golden_test_4_visibility.js`, `golden_test_5_layout.js`, `golden_tests_playwright.js`, `inspect_page.js`, `quick_export_test.js`, `run_golden_tests.js`, `screenshot_app.js`, `screenshot_with_pdf.js`, `test_all_fixes.js`, `test_export_functionality.js`, `test_export_functionality_v2.js`, `test_fixes.js`, `test_issues_validation.js`, `test_pdf_loading_issues.js`, `test_real_songbook.js`, `test_real_songbook_v2.js`, `test_song_detection_fix.js`, `test_transpose.js`, `test_transpose_app.js`, `test_transpose_real_songs.js`, `test_transposepdf.js`, `test_ui_interactions.js`, `transpose_test.js`.

Their still-relevant behaviors map to `flow-master-lifecycle.md`: load/error handling (steps 1, 8, 14), transposition/reset/enharmonic behavior (steps 2–3), PDF export and filename safety (step 10), responsive layout/visibility/accessibility (steps 11–12), and console/network diagnostics (steps 14–15). Music-parser edge cases remain in `tests/testSuite.js`; the persistent and Armor browser suites retain real lifecycle coverage. The legacy scripts used stale selectors, injected synthetic DOM state, hard-coded Windows paths, or duplicated those checks.

### Other generated/runtime files

- Root and nested `__pycache__/`, `.playwright-cli/`, `artifacts/`, `test-results/`, `tests/reports/`, and `tasks/` are ignored. Existing untracked contents remain untouched.

## Verification Gate

1. Clean install from lockfiles succeeds.
2. `npm test -- <explicit-non-production-url>` passes the master checklist.
3. Unique assertions from every removed test are mapped above or intentionally retired as stale implementation-coupled checks.
4. Canonical fixtures are named explicitly; screenshots remain run artifacts, not baselines.

The canonical runner writes new QA reports outside the repository under
`${XDG_STATE_HOME:-/home/danman60/.local/state}/transposepdf/qa-reports` unless an explicit
`--report-dir` override is supplied.
