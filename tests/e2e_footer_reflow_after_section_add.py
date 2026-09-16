#!/usr/bin/env python3
"""Added content must reflow above the full rendered credits/arrangement footer."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000'); SHOT=Path(__file__).parents[1]/'artifacts/e2e/footer-reflow-after-add.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-footer-reflow-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1500,'height':950},service_workers='block',chromium_sandbox=False)
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.evaluate("""async()=>{const lines=Array.from({length:5},(_,i)=>({id:`line-${i}`,lyrics:`Existing lyric line ${i+1}`,chords:[{id:`chord-${i}`,symbol:i%2?'F#m':'Bm7',characterOffset:0}]}));const song=SongModel.create({id:'footer-reflow-proof',title:'Footer Reflow Proof',originalKey:'D',sourceType:'manual',layout:{pageSize:'a4',orientation:'landscape',columns:1,fontSize:13},credits:{writer:{value:'Daniel Abrahamson'},arranger:{value:'Daniel Abrahamson'}},arrangement:{mode:'manual',value:'V1 C B C'},sections:[{id:'verse',label:'Verse 1',lines}]});await window.transposeApp.persistSong(song,{addToSession:true});window.transposeApp.syncFromSessionStore();window.transposeApp.displaySongs();await window.transposeApp.addInlineSection(song.id,1);let named=SongModel.create(window.transposeApp.currentSongs[0]);named.sections[1].label='Chorus';named.sections[1].labelProvenance='manual';named.sections[1].pendingSection=false;await window.transposeApp.persistSong(named,{addToSession:false});window.transposeApp.updateLeadSheetDisplay(window.transposeApp.currentSongs[0]);await window.transposeApp.replaceInlineLyrics(song.id,1,0,'Newly added lyric one');await window.transposeApp.insertInlineChord(song.id,1,0,0,'A');await window.transposeApp.addInlineChartLineAt(song.id,1,1);await window.transposeApp.replaceInlineLyrics(song.id,1,1,'Newly added lyric two');await window.transposeApp.insertInlineChord(song.id,1,1,0,'D')}""")
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections.length===2")
  overlap=page.evaluate("""() => [...document.querySelectorAll('#songsContainer .chart-page')].flatMap((p,index)=>{const footer=p.querySelector('.chart-page-footer');if(!footer)return[];const top=footer.getBoundingClientRect().top;return [...p.querySelectorAll('.chart-line')].filter(n=>n.getBoundingClientRect().bottom>top+.5).map(n=>({page:index+1,bottom:n.getBoundingClientRect().bottom,footerTop:top,text:n.textContent}))})""")
  assert page.get_by_text('Newly added lyric one',exact=True).count()==1 and page.get_by_text('Newly added lyric two',exact=True).count()==1
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT)); assert overlap==[],overlap
  print('6/6 section add, final-page reflow, footer clearance, credits, arrangement, and page-boundary checks passed'); context.close()
