# Main-chart context menu

Purpose: This exists so that right-clicking anywhere on the main chart opens a clear chart menu with Add section here, Add section above, and Add section below.

## Existing surface

- `WorkspaceController` owns delegated main-chart events and section actions.
- `UIController.addInlineSection` owns canonical section creation, persistence, arrangement refresh, and label focus.

## Change

1. Add delegated `contextmenu` handling for chart background and section blocks.
2. Preserve native context menus on editable text and chord fields.
3. Render one accessible fixed-position menu near pointer, clamped to viewport.
4. Route options through existing add-section actions; dismiss on action, outside click, Escape, scroll, or resize.
5. Bump offline cache, verify, deploy.

## Acceptance

- Right-click section shows Add above and Add below.
- Right-click chart blank space shows Add section here and appends.
- New label receives focus for immediate naming.
- Native text context menu remains available inside editable fields.
- Menu remains on-screen near viewport edges and never persists after dismissal.
