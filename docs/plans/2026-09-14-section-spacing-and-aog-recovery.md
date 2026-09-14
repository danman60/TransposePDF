# Section Spacing and AOG Recovery

Status: v46 deployed; exact AOG section merge awaits user confirmation in Version history.

Purpose: This exists so that AOG keeps the user's chords and sections have more whitespace/newlines around them by default.

## Verified state

- Revision 175: 10 sections, 52 lines, 139 chords.
- Revision 176: 9 sections, 46 lines, 125 chords.
- Deleted unit: repeated Verse 1 before Bridge, 6 lines, 14 chords.
- Current revision 192 retains all other section IDs. One Tag has newer edits, so full rollback is unsafe.
- Shared page planner emits a one-row section spacer; editor discards it while PDF retains it.

## Work

1. Render planned section spacer in editor at same one-row height used by PDF.
2. Add parity regression for visible section gaps and page overflow.
3. Deploy static v46 without restarting live process.
4. Preserve current AOG and revision 175 as backups.
5. Add history-level “Recover deleted” action that merges absent section IDs without replacing newer content.
6. Merge only deleted section from revision 175 after explicit recovery approval; create a new checkpoint.

## Acceptance

- Editor and PDF show one full blank line between adjacent sections.
- No extra gap appears at a column/page continuation boundary.
- AOG recovery adds exactly 6 lines and 14 chords before Bridge; newer current sections remain byte-identical.

## Verification

- Generic deleted-section recovery: 4/4 real-browser checks.
- Shared editor/PDF section spacing and parity: 6/6.
- Existing layout/font persistence: 21/21.
- Existing inline editing/insertion: 19/19.
