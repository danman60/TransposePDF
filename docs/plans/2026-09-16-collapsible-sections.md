# Collapsible sections

Purpose: This exists so sections can collapse/expand for easy whole-section rearrangement.

## Design

- Add disclosure button to editable section headings with line/chord summary.
- Store collapsed section IDs per song in browser local storage; never mutate canonical song or export/PDF.
- Apply state after every chart rerender and to every paginated fragment of a section.
- Keep heading, drag handle, label, and summary visible. Hide content and continuation fragments.
- Existing section drag/Alt-copy/drop/undo paths remain authoritative.

## Acceptance

- Collapse hides all lyric/chord rows for that section in editor only.
- Expand restores unchanged rows and controls.
- State survives reload and section reorder.
- Collapsed heading remains draggable as a whole section.
- PDF and canonical song JSON remain unchanged.
