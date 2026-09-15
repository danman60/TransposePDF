const assert = require('node:assert/strict');
const ChartTextMetrics = require('../modules/chartTextMetrics');

const size = 12;
assert.equal(ChartTextMetrics.width('iiii', size, 'mono'), ChartTextMetrics.width('WWWW', size, 'mono'));
assert.ok(ChartTextMetrics.width('iiii', size, 'sans') < ChartTextMetrics.width('WWWW', size, 'sans'));
assert.ok(ChartTextMetrics.width('Lost and lonely', size, 'sans') < ChartTextMetrics.width('Lost and lonely', size, 'mono'));
const phrase = 'Lost and lonely souls draw in their final breath';
const finalStart = phrase.indexOf('final');
const finalX = ChartTextMetrics.positionAtOffset(phrase, finalStart, size, 'sans');
assert.equal(ChartTextMetrics.offsetAtWidth(phrase, finalX, size, 'sans'), finalStart);
const blankOffset = phrase.length + 8;
const blankX = ChartTextMetrics.positionAtOffset(phrase, blankOffset, size, 'sans');
assert.equal(ChartTextMetrics.offsetAtWidth(phrase, blankX, size, 'sans'), blankOffset);
const fit = ChartTextMetrics.fitEnd(phrase, 0, ChartTextMetrics.width(phrase.slice(0, 42), size, 'sans'), size, 'sans');
assert.ok(fit >= 41 && fit <= 43, fit);
assert.equal(ChartTextMetrics.cssFamily('sans'), 'Arial, Helvetica, sans-serif');
assert.match(ChartTextMetrics.cssFamily('mono'), /monospace/);
console.log('8/8 proportional chart text metric checks passed');
