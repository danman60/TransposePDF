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
        results["editor_keeps_original_layout"] = page.locator(".pdf-layout-container").count() > 0
        page.locator("#performanceButton").click()
        page.locator("#performanceShell").wait_for(state="visible"); page.wait_for_timeout(500)
        lyric = page.locator("#performanceChart .lyric-line", has_text="Amazing grace how sweet the sound")
        results["performance_reflows_pdf"] = lyric.count() == 1 and page.locator("#performanceChart .pdf-layout-container").count() == 0
        results["pdf_lyrics_readable"] = results["performance_reflows_pdf"] and lyric.evaluate("e => parseFloat(getComputedStyle(e).fontSize)") >= 20
        context.close()
    results["no_page_errors"] = not errors
    for key, value in results.items():
        print(f"{'PASS' if value else 'FAIL'} {key}")
    if errors:
        print("\n".join(errors))
    sys.exit(0 if all(results.values()) else 1)


if __name__ == "__main__":
    main()
