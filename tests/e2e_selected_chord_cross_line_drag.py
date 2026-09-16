#!/usr/bin/env python3
"""Selected chord body drag and Alt-copy into an empty chord lane."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000')
SHOT=Path(__file__).parents[1]/'artifacts/e2e/selected-chord-cross-line-drag.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-selected-drag-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':950},service_workers='block',chromium_sandbox=False)
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.evaluate("""async()=>{const song=SongModel.create({id:'selected-drag-proof',title:'Selected Drag Proof',originalKey:'C',sourceType:'manual',sections:[{id:'verse',label:'Verse 1',lines:[{id:'one',lyrics:'First lyric line',chords:[{id:'drag-me',symbol:'C',characterOffset:0}]},{id:'two',lyrics:'Empty destination line',chords:[]}]}]});await window.transposeApp.persistSong(song,{addToSession:true});window.transposeApp.syncFromSessionStore();window.transposeApp.displaySongs()}""")
  chord=page.locator('#songsContainer .inline-chord-anchor[data-chord-id="drag-me"]'); chord.click(); assert chord.get_attribute('aria-selected')=='true'
  start=chord.bounding_box(); lane=page.locator('#songsContainer .chord-line[data-line-index="1"]'); end=lane.bounding_box()
  page.mouse.move(start['x']+4,start['y']+4); page.mouse.down(); page.mouse.move(end['x']+180,end['y']+5,steps=12); page.mouse.up()
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[1].chords.some(c=>c.id==='drag-me')")
  assert not page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords.some(c=>c.id==='drag-me')")
  page.keyboard.press('Control+z'); page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords.some(c=>c.id==='drag-me')")
  chord=page.locator('#songsContainer .inline-chord-anchor[data-chord-id="drag-me"]'); chord.click(); start=chord.bounding_box(); lane=page.locator('#songsContainer .chord-line[data-line-index="1"]'); end=lane.bounding_box()
  page.keyboard.down('Alt'); page.mouse.move(start['x']+4,start['y']+4); page.mouse.down(); page.mouse.move(end['x']+260,end['y']+5,steps=12); page.mouse.up(); page.keyboard.up('Alt')
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[1].chords.length===1")
  state=page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines.map(l=>l.chords.map(c=>({id:c.id,symbol:c.symbol})))")
  assert state[0][0]['id']=='drag-me' and state[1][0]['id']!='drag-me' and state[1][0]['symbol']=='C',state
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
  print('8/8 selected chord cross-line move and Alt-copy into empty lane checks passed'); context.close()
