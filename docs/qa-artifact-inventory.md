# QA Artifact Preservation and Removal Manifest

Inventory taken from git HEAD on 2026-09-13. This file authorizes no deletion. Review and approve exact removal targets before `git rm` or filesystem deletion.

## Preserve

- `test_files/test_chord_chart.pdf` — small deterministic PDF fixture.
- `tests/agent/flow-correction-learning.md` — current correction-learning QA contract.
- `tests/agent/flow-master-lifecycle.md` — canonical lifecycle QA contract.
- `tests/e2e_all_edits.py` — current focused Armor regression until its unique assertions are represented in QA Agent.
- `golden_test_*.js`, `golden_tests_playwright.js`, and `tests/testSuite.js` — temporary evidence sources; preserve until unique assertions are mapped into the master checklist.
- Selected release screenshots only after a separate visual-baseline review identifies canonical files.

## Removal Candidates — Do Not Delete Yet

### Installed dependencies

- 462 tracked files under `node_modules/`. Reconstruct from `package-lock.json`; candidate for removal from Git index after clean-install QA.

### Generated media

- 151 tracked `.png`/`.pdf` files: 59 under `test_results/`, 12 under `screenshots/`, 16 under other screenshot directories, 7 under `test_downloads/`, 56 at repository root, and 1 preserved fixture under `test_files/`.
- Root media candidates include `final_test_*`, `transposepdf_test_*`, `screenshot_*`, `step*_*.png`, `debug_*.png`, and downloaded/generated PDFs. Classify canonical visual evidence before removal.

### Root test/debug JavaScript

33 scripts require assertion mapping before removal:

`comprehensive_transpose_test.js`, `create_test_pdf.js`, `debug_song_display.js`, `debug_upload_test.js`, `detailed_test_analysis.js`, `final_comprehensive_test.js`, `final_transpose_test.js`, `golden_test_1_pdf_loading.js`, `golden_test_2_transposition.js`, `golden_test_3_export.js`, `golden_test_4_visibility.js`, `golden_test_5_layout.js`, `golden_tests_playwright.js`, `inspect_page.js`, `quick_export_test.js`, `run_golden_tests.js`, `screenshot_app.js`, `screenshot_with_pdf.js`, `test_all_fixes.js`, `test_export_functionality.js`, `test_export_functionality_v2.js`, `test_fixes.js`, `test_issues_validation.js`, `test_pdf_loading_issues.js`, `test_real_songbook.js`, `test_real_songbook_v2.js`, `test_song_detection_fix.js`, `test_transpose.js`, `test_transpose_app.js`, `test_transpose_real_songs.js`, `test_transposepdf.js`, `test_ui_interactions.js`, `transpose_test.js`.

### Other generated/runtime files

- Root and nested `__pycache__/`, `.playwright-cli/`, `artifacts/`, `test-results/`, `tests/reports/`, and `tasks/` are ignored going forward. Existing untracked contents remain untouched.

## Removal Gate

1. Clean install from lockfiles succeeds.
2. `npm test -- <explicit-non-production-url>` passes the master checklist.
3. Unique assertions from every candidate test are mapped to the canonical checklist or intentionally retired in review notes.
4. Canonical fixtures and approved visual baselines are named explicitly.
5. User approves the exact `git rm --cached` / deletion list.

The canonical runner writes new QA reports outside the repository under
`${XDG_STATE_HOME:-/home/danman60/.local/state}/transposepdf/qa-reports` unless an explicit
`--report-dir` override is supplied.
