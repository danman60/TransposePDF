#!/usr/bin/env python3
"""Real-browser publication flow: manual pages, continuation headers, numbering, and undo."""
import base64, os, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('TRANSPOSEPDF_URL', 'http://127.0.0.1:8000')
SHOT = Path(__file__).parents[1] / 'artifacts/e2e/publication-flow.png'

with tempfile.TemporaryDirectory(prefix='transposepdf-flow-') as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={'width': 1450, 'height': 950}, service_workers='block')
    page = context.pages[0]; page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
    result = page.evaluate("""async () => {
      const song=SongModel.create({id:'flow-proof',title:'Publication Flow Proof',originalKey:'F',sourceType:'manual',layout:{columns:1,typography:'sans',pageNumbers:true,continuationHeader:'none',avoidOrphans:true,layoutMode:true},sections:Array.from({length:4},(_,s)=>({id:`s${s}`,label:`Verse ${s+1}`,lines:Array.from({length:8},(_,l)=>({id:`s${s}l${l}`,lyrics:`Publication lyric ${s+1}-${l+1} remains paired with its chord`,chords:[{id:`c${s}-${l}`,symbol:'F',characterOffset:12}]}))}))});
      await window.transposeApp.persistSong(song,{addToSession:true}); window.transposeApp.syncFromSessionStore(); window.transposeApp.displaySongs();
      await window.transposeApp.setLayoutBreak(song.id,0,4,'page','after');
      return true;
    }""")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.breaks.length === 1")
    initial = page.evaluate("""() => { const song=window.transposeApp.currentSongs[0],plan=ChartPageLayout.plan(song); return {
      pages:plan.pages.length,breaks:song.layout.breaks.map(b=>b.lineId),numbers:[...document.querySelectorAll('.chart-page-number')].map(e=>e.textContent),
      hidden:document.querySelectorAll('.chart-page-header.continuation-header-hidden').length,
      orphan:plan.pages.some(p=>(p.regions?.flatMap(r=>r.columns?.flat()||r.rows)||p.columns.flat()).some((row,i,rows)=>row.type==='section'&&!rows[i+1])) }; }""")
    assert initial['pages'] >= 2 and initial['breaks'] == ['s0l4'], initial
    assert initial['numbers'] == [f'{i + 1} / {initial["pages"]}' for i in range(initial['pages'])], initial
    assert initial['hidden'] == initial['pages'] - 1 and not initial['orphan'], initial
    page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.layout?.breaks?.[0]?.lineId === 's0l4'")
    page.evaluate("() => window.transposeApp.transposeSong('flow-proof',1)")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].transposition === 1")
    assert page.evaluate("() => window.transposeApp.currentSongs[0].layout.breaks[0].lineId") == 's0l4'
    page.evaluate("() => window.transposeApp.setLayoutBreak('flow-proof',1,3,'page','after')")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.breaks.length === 2")
    page.locator('body').click(position={'x': 10, 'y': 10}); page.keyboard.press('Control+z')
    page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.breaks.length === 1")
    output = page.evaluate("""async () => {const pdf=await new PDFGenerator().generatePDF(window.transposeApp.currentSongs,'Flow');return pdf.output('datauristring').split(',')[1]}""")
    pdf_path=Path(profile)/'flow.pdf'; pdf_path.write_bytes(base64.b64decode(output))
    text=subprocess.run(['pdftotext','-layout',str(pdf_path),'-'],check=True,text=True,capture_output=True).stdout
    compact = text.replace(' ', '')
    assert f'1/{initial["pages"]}' in compact and f'{initial["pages"]}/{initial["pages"]}' in compact, text
    SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
    print('11/11 publication flow, page break, undo, numbering, and continuation checks passed')
    context.close()
