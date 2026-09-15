#!/usr/bin/env python3
"""Real-browser notation authoring, transpose, persistence, ChordPro and PDF lifecycle."""
import base64, os, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('TRANSPOSEPDF_URL', 'http://127.0.0.1:8000')
SHOT = Path(__file__).parents[1] / 'artifacts/e2e/structured-notation.png'

with tempfile.TemporaryDirectory(prefix='transposepdf-notation-') as profile, sync_playwright() as pw:
    context = pw.chromium.launch_persistent_context(profile, headless=True, viewport={'width': 1450, 'height': 950}, service_workers='block')
    page = context.pages[0]; page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
    page.locator('#createChartButton').click()
    page.locator('#authorTitle').fill('Notation Lifecycle')
    page.locator('#authorKey').select_option('A')
    source = '||: A | D / / | E(4) | N.C. :|| (1.) (To Bridge)'
    page.locator('#authorContent').fill(f'[Instrumental]\n{source}')
    page.locator('#saveChartButton').click()
    notation = page.locator('[data-inline-field="notation"]'); notation.wait_for()
    assert notation.text_content() == source
    notation.focus(); page.keyboard.press('End'); page.keyboard.type(' (Fine)'); page.locator('.sidebar-song-heading h2').click()
    page.wait_for_function("() => window.transposeApp.currentSongs[0].sections[0].lines[0].notation.source.endsWith('(Fine)')")
    page.evaluate("() => window.transposeApp.transposeSong(window.transposeApp.currentSongs[0].id, 1)")
    page.wait_for_function("() => window.transposeApp.currentSongs[0].transposition === 1")
    shown = notation.text_content()
    assert 'Bb' in shown and 'Eb' in shown and 'N.C.' in shown and '(Fine)' in shown, shown
    page.reload(); page.wait_for_function("() => window.transposeApp?.currentSongs?.length === 1")
    assert '(Fine)' in page.locator('[data-inline-field="notation"]').text_content()
    chordpro = page.evaluate("() => ChordPro.serialize(window.transposeApp.currentSongs[0])")
    assert '{x_notation:' in chordpro and '(Fine)' in chordpro
    pdf64 = page.evaluate("""async () => (await new PDFGenerator().generatePDF(window.transposeApp.currentSongs,'Notation')).output('datauristring').split(',')[1]""")
    pdf = Path(profile) / 'notation.pdf'; pdf.write_bytes(base64.b64decode(pdf64))
    text = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True, text=True, capture_output=True).stdout
    assert 'N.C.' in text and 'Fine' in text and 'To Bridge' in text, text
    SHOT.parent.mkdir(parents=True, exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
    print('9/9 notation authoring, transpose, literal-token, persistence, ChordPro, and PDF checks passed')
    context.close()
