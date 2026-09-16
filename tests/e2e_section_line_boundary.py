#!/usr/bin/env python3
"""Real-browser exact lyric-line target for a dragged section delineator."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000'); SHOT=Path(__file__).parents[1]/'artifacts/e2e/section-line-boundary.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-boundary-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':950},service_workers='block')
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.locator('#createChartButton').click(); page.locator('#authorTitle').fill('Line Boundary Proof')
  page.locator('#authorContent').fill('[Verse 1]\nC\nLine one\nD\nLine two\nE\nLine three\nF\nLine four\nG\nLine five\n\n[Bridge]\nAm\nBridge own line')
  page.locator('#saveChartButton').click(); page.locator('.lead-sheet').wait_for()
  original=page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")
  target=page.locator('[data-inline-field="lyrics"][data-section-index="0"][data-line-index="2"]'); box=target.bounding_box()
  page.evaluate("""({x,y})=>{const chart=document.querySelector('.lead-sheet .structured-chart'),h=chart.querySelectorAll('.section-drag-handle')[1];window.__dt=new DataTransfer();h.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.__dt}));target=document.elementFromPoint(x,y);target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__dt,clientX:x,clientY:y}))}""",{'x':box['x']+20,'y':box['y']+2})
  marker=page.locator('.section-line-drop-before'); marker.wait_for(); assert marker.get_attribute('data-line-index')=='2', page.evaluate("() => ({marker:[...document.querySelectorAll('.section-line-drop-before')].map(x=>({line:x.dataset.lineIndex,rect:x.getBoundingClientRect().toJSON()})), target:document.querySelector('[data-inline-field=\"lyrics\"][data-section-index=\"0\"][data-line-index=\"2\"]').getBoundingClientRect().toJSON()})")
  row_top=target.evaluate("el => el.closest('.chart-line').getBoundingClientRect().top")
  marker_box=marker.bounding_box(); assert abs(marker_box['y']-row_top) < 8, (marker_box,row_top)
  page.evaluate("""({x,y})=>{const target=document.elementFromPoint(x,y);target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__dt,clientX:x,clientY:y}));target.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:window.__dt,clientX:x,clientY:y}))}""",{'x':box['x']+20,'y':box['y']+2})
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines.length === 2")
  model=page.evaluate("() => window.transposeApp.currentSongs[0].sections.map(s=>({label:s.label,lyrics:s.lines.map(l=>l.lyrics),lineIds:s.lines.map(l=>l.id),chordIds:s.lines.flatMap(l=>l.chords.map(c=>c.id))}))")
  assert model[0]['lyrics']==['Line one','Line two']; assert model[1]['lyrics'][:3]==['Line three','Line four','Line five']; assert model[1]['lyrics'][-1]=='Bridge own line'
  all_line_ids=[i for s in model for i in s['lineIds']]; all_chord_ids=[i for s in model for i in s['chordIds']]; assert len(all_line_ids)==len(set(all_line_ids)) and len(all_chord_ids)==len(set(all_chord_ids))
  page.locator('body').click(position={'x':5,'y':5}); page.keyboard.press('Control+z'); page.wait_for_function("o => JSON.stringify(window.transposeApp.currentSongs[0].sections) === o",arg=original)
  page.evaluate("""async()=>{const app=window.transposeApp,s=SongModel.create({...app.currentSongs[0],sections:[{id:'long',label:'Verse 1',lines:Array.from({length:34},(_,i)=>({id:`line-${i}`,lyrics:`Long page boundary lyric number ${i+1}`,chords:[{id:`chord-${i}`,symbol:i%2?'F':'C',characterOffset:0}]}))}]});await app.persistSong(s,{addToSession:false});app.updateLeadSheetDisplay(s)}""")
  page.wait_for_function("() => document.querySelectorAll('.chart-page').length > 1")
  overflow=page.evaluate("""() => [...document.querySelectorAll('.chart-page')].flatMap((page,pageIndex)=>{const body=page.querySelector('.chart-page-body').getBoundingClientRect();return [...page.querySelectorAll('.chart-line')].filter(line=>line.getBoundingClientRect().bottom>body.bottom+1).map(line=>({page:pageIndex+1,bottom:line.getBoundingClientRect().bottom,edge:body.bottom,text:line.textContent}))})""")
  assert overflow == [], overflow
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT)); print('10/10 exact line marker, boundary transfer, ID integrity, undo, and page-edge wrap checks passed'); context.close()
