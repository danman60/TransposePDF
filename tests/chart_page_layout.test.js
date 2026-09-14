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
assert.equal(plan.spec.fontSize, 11);
assert.equal(plan.spec.columns, 2);
assert.ok(plan.pages.length <= 3, `unexpected blank-page expansion: ${plan.pages.length}`);
const allRows = plan.pages.flatMap(page => page.columns.flat());
assert.ok(allRows.some(row => row.metadata && row.content.includes('Written by')));
assert.ok(!plan.pages.some((page, index) => index > 0 && page.columns.flat().every(row => row.metadata)), 'credits-only page');
const segments = ChartPageLayout.wrapLine(song.sections[0].lines[0], plan.spec.maxCharacters);
assert.ok(segments.length > 1);
assert.equal(segments.map(segment => segment.lyrics).join(' '), song.sections[0].lines[0].lyrics);
assert.ok(segments.some(segment => segment.chords.length === 1));
console.log('7/7 shared A4 layout planning checks passed');
