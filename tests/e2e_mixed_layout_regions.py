#!/usr/bin/env python3
"""Real-browser proof for full-width and multi-column regions on one PDF page."""
import base64, os, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('TRANSPOSEPDF_URL', 'http://127.0.0.1:8000')
SHOT = Path(__file__).parents[1] / 'artifacts/e2e/mixed-layout-regions.png'

with tempfile.TemporaryDirectory(prefix='transposepdf-mixed-') as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={'width': 1500, 'height': 1000}, service_workers='block')
    page = context.pages[0]; page.set_default_timeout(10000); page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
    page.evaluate("""async () => {
      const song=SongModel.create({id:'mixed-proof',title:'Mixed Region Proof',originalKey:'A',sourceType:'manual',layout:{columns:2,typography:'sans',balance:'auto',layoutMode:true},sections:[
        {id:'intro',label:'Intro',lines:[{id:'i1',lyrics:'Full width opening',chords:[{id:'ic',symbol:'A',characterOffset:0}]}]},
        {id:'verse',label:'Verse',lines:Array.from({length:4},(_,i)=>({id:`v${i}`,lyrics:`Column lyric ${i+1} uses the measured body region`,chords:[{id:`vc${i}`,symbol:'D',characterOffset:7}]}))},
        {id:'chorus',label:'Chorus',lines:[{id:'c1',lyrics:'Full width ending',chords:[{id:'cc',symbol:'E',characterOffset:5}]}]}
      ]}); await window.transposeApp.persistSong(song,{addToSession:true}); window.transposeApp.syncFromSessionStore(); window.transposeApp.displaySongs();
    }""")
    for index in (0, 2):
        page.evaluate("i => window.transposeApp.setSectionLayoutRule('mixed-proof',i,{spanColumns:true})", index)
        page.wait_for_function("i => window.transposeApp.currentSongs[0].layout.sectionRules[window.transposeApp.currentSongs[0].sections[i].id]?.spanColumns", arg=index)
    state = page.evaluate("""async () => {
      const song=window.transposeApp.currentSongs[0], plan=ChartPageLayout.plan(song);
      const pdf=await new PDFGenerator().generatePDF([song],'Mixed Region Proof');
      return {pages:plan.pages.length,kinds:plan.pages[0].regions.map(r=>r.kind),sections:song.sections.length,
        dom:[...document.querySelectorAll('.chart-page-region')].map(e=>({span:e.classList.contains('chart-page-span'),columns:e.classList.contains('chart-page-columns')})),
        middleColumns:[...document.querySelectorAll('.chart-page-region.chart-page-columns .chart-page-column')].map(e=>e.querySelectorAll('.lyric-line').length),
        pdf:pdf.output('datauristring').split(',')[1]};
    }""")
    assert state['pages'] == 1, state
    assert state['kinds'] == ['span', 'columns', 'span'], state
    assert state['dom'] == [{'span': True, 'columns': False}, {'span': False, 'columns': True}, {'span': True, 'columns': False}], state
    assert all(count > 0 for count in state['middleColumns']), state
    assert state['sections'] == 3, state
    page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.layout?.sectionRules?.intro?.spanColumns && window.transposeApp.currentSongs[0].layout.sectionRules.chorus?.spanColumns")
    SHOT.parent.mkdir(parents=True, exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
    pdf_path = Path(profile) / 'mixed.pdf'; pdf_path.write_bytes(base64.b64decode(state['pdf']))
    extracted = subprocess.run(['pdftotext', '-layout', str(pdf_path), '-'], check=True, text=True, capture_output=True).stdout
    normalized = extracted.upper()
    assert normalized.index('INTRO') < normalized.index('VERSE') < normalized.index('CHORUS'), extracted
    print('8/8 mixed full-width and multi-column editor/PDF lifecycle checks passed')
    context.close()
