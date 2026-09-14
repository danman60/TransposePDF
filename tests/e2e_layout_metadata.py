#!/usr/bin/env python3
"""Real-browser layout, credits, arrangement, persistence, and history coverage."""
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")
ARTIFACTS = Path(__file__).parents[1] / "artifacts/e2e"


def main():
    checks = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-layout-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1440, "height": 1000})
        page = context.pages[0]
        page.goto(URL)
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click()
        page.locator("#authorTitle").fill("Layout Metadata Proof")
        page.locator("#authorContent").fill(
            "Verse 1\nC             G                         Am\nBrokenness surrounds me, sickness and death close in around me\n\n"
            "Chorus\nF             C                         G\nArmor of God gives me strength within every battle I face\n\n"
            "Verse 2\nAm            G                         F\nI put the belt of truth and the breastplate of righteousness on"
        )
        page.locator("#saveChartButton").click()
        page.locator(".lead-sheet").wait_for()
        export_box = page.locator("#songLibrarySidebar #exportButton").bounding_box()
        checks["export_visible_in_sidebar"] = bool(export_box) and export_box["y"] >= 0 and export_box["y"] + export_box["height"] <= 1000

        for columns in (1, 2, 3):
            page.locator(f'[data-action="set-layout-columns"][data-columns="{columns}"]').click()
            page.wait_for_function("n => window.transposeApp.currentSongs[0].layout.columns === n", arg=columns)
            checks[f"desktop_{columns}_columns"] = page.locator(".lead-sheet .structured-chart").get_attribute("data-layout-columns") == str(columns)
            page.screenshot(path=str(ARTIFACTS / f"layout-metadata-desktop-{columns}.png"))

        page.locator('[data-action="set-layout-columns"][data-columns="2"]').click()
        page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.columns === 2")
        column_style = page.locator(".lead-sheet .structured-chart").evaluate("""chart => {
          const columns = chart.querySelector('.chart-page-columns');
          const style = getComputedStyle(columns);
          return { display: style.display, gridColumns: style.gridTemplateColumns.split(' ').length };
        }""")
        checks["two_column_independent_flow"] = column_style["display"] == "grid" and column_style["gridColumns"] == 2
        bounds = page.locator(".lead-sheet .section-block").evaluate_all("""sections => sections.map(section => {
          const box = section.getBoundingClientRect();
          const descendants = [...section.querySelectorAll('.lyric-line, .chord-line, .inline-chord-anchor')];
          return { left: box.left, right: box.right, clientWidth: section.clientWidth, scrollWidth: section.scrollWidth,
            widest: descendants.map(node => ({className:node.className, right:node.getBoundingClientRect().right, scrollWidth:node.scrollWidth, clientWidth:node.clientWidth})).sort((a,b)=>(b.scrollWidth-b.clientWidth)-(a.scrollWidth-a.clientWidth))[0],
            scrolls: section.scrollWidth > section.clientWidth + 1,
            escapes: descendants.some(node => { const b=node.getBoundingClientRect(); return b.right > box.right + 1 || b.left < box.left - 1; }) };
        })""")
        checks["two_column_no_scrollbars"] = all(not box["scrolls"] for box in bounds)
        if not checks["two_column_no_scrollbars"]:
            print("OVERFLOW_DIAGNOSTIC", bounds)
        checks["two_column_no_overlap"] = all(not box["escapes"] for box in bounds)
        expanded_width = page.locator(".song-library-sidebar").evaluate("e => e.getBoundingClientRect().width")
        page.locator("#sidebarCollapseToggle").click()
        collapsed_width = page.locator(".song-library-sidebar").evaluate("e => e.getBoundingClientRect().width")
        page.screenshot(path=str(ARTIFACTS / "layout-metadata-desktop-2-collapsed.png"))
        checks["sidebar_collapses"] = collapsed_width < 70 and expanded_width <= 225
        checks["chart_grows_when_collapsed"] = page.locator(".workspace-chart-pane").evaluate("e => e.getBoundingClientRect().width") > 1250
        page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.length === 1")
        checks["sidebar_collapse_persists"] = page.locator("#sessionWorkspace").evaluate("e => e.classList.contains('sidebar-collapsed')")
        page.locator("#sidebarCollapseToggle").click()
        page.locator('[data-action="set-layout-columns"][data-columns="3"]').click()
        page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.columns === 3")
        writer = page.locator('[data-inline-field="writer"]')
        writer.fill("Ada Writer"); writer.blur()
        arranger = page.locator('[data-inline-field="arranger"]')
        arranger.fill("Ray Arranger"); arranger.blur()
        arrangement = page.locator('[data-inline-field="arrangement"]')
        arrangement.fill("I V1 C V2 C"); arrangement.blur()
        page.wait_for_function("() => window.transposeApp.currentSongs[0].arrangement?.mode === 'manual'")
        arrangement_style = arrangement.evaluate("""element => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return { height: box.height, fontSize: parseFloat(style.fontSize), whiteSpace: style.whiteSpace };
        }""")
        checks["arrangement_follow_along_size"] = arrangement_style["height"] >= 80 and arrangement_style["fontSize"] >= 18 and arrangement_style["whiteSpace"] != "pre"
        if not checks["arrangement_follow_along_size"]:
            print("ARRANGEMENT_STYLE_DIAGNOSTIC", arrangement_style)
        checks["manual_metadata_canonical"] = page.evaluate("""() => {
          const s=window.transposeApp.currentSongs[0];
          return s.credits.writer.value==='Ada Writer' && s.credits.writer.provenance==='manual'
            && s.credits.arranger.value==='Ray Arranger' && s.arrangement.value==='I V1 C V2 C';
        }""")
        page.locator('[data-action="use-song-order"]').click()
        page.wait_for_function("() => window.transposeApp.currentSongs[0].arrangement?.mode === 'auto'")
        checks["use_song_order"] = page.evaluate("() => window.transposeApp.currentSongs[0].arrangement.value === Arrangement.infer(window.transposeApp.currentSongs[0].sections)")
        page.screenshot(path=str(ARTIFACTS / "layout-metadata-desktop-final.png"))

        song_id = page.evaluate("() => window.transposeApp.currentSongs[0].id")
        page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.length === 1")
        checks["reload_persistence"] = page.evaluate("id => {const s=window.transposeApp.currentSongs.find(x=>String(x.id)===String(id)); return s?.layout.columns===3 && s?.credits.writer.value==='Ada Writer' && s?.arrangement.mode==='auto'}", song_id)

        versions = page.evaluate("id => window.transposeApp.sessionStore.listSongVersions(id).then(v => v.map(x => ({id:x.id,columns:x.song?.layout?.columns,revision:x.revision})))", song_id)
        checks["version_history_created"] = len(versions) >= 3
        restore = next((version for version in versions if version.get("columns") == 2), None)
        if restore:
            page.evaluate("id => window.transposeApp.sessionStore.restoreSongVersion(id).then(() => { window.transposeApp.syncFromSessionStore(); window.transposeApp.displaySongs(); })", restore["id"])
            checks["history_restore"] = page.evaluate("() => window.transposeApp.currentSongs[0].layout.columns === 2")
            page.evaluate("() => window.transposeApp.setSongLayoutColumns(window.transposeApp.activeSongId, 3)")
            page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.columns === 3")
        else:
            checks["history_restore"] = False

        page.set_viewport_size({"width": 390, "height": 844})
        for columns in (1, 2, 3):
            page.evaluate("n => window.transposeApp.setSongLayoutColumns(window.transposeApp.activeSongId, n)", columns)
            page.wait_for_function("n => window.transposeApp.currentSongs[0].layout.columns === n", arg=columns)
            page.locator(".lead-sheet").screenshot(path=str(ARTIFACTS / f"layout-metadata-mobile-{columns}.png"))
        checks["mobile_forces_one_column"] = page.locator(".lead-sheet .structured-chart").evaluate("e => getComputedStyle(e).columnCount === '1'")

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.locator("#performanceButton").click()
        page.locator("#performanceShell").wait_for(state="visible")
        checks["performance_initial_columns"] = page.locator("#performanceColumns").input_value() == "3" and page.locator("#performanceChart .structured-chart").get_attribute("data-layout-columns") == "3"
        page.locator("#performanceColumns").select_option("1")
        page.locator("#performanceExit").click()
        page.wait_for_function("() => !window.transposeApp.performance.state.active")
        checks["performance_temporary_only"] = page.evaluate("() => window.transposeApp.currentSongs[0].layout.columns === 3")
        context.close()

    for name, ok in checks.items():
        print(("PASS" if ok else "FAIL"), name)
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise SystemExit("Failed: " + ", ".join(failed))
    print(f"{sum(checks.values())}/{len(checks)} passed")


if __name__ == "__main__":
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    main()
