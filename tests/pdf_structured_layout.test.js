const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console, Intl });
for (const path of ['modules/lyricAnchor.js', 'modules/musicTheory.js', 'modules/songModel.js', 'modules/pdfGenerator.js']) {
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
}
const PDFGenerator = vm.runInContext('PDFGenerator', context);
const LyricAnchor = vm.runInContext('LyricAnchor', context);

class FakePDF {
  constructor() { this.page = 1; this.calls = []; }
  addPage() { this.page += 1; }
  setFontSize() {}
  setFont() {}
  setTextColor() {}
  text(content, x, y) { this.calls.push({ page: this.page, content, x, y }); }
}

(async () => {
  const generator = new PDFGenerator();
  const anchoredLyrics = 'Alpha beta gamma delta';
  const chord = {
    symbol: 'Gb',
    characterOffset: 0,
    anchor: LyricAnchor.create(anchoredLyrics, 11, 'manual'),
    manualEntry: { provenance: 'manual', transposition: -1, totalDisplayOffset: -1, spellingPolicy: 'flats' }
  };
  const song = {
    title: 'Layout Contract', originalKey: 'F', currentKey: 'E', transposition: -1,
    sourceType: 'audio', source: { analysisId: 'audio-proof' }, spellingPolicy: 'sharps', layout: { columns: 3 },
    sessionView: {},
    credits: { writer: { value: 'Ada Writer' }, arranger: { value: 'Ray Arranger' } },
    arrangement: { mode: 'manual', value: 'V1 C V2 C', inferredValue: 'Wrong fallback' },
    sections: [
      { label: 'Verse 1', lines: [{ lyrics: anchoredLyrics, chords: [chord] }] },
      { label: 'Chorus', lines: Array.from({ length: 140 }, (_, index) => ({
        lyrics: `Long chorus line ${index}`, chords: []
      })) }
    ]
  };
  const original = JSON.stringify(song);
  const pdf = new FakePDF();
  const result = await generator.addStructuredSongToPDF(pdf, song);

  assert.equal(result.columns, 3);
  assert.ok(new Set(pdf.calls.map(call => call.x)).size >= 3, 'must fill columns before next page');
  assert.ok(pdf.calls.some(call => call.page > 1 && call.content === 'Layout Contract (continued)'));
  assert.ok(pdf.calls.some(call => call.content === 'Written by: Ada Writer'));
  assert.ok(pdf.calls.some(call => call.content === 'Arrangement by: Ray Arranger'));
  assert.ok(pdf.calls.some(call => call.content === 'Arrangement: V1 C V2 C'));
  assert.ok(!pdf.calls.some(call => String(call.content).includes('Wrong fallback')));
  assert.equal(generator.resolveSemanticOffset(chord, anchoredLyrics), 11);
  assert.ok(pdf.calls.some(call => String(call.content).includes('Gb')), 'manual spelling must survive export');
  assert.equal(JSON.stringify(song), original, 'PDF layout must not mutate canonical song');

  const routedAudioPdf = new FakePDF();
  await generator.addSongToPDF(routedAudioPdf, song);
  assert.ok(new Set(routedAudioPdf.calls.map(call => call.x)).size >= 3, 'audio imports must route through structured columns');

  const wrapped = generator.wrapStructuredLine({
    lyrics: 'one two three four five six seven eight nine ten',
    chords: [{ symbol: 'C', characterOffset: 4 }, { symbol: 'G', characterOffset: 35 }]
  }, 20);
  assert.ok(wrapped.length >= 3, 'long lyrics must wrap to printable column width');
  assert.ok(wrapped.slice(1).some(segment => segment.chords.some(chord => chord.symbol === 'G')), 'wrapped chord must move with its lyric segment');

  const parityPdf = new FakePDF();
  const paritySnapshot = { sectionColumns: [1, 0], lineFontRatios: { '0:0': 0.025, '1:0': 0.025 } };
  await generator.addStructuredSongToPDF(parityPdf, song, paritySnapshot);
  const verseCall = parityPdf.calls.find(call => call.content === 'Verse 1');
  const chorusCall = parityPdf.calls.find(call => call.content === 'Chorus');
  assert.ok(verseCall.x > chorusCall.x, 'PDF section columns must match captured editor columns');
  assert.ok(parityPdf.calls.some(call => call.content === anchoredLyrics), 'captured editor lyric row must remain unwrapped in PDF');

  const blank = generator.getCreditsRows({ credits: {}, arrangement: {} });
  assert.equal(blank.length, 0);
  console.log('16/16 structured PDF layout/content checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
