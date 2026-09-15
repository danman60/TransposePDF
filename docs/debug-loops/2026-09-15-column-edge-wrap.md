# Column-edge wrapping — 2026-09-15

## Victory condition

Dragging a column divider replans lyrics to the visible column edge, with the same wrapping in editor and PDF.

## Evidence

- User screenshot: 48-character lyric wrapped `breath` while visible editor width remained beside the divider.
- Live telemetry: active ArmorOfGod line is exactly `Lost and lonely souls draw in their final breath`.
- `.inline-add-line` is absolutely positioned and consumes no layout width.
- `.chart-page` is a CSS size container with padding. Descendant `cqi` units resolve against its content box, but renderer divided font and gutter values by full page width.

## Attempt 1

- Change: compute `--chart-render-font`, `--arrangement-render-font`, and `--page-gutter` against inner page width (`pageWidth - left margin - right margin`).
- Result: PASS.
- Gates: geometry 26/26; live FIRMAMENT divider lifecycle 10/10; live editor/PDF parity 6/6.
- Release: cache v51; FIRMAMENT runtime file SHA-256 matches local.
