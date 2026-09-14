#!/usr/bin/env python3
"""Real Chromium proof for Alt-copy and lane double-click chord insertion."""

import os
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright


URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")
SHOT = Path(__file__).resolve().parents[1] / "artifacts/e2e/chord-copy-insert.png"


def main():
    checks = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-chord-gestures-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            profile, headless=True, viewport={"width": 1440, "height": 900}, chromium_sandbox=False
        )
        page = context.pages[0]
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click()
        page.locator("#authorTitle").fill("Chord Gesture Proof")
        page.locator("#authorContent").fill("C       G\nAmazing grace how sweet\nF       C\nThat saved a soul")
        page.locator("#saveChartButton").click()
        page.locator("#songsContainer .lead-sheet .inline-chord-anchor").first.wait_for()

        initial = page.evaluate("""() => window.transposeApp.currentSongs[0].sections
          .flatMap((section, si) => section.lines.flatMap((line, li) => line.chords
            .map(chord => [String(chord.id), si, li, chord.characterOffset, chord.symbol])))""")
        source = page.locator("#songsContainer .lead-sheet .inline-chord-anchor").first
        source.scroll_into_view_if_needed()
        source_id = source.get_attribute("data-chord-id")
        source_box = source.locator('.inline-chord-edit').bounding_box()
        lane_two = page.locator('#songsContainer .lead-sheet .chord-line[data-line-index="1"]').first
        lane_two_box = lane_two.bounding_box()

        # Exact user gesture: hold Alt before pointerdown, then drag to another line.
        page.keyboard.down("Alt")
        page.mouse.move(source_box["x"] + source_box["width"] / 2, source_box["y"] + source_box["height"] / 2)
        page.mouse.down()
        page.mouse.move(lane_two_box["x"] + 180, lane_two_box["y"] + 5, steps=12)
        page.mouse.up()
        page.keyboard.up("Alt")
        page.wait_for_timeout(350)
        copied = page.evaluate("""() => window.transposeApp.currentSongs[0].sections
          .flatMap((section, si) => section.lines.flatMap((line, li) => line.chords
            .map(chord => [String(chord.id), si, li, chord.characterOffset, chord.symbol])))""")
        checks["alt_copy_added_one"] = len(copied) == len(initial) + 1
        source_after = next(item for item in copied if item[0] == source_id)
        checks["source_unchanged"] = source_after == next(item for item in initial if item[0] == source_id)
        untouched_ids = {item[0] for item in initial if item[0] != source_id}
        checks["unrelated_unchanged"] = all(
            next(row for row in copied if row[0] == item[0]) == item for item in initial if item[0] in untouched_ids
        )
        new_rows = [row for row in copied if row[0] not in {item[0] for item in initial}]
        checks["copy_unique_id_cross_line"] = len(new_rows) == 1 and new_rows[0][1:3] == [0, 1]

        # Reload releases pointer capture and proves the copied anchor was saved before the next gesture.
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.currentSongs?.length")
        checks["copy_reload_persistence"] = page.locator(
            f'#songsContainer .inline-chord-anchor[data-chord-id="{new_rows[0][0]}"]'
        ).count() == 1

        # Same-line Alt-drag is also a copy and leaves the original anchor fixed.
        same_source = page.locator(f'#songsContainer .inline-chord-anchor[data-chord-id="{source_id}"]')
        same_source.evaluate("node => node.scrollIntoView({block:'center'})")
        same_box = same_source.locator('.inline-chord-edit').bounding_box()
        same_lane = page.locator('#songsContainer .lead-sheet .chord-line[data-line-index="0"]').first
        same_lane_box = same_lane.bounding_box()
        count_before_same = page.locator('#songsContainer .inline-chord-anchor').count()
        page.keyboard.down("Alt")
        page.mouse.move(same_box["x"] + same_box["width"] / 2, same_box["y"] + same_box["height"] / 2)
        page.mouse.down()
        page.mouse.move(same_lane_box["x"] + 240, same_lane_box["y"] + 8, steps=10)
        page.mouse.up()
        page.keyboard.up("Alt")
        page.wait_for_timeout(350)
        checks["alt_copy_same_line"] = (
            page.locator('#songsContainer .lead-sheet .chord-line[data-line-index="0"] .inline-chord-anchor').count() == 3
            and page.locator('#songsContainer .inline-chord-anchor').count() == count_before_same + 1
            and page.locator(f'#songsContainer .inline-chord-anchor[data-chord-id="{source_id}"]').get_attribute("data-character-offset") == "0"
        )

        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.currentSongs?.length")

        # Double-click bare lane at a blank column, then type over selected placeholder.
        lane_one = page.locator('#songsContainer .lead-sheet .chord-line[data-line-index="0"]').first
        lane_one.evaluate("node => node.scrollIntoView({block:'center'})")
        page.wait_for_timeout(100)
        lane_one_box = page.evaluate("""() => { const r = document.querySelector('#songsContainer .lead-sheet .chord-line[data-line-index="0"]').getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }""")
        before_insert = page.locator('#songsContainer .inline-chord-anchor').count()
        page.mouse.dblclick(lane_one_box["x"] + 320, lane_one_box["y"] + lane_one_box["height"] / 2)
        page.wait_for_timeout(150)
        focused = page.locator('#songsContainer .lead-sheet [data-inline-field="chord"]:focus')
        checks["insert_focused"] = focused.count() == 1
        if focused.count():
            page.keyboard.type("Bbmaj7")
            page.locator(".sidebar-song-heading h2").click()
            page.wait_for_timeout(350)
        after_insert = page.evaluate("""() => window.transposeApp.currentSongs[0].sections
          .flatMap(section => section.lines.flatMap(line => line.chords.map(chord => chord.symbol)))""")
        checks["insert_typed_symbol"] = len(after_insert) == before_insert + 1 and "Bbmaj7" in after_insert

        # Double-clicking an existing symbol must edit it, never add another chord.
        count_before_existing_double = len(after_insert)
        page.locator('#songsContainer .lead-sheet [data-inline-field="chord"]').first.dblclick()
        page.wait_for_timeout(150)
        count_after_existing_double = page.evaluate("""() => window.transposeApp.currentSongs[0].sections
          .reduce((n, section) => n + section.lines.reduce((m, line) => m + line.chords.length, 0), 0)""")
        checks["existing_double_no_duplicate"] = count_after_existing_double == count_before_existing_double

        expected = page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.currentSongs?.length")
        actual = page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")
        checks["reload_persistence"] = actual == expected
        SHOT.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOT), full_page=False)
        context.close()

    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    if not all(checks.values()):
        raise SystemExit(1)
    print(f"{sum(checks.values())}/{len(checks)} passed")


if __name__ == "__main__":
    main()
