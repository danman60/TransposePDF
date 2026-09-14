#!/usr/bin/env python3
"""Real Chromium coverage for semantic live-chart anchors and section editing."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")
SHOT = Path(__file__).parents[1] / "artifacts/e2e/semantic-anchors-sections.png"

def main():
    checks = {}
    with tempfile.TemporaryDirectory(prefix="transposepdf-anchor-") as profile, sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1280, "height": 850})
        page = context.pages[0]; page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
        page.locator("#createChartButton").click(); page.locator("#authorTitle").fill("Semantic Anchor Proof")
        page.locator("#authorContent").fill("Verse 1\nC          G\ndear love then love\nF\nSing 👩🏽‍🎤 café now\n\nChorus\nC\nHold fast")
        page.locator("#saveChartButton").click(); page.locator('.lead-sheet').wait_for()

        # Force exact manual anchor locations, then exercise the real contenteditable save path.
        page.evaluate("""async () => {
          const app=window.transposeApp, song=app.currentSongs[0], line=song.sections[0].lines[0];
          line.chords[0].characterOffset=7; line.chords[0].anchor=LyricAnchor.create(line.lyrics,7,'manual');
          line.chords[1].characterOffset=17; line.chords[1].anchor=LyricAnchor.create(line.lyrics,17,'manual');
          await app.persistSong(song,{addToSession:false}); app.updateLeadSheetDisplay(song);
        }""")
        lyric = page.locator('[data-inline-field="lyrics"][data-section-index="0"][data-line-index="0"]')
        lyric.fill("Oh dear love then love"); lyric.blur(); page.wait_for_timeout(200)
        state = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords.map(c=>({o:c.characterOffset,t:c.anchor.token,p:c.anchor.provenance,r:!!c.anchor.needsReview}))")
        checks['insertion_before_anchor'] = state[0]['o'] == 10 and state[0]['t'] == 'love'
        checks['repeated_word_identity'] = state[1]['o'] == 20 and state[1]['t'] == 'love'

        lyric.fill("Oh dear lovely then love"); lyric.blur(); page.wait_for_timeout(200)
        state = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords.map(c=>({o:c.characterOffset,p:c.anchor.provenance}))")
        checks['inside_word_edit'] = state[0]['o'] == 10 and state[0]['p'] == 'manual'

        lyric.fill("Oh dear then love"); lyric.blur(); page.wait_for_timeout(200)
        state = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords.map(c=>({r:!!c.anchor.needsReview,p:c.anchor.provenance}))")
        checks['deleted_anchor_needs_review'] = state[0]['r'] and state[0]['p'] == 'manual'

        # Blank-space and Unicode manual placement use grapheme columns.
        page.evaluate("""async () => {
          const app=window.transposeApp, song=app.currentSongs[0], line=song.sections[0].lines[1];
          line.lyrics='Sing 👩🏽‍🎤        café now'; const c=line.chords[0]; c.characterOffset=12;
          c.anchor=LyricAnchor.create(line.lyrics,12,'manual'); await app.persistSong(song,{addToSession:false}); app.updateLeadSheetDisplay(song);
        }""")
        unicode = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[1].chords[0]")
        checks['blank_space_unicode_anchor'] = unicode['characterOffset'] == 12 and unicode['anchor']['provenance'] == 'manual'

        # Enter splits and boundary Delete joins using live editor handlers.
        second = page.locator('[data-inline-field="lyrics"][data-section-index="0"][data-line-index="1"]')
        second.focus(); page.evaluate("""() => { const n=document.activeElement,r=document.createRange(),s=getSelection(); r.setStart(n.firstChild,5);r.collapse(true);s.removeAllRanges();s.addRange(r); }"""); page.keyboard.press('Enter'); page.wait_for_timeout(250)
        split = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines.slice(1,3).map(l=>({id:l.id,lyrics:l.lyrics,chords:l.chords.map(c=>c.id)}))")
        checks['split_preserves_ids'] = split[0]['lyrics'] == 'Sing ' and split[1]['lyrics'].startswith('👩🏽‍🎤') and sum(map(len,[x['chords'] for x in split])) == 1
        left = page.locator('[data-inline-field="lyrics"][data-section-index="0"][data-line-index="1"]'); left.focus(); page.keyboard.press('End'); page.keyboard.press('Delete'); page.wait_for_timeout(250)
        checks['join_preserves_chord'] = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[1].chords.length === 1")

        # Direct labels, keyboard reorder, duplicate/add/delete.
        label = page.locator('[data-inline-field="section-label"]').first; label.fill('Opening'); label.blur(); page.wait_for_timeout(200)
        checks['manual_label'] = page.evaluate("() => {const s=window.transposeApp.currentSongs[0]; return s.sections[0].label==='Opening' && s.sections[0].labelProvenance==='manual' && s.arrangement.inferredValue===Arrangement.infer(s.sections)}")
        before = page.evaluate("() => window.transposeApp.currentSongs[0].sections.length")
        page.locator('[data-action="duplicate-section"]').first.click(); page.wait_for_timeout(150)
        page.locator('[data-action="add-section-after"]').first.click(); page.wait_for_timeout(150)
        page.locator('[data-action="delete-section"]').nth(1).click(); page.wait_for_timeout(150)
        checks['section_add_duplicate_delete'] = page.evaluate("n => window.transposeApp.currentSongs[0].sections.length===n+1", before)
        drag_id = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].id")
        page.locator('.section-drag-handle').first.drag_to(page.locator('.section-block').last); page.wait_for_timeout(150)
        checks['pointer_section_reorder'] = page.evaluate("id => window.transposeApp.currentSongs[0].sections.at(-1).id===id", drag_id)
        first_id = page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].id")
        page.locator('[data-inline-field="section-label"]').first.focus(); page.keyboard.press('Alt+ArrowDown'); page.wait_for_timeout(150)
        checks['keyboard_reorder'] = page.evaluate("id => window.transposeApp.currentSongs[0].sections[1].id===id", first_id)
        checks['manual_arrangement_override_preserved'] = page.evaluate("() => {const s=window.transposeApp.currentSongs[0]; s.arrangement.mode='manual';s.arrangement.value='CUSTOM'; return window.transposeApp.updateInferredArrangement(s), s.arrangement.value==='CUSTOM'}")

        SHOT.parent.mkdir(parents=True, exist_ok=True); page.screenshot(path=str(SHOT)); context.close()
    for name, ok in checks.items(): print(('PASS' if ok else 'FAIL'), name)
    failed=[name for name,ok in checks.items() if not ok]
    if failed: raise SystemExit('Failed: '+', '.join(failed))
    print(f"{sum(checks.values())}/{len(checks)} passed")

if __name__ == '__main__': main()
