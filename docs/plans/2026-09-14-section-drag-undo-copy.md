# Section drag, undo, and copy

Purpose: This exists so Ctrl+Z undoes a section move, section dragging shows the exact insertion line and drops between sections, and Alt-drag duplicates a section like a chord.

## Reuse

- Extend existing `WorkspaceController` drag boundary.
- Route all section mutations through existing `mutateInlineSections` undo/persistence/learning path.
- Preserve manual section content exactly; duplicated IDs must be new.

## Changes

1. `modules/workspaceController.js`: capture Alt copy intent; calculate nearest insertion boundary across chart/gutters; render marker; drop at boundary; clean drag state; catch Ctrl/Cmd/Alt+Z when focus is outside workspace.
2. `modules/uiController.js`: add boundary-based move/copy operation and retain old button APIs.
3. `styles/main.css`: render high-contrast insertion rule before/after target section.
4. `tests/e2e_section_drag.py`: real-browser move, insertion marker, blank-gap drop, Ctrl+Z, Alt-drag copy, ID uniqueness, reload persistence.
5. `service-worker.js`: advance cache version.

## Acceptance

- Move can drop in whitespace nearest a section boundary.
- Marker shows exact insertion boundary.
- Ctrl+Z restores exact section order after drag.
- Alt-drag creates independent canonical copy.
- Existing chord drag/copy remains unchanged.
