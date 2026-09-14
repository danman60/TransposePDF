# Context menu and undo hotfix

Purpose: This exists so Ctrl+Z undoes chart changes and Add section remains available from every chart right-click menu.

## Proven causes

- Keyboard handler recognizes only Alt+Z.
- Context menus are mutually exclusive by object type; chord/line/lane menus omit section placement.

## Change

1. Accept Ctrl+Z, Cmd+Z, and Alt+Z when chart undo exists.
2. Replace single deletion snapshot with bounded exact-song undo stack.
3. Record pre-mutation snapshots for direct chart edits, drag/copy, insertion/deletion, lines, sections, copied patterns, and context actions.
4. Add section above/below commands to chord, line, lane, and section menus.
5. Bump cache, verify, deploy.
6. For long single-section charts, `Add section here` splits at clicked lyric-line boundary so insertion is spatially exact.

## Acceptance

- Ctrl+Z restores latest persisted chart mutation exactly.
- Repeated Ctrl+Z walks backward through recent chart changes.
- Right-click chord, lyric, chord lane, section body, or chart gap always exposes section insertion.
- Undo restoration itself does not create a duplicate undo entry.
