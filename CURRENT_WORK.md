# Current Work

## Active Task

Implement unified chord-sheet authoring: manual creation plus compatible PDF import, transposition, editing, and PDF export through one canonical song model.

## Recent Changes

- Live deployment and local E2E audit completed 2026-09-12.
- Implementation plan created at `docs/plans/2026-09-12-unified-chord-authoring.md`.
- Added canonical Song/Section/Line/ChordAnchor model with future timestamp/confidence fields.
- Added manual chord-sheet creation, paste parsing, live preview, editing, transpose/reset, and PDF export.
- Adapted existing PDF imports into the same editable model while retaining original positioned layout.
- PDF imports append to the collection instead of replacing authored charts.
- Added synchronized long-line wrapping and monospaced chord/lyric metrics for generated PDFs.
- Updated offline cache for the required song model.

## Blockers

- MP3 analysis remains a separate backend/model implementation.
- A lyric-only line containing only chord-shaped tokens is inherently ambiguous in alternating-row paste format; live preview exposes interpretation for correction.

## Next Steps

1. Implement MP3 upload and background analysis pipeline.
2. Add persistent local/cloud song library.
3. Add direct chord-anchor placement UI beyond alternating-row text entry.

## Context for Next Session

- HEAD at start: `a4394e09ad1aac07e95e5ec19f81b80ad798abf7`.
- Existing dirty state: 462 tracked deletions under `node_modules`; preserve them.
- `UIController` has HIGH blast radius and global inline wiring.
- Do not alter `MusicTheory` public signatures.
- Direct E2E: 18/18 authoring/import/export checks plus 7/7 regression checks passed.
- QA Agent attempted 16 checks but timed out before its first browser action; direct browser results are authoritative.
