# Visible export and large arrangement flow

## Purpose

This exists so that PDF export is always visible during editing and Arrangement is large enough to read while following the song.

## Steps

1. Add real-browser assertions for persistent sidebar PDF export and large Arrangement presentation.
2. Move existing Export PDF control into the persistent song-tools sidebar without duplicating its ID or behavior.
3. Give Arrangement a dedicated follow-along presentation: roughly four times the standard metadata height, larger type, wrapping, and clear focus state.
4. Advance offline cache, run editing/layout/PDF regressions, deploy static assets to FIRMAMENT, and verify final composited UI.

