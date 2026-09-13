import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright


URL = "http://127.0.0.1:8000"
AUDIO = "/tmp/ArmorOfGod.mp3"
LYRICS = "/tmp/armor-of-god-lyrics.txt"
SHOT = "/home/danman60/projects/TransposePDF/artifacts/all-edits-authoring.png"


def import_recording(page):
    page.get_by_role("button", name="Import recording").click()
    page.locator("#lyricsFileInput").set_input_files(LYRICS)
    page.locator("#audioFileInput").set_input_files(AUDIO)
    page.locator("#authorSection").wait_for(state="visible", timeout=600_000)


def main():
    results = {}
    Path(SHOT).parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(accept_downloads=True, viewport={"width": 1440, "height": 1000})
        page = context.new_page()
        errors = []
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(URL, wait_until="networkidle")
        page.evaluate("localStorage.removeItem('transposepdf.chord-corrections.v1')")
        page.reload(wait_until="networkidle")

        started = time.time()
        import_recording(page)
        results["first_analysis_seconds"] = round(time.time() - started, 2)
        original_text = page.locator("#authorContent").input_value()
        raw_before = page.evaluate("JSON.stringify(window.transposeApp.currentSongs[0].source.rawAnalysis)")

        title = "Armor of God — Accepted"
        page.locator("#authorTitle").fill(title)
        page.locator("#authorKey").select_option("C")
        rows = original_text.splitlines()
        section_index = next((i for i, row in enumerate(rows) if re.match(r"^(Verse|Chorus|Bridge|Intro|Outro)", row, re.I)), None)
        if section_index is not None:
            rows[section_index] = "Opening"
        lyric_index = next(i for i, row in enumerate(rows) if row.strip() and not re.match(r"^(Verse|Chorus|Bridge|Intro|Outro)", row, re.I) and not page.evaluate("row => SongModel.isChordRow(row)", row))
        rows[lyric_index] = rows[lyric_index] + " [accepted lyric]"
        chord_rows = [i for i, row in enumerate(rows) if page.evaluate("row => SongModel.isChordRow(row)", row)]
        first_chord_row = chord_rows[0]
        tokens = rows[first_chord_row].split()
        tokens[0] = "C7" if tokens[0] != "C7" else "Cmaj7"
        if len(tokens) > 1:
            tokens.pop()
        tokens.append("F#")
        rows[first_chord_row] = "  ".join(tokens)
        page.locator("#authorContent").fill("\n".join(rows))

        first_token = page.locator("#authorPreview button.chord-token").first
        first_token.focus()
        prior_offset = int(first_token.get_attribute("data-character-offset"))
        first_token.press("ArrowRight")
        moved_offset = int(page.locator("#authorPreview button.chord-token[aria-pressed='true']").get_attribute("data-character-offset"))
        if moved_offset != prior_offset + 1:
            raise AssertionError(f"keyboard placement did not move one column: {prior_offset} -> {moved_offset}")
        selected = page.locator("#authorPreview button.chord-token[aria-pressed='true']")
        old_time_text = selected.get_attribute("data-timestamp") or "0"
        new_time = round(float(old_time_text) + 1.25, 2)
        page.locator("#chordTimingInput").fill(str(new_time))
        page.locator("#chordTimingInput").press("Enter")
        accepted_text = page.locator("#authorContent").input_value()
        page.screenshot(path=SHOT, full_page=True)
        page.locator("#saveChartButton").click()
        state = page.evaluate("JSON.parse(localStorage.getItem('transposepdf.chord-corrections.v1'))")
        if state["version"] != 2 or len(state["songEdits"]) != 1:
            raise AssertionError("v2 recording snapshot was not stored")
        raw_after_save = page.evaluate("JSON.stringify(window.transposeApp.currentSongs[0].source.rawAnalysis)")
        results["raw_immutable_after_save"] = raw_before == raw_after_save

        page.reload(wait_until="networkidle")
        started = time.time()
        import_recording(page)
        results["second_analysis_seconds"] = round(time.time() - started, 2)
        returned_text = page.locator("#authorContent").input_value()
        results["exact_editor_text"] = returned_text == accepted_text
        results["title"] = page.locator("#authorTitle").input_value() == title
        results["key"] = page.locator("#authorKey").input_value() == "C"
        returned_token = page.locator("#authorPreview button.chord-token").first
        returned_token.focus()
        results["timing"] = abs(float(page.locator("#chordTimingInput").input_value()) - new_time) <= 0.1
        raw_before_second_save = page.evaluate("JSON.stringify(window.transposeApp.currentSongs[0].source.rawAnalysis)")

        page.locator("#saveChartButton").click()
        raw_after_second_save = page.evaluate("JSON.stringify(window.transposeApp.currentSongs[0].source.rawAnalysis)")
        results["raw_immutable_after_reimport"] = raw_before_second_save == raw_after_second_save
        song_id = page.evaluate("window.transposeApp.currentSongs[0].id")
        page.locator(f"button[onclick*='transposeSong({song_id}, 1)']").click()
        results["transpose"] = page.locator(f"#transposeValue-{song_id}").inner_text() == "+1"
        page.locator(f"button[onclick*='resetSong({song_id})']").click()
        results["reset"] = page.locator(f"#transposeValue-{song_id}").inner_text() == "0"
        page.locator("#exportButton").click()
        with page.expect_download(timeout=60_000) as download_info:
            page.locator("#exportFinalButton").click()
        download = download_info.value
        output = Path("/tmp/all-edits-output.pdf")
        download.save_as(output)
        results["pdf_bytes"] = output.stat().st_size

        fresh = browser.new_context(viewport={"width": 390, "height": 844})
        fresh_page = fresh.new_page()
        fresh_page.goto(URL, wait_until="networkidle")
        results["fresh_profile_isolated"] = fresh_page.evaluate("localStorage.getItem('transposepdf.chord-corrections.v1')") is None
        fresh.close()
        results["console_errors"] = errors
        context.close()
        browser.close()

    required = ["raw_immutable_after_save", "exact_editor_text", "title", "key", "timing", "raw_immutable_after_reimport", "transpose", "reset", "fresh_profile_isolated"]
    failed = [name for name in required if not results.get(name)]
    results["failed"] = failed
    print(json.dumps(results, indent=2))
    return 1 if failed or errors or results.get("pdf_bytes", 0) < 1000 else 0


if __name__ == "__main__":
    sys.exit(main())
