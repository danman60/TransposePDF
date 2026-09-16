#!/usr/bin/env python3
"""Real-browser collapse/expand and collapsed whole-section reorder lifecycle."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000'); SHOT=Path(__file__).parents[1]/'artifacts/e2e/collapsible-sections.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-collapse-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':950},service_workers='block')
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.locator('#createChartButton').click(); page.locator('#authorTitle').fill('Collapse Proof')
  page.locator('#authorContent').fill('[Verse 1]\nC G\nFirst lyric\nDm\nSecond lyric\n\n[Chorus]\nF\nChorus lyric\n\n[Bridge]\nAm\nBridge lyric')
  page.locator('#saveChartButton').click(); page.locator('#songsContainer .section-collapse-toggle').first.wait_for()
  source_id=page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].id")
  source_data=page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections[0])")
  toggle=page.locator('#songsContainer .section-collapse-toggle[data-section-index="0"]').first; assert 'lines' in toggle.locator('xpath=..').text_content()
  toggle.click(); assert toggle.get_attribute('aria-expanded')=='false'
  assert page.locator('#songsContainer .section-block[data-section-reorder-index="0"]').first.evaluate("n => n.classList.contains('is-collapsed') && [...n.children].filter(x=>x.classList.contains('chart-line')).every(x=>getComputedStyle(x).display==='none')")
  assert page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections[0])")==source_data
  page.reload(); page.wait_for_function("() => document.querySelector('#songsContainer .section-collapse-toggle')?.getAttribute('aria-expanded') === 'false'")
  source=page.locator('#songsContainer .section-block[data-section-reorder-index="0"] .section-drag-handle').first
  target=page.locator('#songsContainer .section-block[data-section-reorder-index="1"]').first; box=target.bounding_box()
  page.evaluate("""({x,y})=>{const h=document.querySelector('#songsContainer .section-block[data-section-reorder-index="0"] .section-drag-handle');window.__sdt=new DataTransfer();h.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.__sdt}));const n=document.elementFromPoint(x,y);n.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__sdt,clientX:x,clientY:y}));n.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__sdt,clientX:x,clientY:y}));n.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:window.__sdt}))}""",{'x':box['x']+20,'y':box['y']+box['height']-2})
  page.wait_for_function("id => window.transposeApp.currentSongs[0].sections[1].id === id",arg=source_id)
  moved_index=page.evaluate("id => window.transposeApp.currentSongs[0].sections.findIndex(s=>s.id===id)",source_id)
  moved_toggle=page.locator(f'#songsContainer .section-collapse-toggle[data-section-index="{moved_index}"]').first; assert moved_toggle.get_attribute('aria-expanded')=='false'
  assert page.evaluate("id => JSON.stringify(window.transposeApp.currentSongs[0].sections.find(s=>s.id===id))",source_id)==source_data
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
  moved_toggle.click(); page.wait_for_function("i => document.querySelector(`#songsContainer .section-collapse-toggle[data-section-index='${i}']`)?.getAttribute('aria-expanded') === 'true'",arg=moved_index)
  assert page.locator(f'#songsContainer .section-block[data-section-reorder-index="{moved_index}"] .chart-line').first.is_visible()
  print('10/10 collapse, unchanged data, reload persistence, collapsed reorder, stable-ID state, and expand checks passed'); context.close()
