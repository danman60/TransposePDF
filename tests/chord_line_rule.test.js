const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
global.MusicTheory = require('../modules/musicTheory');
const SongModel = require('../modules/songModel');

const theory = new MusicTheory();
const importer = line => theory.isChordLine(line);
const editor = line => SongModel.isChordRow(line);
let checks = 0;

// Public-domain hymn lines whose words start with chord letters (A-G, Am, Add, Bb...).
const lyrics = [
  'Amazing grace how sweet the sound', 'A mighty fortress is our God', 'Be Thou my vision, O Lord of my heart',
  'Abide with me; fast falls the eventide', 'Come, Thou Fount of every blessing', 'Fade, fade, each earthly joy',
  'Am I a soldier of the cross', 'And can it be that I should gain', 'Ah, holy Jesus, how hast Thou offended',
  'Christ the Lord is risen today', 'Day by day, and with each passing moment', 'Earth has many a noble city',
  'God of grace and God of glory', 'Be still, my soul: the Lord is on thy side', 'Amen', 'Bridge:'
];
for (const line of lyrics) {
  assert.equal(importer(line), false, `importer: ${line}`);
  assert.equal(editor(line), false, `editor: ${line}`);
  checks += 2;
}

const chordRows = ['G G7 C G', 'Dm7/C  F#m11  Bbmaj7', 'Csus4  C7sus4  Gadd9  E7#9', 'C/E  F  G/B', 'N.C.  G', 'G(add9)  C2  Dsus', 'Am'];
for (const line of chordRows) {
  assert.equal(importer(line), true, `importer: ${line}`);
  assert.equal(editor(line), true, `editor: ${line}`);
  checks += 2;
}

// Declared differences only: bar/label marks are import-only, lowercase typing is editor-only.
for (const line of ['Intro: G C D', '| G / / / | C |']) { assert.equal(importer(line), true, line); assert.equal(editor(line), false, line); checks += 2; }
assert.equal(editor('g c d'), true); assert.equal(importer('g c d'), false); checks += 2;

// Every line of the real sample PDF: chord rows and lyric rows agree in both paths.
const pdfLines = execFileSync('pdftotext', ['-layout', 'test_files/test_chord_chart.pdf', '-'], { encoding: 'utf8' })
  .split('\n').map(line => line.trim()).filter(Boolean);
const chordCount = pdfLines.filter(importer).length;
for (const line of pdfLines) { assert.equal(editor(line), importer(line), `sample PDF: ${line}`); checks += 1; }
assert.equal(chordCount, 8, 'sample PDF has 8 chord rows');
assert.equal(pdfLines.length - chordCount, 10, 'sample PDF has 10 text rows (title, subtitle, 8 lyrics)');
checks += 2;
console.log(`${checks}/${checks} shared chord-line rule checks passed`);
