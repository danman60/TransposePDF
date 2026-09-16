#!/usr/bin/env python3
"""Real-browser chord-row keyboard navigation and safe notation deletion."""
import os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000')
SHOT=Path(__file__).parents[1]/'artifacts/e2e/chord-hotkey-notation-delete.png'
with tempfile.TemporaryDirectory(prefix='transposepdf-hotkey-') as profile, sync_playwright() as pw:
  context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1400,'height':900},service_workers='block')
  page=context.pages[0]; page.goto(URL); page.wait_for_function("() => typeof window.transposeApp?.persistSong === 'function'")
  page.locator('#createChartButton').click(); page.locator('#authorTitle').fill('Hotkey Proof')
  page.locator('#authorContent').fill('[Verse 1]\nFeet prepared for the road\nNext lyric stays\n\n[Chorus]\nC       F\nSing this chorus\n\n[Bridge]\nBridge words stay')
  page.locator('#saveChartButton').click(); lyric=page.locator('[data-inline-field="lyrics"][data-section-index="0"][data-line-index="0"]'); lyric.wait_for()
  lyric.focus(); page.evaluate("""() => {const n=document.activeElement,r=document.createRange(),s=getSelection();r.setStart(n.firstChild,5);r.collapse(true);s.removeAllRanges();s.addRange(r)}""")
  page.keyboard.press('Alt+ArrowUp'); page.wait_for_function("() => document.activeElement?.dataset?.inlineField === 'chord'")
  assert page.evaluate("() => Number(document.activeElement.closest('.inline-chord-anchor').dataset.characterOffset)") == 5
  page.keyboard.type('Dm'); page.locator('.sidebar-song-heading h2').click(); page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[0].chords[0].symbol === 'Dm'")
  page.locator('[data-inline-field="chord"][data-section-index="0"]').focus(); page.keyboard.press('Alt+ArrowDown')
  assert page.evaluate("() => document.activeElement?.dataset?.inlineField") == 'lyrics'
  assert page.evaluate("() => window.getSelection().anchorOffset") == 5
  page.evaluate("() => window.transposeApp.convertInlineLineToNotation(window.transposeApp.currentSongs[0].id,0,0)")
  page.wait_for_function("() => document.activeElement?.dataset?.inlineField === 'notation'"); page.keyboard.press('Delete')
  page.wait_for_function("() => !window.transposeApp.currentSongs[0].sections[0].lines.some(l => l.notation)")
  model=page.evaluate("() => window.transposeApp.currentSongs[0].sections[0].lines.map(l=>({lyrics:l.lyrics,chords:l.chords.length}))")
  assert model[0] == {'lyrics':'Next lyric stays','chords':0} and all(item['chords']==0 for item in model), model
  page.locator('body').click(position={'x':5,'y':5}); page.keyboard.press('Control+z')
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines.some(l => l.notation)")
  notation=page.locator('[data-inline-field="notation"]'); notation.click(button='right')
  assert page.locator('[data-context-command="delete-notation"]').is_visible(); page.locator('[data-context-command="delete-notation"]').click()
  page.wait_for_function("() => !window.transposeApp.currentSongs[0].sections[0].lines.some(l => l.notation)")
  page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.[0]?.sections?.[0]?.lines?.[0]?.lyrics === 'Next lyric stays'")
  assert page.locator('[data-inline-field="lyrics"]').first.text_content() == 'Next lyric stays'
  page.locator('[data-inline-field="section-label"]',has_text='Chorus').click(button='right')
  copy=page.locator('[data-context-command="copy-section-chords-to"]',has_text='Bridge'); assert copy.is_visible(); copy.click()
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[2].lines[0].chords.length === 2")
  copied=page.evaluate("""() => {const s=window.transposeApp.currentSongs[0];return {source:s.sections[1].lines[0].chords.map(c=>c.id),target:s.sections[2].lines[0].chords.map(c=>c.id),lyrics:s.sections.map(x=>x.lines.map(l=>l.lyrics))}}""")
  assert set(copied['source']).isdisjoint(copied['target']) and copied['lyrics'][2][0]=='Bridge words stay'
  page.locator('[data-inline-field="section-label"]',has_text='Chorus').click(button='right'); clear=page.locator('[data-context-command="clear-section-chords"]'); assert clear.is_visible(); clear.click()
  page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[1].lines[0].chords.length === 0")
  assert page.evaluate("() => window.transposeApp.currentSongs[0].sections[2].lines[0].chords.length") == 2
  SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
  print('15/15 chord-row hotkey, notation deletion, section chord copy/clear, neighbor safety, undo, and reload checks passed'); context.close()
