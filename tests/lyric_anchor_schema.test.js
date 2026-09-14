const assert = require('node:assert/strict');
const LyricAnchor = require('../modules/lyricAnchor');
const SongModel = require('../modules/songModel');
const ChordCorrectionMemory = require('../modules/correctionMemory');
global.SongModel = SongModel;
const LibraryStore = require('../modules/libraryStore');

const chord = (lyrics, offset, provenance = 'manual') => ({
  id: 'chord-fixed', symbol: 'Gb', characterOffset: offset,
  manualEntry: { provenance: 'manual', enteredSymbol: 'Gb' },
  anchor: LyricAnchor.create(lyrics, offset, provenance)
});

{
  const oldLyrics = 'Amazing grace';
  const line = { id: 'line-fixed', lyrics: oldLyrics, chords: [chord(oldLyrics, 8)] };
  const updated = LyricAnchor.reconcileLine(line, oldLyrics, 'Oh Amazing grace');
  assert.equal(updated.chords[0].characterOffset, 11, 'insert before word follows semantic token');
  assert.equal(updated.chords[0].id, 'chord-fixed');
  assert.equal(updated.chords[0].anchor.provenance, 'manual');
}

{
  const store = new LibraryStore(null);
  const oldRecord = { id: 'old', schemaVersion: 1, revision: 7,
    song: { id: 'old', title: 'Legacy', sections: [{ lines: [{ lyrics: 'Stay', chords: [{ symbol: 'C', characterOffset: 0 }] }] }] } };
  const migrated = store.normalizeSongRecord(oldRecord);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.revision, 7, 'read normalization does not increment revision');
  assert.equal(oldRecord.schemaVersion, 1, 'read normalization does not write source record');
  assert.equal(migrated.song.sections[0].lines[0].chords[0].characterOffset, 0);
}

{
  const oldLyrics = 'hallelujah';
  const anchored = chord(oldLyrics, 5);
  const resolved = LyricAnchor.resolve(anchored.anchor, oldLyrics, 'halleXlujah', anchored.characterOffset);
  assert.equal(resolved.anchor.token, 'hallexlujah');
  assert.equal(resolved.characterOffset, 5, 'inside-word edit retains syllable point');
}

{
  const oldLyrics = 'love and love forever';
  const anchored = chord(oldLyrics, 0);
  const resolved = LyricAnchor.resolve(anchored.anchor, oldLyrics, 'and love forever', 0);
  assert.equal(resolved.characterOffset, 0, 'deleted word stays at deletion boundary');
  assert.equal(resolved.anchor.needsReview, true);
}

{
  const oldLyrics = 'love then love';
  const anchored = chord(oldLyrics, 10);
  const resolved = LyricAnchor.resolve(anchored.anchor, oldLyrics, 'dear love then love', 10);
  assert.equal(resolved.characterOffset, 15, 'repeated word resolved with context and distance');
}

{
  const lyrics = 'Sing 👩🏽‍🎤 café now';
  const anchor = LyricAnchor.create(lyrics, 7, 'manual');
  assert.equal(LyricAnchor.graphemes('👩🏽‍🎤').length, 1);
  const resolved = LyricAnchor.resolve(anchor, lyrics, 'Please Sing 👩🏽‍🎤 café now', 7);
  assert.equal(resolved.anchor.provenance, 'manual');
  assert.ok(resolved.characterOffset > 7);
}

{
  const lyrics = 'word      next';
  const anchor = LyricAnchor.create(lyrics, 7, 'manual');
  const resolved = LyricAnchor.resolve(anchor, lyrics, 'word        next', 7);
  assert.equal(resolved.anchor.provenance, 'manual');
  assert.ok(resolved.characterOffset >= 4 && resolved.characterOffset <= 12, 'blank-space placement remains freeform');
}

{
  const lyrics = 'first second';
  const original = { id: 'line-a', lyrics, chords: [chord(lyrics, 1), { ...chord(lyrics, 7), id: 'chord-b' }] };
  const [left, right] = LyricAnchor.splitLine(original, 6, 'line-b');
  assert.deepEqual(left.chords.map(item => item.id), ['chord-fixed']);
  assert.deepEqual(right.chords.map(item => item.id), ['chord-b']);
  assert.equal(right.chords[0].characterOffset, 1);
  const joined = LyricAnchor.joinLines(left, right);
  assert.deepEqual(joined.chords.map(item => item.id), ['chord-fixed', 'chord-b']);
  assert.equal(joined.chords[1].characterOffset, 7);
}

{
  const legacy = { id: 'song-fixed', title: 'Exact', sourceType: 'pdf', sections: [{
    id: 'section-fixed', label: 'Verse 1', lines: [{ id: 'line-fixed', lyrics: 'Hello world', chords: [{
      id: 'chord-fixed', symbol: 'Gb', characterOffset: 6, manualEntry: { provenance: 'manual', enteredSymbol: 'Gb' }
    }] }]
  }] };
  const normalized = SongModel.create(legacy);
  const again = SongModel.create(normalized);
  assert.equal(normalized.schemaVersion, 2);
  assert.equal(normalized.sections[0].id, 'section-fixed');
  assert.equal(normalized.sections[0].lines[0].id, 'line-fixed');
  assert.equal(normalized.sections[0].lines[0].chords[0].id, 'chord-fixed');
  assert.equal(normalized.sections[0].lines[0].chords[0].characterOffset, 6);
  assert.equal(normalized.sections[0].lines[0].chords[0].symbol, 'Gb');
  assert.equal(normalized.sections[0].lines[0].chords[0].anchor.provenance, 'manual');
  assert.deepEqual(again, normalized, 'schema normalization is idempotent');
  assert.equal(normalized.layout.columns, 1);
  assert.equal(normalized.credits.writer.value, '');
  assert.equal(normalized.arrangement.inferredValue, 'V1');
}

{
  const memory = new ChordCorrectionMemory(null);
  memory.read = () => ({ version: 2, records: [{ kind: 'enharmonic', key: 'F', guessed: 'Gb', corrected: 'F#' }], songEdits: {} });
  const song = SongModel.create({ title: 'Manual wins', sourceType: 'audio', originalKey: 'F', sections: [{
    lines: [{ lyrics: 'word', chords: [chord('word', 0)] }]
  }] });
  const applied = memory.apply(song);
  assert.equal(applied.song.sections[0].lines[0].chords[0].symbol, 'Gb');
  assert.equal(applied.applied, 0, 'correction inference skips canonical manual chord');
}

console.log('lyric anchor/schema: 11 deterministic groups passed');
