# Easy section creation

Purpose: This exists so that a user can create a new labeled song section directly on the main chart with one obvious action.

## Existing surface

- `UIController.addInlineSection` already creates canonical sections.
- Per-section before/after actions exist but remain hidden until hover/focus.
- `WorkspaceController` already delegates section actions.

## Change

1. Add a persistent `+ Add section` control after chart sections and before metadata.
2. Reuse `addInlineSection`; append at song end, then focus/select the new label for immediate naming.
3. Preserve inferred arrangement refresh while manual arrangement override remains unchanged.
4. Add accessible responsive styling, bump offline cache, verify, deploy.

## Acceptance

- Add-section action remains visible without hover on desktop and mobile.
- One activation appends exactly one blank section.
- New section label receives focus and selected text for immediate replacement.
- Saved section and label survive reload.
- Existing before/after/duplicate/reorder/delete controls still work.
