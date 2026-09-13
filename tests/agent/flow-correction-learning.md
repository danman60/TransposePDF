# Correction Learning E2E

Target: `http://127.0.0.1:8000`

Use a persistent browser profile for steps 1-10. Do not modify application source or localStorage directly.

1. Open app with an empty correction-memory key and confirm no console errors.
2. Choose **Import recording**. Load `/tmp/armor-of-god-lyrics.txt` as authoritative lyrics and `/tmp/ArmorOfGod.mp3` as recording.
3. Wait until real analysis completes and editor opens. Confirm title `ArmorOfGod`, key `B`, populated lyrics, and chord symbols.
4. In editor, make and record all of these saved edits: title, key, two lyric corrections, one section rename, `B` to `B7`, `Abm` to `G#m`, move one chord horizontally, move one chord to another lyric line, set one selected chord's timing 1.25 seconds later, add one chord, and delete one chord. Save changes.
5. Confirm status reports saved edits learned. Capture corrected rendered chart and the exact editor text.
6. Reload page, return to **Import recording**, then load same lyric sheet and MP3 again.
7. Wait for real analysis. Confirm every item from step 4 returns, including exact editor text, offsets, cross-line placement, and selected chord timing within 0.1 seconds.
8. Save, transpose up one semitone, and confirm corrected `B7` renders as `C7` and `G#m` as `Am`. Reset and confirm `B7` and `G#m` return.
9. Export PDF. Open/read downloaded PDF and confirm corrected symbols are present.
10. Reload with same profile and confirm correction records persist. Open a fresh isolated browser profile and confirm it does not inherit the first profile's recording-specific edits.
11. Hash `source.rawAnalysis` before and after save/reimport and confirm it is unchanged. Make one extra edit, cancel instead of saving, reimport, and confirm the canceled edit does not return.

Report exact pass/fail count, console errors, analysis durations, learned/applied counts, screenshot paths, and downloaded PDF size.
