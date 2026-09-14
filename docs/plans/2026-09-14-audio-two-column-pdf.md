# Audio-song two-column PDF

Purpose: This exists so an imported recording prints as a clean structured two-column chord chart.

## Proven cause

`PDFGenerator` routes only manual songs or songs with explicit `source.preserveLayout === false` through structured columns. Audio imports with canonical sections can fall into legacy linear export, ignoring layout columns and structured wrapping.

## Change

1. Use structured export for every song with canonical sections unless `source.preserveLayout === true` explicitly requests original PDF coordinates.
2. Apply same routing rule to processed-content fallback.
3. Add an audio-source two-column regression with long lyrics and chord anchors.
4. Verify column x-bounds, wrapped segments, chord relocation, credits, continuation pages, and model immutability.
5. Bump cache, deploy, generate/read final PDF.

## Acceptance

- Audio song with `layout.columns=2` returns structured result with 2 columns.
- No rendered text call exceeds its assigned column start/flow contract.
- Long lyrics split within calculated column character capacity.
- Chords following wrap move to corresponding wrapped segment.
- Existing PDF imports with `preserveLayout:true` keep positional export.
