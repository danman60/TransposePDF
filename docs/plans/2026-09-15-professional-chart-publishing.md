# Professional Chart Publishing Plan

## Purpose

This exists so that users have "full control of how the page sizes/lays out per song," while "the chords always stay linked to the syllable" and editor/PDF remain "one to one the same."

## Invariants

- Manual user entry and placement are canonical.
- Automation supplies defaults only until the user overrides them.
- One semantic song model feeds editor, PDF, ChordPro, rehearsal, and learning.
- One page plan feeds editor and PDF; no export-only layout decisions.
- Imported PDFs and audio-created charts remain editable, transposable, and exportable.
- Existing saved songs migrate without destructive rewriting.

## Existing surfaces to extend

| Requirement | Existing surface | Extension |
|---|---|---|
| Proportional typography | `LyricAnchor`, `AuthoringController`, `ChartPageLayout` | measured text advances and semantic pixel/point projection |
| Mixed layouts | `layout.sectionRules.spanColumns` | per-section `columnSpan` and region transitions inside a page |
| Page boundaries | semantic `layout.breaks` and draggable boundary targets | explicit page handles and continuation-header options |
| Section-aware flow | keepTogether/start/spacing/balance | orphan/widow rules and user-overridable defaults |
| One-to-one compositor | shared `ChartPageLayout` | common positioned render primitives and parity evidence |
| Musical notation | section types plus ChordPro import/export | structured measure/repeat/ending/cue tokens |
| Professional metadata | title/key/writer/arranger/tempo/time | recording, CCLI, copyright, page numbers, header/footer templates |
| Presets | lead-sheet/stage/large-print/custom | SongSelect, compact columns, hymnal, Nashville, tablet |

## Phase 1 — measured proportional layout

Status: implemented in v52 candidate. Deterministic Helvetica metrics drive wrapping, editor chord projection, pointer-to-anchor conversion, and PDF chord coordinates. Legacy songs remain `mono`; professional presets select `sans`.

Files:
- `modules/songModel.js`: persist font family and anchor projection version.
- `modules/chartPageLayout.js`: replace fixed `0.6em` capacity with deterministic measured advances supplied by shared metrics.
- `modules/chartRenderer.js`: render proportional lyrics while projecting chord anchors from semantic character/syllable offsets.
- `modules/pdfGenerator.js`: use identical font metrics and X coordinates.
- `modules/authoringController.js`, `modules/workspaceController.js`: convert pointer X to nearest semantic text boundary, including blank-space anchors.
- `styles/main.css`, `index.html`, `modules/uiController.js`: font-family control with accessible defaults.
- Tests: add measured-wrap, freeform-anchor, editor/PDF-coordinate, transpose, and reload coverage.

Acceptance:
- A 48-character line consumes the visible region up to the divider before wrapping.
- Chord X coordinates differ by no more than 2pt between editor and PDF.
- Dragging a divider replans live; dragging chords never moves neighboring chords.
- Existing monospaced songs load unchanged; chosen typography persists per song.

## Phase 2 — mixed section layout regions

Status: implemented in v53 candidate. Existing `Span all columns` now produces page-relative full-width regions before, between, or after balanced multi-column regions instead of forcing a dedicated page.

Files:
- Extend `layout.sectionRules` with `columnSpan: 1..columns` and `regionStart`.
- Extend `ChartPageLayout.plan()` to emit ordered full-width and multi-column regions on the same page.
- Extend existing section context menu and sidebar; no new layout editor.
- Render/export identical region grids.

Acceptance:
- Full-width intro → two-column verses → full-width chorus works on one page.
- Region transitions are draggable and undoable.
- Section, line, chord, lyric, and manual-placement data remain byte-identical after layout-only edits.

## Phase 3 — publication flow controls

Status: implemented in v54 candidate. Per-song controls now cover continuation title/key, page numbering, and heading orphan protection. Existing semantic page boundaries remain draggable, persisted, transposition-safe, and undoable.

- Extend semantic breaks with draggable page boundaries.
- Add defaults for heading orphan prevention, chord/lyric pairing, short-section keep-together, and optional continuation headers.
- Expose each default as a per-song control; manual breaks always win.
- Add page numbers and optional repeated title/key header.

Acceptance:
- No orphan section heading or separated chord/lyric pair.
- User page break survives reload, transpose, PDF, and undo.
- Intentional sparse pages remain possible.

## Phase 4 — structured musical notation

Status: implemented in v55 candidate. Canonical notation source derives typed runs; chord runs preserve stable IDs/manual provenance while literal repeat, ending, slash, hold, and navigation tokens never transpose. Inline editing, ChordPro `x_notation`, reload, and PDF share this model.

- Extend line schema with notation runs: barline, repeat-start/end, measure, ending, rhythmic slash, rest/hold, `N.C.`, and navigation cue.
- Reuse ChordPro directive parser/exporter; preserve unknown directives.
- Add inline notation toolbar and keyboard entry on main surface.
- Render notation identically in editor/PDF.

Acceptance:
- SongSelect-style instrumental/repeat/first-second-ending examples round-trip through save/reload/PDF/ChordPro.
- Chord transposition changes chord tokens only; cues and bar structure remain unchanged.

## Phase 5 — professional metadata and templates

Status: implemented in v55 candidate. Recording, copyright, CCLI song/license metadata are inline-editable in the shared footer and round-trip through ChordPro. Per-song header/footer visibility and six non-destructive professional presets extend the existing layout director.

- Extend existing song metadata with recording attribution, copyright, CCLI song/license numbers, subtitle, and header/footer visibility.
- Make all fields inline-editable and canonical.
- Add header/footer templates without duplicating PDF metadata logic.
- Add presets: SongSelect full-width, compact two-column, hymnal three-column, Nashville, large-print stage, tablet.

Acceptance:
- Metadata appears identically in editor and PDF and round-trips through ChordPro where supported.
- Each preset changes layout defaults only; applying it never rewrites content or manual chord positions.

## Phase 6 — full lifecycle verification and release

- Migration tests across existing ArmorOfGod checkpoints and imported PDF songs.
- Real browser lifecycle: create, paste, audio import with authoritative lyrics, PDF import, edit, drag, transpose, undo, reload, export.
- Compare editor screenshots and PDF bounding boxes for every layout/preset.
- Cross-browser desktop/mobile pass; accessibility and keyboard pass.
- Deploy static/runtime files to FIRMAMENT without restarting user-facing processes.
- Verify served hashes, cache version, real FIRMAMENT browser output, and saved ArmorOfGod invariants.

## Completion evidence

- Requirement-by-requirement report with direct test names and artifacts.
- Composited screenshots for each layout family sent to Telegram.
- Searchable PDFs visually compared with editor output.
- Clean syntax, diff, security grep, commit, push, FIRMAMENT served-hash verification.
