const test = require('node:test');
const assert = require('node:assert/strict');
global.LyricAnchor = require('../modules/lyricAnchor');
global.SongModel = require('../modules/songModel');
const Arrangement = require('../modules/arrangement');
const ChordPro = require('../modules/chordPro');

test('arrangement inference is deterministic and numbers verses', () => {
  const sections = [
    { type: 'intro' }, { type: 'verse', label: 'Verse 1' }, { type: 'pre-chorus' },
    { type: 'chorus' }, { type: 'verse', label: 'Verse 2' }, { type: 'chorus' },
    { type: 'bridge' }, { type: 'tag' }, { type: 'outro' }
  ];
  assert.equal(Arrangement.infer(sections), 'I V1 PC C V2 C B T O');
  assert.equal(Arrangement.resolve({ mode: 'manual', value: 'I V1 C B C x2' }, sections), 'I V1 C B C x2');
  assert.deepEqual(Arrangement.normalize({ mode: 'auto', value: 'stale' }, sections), {
    mode: 'auto', value: 'I V1 PC C V2 C B T O', inferredValue: 'I V1 PC C V2 C B T O', updatedAt: null
  });
});

test('ChordPro metadata and expanded sections round-trip without duplicate known directives', () => {
  const input = `{title: Exact}\n{composer: Ada Writer}\n{lyricist: Lee Words}\n{x_arranger: Ari Arrange}\n{x_arrangement: I V1 PC C}\n{x_columns: 2}\n{x_font_size: 12}\n{X-Custom :  keep  spacing }\n{start_of_intro}\n[C]Open\n{end_of_intro}\n{start_of_pre_chorus: Lift}\n[G]Rise\n{end_of_pre_chorus}\n`;
  const song = ChordPro.parse(input)[0];
  assert.equal(song.credits.writer.value, 'Ada Writer');
  assert.equal(song.credits.writer.provenance, 'imported');
  assert.equal(song.credits.arranger.value, 'Ari Arrange');
  assert.equal(song.arrangement.mode, 'manual');
  assert.equal(song.arrangement.value, 'I V1 PC C');
  assert.equal(song.layout.columns, 2);
  assert.equal(song.layout.fontSize, 12);
  assert.deepEqual(song.sections.map(section => section.type), ['intro', 'pre-chorus']);
  assert.equal(song.source.chordPro.directives[0].name, 'lyricist');

  const output = ChordPro.serialize(song);
  assert.match(output, /\{composer: Ada Writer\}/);
  assert.match(output, /\{lyricist: Lee Words\}/);
  assert.match(output, /\{X-Custom :  keep  spacing \}/);
  assert.equal((output.match(/\{composer:/g) || []).length, 1);
  assert.equal((output.match(/\{x_arranger:/g) || []).length, 1);
  assert.equal((output.match(/\{x_columns:/g) || []).length, 1);
  assert.equal((output.match(/\{x_font_size:/g) || []).length, 1);

  const reparsed = ChordPro.parse(output)[0];
  assert.equal(reparsed.credits.writer.value, song.credits.writer.value);
  assert.equal(reparsed.credits.arranger.value, song.credits.arranger.value);
  assert.equal(reparsed.arrangement.value, song.arrangement.value);
  assert.equal(reparsed.layout.columns, song.layout.columns);
  assert.equal(reparsed.layout.fontSize, song.layout.fontSize);
  assert.deepEqual(reparsed.sections.map(section => section.type), song.sections.map(section => section.type));
});

test('writer alias imports and lyricist remains an exact unknown directive', () => {
  const song = ChordPro.parse('{title: Alias}\n{writer: W}\n{lyricist: L}\nLine\n')[0];
  assert.equal(song.credits.writer.value, 'W');
  assert.equal(song.source.chordPro.directives[0].raw, '{lyricist: L}');
  const output = ChordPro.serialize(song);
  assert.equal((output.match(/\{composer: W\}/g) || []).length, 1);
  assert.equal((output.match(/\{lyricist: L\}/g) || []).length, 1);
});
