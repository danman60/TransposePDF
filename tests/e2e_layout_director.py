#!/usr/bin/env python3
"""Real-browser lifecycle for semantic page-layout controls."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")
SHOT = Path(__file__).parents[1] / "artifacts/e2e/layout-director.png"

with tempfile.TemporaryDirectory(prefix="transposepdf-layout-director-") as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={"width": 1440, "height": 1000}, service_workers="block")
    page = context.pages[0]; page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
    page.evaluate("""async () => {
      const song=SongModel.create({id:'layout-director-proof',title:'Layout Director Proof',originalKey:'F',sourceType:'manual',layout:{columns:2},
        sections:Array.from({length:5},(_,s)=>({label:`Verse ${s+1}`,lines:Array.from({length:5},(_,l)=>({lyrics:`Line ${s+1}-${l+1} gives the chart enough content for directed flow`,chords:[{symbol:'F',characterOffset:5}]}))}))});
      await window.transposeApp.persistSong(song,{addToSession:true}); window.transposeApp.syncFromSessionStore(); window.transposeApp.displaySongs();
    }""")
    page.locator('[data-action="toggle-layout-mode"]').click()
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.layoutMode === true")
    page.evaluate("() => window.transposeApp.setLayoutBreak('layout-director-proof',0,1,'column')")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.breaks.length === 1")
    checks = {}
    checks['dotted_break_visible'] = page.locator('.layout-break-target.has-layout-break').count() == 1
    source = page.locator('.layout-break-target.has-layout-break'); target = page.locator('.layout-break-target[data-section-index="0"][data-line-index="4"]')
    page.evaluate("() => {window.__pointerEvents=[];for(const n of ['pointerdown','pointermove','pointerup'])document.addEventListener(n,e=>window.__pointerEvents.push({type:n,cls:e.target.className}),true)}")
    target.scroll_into_view_if_needed(); source.scroll_into_view_if_needed()
    a=source.bounding_box(); b=target.bounding_box(); page.mouse.move(a['x']+a['width']/2,a['y']+2); page.mouse.down(); page.mouse.move(b['x']+b['width']/2,b['y']+2,steps=8); page.mouse.up()
    page.wait_for_timeout(3000)
    actual=page.evaluate("() => {const s=window.transposeApp.currentSongs?.[0];return {events:window.__pointerEvents,state:Boolean(window.transposeApp.workspaceController?.layoutPointerDrag),songCount:window.transposeApp.currentSongs?.length,breaks:s?.layout?.breaks||[],breakId:s?.layout?.breaks?.[0]?.lineId,want:s?.sections?.[0]?.lines?.[4]?.id}}")
    assert actual['breakId']==actual['want'], actual
    checks['drag_reanchors_semantically'] = True
    before = page.evaluate("() => ({sections:window.transposeApp.currentSongs[0].sections.length,lines:window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).length,chords:window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).flatMap(l=>l.chords).length})")
    page.evaluate("() => window.transposeApp.setSectionLayoutRule('layout-director-proof',1,{keepTogether:true,start:'column',spacing:'spacious'})")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.sectionRules[window.transposeApp.currentSongs[0].sections[1].id]?.keepTogether")
    page.locator('[data-action="set-layout-field"][data-layout-field="margin"]').select_option('wide')
    page.locator('[data-action="set-layout-preset"]').select_option('large-print')
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.fontSize === 16")
    checks['preset_and_rules_persist'] = page.evaluate("() => {const s=window.transposeApp.currentSongs[0];return s.layout.margin==='wide'&&s.layout.sectionSpacing==='spacious'&&s.layout.preset==='large-print'}")
    after = page.evaluate("() => ({sections:window.transposeApp.currentSongs[0].sections.length,lines:window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).length,chords:window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).flatMap(l=>l.chords).length})")
    checks['content_unchanged'] = before == after
    page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.length === 1")
    checks['reload_keeps_layout'] = page.evaluate("() => window.transposeApp.currentSongs[0].layout.breaks.length===1 && window.transposeApp.currentSongs[0].layout.preset==='large-print'")
    plan_match = page.evaluate("() => {const s=window.transposeApp.currentSongs[0];const a=ChartPageLayout.plan(s);const b=new PDFGenerator();return a.spec.margin===54&&a.spec.fontSize===16&&b!=null}")
    checks['shared_export_plan'] = plan_match
    SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
    for name, ok in checks.items(): print(('PASS' if ok else 'FAIL'),name)
    failed=[name for name,ok in checks.items() if not ok]
    if failed: raise SystemExit('Failed: '+', '.join(failed))
    print(f"{len(checks)}/{len(checks)} layout director lifecycle checks passed")
    context.close()
