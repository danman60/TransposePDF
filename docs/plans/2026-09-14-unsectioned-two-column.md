# Unsectioned cleanup and safe columns

Purpose: This exists so every line after a labeled section belongs to that section until another real label, and multi-column charts never overlap.

## Change

1. Collapse legacy blank/NS/No section/New section blocks into prior labeled section; discard empty placeholders.
2. Mark newly-created blank sections pending only while label is being entered.
3. On label commit, make section canonical; on abandoning blank pending label, remove/merge it.
4. Contain long preformatted lyric/chord rows within their 2/3-column section cells using horizontal overflow, preserving exact offsets.
5. Bump cache, verify, deploy.

## Acceptance

- Current ArmorOfGod `New section`/`NS` disappears; following Chorus stays separate.
- Nonempty unsectioned lines append to preceding labeled section without changing line/chord IDs.
- Pending creation remains available long enough to type label.
- No lyric/chord pixels cross column gutter.
- One-column behavior unchanged.
