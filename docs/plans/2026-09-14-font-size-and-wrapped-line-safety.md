# Font Size and Wrapped-Line Safety

Status: Complete — deployed as FIRMAMENT v45.

Purpose: This exists so that text is not too big, user can edit font size, and Verse 1 does not get screwed up.

## Verified starting state

- Live FIRMAMENT and IndexedDB representations retain the same six Verse 1 source lines.
- Three `chart.line.inserted` gestures fired after refresh; visual wrapping must never create or masquerade as source lines.
- Font is hard-coded at 16pt in `ChartPageLayout`; editor adds a separate 18px floor.

## Work

1. Persist `layout.fontSize` through `SongModel` and ChordPro, default 13pt, clamp 10–18pt.
2. Make `ChartPageLayout` derive wrapping, line height, and page capacity from that value.
3. Render editor at the same physical page scale as PDF using a shared CSS variable.
4. Add sidebar font-size control beside column control; changes save/version/telemetry like columns.
5. Mark wrapped continuation segments explicitly and prove Enter reconstruction never changes neighboring source lines.
6. Run planner, editor/PDF parity, inline edit, layout persistence, structured PDF, and Armor lifecycle gates.
7. Deploy static v45 assets to FIRMAMENT without restarting user process; screenshot and DM real surface.

## Acceptance

- Existing song defaults to 13pt and immediately renders smaller.
- User selects any integer 10–18pt; reload and PDF retain exact selection.
- Editor and PDF use same page count, wraps, columns, and font setting.
- Wrapped Verse 1 source lines remain one canonical line unless user deliberately presses Enter.
- Version history remains available before every saved font change.

## Result

- 13pt default; 10–18pt per-song selector; shared editor/PDF plan and ChordPro round-trip.
- Restored one `+ line` control per canonical lyric line. Intermediate visual wraps never create duplicate insert controls.
- User Armor snapshot rendered with six intact Verse 1 lines, three pages, and zero overflow.
