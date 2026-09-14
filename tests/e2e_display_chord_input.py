#!/usr/bin/env python3
"""Chromium regression: visible chord input survives canonical storage, reload, and export."""
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")
SHOT = Path(__file__).resolve().parents[1] / "artifacts/e2e/display-chord-input.png"

with tempfile.TemporaryDirectory(prefix="transposepdf-display-input-") as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1440, "height": 900})
    page = context.pages[0]
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("() => window.transposeApp?.libraryStore")
    page.locator("#createChartButton").click()
    page.locator("#authorTitle").fill("Display Input Regression")
    page.locator("#authorKey").select_option("B")
    page.locator("#authorContent").fill("B\nArmor of God")
    page.locator("#saveChartButton").click()
    down = page.locator('[data-action="transpose-song"][data-semitones="-1"]')
    down.click(); down.click()
    page.wait_for_timeout(250)
    chord = page.locator('[data-inline-field="chord"]').first
    chord.click(); page.keyboard.press("Control+A"); page.keyboard.type("C"); chord.press("Enter")
    page.wait_for_timeout(350)
    chord = page.locator('[data-inline-field="chord"]').first
    stored = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords[0]")
    assert chord.text_content() == "C", {"text": chord.text_content(), "stored": stored}
    assert stored["symbol"] == "C", stored
    assert stored["manualEntry"]["provenance"] == "manual", stored
    page.reload(wait_until="domcontentloaded")
    page.wait_for_function("() => window.transposeApp?.currentSongs?.length")
    assert page.locator('[data-inline-field="chord"]').first.text_content() == "C"
    export_text = page.evaluate("""() => ChordPro.serialize(window.transposeApp.currentSongs[0], {
      chordDisplay: (symbol, chord) => window.transposeApp.chartRenderer.displayStoredChord(
        chord, window.transposeApp.currentSongs[0], new MusicTheory())
    })""")
    assert "[C]" in export_text, export_text
    SHOT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOT), full_page=False)
    print("6/6 displayed input, canonical storage, reload, and export checks passed")
    context.close()
