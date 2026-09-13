# Correction Learning E2E

Target: `http://127.0.0.1:8000`

Use a persistent browser profile for steps 1-10. Do not modify application source or localStorage directly.

1. Open app with an empty correction-memory key and confirm no console errors.
2. Choose **Import recording**. Load `/tmp/armor-of-god-lyrics.txt` as authoritative lyrics and `/tmp/ArmorOfGod.mp3` as recording.
3. Wait until real analysis completes and editor opens. Confirm title `ArmorOfGod`, key `B`, populated lyrics, and chord symbols.
4. In editor text, change one machine-guessed `B` chord to `B7` and one `Abm` chord to its enharmonic spelling `G#m`. Keep their line positions unchanged. Save changes.
5. Confirm status says two corrections were learned. Capture corrected rendered chart.
6. Reload page, return to **Import recording**, then load same lyric sheet and MP3 again.
7. Wait for real analysis. Confirm status reports learned corrections applied and editor contains `B7` and `G#m` at matching passages.
8. Save, transpose up one semitone, and confirm corrected `B7` renders as `C7` and `G#m` as `Am`. Reset and confirm `B7` and `G#m` return.
9. Export PDF. Open/read downloaded PDF and confirm corrected symbols are present.
10. Reload with same profile and confirm correction records persist. Open a fresh isolated browser profile and confirm it does not inherit the first profile's corrections.

Report exact pass/fail count, console errors, analysis durations, learned/applied counts, screenshot paths, and downloaded PDF size.
