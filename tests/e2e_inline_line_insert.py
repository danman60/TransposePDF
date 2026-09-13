#!/usr/bin/env python3
"""Real-browser regression for inserting and removing lyric rows in the main chart."""

import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")
SHOT = Path(__file__).resolve().parents[1] / "artifacts/e2e/inline-line-insert.png"


def main():
    checks = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-lines-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1280, "height": 820})
        page = context.pages[0]
        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click()
        page.locator("#authorTitle").fill("Missing Line Proof")
        page.locator("#authorContent").fill("C       G\nFirst lyric sentence\nF       C\nThird lyric stays here")
        page.locator("#saveChartButton").click()
        page.locator('.lead-sheet [data-inline-field="lyrics"][data-line-index="0"]').wait_for()
        before = page.evaluate("""() => window.transposeApp.currentSongs[0].sections[0].lines.map(line => ({
          id: line.id, lyrics: line.lyrics, chords: line.chords.map(chord => [chord.id, chord.characterOffset])
        }))""")

        first = page.locator('.lead-sheet [data-inline-field="lyrics"][data-line-index="0"]')
        first.evaluate("""node => { const range = document.createRange(); range.setStart(node.firstChild, 6);
          range.collapse(true); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); node.focus(); }""")
        # Do not blur/save first: Enter must split the current DOM text, not the stale stored lyric.
        page.keyboard.type("NEW")
        page.keyboard.press("Enter")
        page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines.length === 3")
        after = page.evaluate("""() => window.transposeApp.currentSongs[0].sections[0].lines.map(line => ({
          id: line.id, lyrics: line.lyrics, chords: line.chords.map(chord => [chord.id, chord.characterOffset])
        }))""")
        checks["enter_splits_unsaved_dom_at_caret"] = [line["lyrics"] for line in after] == ["First NEW", "lyric sentence", "Third lyric stays here"]
        checks["existing_line_identity"] = after[0]["id"] == before[0]["id"] and after[2]["id"] == before[1]["id"]
        checks["existing_chords_unchanged"] = after[0]["chords"] == before[0]["chords"] and after[2]["chords"] == before[1]["chords"]
        checks["new_line_focused"] = page.evaluate("() => document.activeElement?.dataset?.lineIndex === '1'")

        page.locator('.lead-sheet .inline-add-line[data-line-index="2"]').click()
        page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines.length === 4")
        checks["add_line_affordance"] = page.locator('.lead-sheet [data-inline-field="lyrics"][data-line-index="3"]').text_content() == ""
        page.keyboard.press("Backspace")
        page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines.length === 3")
        checks["empty_line_delete"] = page.locator('.lead-sheet .chart-line').count() == 3

        page.reload(wait_until="domcontentloaded")
        page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.sections?.[0]?.lines?.length === 3")
        checks["reload_persists_without_stale_overwrite"] = (
            page.locator('.lead-sheet [data-inline-field="lyrics"][data-line-index="0"]').text_content() == "First NEW"
            and page.locator('.lead-sheet [data-inline-field="lyrics"][data-line-index="1"]').text_content() == "lyric sentence"
        )
        checks["chordpro_contains_line"] = "lyric sentence" in page.evaluate("() => ChordPro.serialize(window.transposeApp.currentSongs[0])")
        page.locator("#performanceButton").click()
        page.locator("#performanceChart .chart-line").first.wait_for()
        checks["render_export_parity"] = page.locator("#performanceChart .chart-line").count() == 3
        page.locator("#performanceExit").click()
        SHOT.parent.mkdir(parents=True, exist_ok=True)
        page.locator(".lead-sheet").scroll_into_view_if_needed()
        page.locator('.lead-sheet .chart-line').nth(1).hover()
        page.screenshot(path=str(SHOT))
        context.close()

    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    failed = [name for name, passed in checks.items() if not passed]
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))


if __name__ == "__main__":
    main()
