const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('modules/musicTheory.js', 'utf8'), context, { filename: 'modules/musicTheory.js' });
const theory = vm.runInContext('new MusicTheory()', context);
const found = line => theory.extractChords(line).map(chord => chord.original).join(' ');

// Lyric lines: transposing used to rewrite "Amazing Grace" as "Bmazing Arace".
for (const lyric of ['Amazing Grace', 'And grace my fears relieved', 'A wretch like me', 'Every Christ God', 'Am I the one', 'Bridge:']) {
  assert.equal(found(lyric), '', lyric);
}
const chordLines = [
  ['G G7 C G', 'G G7 C G'], ['Intro: G C D', 'G C D'], ['| G / / / | C |', 'G C'], ['G  C  (x2)', 'G C'],
  ['N.C.  G', 'G'], ['C/E  F  G/B', 'C/E F G/B'], ['Dm7/C  F#m11  Bbmaj7  Csus4  C7sus4  Gadd9  E7#9', 'Dm7/C F#m11 Bbmaj7 Csus4 C7sus4 Gadd9 E7#9']
];
for (const [line, chords] of chordLines) assert.equal(found(line), chords, line);
console.log(`${6 + chordLines.length}/${6 + chordLines.length} chord extraction checks passed`);
