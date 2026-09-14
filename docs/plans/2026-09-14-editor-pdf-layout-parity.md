# Editor and PDF layout parity

## Purpose

This exists so that the exported PDF has the exact same lyric wrapping and section columns shown in the editor.

## Contract

- One pure layout engine owns A4 page dimensions, readable fixed type, line wrapping, section spacing, columns, page breaks, credits, and arrangement placement.
- Editor and PDF consume the same planned pages/columns/rows. Neither renderer performs independent wrapping or pagination.
- Wrapped visual segments retain canonical section index, line index, source start/end, and chord offsets so typing and dragging update the original song line.
- No chart page may be created for credits alone when credits fit remaining space on the preceding page.
- Fixed-layout imported PDFs retain their existing export path.

## Steps

1. Build `ChartPageLayout` as a pure shared planner with fixtures matching the user's four-page Armor export.
2. Render editor as planned A4 pages and columns with readable fixed typography.
3. Map segmented lyric/chord editing and dragging back to canonical source coordinates.
4. Replace structured PDF pagination with direct rendering of the same plan; remove v41 geometry snapshots.
5. Verify editor/PDF page count, section-column assignment, wrap boundaries, font size, credits placement, manual-entry transpose behavior, searchable text, and drag/edit persistence.
6. Deploy runtime assets to FIRMAMENT; inspect the exact desktop export and editor side by side.

## Implementation status

- Shared planner: complete; fixed A4 geometry, 16pt lyrics, 18pt arrangement, atomic chord/lyric units, continuation headings, balanced final page, full-width footer reservation.
- Editor renderer: complete; paginated A4 pages and canonical source-coordinate editing/drag mapping.
- PDF renderer: complete; consumes same page plan directly. Single-song export omits songbook title page.
- Local parity gate: 6/6. Existing layout/edit/drag gates: 35/35. Armor manual-entry/transpose/export lifecycle: clean.
- Remaining: FIRMAMENT deploy, exact live desktop artifact comparison, final completion audit.

## Evidence requiring replacement

- `C:\Users\danie\Downloads\Transposed Songbook.pdf`, exported 2026-09-14 12:46:54 Eastern: 4 A4 pages, 17,018 bytes.
- Page 4 contains credits/arrangement only; pages 2–3 leave substantial unused lower-page space.
- v41 font-ratio translation reaches 6.6 pt and is unreadable. Snapshot translation cannot provide one-to-one pagination.
