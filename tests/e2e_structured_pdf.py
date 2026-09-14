#!/usr/bin/env python3
"""Generate a real structured PDF and verify its searchable text."""
import os
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")

with tempfile.TemporaryDirectory(prefix="transposepdf-pdf-") as temporary, sync_playwright() as pw:
    pdf_path = Path(temporary) / "structured.pdf"
    text_path = Path(temporary) / "structured.txt"
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("() => typeof PDFGenerator === 'function' && window.jspdf?.jsPDF")
    data = page.evaluate("""async () => {
      const song = SongModel.create({
        title: 'Searchable Export', originalKey: 'F', currentKey: 'F', sourceType: 'manual',
        layout: { columns: 2 },
        credits: { writer: { value: 'Ada Writer', provenance: 'manual' },
          arranger: { value: 'Ray Arranger', provenance: 'manual' } },
        arrangement: { mode: 'manual', value: 'V1 C V2 C', inferredValue: 'Verse Chorus' },
        sections: [{ label: 'Verse 1', lines: [{ lyrics: 'Armor of God', chords: [{
          symbol: 'Gb', characterOffset: 0,
          manualEntry: { provenance: 'manual', enteredSymbol: 'Gb' }
        }] }] }]
      });
      const pdf = await new PDFGenerator().generatePDF([song], 'Searchable Test');
      return pdf.output('datauristring').split(',')[1];
    }""")
    pdf_path.write_bytes(__import__('base64').b64decode(data))
    subprocess.run(["pdftotext", str(pdf_path), str(text_path)], check=True)
    extracted = text_path.read_text(errors="replace")
    for expected in ["Searchable Export", "Armor of God", "Gb", "Written by: Ada Writer",
                     "Arrangement by: Ray Arranger", "Arrangement: V1 C V2 C"]:
        assert expected in extracted, (expected, extracted)
    assert pdf_path.stat().st_size > 1000
    print("7/7 real PDF generation/searchable-text checks passed")
    browser.close()
