const assert = require('assert');
global.LyricAnchor = require('../modules/lyricAnchor');
global.Arrangement = require('../modules/arrangement');
global.ChartNotation = require('../modules/chartNotation');
global.SongModel = require('../modules/songModel');
const ChordPro = require('../modules/chordPro');

const source = '||: A | D / / | E(4) | N.C. :|| (1.) (To Bridge)';
const parsed = ChartNotation.parse(source);
assert.strictEqual(parsed.source, source);
assert.deepStrictEqual(parsed.runs.map(run => run.type), [
  'repeatStart', 'chord', 'bar', 'chord', 'slash', 'slash', 'bar', 'chord', 'bar',
  'chord', 'repeatEnd', 'ending', 'cue'
]);
assert.deepStrictEqual(parsed.chords.map(chord => chord.symbol), ['A', 'D', 'E(4)', 'N.C.']);
assert.strictEqual(ChartNotation.serialize(parsed, symbol => symbol === 'A' ? 'Bb' : symbol),
  '||: Bb | D / / | E(4) | N.C. :|| (1.) (To Bridge)');

const song = SongModel.fromManual({ title: 'Notation', originalKey: 'A', content: `[Instrumental]\n${source}` });
assert.strictEqual(song.sections[0].lines[0].notation.source, source);
assert.strictEqual(song.sections[0].lines[0].chords.length, 4);
assert.strictEqual(SongModel.toSongText(song).split('\n')[1], source);

const encoded = ChordPro.serialize(song);
assert(encoded.includes('{x_notation: ||: A | D / / | E(4) | N.C. :|| (1.) (To Bridge)}'));
const roundTrip = ChordPro.parse(encoded)[0];
assert.strictEqual(roundTrip.sections[0].lines[0].notation.source, source);
assert.deepStrictEqual(roundTrip.sections[0].lines[0].chords.map(chord => chord.symbol), ['A', 'D', 'E(4)', 'N.C.']);

console.log('chart notation tests passed');
