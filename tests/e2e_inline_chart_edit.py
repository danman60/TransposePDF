#!/usr/bin/env python3
"""Real-browser regression for editing the displayed chart surface."""

import os
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright


URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")
SHOT = Path(__file__).resolve().parents[1] / "artifacts/e2e/inline-chart-edit.png"


def select_text(page, selector, start, end):
    page.locator(selector).evaluate(
        """(node, positions) => {
          const range = document.createRange();
          range.setStart(node.firstChild, positions[0]);
          range.setEnd(node.firstChild, positions[1]);
          const selection = getSelection();
          selection.removeAllRanges(); selection.addRange(range); node.focus();
        }""",
        [start, end],
    )


def main():
    results = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-inline-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            profile, headless=True, viewport={"width": 1440, "height": 900}, chromium_sandbox=False,
            has_touch=True,
        )
        page = context.pages[0]
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click()
        page.locator("#authorTitle").fill("Inline Editing Proof")
        page.locator("#authorContent").fill("C       G\nAmazing grace how sweet the sound\nF       C\nThat saved a soul")
        page.locator("#saveChartButton").click()
        lyric = '.lead-sheet [data-inline-field="lyrics"][data-line-index="0"]'
        chord = '.lead-sheet [data-inline-field="chord"][data-line-index="0"][data-chord-index="0"]'
        page.locator(lyric).wait_for()

        # Exact user path: highlight text in rendered chart, type replacement, then delete selection.
        select_text(page, lyric, 0, 7)
        page.keyboard.type("Wonderful")
        select_text(page, lyric, 10, 16)
        page.keyboard.press("Backspace")
        page.locator(".sidebar-song-heading h2").click()
        page.wait_for_function("() => document.querySelector('#sessionSaveState')?.textContent.includes('Saved')")
        expected_lyric = page.locator(lyric).text_content()
        results["lyric_type_delete"] = expected_lyric == "Wonderful how sweet the sound"

        select_text(page, chord, 0, 1)
        page.keyboard.type("Dm7")
        page.locator(".sidebar-song-heading h2").click()
        page.wait_for_function("() => document.querySelector('#sessionSaveState')?.textContent.includes('Saved')")
        results["chord_replace"] = page.locator(chord).text_content() == "Dm7"

        # A normal click must remain an edit gesture; the drag threshold must not eat it.
        chord_box = page.locator(chord).bounding_box()
        page.mouse.click(chord_box["x"] + chord_box["width"] / 2, chord_box["y"] + chord_box["height"] / 2)
        page.keyboard.press("End")
        page.keyboard.type("sus2")
        page.locator(".sidebar-song-heading h2").click()
        page.wait_for_function("() => document.querySelector('#sessionSaveState')?.textContent.includes('Saved')")
        results["click_then_type"] = page.locator(chord).text_content() == "Dm7sus2"

        anchor = page.locator(chord).locator('xpath=..')
        original_offset = anchor.get_attribute("data-character-offset")
        moved_id = anchor.get_attribute("data-chord-id")
        untouched_before = page.evaluate(
            """movedId => window.transposeApp.currentSongs[0].sections.flatMap((section, sectionIndex) =>
              section.lines.flatMap((line, lineIndex) => line.chords
                .filter(chord => String(chord.id) !== String(movedId))
                .map(chord => [String(chord.id), sectionIndex, lineIndex, chord.characterOffset])))""",
            moved_id,
        )
        # Drag the visible symbol body within its current line first.
        handle_box = anchor.locator('.inline-chord-edit').bounding_box()
        same_line_box = page.locator('.lead-sheet .chord-line[data-line-index="0"]').bounding_box()
        page.mouse.move(handle_box["x"] + handle_box["width"] / 2, handle_box["y"] + handle_box["height"] / 2)
        page.mouse.down()
        page.mouse.move(same_line_box["x"] + 260, same_line_box["y"] + 8, steps=8)
        page.mouse.up()
        page.wait_for_timeout(250)
        same_line_offset = page.locator(f'.lead-sheet .inline-chord-anchor[data-chord-id="{moved_id}"]').get_attribute("data-character-offset")
        results["same_line_body_drag"] = same_line_offset != original_offset
        results["drag_stores_manual_anchor"] = page.evaluate(
            """id => window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).flatMap(l=>l.chords).find(c=>String(c.id)===String(id))?.anchor?.provenance==='manual'""",
            moved_id,
        )

        page.locator('.lead-sheet .chord-line[data-line-index="1"]').scroll_into_view_if_needed()
        anchor = page.locator(f'.lead-sheet .inline-chord-anchor[data-chord-id="{moved_id}"]')
        handle_box = anchor.locator('.inline-chord-edit').bounding_box()
        line_box = page.locator('.lead-sheet .chord-line[data-line-index="1"]').bounding_box()
        page.mouse.move(handle_box["x"] + handle_box["width"] / 2, handle_box["y"] + handle_box["height"] / 2)
        page.mouse.down()
        page.mouse.move(line_box["x"] + 180, line_box["y"] + 8, steps=8)
        page.mouse.up()
        page.wait_for_timeout(500)
        moved = page.locator('.lead-sheet .chord-line[data-line-index="1"] [data-chord-id]').filter(has_text="Dm7")
        untouched_after = page.evaluate(
            """movedId => window.transposeApp.currentSongs[0].sections.flatMap((section, sectionIndex) =>
              section.lines.flatMap((line, lineIndex) => line.chords
                .filter(chord => String(chord.id) !== String(movedId))
                .map(chord => [String(chord.id), sectionIndex, lineIndex, chord.characterOffset])))""",
            moved_id,
        )
        results["freeform_drag"] = (
            moved.count() == 1
            and moved.get_attribute("data-character-offset") != same_line_offset
            and untouched_after == untouched_before
        )

        # Real Chromium touch input follows the same visible-symbol path.
        touch_anchor = page.locator(f'.lead-sheet .inline-chord-anchor[data-chord-id="{moved_id}"]')
        touch_box = touch_anchor.locator('.inline-chord-edit').bounding_box()
        touch_line = page.locator('.lead-sheet .chord-line[data-line-index="1"]').bounding_box()
        before_touch = touch_anchor.get_attribute("data-character-offset")
        cdp = context.new_cdp_session(page)
        start = {"x": touch_box["x"] + touch_box["width"] / 2, "y": touch_box["y"] + touch_box["height"] / 2}
        finish = {"x": touch_line["x"] + 360, "y": touch_line["y"] + 8}
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [start]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [finish]})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        page.wait_for_timeout(250)
        results["touch_body_drag"] = touch_anchor.get_attribute("data-character-offset") != before_touch

        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.currentSongs?.length === 1")
        results["reload_lyrics"] = page.locator(lyric).text_content() == expected_lyric
        results["reload_chord"] = page.locator('[data-inline-field="chord"]').filter(has_text="Dm7").count() == 1
        page.locator("#performanceButton").click()
        page.locator("#performanceChart .structured-chart").wait_for()
        results["performance_read_only"] = (
            page.locator("#performanceShell").is_visible()
            and page.locator("#performanceChart .chart-line").count() == 2
            and page.locator('#performanceChart [contenteditable]').count() == 0
        )
        page.locator("#performanceExit").click()
        SHOT.parent.mkdir(parents=True, exist_ok=True)
        page.locator('.lead-sheet').scroll_into_view_if_needed()
        page.screenshot(path=str(SHOT), full_page=False)
        context.close()

    failed = [name for name, passed in results.items() if not passed]
    for name, passed in results.items():
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    if failed:
        raise SystemExit(f"Failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
