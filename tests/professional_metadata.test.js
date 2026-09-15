const assert = require('assert');
global.LyricAnchor = require('../modules/lyricAnchor'); global.Arrangement = require('../modules/arrangement');
global.ChartNotation = require('../modules/chartNotation'); global.SongModel = require('../modules/songModel');
global.ChartTextMetrics = require('../modules/chartTextMetrics');
const Layout = require('../modules/chartPageLayout'); const ChordPro = require('../modules/chordPro');

const song = SongModel.create({title:'Metadata', originalKey:'C', artist:'Subtitle', metadata:{recording:'Live 2026',copyright:'© 2026 Example',ccliSongNumber:'12345',ccliLicenseNumber:'9876'}, layout:{headerVisibility:'first',footerVisibility:'all'},sections:[{label:'Verse',lines:[{lyrics:'Line',chords:[]}]}]});
assert.strictEqual(song.metadata.recording, 'Live 2026');
assert.strictEqual(song.layout.headerVisibility, 'first');
const plan = Layout.plan(song);
assert(plan.metadata.some(row => row.field === 'ccliSongNumber' && row.value === '12345'));
const serialized = ChordPro.serialize(song);
assert(serialized.includes('{x_recording: Live 2026}'));
assert(serialized.includes('{copyright: © 2026 Example}'));
assert(serialized.includes('{ccli: 12345}'));
assert(serialized.includes('{x_ccli_license: 9876}'));
const imported = ChordPro.parse(serialized)[0];
assert.deepStrictEqual(imported.metadata, song.metadata);
console.log('professional metadata tests passed');
