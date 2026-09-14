#!/usr/bin/env python3
"""Deleted-section recovery preserves newer canonical edits."""
import os
import tempfile
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")

with tempfile.TemporaryDirectory(prefix="transposepdf-section-recovery-") as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1440, "height": 1000})
    page = context.pages[0]
    page.goto(URL)
    page.wait_for_function("() => window.transposeApp?.libraryStore")
    page.locator("#createChartButton").click()
    page.locator("#authorTitle").fill("Recovery Proof")
    page.locator("#authorContent").fill("Verse 1\nC\nFirst\n\nChorus\nF G\nMiddle\n\nBridge\nAm\nLast")
    page.locator("#saveChartButton").click()
    page.locator(".lead-sheet").wait_for()
    song_id = page.evaluate("() => window.transposeApp.activeSongId")
    page.evaluate("id => window.transposeApp.deleteInlineSection(id, 1)", song_id)
    page.wait_for_function("() => window.transposeApp.currentSongs[0].sections.length === 2")
    first = page.locator('.lead-sheet [data-inline-field="lyrics"][data-section-index="0"]').first
    first.fill("Newest first"); first.blur()
    page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[0].lyrics === 'Newest first'")
    page.on("dialog", lambda dialog: dialog.accept())
    page.evaluate("id => window.transposeApp.openHistory(id)", song_id)
    recover = page.locator("[data-recover-sections]").first
    recover.wait_for(); recover.click()
    page.wait_for_function("() => window.transposeApp.currentSongs[0].sections.length === 3")
    result = page.evaluate("""() => { const s=window.transposeApp.currentSongs[0]; return {
      labels:s.sections.map(x=>x.label), lyrics:s.sections[0].lines[0].lyrics,
      chorus:s.sections[1].lines[0]} }""")
    result["versions"] = page.evaluate("id => window.transposeApp.sessionStore.listSongVersions(id).then(x=>x.length)", song_id)
    checks = {
      "recovered_middle_position": result["labels"] == ["Verse 1", "Chorus", "Bridge"],
      "newer_edit_preserved": result["lyrics"] == "Newest first",
      "recovered_chords_preserved": [chord["symbol"] for chord in result["chorus"]["chords"]] == ["F", "G"],
      "recovery_checkpoint_created": result["versions"] >= 4,
    }
    context.close()
    for name, passed in checks.items(): print(("PASS" if passed else "FAIL"), name)
    failed = [name for name, passed in checks.items() if not passed]
    if failed: raise SystemExit("Failed: " + ", ".join(failed))
