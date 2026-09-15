const fs = require('fs');
const vm = require('vm');

const context = { console, logger: { error() {}, warn() {}, info() {} } };
vm.createContext(context);
vm.runInContext(`${fs.readFileSync('modules/musicTheory.js', 'utf8')}\nthis.MusicTheory = MusicTheory;`, context);
const theory = new context.MusicTheory();

const cases = [
  { symbol: 'C', song: { originalKey: 'B', transposition: -2 }, view: {} },
  { symbol: 'F#m7/C#', song: { originalKey: 'E', transposition: 5 }, view: {} },
  { symbol: 'Bbmaj7/D', song: { originalKey: 'F', transposition: -4 }, view: {} },
  { symbol: 'Eb7sus4/G', song: { originalKey: 'Bb', transposition: 3 }, view: { capo: 2 } },
  { symbol: 'G#add9/B#', song: { originalKey: 'E', transposition: -5 }, view: { instrument: 'bb' } },
  { symbol: 'Db/F', song: { originalKey: 'Ab', transposition: 7 }, view: { instrument: 'eb' } },
  { symbol: 'A/C#', song: { originalKey: 'D', transposition: -7 }, view: { instrument: 'f' } }
];

for (const test of cases) {
  const result = theory.canonicalChordFromDisplay(test.symbol, test.song, test.view);
  if (!result.ok) throw new Error(`${test.symbol}: ${result.error}`);
  if (result.canonical !== test.symbol) throw new Error(`${test.symbol} was rewritten as ${result.canonical}`);
  const rendered = theory.displayManualChord(result.canonical, result.manualEntry, test.song, test.view);
  if (rendered !== test.symbol) {
    throw new Error(`${test.symbol} round-tripped as ${rendered} through ${result.canonical}`);
  }
}

const nashville = theory.canonicalChordFromDisplay('1m7', { originalKey: 'C' }, { notation: 'nashville' });
if (nashville.ok || !nashville.error.includes('Switch Notation')) throw new Error('Nashville entry was not safely rejected');
const invalid = theory.canonicalChordFromDisplay('hello', { originalKey: 'C' }, {});
if (invalid.ok) throw new Error('Invalid chord was accepted');
const baseline = theory.canonicalChordFromDisplay('A', { originalKey: 'A', transposition: 0 }, {});
const transposedManual = theory.displayManualChord(baseline.canonical, baseline.manualEntry, { originalKey: 'A', transposition: 1 }, {});
if (transposedManual !== 'Bb') throw new Error(`Manual A transposed in Bb as ${transposedManual}`);

console.log(`${cases.length + 3}/10 display-to-canonical checks passed`);
