const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({ console, Intl });
for (const path of ['modules/lyricAnchor.js', 'modules/musicTheory.js', 'modules/songModel.js']) {
  vm.runInContext(fs.readFileSync(path, 'utf8'), context, { filename: path });
}
const SongModel = vm.runInContext('SongModel', context);
const lyrics = song => [...song.sections.flatMap(section => section.lines.map(line => line.lyrics.trim()))];

const pdf = SongModel.fromPDFSong({ title: 'Amazing Grace', songText: 'Amazing Grace\nTraditional - Key of G\nG G7 C G\nAmazing grace how sweet the sound' });
assert.deepEqual(lyrics(pdf), ['Traditional - Key of G', 'Amazing grace how sweet the sound'], 'title row dropped, lyric that repeats it kept');

const noTitle = SongModel.fromPDFSong({ title: 'Other', songText: 'G\nAmazing Grace' });
assert.deepEqual(lyrics(noTitle), ['Amazing Grace'], 'rows are kept when the first row is not the title');
console.log('2/2 PDF title row checks passed');
