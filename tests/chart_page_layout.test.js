const assert = require('node:assert/strict');
const ChartPageLayout = require('../modules/chartPageLayout');
global.ChartPageLayout = ChartPageLayout;
const ChartRenderer = require('../modules/chartRenderer');

const song = {
  layout: { columns: 2 },
  credits: { writer: { value: 'Daniel Abrahamson' }, arranger: { value: 'Daniel Abrahamson' } },
  arrangement: { mode: 'manual', value: 'V1 C V2 C B T C' },
  sections: Array.from({ length: 7 }, (_, sectionIndex) => ({
    label: sectionIndex === 6 ? 'Tag' : `Section ${sectionIndex + 1}`,
    lines: Array.from({ length: sectionIndex === 4 ? 12 : 5 }, (_, lineIndex) => ({
      lyrics: `Readable lyric line ${sectionIndex + 1}-${lineIndex + 1} with enough words to exercise deterministic wrapping`,
      chords: [{ symbol: 'F#m', characterOffset: 9 }]
    }))
  }))
};

const plan = ChartPageLayout.plan(song);
assert.equal(plan.spec.fontSize, 13);
assert.equal(plan.spec.columns, 2);
assert.ok(plan.pages.length <= 6, `unexpected blank-page expansion: ${plan.pages.length}`);
assert.ok(plan.metadata.some(row => row.field === 'writer' && row.value === 'Daniel Abrahamson'));
assert.ok(!plan.pages.some((page, index) => index > 0 && page.columns.flat().length === 0), 'blank page');
assert.ok(plan.pages.slice(0, -1).every(page => page.columns.flat().length >= plan.spec.rowsPerColumn), 'non-final pages must use at least half their available rows');
assert.ok(plan.pages[plan.pages.length - 1].columns.flat().some(row => Number.isFinite(row.sectionIndex)), 'metadata page must retain chart content');
const finalCounts = plan.pages[plan.pages.length - 1].columns.map(rows => rows.length);
assert.ok(Math.max(...finalCounts) - Math.min(...finalCounts) <= 3, `final page columns are not balanced: ${finalCounts}`);
plan.pages.forEach(page => page.columns.forEach(rows => rows.forEach((row, index) => {
  if (row.type === 'chords') assert.equal(rows[index + 1]?.lineIndex, row.lineIndex, 'chord row separated from lyric row');
  if (row.type === 'section' && rows[index + 1]) assert.ok(rows[index + 1].lineIndex != null, 'section heading orphaned');
})));
const segments = ChartPageLayout.wrapLine(song.sections[0].lines[0], plan.spec.maxCharacters);
assert.ok(segments.length > 1);
assert.equal(segments.map(segment => segment.lyrics).join(' '), song.sections[0].lines[0].lyrics);
assert.ok(segments.some(segment => segment.chords.length === 1));
assert.equal(ChartPageLayout.plan({ ...song, layout: { columns: 2, fontSize: 11 } }).spec.fontSize, 11);
assert.equal(ChartPageLayout.plan({ ...song, layout: { columns: 2, fontSize: 99 } }).spec.fontSize, 18);
const anchored = JSON.parse(JSON.stringify(song));
anchored.sections.forEach((section, sectionIndex) => { section.id = `s${sectionIndex}`; section.lines.forEach((line, lineIndex) => { line.id = `s${sectionIndex}l${lineIndex}`; }); });
anchored.layout = { columns: 2, fontSize: 13, margin: 'wide', sectionSpacing: 'spacious', balance: 'off',
  breaks: [{ id: 'b1', type: 'column', sectionId: 's0', lineId: 's0l1', edge: 'after' }],
  sectionRules: { s1: { keepTogether: true, start: 'column' }, s2: { spanColumns: true } } };
const directed = ChartPageLayout.plan(anchored);
assert.equal(directed.spec.margin, 54);
assert.ok(directed.pages.some(page => page.spanSectionId === 's2'), 'spanning section gets full-width page');
assert.ok(directed.pages[0].columns[0].some(row => row.lineId === 's0l1'));
assert.ok(!directed.pages[0].columns[0].some(row => row.lineId === 's0l2'), 'manual column termination honored');
assert.ok(directed.pages.some(page => page.columns.some(rows => rows.filter(row => row.sectionId === 's0' && row.sectionGap).length === 2)), 'spacious gap honored');
assert.ok(Array.isArray(directed.warnings));
const geometry = ChartPageLayout.plan({ ...anchored, layout: { ...anchored.layout, pageSize: 'letter', orientation: 'landscape',
  margins: { top: 36, right: 54, bottom: 72, left: 18 }, gutter: 24, columnRatios: [.35, .65] } });
assert.deepEqual([geometry.spec.pageWidth, geometry.spec.pageHeight], [792, 612]);
assert.deepEqual(geometry.spec.margins, { top: 36, right: 54, bottom: 72, left: 18 });
assert.equal(geometry.spec.gutter, 24);
assert.ok(Math.abs(geometry.spec.columnRatios[0] - .35) < .0001);
assert.ok(geometry.spec.columnWidths[1] > geometry.spec.columnWidths[0]);
assert.ok(Math.abs(geometry.spec.columnOffsets[1] - (18 + geometry.spec.columnWidths[0] + 24)) < .001);
const custom = ChartPageLayout.spec({ columns: 3, pageSize: 'custom', customPage: { width: 720, height: 360 }, orientation: 'landscape', columnRatios: [.2,.3,.5] });
assert.deepEqual([custom.pageWidth, custom.pageHeight], [720, 360]);
assert.deepEqual(custom.columnRatios, [.2,.3,.5]);
const wrapText = 'This deliberately long canonical lyric line demonstrates independent wrapping inside differently sized columns';
const wrapSong = { layout: { columns: 2, columnRatios: [.3,.7], balance: 'off', breaks: [{id:'wrap-break',type:'column',sectionId:'wrap-section',lineId:'wrap-0',edge:'after'}] },
  sections: [{ id:'wrap-section', label:'Verse', lines:[{id:'wrap-0',lyrics:wrapText,chords:[]},{id:'wrap-1',lyrics:wrapText,chords:[]}]}] };
const wrapPlan = ChartPageLayout.plan(wrapSong);
const narrowSegments = wrapPlan.pages[0].columns[0].filter(row => row.lineId === 'wrap-0' && row.type === 'text').length;
const wideSegments = wrapPlan.pages[0].columns[1].filter(row => row.lineId === 'wrap-1' && row.type === 'text').length;
assert.ok(narrowSegments > wideSegments, `independent wrapping expected narrow ${narrowSegments} > wide ${wideSegments}`);
const renderedGeometrySong = { id: 'geometry-song', title: 'Geometry', currentKey: 'A', layout: {
  columns: 2, pageSize: 'a4', margins: { top: 36, right: 54, bottom: 36, left: 18 }, gutter: 24, fontSize: 10
}, sections: [{ id: 's', label: 'Verse', lines: [{ id: 'l', lyrics: 'Lost and lonely souls draw in their final breath', chords: [] }] }] };
const renderedGeometrySpec = ChartPageLayout.spec(renderedGeometrySong.layout);
const renderedGeometry = new ChartRenderer().renderPlannedStructuredContent(renderedGeometrySong, { editable: true });
const innerPageWidth = renderedGeometrySpec.pageWidth - renderedGeometrySpec.margins.left - renderedGeometrySpec.margins.right;
assert.ok(renderedGeometry.includes(`--chart-render-font:${(renderedGeometrySpec.fontSize / innerPageWidth * 100).toFixed(4)}cqi`), 'screen font must scale against CSS content-box width');
assert.ok(renderedGeometry.includes(`--page-gutter:${(renderedGeometrySpec.gutter / innerPageWidth * 100).toFixed(4)}cqi`), 'screen gutter must scale against CSS content-box width');
console.log('26/26 shared page geometry, CSS scale, and independent wrapping checks passed');
