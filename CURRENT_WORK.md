# Current Work

## Active Task

Implement recording-to-chord-chart authoring through the same editable/transposable/exportable model used by manual and PDF imports.

## Recent Changes

- Live deployment and local E2E audit completed 2026-09-12.
- Implementation plan created at `docs/plans/2026-09-12-unified-chord-authoring.md`.
- Added canonical Song/Section/Line/ChordAnchor model with future timestamp/confidence fields.
- Added manual chord-sheet creation, paste parsing, live preview, editing, transpose/reset, and PDF export.
- Adapted existing PDF imports into the same editable model while retaining original positioned layout.
- PDF imports append to the collection instead of replacing authored charts.
- Added synchronized long-line wrapping and monospaced chord/lyric metrics for generated PDFs.
- Updated offline cache for the required song model.
- Added local FFmpeg/NumPy major/minor chord analysis and OpenAI word-timestamp transcription.
- Added background Starlette audio jobs with 100 MB upload validation, bounded concurrency, cancellation, TTL cleanup, and no-store status responses.
- Added recording import/progress UI; completed drafts open directly in the existing editor.
- Preserved chord timing/confidence through nearby lyric and chord corrections.
- Added accurate web-app runtime dependencies and README.

## Blockers

- No production deployment target exists. Audio backend needs FFmpeg-capable hosting plus authentication/rate limiting and durable job storage before public exposure.
- Mixed-vocal synthetic test detected A/E/A instead of backing C/F/G/Am; current chord analysis is draft-grade, not production-accuracy.
- A lyric-only line containing only chord-shaped tokens is inherently ambiguous in alternating-row paste format; live preview exposes interpretation for correction.

## Next Steps

1. Choose and configure an FFmpeg-capable production worker host; add auth, rate limiting, durable jobs, and secret management.
2. Improve chord accuracy with vocal/instrument separation, beat/downbeat tracking, and richer chord vocabulary.
3. Add persistent local/cloud song library and direct visual chord-anchor placement.

## Context for Next Session

- HEAD at start: `a4394e09ad1aac07e95e5ec19f81b80ad798abf7`.
- Existing dirty state: 462 tracked deletions under `node_modules`; preserve them.
- `UIController` has HIGH blast radius and global inline wiring.
- Do not alter `MusicTheory` public signatures.
- Direct E2E: 18/18 authoring/import/export checks plus 7/7 regression checks passed.
- QA Agent attempted 16 checks but timed out before its first browser action; direct browser results are authoritative.
- Audio probes: pure C/F/G/Am analyzer 4/4; real 2-second transcription 6/6 words with timestamps.
- Final audio browser E2E passed upload, cancel, same-file retry, edit, timing retention, transpose, reset, and PDF download; 0 console errors.
- Vercel account project inventory, GitHub Pages API, and repository config all confirm no current production deployment.
