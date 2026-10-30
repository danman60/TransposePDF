const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('modules/musicTheory.js', 'utf8'), context, { filename: 'modules/musicTheory.js' });
const theory = vm.runInContext('new MusicTheory()', context);

const cases = [
  ['C G Am F', 'C'], ['Am F C G', 'Am'], ['D A Bm G', 'D'], ['Em C G D', 'Em'], ['F C Dm Bb', 'F'],
  ['G G7 C G D7 G', 'G'], // test_files/test_chord_chart.pdf, was Gm
  ['Bb Eb F Gm', 'Bb'], ['Eb Ab Bb Cm', 'Eb'], ['Ab Db Eb Fm', 'Ab'], ['Gm Cm D7 Gm', 'Gm']
];
for (const [chords, key] of cases) assert.equal(theory.detectKey(chords.split(' ')).key, key, chords);
assert.equal(theory.detectKey([]).key, 'C');
console.log(`${cases.length + 1}/${cases.length + 1} key detection checks passed`);
