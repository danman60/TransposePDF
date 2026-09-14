#!/usr/bin/env python3
"""Real-browser section boundary drag, undo, and Alt-copy coverage."""
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")
ARTIFACTS = Path(__file__).parents[1] / "artifacts/e2e"


def labels(page):
    return page.locator(".lead-sheet .section-label").all_text_contents()


def drag(page, source_index, target_index, edge="after", alt=False):
    handles = page.locator(".lead-sheet .section-drag-handle")
    sections = page.locator(".lead-sheet .section-block")
    target = sections.nth(target_index).bounding_box()
    y = target["y"] - 8 if edge == "before" else target["y"] + target["height"] + 8
    page.evaluate("""({sourceIndex, x, y, alt}) => {
      const chart=document.querySelector('.lead-sheet .structured-chart');
      const handle=chart.querySelectorAll('.section-drag-handle')[sourceIndex];
      window.__sectionDragTransfer=new DataTransfer();
      handle.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.__sectionDragTransfer,altKey:alt,clientX:x,clientY:y}));
      chart.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__sectionDragTransfer,altKey:alt,clientX:x,clientY:y}));
    }""", {"sourceIndex": source_index, "x": target["x"] + target["width"] / 2, "y": y, "alt": alt})
    marker = page.locator(".section-drop-before, .section-drop-after")
    marker.wait_for(state="attached")
    page.wait_for_timeout(120)
    marker_style = marker.evaluate("e => { const p=getComputedStyle(e, e.classList.contains('section-drop-before') ? '::before' : '::after'); return {height:p.height, background:p.backgroundColor}; }")
    assert marker_style["height"] == "3px" and marker_style["background"] != "rgba(0, 0, 0, 0)", marker_style
    marker_target = marker.evaluate("e => ({index:Number(e.dataset.sectionReorderIndex), edge:e.classList.contains('section-drop-before') ? 'before' : 'after'})")
    assert marker_target == {"index": target_index, "edge": edge}, marker_target
    page.screenshot(path=str(ARTIFACTS / ("section-alt-copy-marker.png" if alt else "section-move-marker.png")))
    page.evaluate("""({x,y,alt}) => { const chart=document.querySelector('.lead-sheet .structured-chart');
      chart.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__sectionDragTransfer,altKey:alt,clientX:x,clientY:y}));
      chart.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:window.__sectionDragTransfer,altKey:alt,clientX:x,clientY:y}));
    }""", {"x": target["x"] + target["width"] / 2, "y": y, "alt": alt})


def main():
    checks = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-section-drag-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1280, "height": 900})
        page = context.pages[0]
        page.goto(URL)
        page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click()
        page.locator("#authorTitle").fill("Section Drag Proof")
        page.locator("#authorContent").fill("Verse 1\nC\nFirst\n\nChorus\nF\nSecond\n\nBridge\nG\nThird")
        page.locator("#saveChartButton").click()
        page.locator(".lead-sheet").wait_for()
        original = labels(page)

        drag(page, 0, 2, "after")
        page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[2].label === 'Verse 1'")
        checks["boundary_move"] = labels(page) == ["Chorus", "Bridge", "Verse 1"]
        checks["marker_cleared"] = page.locator(".section-drop-before, .section-drop-after").count() == 0

        page.locator("body").click(position={"x": 4, "y": 4})
        page.keyboard.press("Control+z")
        page.wait_for_function("expected => window.transposeApp.currentSongs[0].sections.map(s => s.label).join('|') === expected", arg="|".join(original))
        checks["global_ctrl_z"] = labels(page) == original

        drag(page, 0, 1, "after", alt=True)
        page.wait_for_function("() => window.transposeApp.currentSongs[0].sections.length === 4")
        model = page.evaluate("""() => { const s=window.transposeApp.currentSongs[0]; return {
          labels:s.sections.map(x=>x.label), sectionIds:s.sections.map(x=>x.id),
          lineIds:s.sections.flatMap(x=>x.lines.map(l=>l.id)), chordIds:s.sections.flatMap(x=>x.lines.flatMap(l=>l.chords.map(c=>c.id))) }; }""")
        checks["alt_drag_duplicates"] = model["labels"].count("Verse 1") == 2
        checks["copy_ids_unique"] = (len(model["sectionIds"]) == len(set(model["sectionIds"]))
                                     and len(model["lineIds"]) == len(set(model["lineIds"]))
                                     and len(model["chordIds"]) == len(set(model["chordIds"])))
        page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.sections?.length === 4")
        checks["copy_persists"] = labels(page).count("Verse 1") == 2
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
