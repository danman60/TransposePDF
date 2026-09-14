# Song Layout, Stable Chord Anchors, Credits, and Arrangement Plan

## Purpose

This exists so that a musician can build a 1-, 2-, or 3-column chord sheet with labeled sections, keep every chord attached to the intended lyric position while lyrics are edited, and publish editable writer, arranger, and arrangement information in the app and PDF.

## Non-negotiable product rule

User input is canonical. A manual chord spelling, chord position, section label, column choice, credit, lyric, or arrangement entry must never be replaced by inference, normalization, import reconciliation, transposition heuristics, or a later analysis pass. Automation may populate an empty value and may offer a suggestion beside a manual value. It may not silently mutate a manual value.

## Current-state findings

- `SongModel.create()` is the canonical normalization point for manual, PDF, ChordPro, and audio-derived songs. It currently retains `characterOffset` only for chord placement.
- `ChartRenderer.renderStructuredContent()` renders labeled sections and editable chord/lyric rows. Chords are positioned with `--chord-column` from `characterOffset`.
- `UIController` owns inline lyric edits, chord insertion, movement, persistence, display controls, and PDF export. It is the principal integration surface and a high-blast-radius file.
- `WorkspaceController` owns delegated click, change, double-click, pointer-drag, and native drag events for the live sheet.
- `LibraryStore.saveSong()` stores the entire normalized song in IndexedDB and versions complete song snapshots. New song fields therefore need record migration/normalization, not a new object store.
- `PDFGenerator` supports structured sections and character-offset chord rows, but has one-column flow only and no credits or arrangement footer.
- `ChordPro` supports title/subtitle/key/tempo/time/capo plus verse, chorus, and bridge sections. It does not distinguish artist, writer, arranger, layout, or arrangement order.
- Performance mode already has a session-only 1/2/3-column control. That setting is not a persisted per-song print/layout preference.

## Industry-standard approach and tradeoffs

Standard lead-sheet tools separate semantic content from presentation: songs contain stable sections and lyric/chord anchors; layout contains column count; credits and arrangement order are metadata. ChordPro-compatible directives carry portable metadata, while application-specific directives preserve features ChordPro does not standardize.

Use that model here. Do not store three separately edited column bodies or absolute pixel coordinates. Columns are presentation over one canonical section sequence. This keeps transposition, PDF export, ChordPro, and future collaboration consistent.

For lyric attachment, a bare character index is insufficient: inserting text before a chord moves the intended word. Full collaborative-editor relative positions would add a document engine and CRDT dependency. Use a durable semantic anchor plus a materialized character offset. This gives stable single-user editing now and can later map to collaborative relative positions without changing the song surface.

## Canonical data schema (song schema version 2)

```js
{
  schemaVersion: 2,
  // existing song fields
  credits: {
    writer: { value: "", provenance: "manual|imported|inferred", updatedAt: null },
    arranger: { value: "", provenance: "manual|imported|inferred", updatedAt: null }
  },
  layout: {
    columns: 1,                 // integer 1..3, provenance manual once user changes it
    columnsProvenance: "default|manual|imported"
  },
  arrangement: {
    mode: "auto|manual",
    value: "V1 V2 C B C",      // exact user-authored shorthand when mode=manual
    inferredValue: "V1 V2 C",  // always recomputable from section order
    updatedAt: null
  },
  sections: [{
    id: "stable UUID",
    type: "verse|chorus|bridge|pre-chorus|intro|outro|tag|interlude|vamp|refrain|section",
    label: "Verse 1",
    labelProvenance: "manual|imported|inferred",
    lines: [{
      id: "stable UUID",
      lyrics: "Amazing grace",
      chords: [{
        // existing chord fields
        characterOffset: 8,    // materialized display/export offset
        anchor: {
          version: 1,
          token: "grace",      // normalized word containing/nearest placement
          tokenOccurrence: 0,  // occurrence within this line
          graphemeOffset: 0,   // insertion point inside token; preserves syllable-level placement
          affinity: "before|inside|after",
          leftContext: "mazing ",
          rightContext: "grace",
          provenance: "manual|imported|inferred"
        }
      }]
    }]
  }]
}
```

`artist` remains the performing artist. Do not overload it with writer. Empty credits remain empty; never invent names.

## Migration and compatibility

1. Add `SongModel.SCHEMA_VERSION = 2` and make `SongModel.create()` idempotently normalize old and new songs.
2. Old songs default to one column, blank credits, and automatic arrangement derived from existing section order.
3. For every legacy chord lacking `anchor`, derive an anchor from its current lyric and `characterOffset`. Mark provenance `imported` for imported songs and `inferred` otherwise. Preserve the exact offset.
4. Preserve existing IDs. New section, line, and chord IDs use UUIDs rather than index-derived IDs so reordering does not change identity.
5. Change `LibraryStore` song-record `schemaVersion` to 2. Normalize through `SongModel.create()` on read and before save. No IndexedDB version bump is required because object-store structure is unchanged.
6. The first save of a migrated song persists schema 2 and creates the normal version checkpoint. Reading must not write or increment revision.
7. Sync payloads carry schema 2 unchanged. Older clients must retain unknown song fields; if that cannot be guaranteed, reject schema 2 writes with an explicit upgrade message rather than dropping fields.

## Stable lyric-anchor algorithm

### On chord insert or drag

1. Convert pointer x-coordinate to a grapheme insertion point, not a UTF-16 code-unit index.
2. Identify the Unicode word token containing the insertion point with `Intl.Segmenter('en', { granularity: 'word' })`; retain generic grapheme segmentation for non-English lyrics and punctuation.
3. Store token text, its occurrence number in the line, grapheme offset within the token, six graphemes of left/right context, and affinity.
4. Materialize `characterOffset` for current render, monospace export, and old-client compatibility.
5. A user drag sets anchor provenance to `manual`. Nothing may move it except that user, or lyric-edit reconciliation needed to keep it on the same semantic lyric location.

### On lyric edit

1. Snapshot old lyrics and chord anchors before DOM input is committed.
2. Build an old-to-new grapheme index mapping with a deterministic sequence diff. For ordinary contiguous edits, prefix/suffix mapping is sufficient; use a bounded Myers diff for paste/replacement edits.
3. Resolve each anchor independently in this order:
   - same normalized token and occurrence, with matching left/right context;
   - best same-token candidate by context score and shortest mapped distance;
   - diff-mapped grapheme insertion point;
   - nearest surviving word boundary using stored affinity;
   - clamped old materialized offset only as last fallback.
4. Recompute `characterOffset` from the resolved grapheme point. Do not use proportional line-length scaling.
5. Multiple chords may occupy one lyric insertion point. Collision avoidance may offset visual labels, but must not rewrite semantic anchors.
6. Deleting the anchored word keeps the chord at the deletion boundary and flags `anchor.needsReview = true`; it must not jump to an unrelated repeated word.
7. Splitting/joining lines maps anchors through the exact split/join operation and retains chord IDs. Section moves and column reflow never alter anchors.

### Manual chord canonicality

- Manual chord text is stored exactly as entered in `symbol`, plus existing `manualEntry` provenance needed for transposed display.
- Validation may warn; it cannot substitute another chord or enharmonic spelling.
- Transposition is a derived view. Returning to the entered key must reproduce the exact manual text.
- Correction-memory inference runs only on imported/inferred chords. It skips every field whose provenance is manual.

## Section labels and arrangement inference

- Make every section label editable in place in the live sheet. Add section before/after, duplicate, delete, and drag-reorder actions without rebuilding lyric content.
- Infer arrangement from actual section sequence. Normalize labels to conventional shorthand for the suggestion only: `Verse 1 -> V1`, `Verse 2 -> V2`, `Chorus -> C`, `Pre-Chorus -> PC`, `Bridge -> B`, `Intro -> I`, `Outro -> O`, `Tag -> T`, `Interlude -> INT`, `Vamp -> VAMP`; unknown labels remain exact.
- Recompute `inferredValue` whenever sections are added, removed, relabeled, or reordered.
- `mode:auto` displays and exports `inferredValue`. Typing in Arrangement changes mode to `manual` and preserves the exact string. Provide a deliberate `Use song order` action to return to auto; never switch back automatically.
- Arrangement order is descriptive metadata in this phase. It does not duplicate/reorder section bodies. A later setlist/arrangement editor can convert shorthand into an explicit playback sequence of section IDs.

## UI placement

- Add compact `Layout` control in the existing song sidebar: segmented buttons `1`, `2`, `3` labeled Columns. Persist per song. Reuse this value as Performance mode's initial column count but do not let a temporary performance adjustment silently overwrite it.
- Render structured chart as CSS grid/multicolumn flow by whole section blocks. Apply `break-inside: avoid` to sections, falling back to line-level splitting only when a section exceeds one page/column.
- Keep the sheet itself the editor. Section labels, lyrics, chords, Writer, Arranger, and Arrangement are directly editable; no separate metadata editor.
- Add bottom metadata block after the final section:
  - `Writer` editable single-line field
  - `Arrangement by` editable single-line field
  - `Arrangement` editable single-line shorthand plus `Use song order`
- Blank credits remain editable in the app but do not consume PDF footer space. Show clear placeholders only in edit mode.
- Save through the existing debounced song persistence path. Each field shows the same Saving/Saved/error state and participates in version history, undo/recovery, sync outbox, telemetry, and PDF preview.
- On narrow screens, column selection remains available but the editable workspace displays one column to preserve touch targets; the persisted 2/3-column choice continues to govern print/PDF and wide performance view.

## PDF behavior

- `PDFGenerator` lays out sections into 1, 2, or 3 equal-width columns with consistent gutters. It measures complete section height and fills top-to-bottom, then left-to-right, balancing columns only at section boundaries when possible.
- Chord rows and lyric rows use the same monospaced metrics per column. Re-wrap structured lines for actual column width, remapping materialized offsets from semantic anchors; never edit stored offsets during export.
- Repeat title/key header on continuation pages. Never orphan a section label at a column/page bottom.
- Add a final metadata block after content, spanning full printable width when space remains or on the final page otherwise:
  - `Written by <writer>` when nonempty
  - `Arrangement by <arranger>` when nonempty
  - `Arrangement: <effective arrangement>` when nonempty
- Credits/order use smaller neutral text and remain searchable PDF text, not canvas pixels.
- PDF import retains extracted credits only when confidently labeled; provenance is imported. It must not guess a writer or arranger from an unlabeled name.

## ChordPro mapping

- Parse/emit standard `{composer: ...}` for writer where supported by common ChordPro consumers.
- Parse `{lyricist: ...}` and `{composer: ...}` without merging them destructively. Until separate lyricist UI exists, preserve lyricist in unknown directives.
- Use application directives for nonstandard data: `{x_arranger: ...}`, `{x_arrangement: ...}`, `{x_columns: 2}`.
- Preserve unknown directives exactly as today. On export, avoid duplicate directives already represented by canonical fields.
- Parse section directives into stable section labels/types, including existing verse/chorus/bridge mappings; add pre-chorus, intro, outro, tag, interlude, and refrain mappings when recognized.
- ChordPro inline chord offsets are regenerated from current resolved anchors. Import creates anchors immediately.

## Implementation sequence and acceptance gates

### 1. Lock canonical manual-input behavior

Files: `modules/songModel.js`, `modules/musicTheory.js`, `modules/correctionMemory.js`, `modules/uiController.js`, `tests/e2e_display_chord_input.py`, new browser regression checklist/test.

- Add provenance guards before adding new inference.
- Gate: manually type an enharmonic spelling, save/reload/export/transpose away/back; exact entry returns and correction memory never replaces it.

### 2. Add schema normalization and anchor engine

Files: `modules/songModel.js`, new `modules/lyricAnchor.js`, `index.html`, `service-worker.js`, `modules/libraryStore.js`.

- Keep anchor engine pure and separately testable.
- Gate: legacy fixtures normalize without data loss; insert/delete/paste before and inside anchored words; repeated-word and deleted-word cases behave deterministically.

### 3. Wire live-sheet lyric reconciliation and section editing

Files: `modules/workspaceController.js`, `modules/uiController.js`, `modules/chartRenderer.js`, `styles/main.css` (or current stylesheet path), `index.html`.

- Run `graphify affected` for every modified UIController/WorkspaceController/ChartRenderer method first.
- Gate: real-browser editing, drag, Alt-drag, double-click insertion, section relabel/reorder, line split/join; unchanged chords retain IDs and semantic lyric placement.

### 4. Add columns and bottom metadata UI

Files: `index.html`, `modules/uiController.js`, `modules/chartRenderer.js`, `modules/performanceController.js`, stylesheet, `service-worker.js`.

- Mock and screenshot real wide/mobile sheets before final integration.
- Gate: per-song choice survives switching/reload/history restore; wide view shows 1/2/3 columns; mobile remains one-column editable; credits and arrangement are direct-edit fields.

### 5. Add arrangement inference

Files: new pure `modules/arrangement.js`, `modules/songModel.js`, `modules/uiController.js`, `modules/chartRenderer.js`, `index.html`, `service-worker.js`.

- Gate: default updates after section edits; first manual keystroke locks manual mode; later section changes update suggestion only; `Use song order` explicitly restores auto.

### 6. Upgrade PDF and ChordPro

Files: `modules/pdfGenerator.js`, `modules/chordPro.js`, relevant export wiring/tests.

- Gate: generated PDFs for 1/2/3 columns have no clipped text, orphan labels, or chord/lyric drift; credits/order text is extractable; ChordPro round-trip retains canonical metadata and unknown directives.

### 7. Persistence, versioning, sync, and full lifecycle

Files: `modules/libraryStore.js`, `modules/sessionStore.js`, `modules/syncStore.js`, Supabase validation/migration only if payload allowlists require it, lifecycle checklists/tests.

- Gate: old IndexedDB record migration; autosave; session switch; version restore; offline reload; sync round-trip/conflict copy; manual provenance retained through every path.
- Run QA Agent against FIRMAMENT with real browser and real saved song. Validate final PDF as the last hop.

## Test matrix

- Anchors: insertion/deletion before chord, inside word, whole anchored-word deletion, repeated words, punctuation, emoji/accented graphemes, blank-space anchors, multiple chords at one point, long paste, line split/join, section reorder.
- Canonical overrides: manual chord text/spelling/position, label, columns, writer, arranger, arrangement; reload, history restore, ChordPro round-trip, PDF output, audio re-analysis, correction-memory application.
- Layout: 1/2/3 columns at desktop and PDF; oversized section; page continuation; long chord symbols; empty sections; mobile editing.
- Metadata: blank fields, Unicode names, long credits, exact punctuation, imported standard/custom directives, unknown directives preserved.
- Accessibility: keyboard edit/section reorder/column selection; focus retained after autosave rerender; named inputs; reduced motion.
- Lifecycle: create, PDF import, ChordPro import, audio import with authoritative lyrics, edit, save, close/reopen, transpose, export ChordPro/PDF, version restore, offline run.

## Blast radius and safeguards

- High risk: `SongModel.create`, lyric commit handlers, `UIController` save/rerender path, `PDFGenerator.processStructuredSongContent`, and ChordPro parse/serialize affect every import/export route.
- Medium risk: `ChartRenderer.renderStructuredContent`, performance columns, LibraryStore normalization, sync validation.
- Direct callers must be enumerated with `graphify affected` immediately before implementation; current graph is stale relative to HEAD and must be rebuilt first.
- Preserve imported PDF absolute layout when the song has not been converted to structured mode. Columns and semantic anchors apply to structured song content; conversion must remain explicit.
- Never migrate by rewriting all records during IndexedDB upgrade. Normalize lazily, persist only on user/save action, and checkpoint before the first schema-2 overwrite.

## Done definition

A user can open an existing or new song, edit all content directly on the live sheet, choose 1/2/3 columns, label/reorder sections, type exact credits and arrangement shorthand, edit lyrics before anchored chords without losing intended placement, reload and recover the same state, transpose without losing manual spellings, and export a readable PDF and ChordPro file containing the effective metadata. Automation populates defaults only; every manual override remains canonical until the user explicitly changes or resets it.
