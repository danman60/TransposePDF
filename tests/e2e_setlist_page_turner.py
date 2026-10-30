#!/usr/bin/env python3
"""Setlist + Bluetooth page-turner E2E: 3-song set, arrow/PageDown stepping in Performance, reload keeps the set."""

import os
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "").rstrip("/")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "e2e"


def active_title(page):
    return page.evaluate(
        "() => window.transposeApp.currentSongs.find(s => String(s.id) === String(window.transposeApp.activeSongId))?.title"
    )


def main():
    if not URL:
        sys.exit("Set TRANSPOSEPDF_URL explicitly (no default target).")
    print(f"Target: {URL}")
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors, results = [], {}
    long_alpha = "\n".join(line for n in range(1, 61) for line in ("C        G", f"Alpha lyric {n}"))
    fixtures = (("Alpha", long_alpha), ("Beta", "D A\nBeta lyric"), ("Gamma", "E B\nGamma lyric"))

    with tempfile.TemporaryDirectory(prefix="transposepdf-setlist-") as profile, sync_playwright() as p:
        context = p.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1280, "height": 800}, chromium_sandbox=False)
        page = context.pages[0] if context.pages else context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        for title, content in fixtures:
            create = "#createChartButton" if page.locator("#createChartButton").is_visible() else "#sidebarCreateChartButton"
            page.locator(create).click()
            page.locator("#authorTitle").fill(title)
            page.locator("#authorContent").fill(content)
            page.locator("#saveChartButton").click()
            page.wait_for_timeout(250)
        page.locator("#sessionName").fill("Friday Set")
        page.wait_for_timeout(700)

        # Reorder: move Gamma up one -> Alpha, Gamma, Beta.
        page.locator("[data-action='move-song'][data-direction='up'][aria-label='Move Gamma up']").click()
        page.wait_for_timeout(500)
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => document.querySelectorAll('#activeSongSelect option').length === 3")
        order = page.evaluate("window.transposeApp.currentSongs.map(s => s.title)")
        results["reload_keeps_ordered_set"] = order == ["Alpha", "Gamma", "Beta"] and page.locator("#sessionName").input_value() == "Friday Set"

        page.locator("#songSelectorList button", has_text="Alpha").click()
        page.locator("#performanceButton").click()
        page.locator("#performanceShell").wait_for(state="visible")
        results["set_position_header"] = page.locator("#performanceSetPosition").text_content() == "1 / 3 · Next: Gamma"

        # Song-per-press mode (default): no bindings configured, arrows step songs.
        page.keyboard.press("ArrowRight"); page.wait_for_timeout(250)
        results["arrow_right_next"] = active_title(page) == "Gamma"
        page.keyboard.press("PageDown"); page.wait_for_timeout(250)
        results["pagedown_next"] = active_title(page) == "Beta" and page.locator("#performanceSetPosition").text_content() == "3 / 3 · End of set"
        page.keyboard.press("ArrowRight"); page.wait_for_timeout(250)
        results["clamps_at_end"] = active_title(page) == "Beta"
        page.keyboard.press("ArrowLeft"); page.wait_for_timeout(250)
        page.keyboard.press("PageUp"); page.wait_for_timeout(250)
        results["back_to_first"] = active_title(page) == "Alpha"
        page.screenshot(path=str(ARTIFACTS / "setlist-performance-song-mode.png"))
        lyric_px = "() => parseFloat(getComputedStyle(document.querySelector('#performanceChart .lyric-line')).fontSize)"
        base_px = page.evaluate(lyric_px)
        page.evaluate("window.transposeApp.performance.setFontScale(1.6)"); page.wait_for_timeout(250)
        results["text_slider_scales_chart"] = page.evaluate(lyric_px) > base_px * 1.4
        page.evaluate("window.transposeApp.performance.setFontScale(1)"); page.wait_for_timeout(250)

        # Scroll mode: PageDown pages through long Alpha before advancing.
        page.locator("#performancePageTurner").select_option("scroll")
        page.locator("#performanceChart").click(position={"x": 5, "y": 5})
        page.keyboard.press("PageDown"); page.wait_for_timeout(700)
        scrolled = page.evaluate("document.getElementById('performanceShell').scrollTop")
        results["scroll_mode_scrolls_first"] = active_title(page) == "Alpha" and scrolled > 200
        for _ in range(30):
            if active_title(page) != "Alpha":
                break
            page.keyboard.press("PageDown"); page.wait_for_timeout(700)
        results["scroll_mode_advances_at_bottom"] = active_title(page) == "Gamma"
        page.screenshot(path=str(ARTIFACTS / "setlist-performance-scroll-mode.png"))
        page.evaluate("document.fullscreenElement && document.exitFullscreen()"); page.wait_for_timeout(300)
        page.set_viewport_size({"width": 390, "height": 844}); page.wait_for_timeout(300)
        page.screenshot(path=str(ARTIFACTS / "setlist-performance-phone.png"))
        results["phone_lyrics_readable"] = page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('#performanceChart .lyric-line')).fontSize)") >= 16
        results["phone_no_sideways_scroll"] = page.evaluate("() => { const s = document.getElementById('performanceShell'); return s.scrollWidth <= s.clientWidth; }")
        page.set_viewport_size({"width": 1280, "height": 800})
        page.locator("#performanceExit").click()
        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.performance")
        results["page_turner_mode_persists"] = page.evaluate("window.transposeApp.performance.state.pageTurner") == "scroll"

        # Editor arrow keys untouched outside Performance.
        page.locator("#songSelectorList button", has_text="Alpha").click()
        page.keyboard.press("ArrowRight"); page.wait_for_timeout(250)
        results["no_effect_outside_performance"] = active_title(page) == "Alpha"
        context.close()

    results["no_page_errors"] = not errors
    for key, value in results.items():
        print(f"{'PASS' if value else 'FAIL'} {key}")
    if errors:
        print("\n".join(errors))
    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
