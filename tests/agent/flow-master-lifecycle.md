# TransposePDF Master Lifecycle

Use a fresh persistent browser profile. Test only the explicit URL printed by the runner. Do not modify application source, IndexedDB, localStorage, or server files directly.

1. Open the app. Confirm zero console errors, session name and `Saved` state visible, and Create/PDF/Recording entry actions keyboard reachable.
2. Create a manual chart named `QA Manual` in key F with Verse and Chorus sections, lyrics, `F`, `Bb`, `C/E`, and `N.C.`. Save it.
3. Confirm one session song displays. Set spelling to flats, transpose up once, and confirm key/chords change while `N.C.` remains exact.
4. Reload. Confirm session name, song, active selection, spelling policy, transposition, exact lyrics, and chord placement survive.
5. Edit `QA Manual`. Change title, one lyric, one chord, chord horizontal position, and optional chord time. Wait for `Saved`, reload before explicit chart Save, and confirm recovery banner appears.
6. Restore draft. Confirm every unsaved field returns exactly. Explicitly Save changes, reload, and confirm recovery banner is gone and saved chart remains exact.
7. Create a second manual chart named `QA Second`, save it, and verify desktop and mobile selectors show both songs while only active chart renders. Switch both directions with keyboard and touch-sized controls.
8. Import a valid text-based PDF fixture. Confirm every page completes, imported songs join session, and malformed/non-PDF input produces accessible error dialog with focus restoration.
9. If recording analysis is configured for this target, import a short supported recording with supplied authoritative lyrics. Confirm progress semantics, editable timed draft, Save, reload, and no media/path/raw-transcript evidence in persisted library records. If unavailable, record this step as explicitly not configured, not passed.
10. Export session PDF. Confirm download exists, has nonzero size, contains songs in selector order, and rendered/exported keys and chord spellings agree.
11. At 375px viewport, confirm selector, editor Source/Preview tabs, sticky Save/Edit access, recovery, error dialog, and export remain operable without horizontal page overflow.
12. Enable reduced motion. Confirm song switching and editor interactions remain understandable without animation. Complete a keyboard-only pass for create, edit, chord nudge, song select, transpose, error close, and export.
13. Reload offline after a successful online load. Confirm app shell, saved session, song switching, editing, transposition, recovery autosave, and PDF export work without CDN requests.
14. Inspect browser console/network and local persistence. Require zero console errors, no unintended production requests, no audio/PDF blobs or local paths in IndexedDB, and telemetry failures never block editing.
15. Report exact pass/fail counts, failed step numbers, console errors, failed requests, downloaded PDF size, desktop/mobile screenshots, and tested URL.
