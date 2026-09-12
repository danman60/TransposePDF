# Unified Chord Authoring Plan

## Purpose

This exists so users can create chord sheets manually, import existing chord-chart PDFs, or generate drafts from MP3 recordings, then edit, transpose, and export every source through one compatible song model.

## Scope

This increment delivers manual authoring and a canonical model compatible with the existing PDF importer, transposition engine, and PDF exporter. It establishes timestamp/confidence fields required by a later MP3 analysis pipeline. It does not implement audio transcription, accounts, cloud sync, or deployment.

## Existing surfaces to retain

- `PDFProcessor.loadPDF(file)` and its positioned `textItems` output.
- `SongSeparator.separateSongs(textItems)` array return contract.
- `MusicTheory.extractChords`, `transposeChord`, and `detectKey` signatures.
- `PDFGenerator.generatePDF(songs, filename)` promise contract.
- `window.transposeApp.transposeSong/resetSong` controls.

## Step 1 — Canonical song model

Files: `modules/songModel.js`, `index.html`.

- Define normalized Song, Section, Line, and ChordAnchor shapes.
- Parse alternating chord/lyric rows from pasted text.
- Preserve chord character offsets, with optional timestamp/confidence fields.
- Adapt legacy/PDF songs without discarding positioned `textItems`.
- Derive plain `songText` for compatibility.

Acceptance:

- Pasted lyrics form structured lines.
- A chord row above a lyric row becomes anchors on that lyric line.
- PDF metadata and `textItems` survive normalization.

## Step 2 — Manual authoring UI

Files: `index.html`, `styles/main.css`, `styles/mobile.css`, `modules/uiController.js`.

- Add clear entry choices: import PDF or create chart.
- Add title, key, and multiline chord/lyric editor.
- Support alternating chord/lyric line paste and live preview.
- Save a manual chart into the same `currentSongs` collection used by PDF imports.
- Add edit action that reopens a chart without losing source metadata.

Acceptance:

- User creates a chart from pasted text without uploading a PDF.
- Chords render above lyrics and remain aligned.
- Mobile authoring controls remain usable at 375x812.

## Step 3 — Unified render, transpose, and PDF import

Files: `modules/songSeparator.js`, `modules/uiController.js`.

- Normalize every PDF-separated song into the canonical model.
- Render canonical structured lines for manual songs.
- Retain positioned original-layout rendering for imported PDFs.
- Keep transpose/reset controls working for both origins.

Acceptance:

- Existing test PDF imports and displays.
- Manual and imported charts both transpose and reset.
- Imported PDF songs remain exportable.

## Step 4 — Unified export

File: `modules/pdfGenerator.js`.

- Export canonical sections, chord anchors, and lyric lines.
- Preserve legacy `songText` fallback for existing data/tests.
- Apply current transposition during export.

Acceptance:

- Manual chart downloads as a non-empty PDF.
- Imported chart downloads as a non-empty PDF.
- Export contains title, key, chords, and lyrics.

## Step 5 — Verification

- Run static syntax checks for all changed JavaScript.
- Run QA Agent against local HTTP for shell/responsive coverage.
- Run direct real-browser E2E for file upload because QA Agent lacks file-upload action support.
- Verify manual create -> transpose -> reset -> export.
- Verify PDF import -> transpose -> reset -> export.
- Capture desktop and mobile screenshots and send both to Telegram.
- Review console errors, failed requests, and exported artifacts.

## Deferred MP3 increment

- Upload/storage API and background job.
- Timed lyric transcription.
- Beat/key/chord detection.
- Alignment into the same Line and ChordAnchor fields.
- Confidence review and playback-linked correction.

