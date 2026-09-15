#!/usr/bin/env python3
"""Real-browser canonical metadata and non-destructive preset lifecycle."""
import base64, os, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000'); SHOT=Path(__file__).parents[1]/'artifacts/e2e/metadata-presets.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-meta-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1450,'height':950},service_workers='block'); page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.evaluate("""async()=>{const s=SongModel.create({id:'meta-proof',title:'Professional Metadata',artist:'Subtitle',originalKey:'F',sections:[{id:'v1',label:'Verse 1',lines:[{id:'l1',lyrics:'Metadata lifecycle line',chords:[{id:'c1',symbol:'F',characterOffset:0}]}]}]});await window.transposeApp.persistSong(s,{addToSession:true});window.transposeApp.syncFromSessionStore();window.transposeApp.displaySongs()}""")
  page.locator('[data-inline-field="recording"]').fill('Live 2026'); page.locator('.sidebar-song-heading h2').click(); page.wait_for_function("() => window.transposeApp.currentSongs[0].metadata.recording==='Live 2026'")
  page.locator('[data-inline-field="copyright"]').fill('© 2026 Example'); page.locator('.sidebar-song-heading h2').click(); page.wait_for_function("() => window.transposeApp.currentSongs[0].metadata.copyright.includes('2026')")
  before=page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")
  for preset in ['songselect','compact','hymnal','nashville','stage','tablet']:
    page.evaluate("p => window.transposeApp.setSongLayoutPreset('meta-proof',p)",preset); page.wait_for_function("p => window.transposeApp.currentSongs[0].layout.preset===p",arg=preset)
    assert page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")==before
  page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.metadata?.recording==='Live 2026'")
  pdf64=page.evaluate("""async()=> (await new PDFGenerator().generatePDF(window.transposeApp.currentSongs,'Metadata')).output('datauristring').split(',')[1]"""); pdf=Path(profile)/'meta.pdf'; pdf.write_bytes(base64.b64decode(pdf64)); text=subprocess.run(['pdftotext','-layout',str(pdf),'-'],check=True,text=True,capture_output=True).stdout
  assert 'Live 2026' in text and '2026 Example' in text
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT)); print('12/12 metadata edit, persistence, six preset, content integrity, and PDF checks passed'); context.close()
