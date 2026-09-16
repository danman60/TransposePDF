#!/usr/bin/env python3
"""Page/column break commands must be reachable from every chart-row context target."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000')
SHOT=Path(__file__).parents[1]/'artifacts/e2e/page-break-context-menu.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-break-menu-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':950},service_workers='block',chromium_sandbox=False)
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.locator('#createChartButton').click(); page.locator('#authorTitle').fill('Break Menu Proof')
  page.locator('#authorContent').fill('[Verse 1]\nC G\nFirst lyric\nDm\nSecond lyric\n\n[Chorus]\nF\nChorus lyric')
  page.locator('#saveChartButton').click(); page.locator('#songsContainer .lead-sheet').wait_for()
  targets={
    'lyric':'#songsContainer [data-inline-field="lyrics"][data-line-index="0"]',
    'chord':'#songsContainer .inline-chord-anchor[data-line-index="0"]',
    'lane':'#songsContainer .chord-line[data-line-index="0"]',
    'section':'#songsContainer [data-inline-field="section-label"][data-section-index="0"]',
  }
  results={}
  for name,selector in targets.items():
    page.locator(selector).first.click(button='right',force=True); labels=page.locator('.chart-context-menu [role="menuitem"]').all_text_contents()
    results[name]={'page':any('page break' in label.lower() or 'new page' in label.lower() for label in labels),'column':any('column break' in label.lower() or 'end column' in label.lower() for label in labels)}
    page.keyboard.press('Escape')
  assert all(item['page'] and item['column'] for item in results.values()), results
  page.locator(targets['lane']).first.click(button='right',force=True); SHOT.parent.mkdir(parents=True,exist_ok=True); page.screenshot(path=str(SHOT)); page.get_by_role('menuitem',name='Start new page after this line').click()
  page.wait_for_function("() => window.transposeApp.currentSongs[0].layout.breaks.some(b=>b.type==='page')")
  page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.layout?.breaks?.some(b=>b.type==='page')")
  print('10/10 lyric, chord, lane, section page/column menu visibility and page-break creation checks passed'); context.close()
