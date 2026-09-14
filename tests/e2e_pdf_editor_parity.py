#!/usr/bin/env python3
"""Prove editor and generated PDF consume the same A4 page plan."""
import base64
import os
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("TRANSPOSEPDF_URL", "http://127.0.0.1:8000")

with tempfile.TemporaryDirectory(prefix="transposepdf-parity-") as temporary, sync_playwright() as pw:
    pdf_path = Path(temporary) / "parity.pdf"
    bbox_path = Path(temporary) / "parity.html"
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.goto(URL)
    page.wait_for_function("() => window.transposeApp && typeof ChartPageLayout === 'function'")
    proof = page.evaluate("""async () => {
      const song = SongModel.create({ id:'parity-song', title:'Parity Proof', originalKey:'F', currentKey:'F',
        sourceType:'manual', layout:{columns:2}, credits:{writer:{value:'Writer Proof'},arranger:{value:'Arranger Proof'}},
        arrangement:{mode:'manual',value:'V1 C V2 C',inferredValue:'V1 C V2 C'}, sections:[
          {label:'Alpha',lines:Array.from({length:7},(_,i)=>({lyrics:`Alpha lyric ${i+1} carries enough words to wrap identically`,chords:[{id:`a${i}`,symbol:'F',characterOffset:6}]}))},
          {label:'Beta',lines:Array.from({length:3},(_,i)=>({lyrics:`Beta lyric ${i+1} follows the same shared geometry`,chords:[{id:`b${i}`,symbol:'Bb',characterOffset:5}]}))},
          {label:'Gamma',lines:Array.from({length:8},(_,i)=>({lyrics:`Gamma lyric ${i+1} remains readable in both outputs`,chords:[{id:`g${i}`,symbol:'C',characterOffset:7}]}))}
        ]});
      window.transposeApp.currentSongs=[song]; window.transposeApp.activeSongId=song.id; window.transposeApp.displaySongs();
      const plan=ChartPageLayout.plan(song,{includeEmptyMetadata:true});
      const editor={pages:document.querySelectorAll('.chart-page').length,
        font:parseFloat(getComputedStyle(document.querySelector('.chart-page-columns')).fontSize),
        lines:[...document.querySelectorAll('.chart-page .lyric-line')].map(e=>e.textContent.trim()).filter(Boolean)};
      const pdf=await new PDFGenerator().generatePDF([song],'Parity Proof');
      return {editor,plan,pdf:pdf.output('datauristring').split(',')[1]};
    }""")
    editor_output = os.environ.get("TRANSPOSEPDF_PARITY_EDITOR")
    if editor_output: page.locator('.lead-sheet').screenshot(path=editor_output)
    pdf_path.write_bytes(base64.b64decode(proof["pdf"]))
    subprocess.run(["pdftotext", "-bbox", str(pdf_path), str(bbox_path)], check=True)
    pages = [node for node in ET.parse(bbox_path).getroot().iter() if node.tag.endswith("page")]
    assert len(pages) == proof["editor"]["pages"], (len(pages), proof["editor"]["pages"])
    assert proof["editor"]["font"] >= 18, proof["editor"]["font"]
    words_by_page = [[word for word in node.iter() if word.tag.endswith("word")] for node in pages]
    for label in ("Alpha", "Beta", "Gamma"):
        planned = next((page_index, column_index) for page_index, planned_page in enumerate(proof["plan"]["pages"])
          for column_index, column in enumerate(planned_page["columns"])
          if any(row.get("type") == "section" and row.get("content") == label for row in column))
        found = next((page_index, float(word.attrib["xMin"])) for page_index, words in enumerate(words_by_page)
          for word in words if (word.text or "") == label)
        expected_x = proof["plan"]["spec"]["margin"] + planned[1] * (proof["plan"]["spec"]["columnWidth"] + proof["plan"]["spec"]["gutter"])
        assert found[0] == planned[0] and abs(found[1] - expected_x) < 3, (label, planned, found, expected_x)
    extracted_lines = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], check=True, text=True, capture_output=True).stdout.splitlines()
    normalized = {" ".join(line.split()) for line in extracted_lines}
    for line in proof["editor"]["lines"]:
        assert any(" ".join(line.split()) in candidate for candidate in normalized), line
    output = os.environ.get("TRANSPOSEPDF_PARITY_PDF")
    if output: Path(output).write_bytes(pdf_path.read_bytes())
    print("6/6 editor/PDF page, column, wrap, and readability parity checks passed")
    browser.close()
