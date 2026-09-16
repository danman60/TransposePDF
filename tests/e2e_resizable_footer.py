#!/usr/bin/env python3
"""Footer splitter resizes, persists, resets, and never permits overlap."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000')
SHOT=Path(__file__).parents[1]/'artifacts/e2e/resizable-footer.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-footer-resize-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1500,'height':950},service_workers='block',chromium_sandbox=False)
  page=context.pages[0]; errors=[]
  page.on('console',lambda msg: errors.append(msg.text) if msg.type=='error' else None)
  page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.evaluate("""async()=>{const lines=Array.from({length:24},(_,i)=>({id:`line-${i}`,lyrics:`Footer resize lyric line ${i+1} with enough words for a chart`,chords:[{id:`chord-${i}`,symbol:i%2?'G':'C',characterOffset:0}]}));const song=SongModel.create({id:'footer-resize-proof',title:'Resizable Footer Proof',originalKey:'C',sourceType:'manual',layout:{pageSize:'a4',orientation:'landscape',columns:2,fontSize:13},credits:{writer:{value:'Daniel Abrahamson'},arranger:{value:'Daniel Abrahamson'}},arrangement:{mode:'manual',value:'V1 C V2 C B C'},sections:[{id:'verse',label:'Verse 1',lines}]});await window.transposeApp.persistSong(song,{addToSession:true});window.transposeApp.syncFromSessionStore();window.transposeApp.displaySongs()}""")
  handle=page.locator('.footer-resize-handle').last; handle.wait_for()
  initial=page.evaluate("""()=>{const h=document.querySelector('.footer-resize-handle');const f=h.closest('.chart-page-footer');return{rows:+h.dataset.footerRows,min:+h.dataset.minFooterRows,top:f.getBoundingClientRect().top,pages:document.querySelectorAll('.chart-page').length}}""")
  handle.scroll_into_view_if_needed(); box=handle.bounding_box(); page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2); page.mouse.down(); page.mouse.move(box['x']+box['width']/2,box['y']-80,steps=10); page.mouse.up()
  page.wait_for_function("n => window.transposeApp.currentSongs[0].layout.footerRows > n",arg=initial['rows'])
  custom=page.evaluate("""()=>{const s=window.transposeApp.currentSongs[0],h=document.querySelector('.footer-resize-handle'),f=h.closest('.chart-page-footer'),top=f.getBoundingClientRect().top,overlap=[...f.closest('.chart-page').querySelectorAll('.chart-line')].some(n=>n.getBoundingClientRect().bottom>top+.5);return{saved:s.layout.footerRows,rows:+h.dataset.footerRows,min:+h.dataset.minFooterRows,top,pages:document.querySelectorAll('.chart-page').length,overlap}}""")
  assert custom['saved']>initial['rows'] and custom['rows']==custom['saved'] and custom['top']<initial['top'] and not custom['overlap'],(initial,custom)
  saved=custom['saved']; page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.some(s => s.id === 'footer-resize-proof')")
  assert page.evaluate("()=>window.transposeApp.currentSongs.find(s=>s.id==='footer-resize-proof').layout.footerRows")==saved
  handle=page.locator('.footer-resize-handle').last; handle.focus(); handle.press('ArrowUp')
  page.wait_for_function("n=>window.transposeApp.currentSongs.find(s=>s.id==='footer-resize-proof').layout.footerRows===n+1",arg=saved)
  handle=page.locator('.footer-resize-handle').last; handle.dblclick()
  page.wait_for_function("()=>window.transposeApp.currentSongs.find(s=>s.id==='footer-resize-proof').layout.footerRows===null")
  reset=page.evaluate("""()=>{const h=document.querySelector('.footer-resize-handle'),f=h.closest('.chart-page-footer'),top=f.getBoundingClientRect().top;return{rows:+h.dataset.footerRows,min:+h.dataset.minFooterRows,overlap:[...f.closest('.chart-page').querySelectorAll('.chart-line')].some(n=>n.getBoundingClientRect().bottom>top+.5)}}""")
  assert reset['rows']==reset['min'] and not reset['overlap'],reset
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
  unexpected=[error for error in errors if 'ERR_SW_REGISTER' not in error]
  assert not unexpected,unexpected
  print(f"10/10 footer resize, persistence, keyboard, reset, PDF-plan reserve, and overlap checks passed; {initial['rows']}->{custom['rows']} rows")
  context.close()
