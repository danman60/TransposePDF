# Editor and PDF layout parity

## Purpose

This exists so that the exported PDF has the exact same lyric wrapping and section columns shown in the editor.

## Contract

- Editor is source of truth at export time for each visible structured section's column and each lyric/chord row's font-to-column ratio.
- PDF keeps each editor lyric row intact instead of applying a second character-count wrapper.
- PDF uses captured editor section columns and relative font sizing.
- Fixed-layout imported PDFs retain their existing export path.

## Steps

1. Add deterministic PDF assertions for captured column placement and unbroken editor rows.
2. Capture structured editor geometry immediately before PDF generation.
3. Pass geometry through PDF generation and render from it without independent wrapping.
4. Run layout, editing, transpose/manual-entry, and searchable-PDF regressions.
5. Deploy runtime assets to FIRMAMENT and verify real exported output.

