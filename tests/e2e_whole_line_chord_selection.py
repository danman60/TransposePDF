#!/usr/bin/env python3
"""Real-browser whole-line gestures and select/drag/double-click chord contract."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000'); SHOT=Path(__file__).parents[1]/'artifacts/e2e/whole-line-controls.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-lines-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':950},service_workers='block')
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.locator('#createChartButton').click(); page.locator('#authorTitle').fill('Whole Line Proof')
  page.locator('#authorContent').fill('[Verse 1]\nC G\nFirst lyric\nDm\nSecond lyric\n\n[Chorus]\nF\nChorus lyric')
  page.locator('#saveChartButton').click(); page.locator('.lead-sheet').wait_for()
  first_chord=page.locator('.inline-chord-anchor').first; chord_id=first_chord.get_attribute('data-chord-id')
  first_chord.click(); assert first_chord.get_attribute('aria-selected')=='true'; assert page.locator('[data-inline-field="chord"]').first.get_attribute('contenteditable')=='false'
  page.keyboard.press('Delete'); page.wait_for_timeout(400)
  delete_diag=page.evaluate("id => ({active:document.activeElement?.outerHTML, selected:[...document.querySelectorAll('.inline-chord-anchor.is-selected')].map(n=>n.dataset.chordId), ids:window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).flatMap(l=>l.chords).map(c=>c.id)})",chord_id)
  assert chord_id not in delete_diag['ids'], delete_diag
  page.keyboard.press('Control+z'); page.wait_for_function("id => !!document.querySelector(`[data-chord-id='${id}']`)",arg=chord_id)
  restored=page.locator(f'.lead-sheet .inline-chord-anchor[data-chord-id="{chord_id}"]'); restored.dblclick(); assert restored.locator('[data-inline-field="chord"]').get_attribute('contenteditable')=='plaintext-only'
  page.keyboard.press('Escape')
  original=page.evaluate("() => JSON.stringify(window.transposeApp.currentSongs[0].sections)")
  checks=page.locator('.line-select-checkbox[data-section-index="0"]'); checks.nth(0).click(); checks.nth(1).click(modifiers=['Shift']); assert checks.nth(0).is_checked() and checks.nth(1).is_checked(), page.evaluate("() => [...document.querySelectorAll('.lead-sheet .line-select-checkbox')].map(x=>({s:x.dataset.sectionIndex,l:x.dataset.lineIndex,c:x.checked}))")
  target=page.locator('[data-inline-field="lyrics"][data-section-index="1"][data-line-index="0"]'); group_box=target.locator('xpath=..').bounding_box()
  page.evaluate("""({x,y})=>{const h=document.querySelector('.line-drag-handle[data-section-index="0"][data-line-index="0"]');window.__ldt=new DataTransfer();h.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,altKey:true}));const n=document.elementFromPoint(x,y);n.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,clientX:x,clientY:y,altKey:true}));n.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,clientX:x,clientY:y,altKey:true}));n.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,altKey:true}))}""",{'x':group_box['x']+30,'y':group_box['y']+2})
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[1].lines.length === 3")
  group=page.evaluate("() => window.transposeApp.currentSongs[0].sections[1].lines.slice(0,2)"); assert [x['lyrics'] for x in group]==['First lyric','Second lyric'] and group[0]['chords'][0]['id']!=chord_id
  page.keyboard.press('Control+z'); page.wait_for_function("o => JSON.stringify(window.transposeApp.currentSongs[0].sections) === o",arg=original)
  page.locator('.line-select-checkbox[data-section-index="0"][data-line-index="0"]').check(); page.keyboard.press('Control+c'); page.keyboard.press('Control+v')
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[1]?.lyrics === 'First lyric'")
  pasted=page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines.slice(0,3)"); assert pasted[0]['lyrics']==pasted[1]['lyrics']=='First lyric' and pasted[0]['id']!=pasted[1]['id'], pasted
  page.keyboard.press('Control+z'); page.wait_for_function("o => JSON.stringify(window.transposeApp.currentSongs[0].sections) === o",arg=original)
  source=page.locator('.line-drag-handle[data-section-index="0"][data-line-index="0"]'); target=page.locator('[data-inline-field="lyrics"][data-section-index="1"][data-line-index="0"]'); box=target.locator('xpath=..').bounding_box()
  page.evaluate("""({x,y})=>{const h=document.querySelector('.line-drag-handle[data-section-index="0"][data-line-index="0"]');window.__ldt=new DataTransfer();h.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:window.__ldt}));document.elementFromPoint(x,y).dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,clientX:x,clientY:y}))}""",{'x':box['x']+30,'y':box['y']+2})
  assert page.locator('.line-drop-before').count()==1
  page.evaluate("""({x,y})=>{const n=document.elementFromPoint(x,y);n.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:window.__ldt,clientX:x,clientY:y}));n.dispatchEvent(new DragEvent('dragend',{bubbles:true,cancelable:true,dataTransfer:window.__ldt}))}""",{'x':box['x']+30,'y':box['y']+2})
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[1].lines[0].lyrics === 'First lyric'")
  moved=page.evaluate("() => window.transposeApp.currentSongs[0].sections[1].lines[0]"); assert moved['lyrics']=='First lyric' and len(moved['chords'])==2 and moved['chords'][0]['id']==chord_id
  page.keyboard.press('Control+z'); page.wait_for_function("o => JSON.stringify(window.transposeApp.currentSongs[0].sections) === o",arg=original)
  page.locator('.line-delete-button[data-section-index="0"][data-line-index="0"]').click(); page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[0].lyrics === 'Second lyric'")
  deleted=page.evaluate("() => window.transposeApp.currentSongs[0].sections.flatMap(s=>s.lines).flatMap(l=>l.chords).map(c=>c.id)"); assert chord_id not in deleted
  page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.sections?.[0]?.lines?.[0]?.lyrics === 'Second lyric'")
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
  print('18/18 chord select/delete/edit and whole-line select/copy/paste/drag/delete/undo/reload checks passed'); context.close()
