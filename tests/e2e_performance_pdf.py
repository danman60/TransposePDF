#!/usr/bin/env python3
"""An imported PDF reads as a reflowed chart in Performance (not the tiny original-page view)."""

import os
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "").rstrip("/")
PDF = Path(__file__).resolve().parents[1] / "test_files" / "test_chord_chart.pdf"


def main():
    if not URL:
        sys.exit("Set TRANSPOSEPDF_URL explicitly (no default target).")
    print(f"Target: {URL}")
    errors, results = [], {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-perfpdf-") as profile, sync_playwright() as p:
        context = p.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 820, "height": 1180}, chromium_sandbox=False)
        page = context.pages[0] if context.pages else context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#fileInput").set_input_files(str(PDF))
        page.wait_for_function("() => window.transposeApp.currentSongs.length === 1", timeout=30000)
        results["pdf_key_detected_g"] = page.evaluate("window.transposeApp.currentSongs[0].originalKey") == "G"
        for _ in range(2):
            page.locator("button[data-action='transpose-song'][aria-label='Transpose up']").first.click(); page.wait_for_timeout(400)
        editor_text = page.locator(".pdf-layout-container").inner_text()
        results["transpose_keeps_pdf_lyrics"] = "Amazing grace how sweet the sound" in editor_text and "Bmazing" not in editor_text and "A A7 D A" in editor_text
        results["editor_keeps_original_layout"] = page.locator(".pdf-layout-container").count() > 0
        page.locator("#performanceButton").click()
        page.locator("#performanceShell").wait_for(state="visible"); page.wait_for_timeout(500)
        lyric = page.locator("#performanceChart .lyric-line", has_text="Amazing grace how sweet the sound")
        results["performance_reflows_pdf"] = lyric.count() == 1 and page.locator("#performanceChart .pdf-layout-container").count() == 0
        results["pdf_lyrics_readable"] = results["performance_reflows_pdf"] and lyric.evaluate("e => parseFloat(getComputedStyle(e).fontSize)") >= 20
        results["title_not_repeated_as_lyric"] = page.locator("#performanceChart .lyric-line").evaluate_all("els => !els.some(e => e.textContent.trim() === 'Amazing Grace')")
        page.locator("#performanceOriginal").check(); page.wait_for_timeout(300)
        results["original_page_toggle"] = page.locator("#performanceChart .pdf-layout-container").count() == 1
        page.screenshot(path=os.environ.get("PERF_PDF_SHOT", "/dev/null") if os.environ.get("PERF_PDF_SHOT") else str(Path(profile) / "x.png"))
        page.locator("#performanceOriginal").uncheck(); page.wait_for_timeout(300)
        results["toggle_back_reflows"] = page.locator("#performanceChart .pdf-layout-container").count() == 0
        context.close()
    results["no_page_errors"] = not errors
    for key, value in results.items():
        print(f"{'PASS' if value else 'FAIL'} {key}")
    if errors:
        print("\n".join(errors))
    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
