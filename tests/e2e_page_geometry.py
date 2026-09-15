#!/usr/bin/env python3
"""Real-browser proof that per-song geometry drives editor and generated PDF."""
import base64, os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.environ.get('TRANSPOSEPDF_URL','http://127.0.0.1:8000')
SHOT=Path(__file__).parents[1]/'artifacts/e2e/page-geometry.png'

with tempfile.TemporaryDirectory(prefix='transposepdf-geometry-') as profile, sync_playwright() as pw:
    context=pw.chromium.launch_persistent_context(profile,headless=True,viewport={'width':1600,'height':1100},service_workers='block')
    page=context.pages[0]; page.goto(URL); page.wait_for_function("() => window.transposeApp?.libraryStore")
    result=page.evaluate("""async () => {
      const song=SongModel.create({id:'geometry-proof',title:'Geometry Proof',originalKey:'F',sourceType:'manual',
        layout:{columns:2,pageSize:'letter',orientation:'landscape',fontSize:13,gutter:28,columnRatios:[.35,.65],margins:{top:30,right:42,bottom:54,left:24},layoutMode:true},
        sections:Array.from({length:5},(_,s)=>({label:`Section ${s+1}`,lines:Array.from({length:6},(_,l)=>({lyrics:`Geometry lyric ${s+1}-${l+1} remains canonical while page dimensions change`,chords:[{symbol:'F',characterOffset:9}]}))}))});
      await window.transposeApp.persistSong(song,{addToSession:true});window.transposeApp.syncFromSessionStore();window.transposeApp.displaySongs();
      const plan=ChartPageLayout.plan(window.transposeApp.currentSongs[0]);
      const pdf=await new PDFGenerator().generatePDF([window.transposeApp.currentSongs[0]],'Geometry Proof');
      return {spec:plan.spec,pdfWidth:pdf.internal.pageSize.getWidth(),pdfHeight:pdf.internal.pageSize.getHeight(),pdf:pdf.output('datauristring').split(',')[1]};
    }""")
    chart=page.locator('.chart-page').first
    box=chart.bounding_box(); columns=page.locator('.chart-page-columns').first.evaluate("e=>({template:getComputedStyle(e).gridTemplateColumns,gap:parseFloat(getComputedStyle(e).columnGap),width:e.getBoundingClientRect().width})")
    widths=[float(value.replace('px','')) for value in columns['template'].split()]
    metrics=page.locator('.chart-page').evaluate_all("pages=>pages.map(e=>({client:e.clientHeight,scroll:e.scrollHeight,columns:e.querySelector('.chart-page-columns')?.getBoundingClientRect().height,footer:e.querySelector('.chart-page-footer')?.getBoundingClientRect().height||0}))")
    checks={
      'letter_landscape_plan': abs(result['spec']['pageWidth']-792)<.1 and abs(result['spec']['pageHeight']-612)<.1,
      'four_margins': result['spec']['margins']=={'top':30,'right':42,'bottom':54,'left':24},
      'gutter': result['spec']['gutter']==28,
      'unequal_columns': widths[1]>widths[0]*1.7,
      'editor_aspect': abs(box['width']/box['height']-792/612)<.02,
      'vertical_divider': page.locator('.column-divider-handle').count()>=1,
      'pdf_dimensions_match': abs(result['pdfWidth']-792)<.2 and abs(result['pdfHeight']-612)<.2,
      'content_intact': page.evaluate("() => {const s=window.transposeApp.currentSongs[0];return s.sections.length===5&&s.sections.flatMap(x=>x.lines).length===30&&s.sections.flatMap(x=>x.lines).flatMap(x=>x.chords).length===30}"),
      'no_editor_overflow': page.locator('.chart-page').evaluate_all("pages=>pages.every(e=>e.scrollHeight<=e.clientHeight+1)"),
    }
    if not checks['no_editor_overflow']:
      offenders=page.locator('.chart-page').first.evaluate("e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('*')].map(x=>{const b=x.getBoundingClientRect();return {cls:x.className,tag:x.tagName,bottom:b.bottom-r.bottom,right:b.right-r.right,height:b.height}}).sort((a,b)=>b.bottom-a.bottom).slice(0,8)}")
      print('OVERFLOW_DIAGNOSTIC',metrics,offenders)
    SHOT.parent.mkdir(parents=True,exist_ok=True); page.locator('.session-workspace').screenshot(path=str(SHOT))
    Path(profile,'geometry.pdf').write_bytes(base64.b64decode(result['pdf']))
    for name,ok in checks.items(): print(('PASS' if ok else 'FAIL'),name)
    failed=[name for name,ok in checks.items() if not ok]
    if failed: raise SystemExit('Failed: '+', '.join(failed))
    print(f'{len(checks)}/{len(checks)} per-song geometry checks passed')
    context.close()
