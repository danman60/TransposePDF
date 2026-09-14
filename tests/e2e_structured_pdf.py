#!/usr/bin/env python3
"""Generate a real structured PDF and verify its searchable text."""
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000").rstrip("/")

with tempfile.TemporaryDirectory(prefix="transposepdf-pdf-") as temporary, sync_playwright() as pw:
    pdf_path = Path(temporary) / "structured.pdf"
    text_path = Path(temporary) / "structured.txt"
    bbox_path = Path(temporary) / "structured.html"
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_function("() => typeof PDFGenerator === 'function' && window.jspdf?.jsPDF")
    data = page.evaluate("""async () => {
      const song = SongModel.create({
        title: 'Searchable Export', originalKey: 'F', currentKey: 'F', sourceType: 'audio',
        layout: { columns: 2 },
        credits: { writer: { value: 'Ada Writer', provenance: 'manual' },
          arranger: { value: 'Ray Arranger', provenance: 'manual' } },
        arrangement: { mode: 'manual', value: 'V1 C V2 C', inferredValue: 'Verse Chorus' },
        sections: Array.from({ length: 6 }, (_, sectionIndex) => ({
          label: `Section ${sectionIndex + 1}`,
          lines: Array.from({ length: 8 }, (_, lineIndex) => ({
            lyrics: `Armor of God line ${sectionIndex + 1}-${lineIndex + 1}`,
            chords: [{ symbol: sectionIndex === 0 && lineIndex === 0 ? 'Gb' : 'F', characterOffset: 0,
              manualEntry: { provenance: 'manual', enteredSymbol: sectionIndex === 0 && lineIndex === 0 ? 'Gb' : 'F' } }]
          }))
        }))
      });
      const pdf = await new PDFGenerator().generatePDF([song], 'Searchable Test');
      return pdf.output('datauristring').split(',')[1];
    }""")
    pdf_path.write_bytes(__import__('base64').b64decode(data))
    subprocess.run(["pdftotext", str(pdf_path), str(text_path)], check=True)
    subprocess.run(["pdftotext", "-bbox", str(pdf_path), str(bbox_path)], check=True)
    extracted = text_path.read_text(errors="replace")
    for expected in ["Searchable Export", "Armor of God", "Gb", "Written by: Ada Writer",
                     "Arrangement by: Ray Arranger", "Arrangement: V1 C V2 C"]:
        assert expected in extracted, (expected, extracted)
    assert pdf_path.stat().st_size > 1000
    root = ET.parse(bbox_path).getroot()
    words = [word for word in root.iter() if word.tag.endswith("word")]
    armor_x = [float(word.attrib["xMin"]) for word in words if (word.text or "") == "Armor"]
    assert min(armor_x) < 100, armor_x
    assert max(armor_x) > 300, armor_x
    output_path = os.environ.get("TRANSPOSEPDF_TEST_PDF")
    if output_path:
        Path(output_path).write_bytes(pdf_path.read_bytes())
    print("9/9 real audio PDF generation/searchable-text/two-column checks passed")
    browser.close()
