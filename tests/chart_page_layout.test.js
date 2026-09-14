const assert = require('node:assert/strict');
const ChartPageLayout = require('../modules/chartPageLayout');

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
assert.equal(plan.spec.fontSize, 16);
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
console.log('7/7 shared A4 layout planning checks passed');
