# Layout Director

Purpose: This exists so that the user can manually control exactly where columns and pages terminate while editor and PDF remain one-to-one.

## Contract

- Store layout decisions only in `song.layout`; never rewrite sections, lines, lyrics, chords, or manual-entry provenance.
- Anchor breaks to stable section/line IDs with index fallback. A chord row and its lyric row remain indivisible.
- Shared `ChartPageLayout.plan()` remains the only pagination source for editor and PDF.
- Every change persists through normal song revision history and therefore participates in undo/recovery.

## Work

1. Normalize layout schema: margins, spacing, balance, preset, semantic breaks, per-section flow rules.
2. Extend shared planner for manual column/page breaks, keep-together, next-column/page, spanning sections, spacing, warnings, and boundary metadata.
3. Render layout mode controls, dotted draggable break lines, page/margin/gutter guides, and warnings.
4. Wire sidebar and delegated pointer/context actions through one generic layout update path.
5. Make structured PDF consume the same plan, including spanning regions and selected margins.
6. Add built-in presets plus browser-saved custom presets.
7. Add deterministic planner and real-browser lifecycle coverage; verify editor/PDF plan parity.
8. Deploy static assets to FIRMAMENT without restarting its running process; capture and DM live screenshot.

## Acceptance

- Dragging a dotted column/page line changes a semantic boundary and survives reload.
- Manual breaks may land before/after blank lyric lines and never detach chords from lyrics.
- Section flow rules and spacing visibly match PDF output.
- Auto balance can be restored without deleting manual breaks unless explicitly reset.
- Fit warning names the responsible constraint.
- Armor of God section/line/chord counts remain unchanged across layout edits.
