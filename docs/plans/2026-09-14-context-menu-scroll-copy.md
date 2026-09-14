# Context-menu scrolling and section chord sources

Purpose: This exists so the right-click menu stays open while scrolling and clearly names every section whose chord changes can be copied.

## Proven causes

- Capture-phase window scroll listener treats menu overflow scrolling as page scrolling.
- Copy action is generic and buried; source section is not visible before activation.

## Change

1. Ignore scroll events originating inside context menu; retain dismissal for page/ancestor scrolling.
2. For chord-empty target sections, place `Use chords from <label>` actions directly after section placement controls.
3. List every eligible source section with same-family source first.
4. Route chosen source through existing canonical copy/persist/learning method.
5. Bump cache, verify, deploy.

## Acceptance

- Mouse-wheel/trackpad scrolling inside menu never closes it.
- Source section names are visible and directly selectable.
- Selecting source copies chords only; lyrics remain unchanged.
- Menu closes after successful action or ordinary outside/page dismissal.
