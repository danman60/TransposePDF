/** Pure ChordPro conversion against the canonical concert-pitch SongModel. */
class ChordPro {
  static parse(text) {
    const Model = this.songModel();
    const songs = [];
    let metadata;
    let sections;
    let current;
    let unknown;

    const reset = () => {
      metadata = { title: '', artist: '', originalKey: 'C', tempo: null, timeSignature: '' };
      sections = [];
      current = { type: 'section', label: '', lines: [] };
      unknown = [];
    };
    const pushSection = () => {
      if (current.lines.length || current.label) sections.push(current);
      current = { type: 'section', label: '', lines: [] };
    };
    const pushSong = () => {
      pushSection();
      if (!sections.length && !metadata.title) return;
      songs.push(Model.create({
        ...metadata,
        currentKey: metadata.originalKey,
        sourceType: 'chordpro',
        view: { notation: 'chords', capo: metadata.capo || 0, instrument: 'concert' },
        sections,
        source: { chordPro: { directives: unknown } }
      }));
    };
    reset();

    const sourceLines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    sourceLines.forEach((rawLine, sourceLine) => {
      if (sourceLine === sourceLines.length - 1 && rawLine === '') return;
      const directive = this.parseDirective(rawLine);
      if (!directive) {
        current.lines.push(this.parseLyricLine(rawLine));
        return;
      }
      const { name, value } = directive;
      if (name === 'new_song' || name === 'ns') {
        pushSong();
        reset();
        return;
      }
      if ((name === 'title' || name === 't') && metadata.title && (sections.length || current.lines.length)) {
        pushSong();
        reset();
      }
      if (name === 'title' || name === 't') metadata.title = value;
      else if (name === 'subtitle' || name === 'st' || name === 'artist') metadata.artist = value;
      else if (name === 'key') metadata.originalKey = value || 'C';
      else if (name === 'tempo') metadata.tempo = Number(value) || null;
      else if (name === 'time' || name === 'time_signature') metadata.timeSignature = value;
      else if (name === 'capo') metadata.capo = Math.max(0, Math.min(11, Math.trunc(Number(value) || 0)));
      else if (this.sectionStarts()[name]) {
        pushSection();
        const definition = this.sectionStarts()[name];
        current = { type: definition.type, label: value || definition.label, lines: [] };
      } else if (this.sectionEnds().has(name)) {
        pushSection();
      } else {
        unknown.push({ name, value, sourceLine });
      }
    });
    pushSong();
    return songs;
  }

  static serialize(song, { chordDisplay = null } = {}) {
    const lines = [];
    const directive = (name, value) => lines.push(`{${name}${value === '' ? '' : `: ${this.escapeDirective(value)}`}}`);
    directive('title', song.title || 'Untitled Song');
    if (song.artist) directive('subtitle', song.artist);
    if (song.originalKey) directive('key', song.originalKey);
    if (song.tempo !== null && song.tempo !== undefined) directive('tempo', String(song.tempo));
    if (song.timeSignature) directive('time', song.timeSignature);
    if (song.view?.capo) directive('capo', String(song.view.capo));
    (song.source?.chordPro?.directives || []).forEach(item => directive(item.name, item.value || ''));

    (song.sections || []).forEach(section => {
      const pair = this.sectionDirective(section.type);
      if (pair) directive(pair.start, section.label || pair.label);
      (section.lines || []).forEach(line => lines.push(this.serializeLine(line, chordDisplay)));
      if (pair) directive(pair.end, '');
    });
    return `${lines.join('\n')}\n`;
  }

  static parseDirective(line) {
    const match = String(line).trim().match(/^\{([a-z_]+)(?:\s*:\s*(.*))?\}$/i);
    if (!match) return null;
    return { name: match[1].toLowerCase(), value: this.unescape(match[2] || '') };
  }

  static parseLyricLine(line) {
    let lyrics = '';
    const chords = [];
    const value = String(line);
    for (let index = 0; index < value.length;) {
      if (value[index] === '\\' && index + 1 < value.length) {
        lyrics += value[index + 1];
        index += 2;
        continue;
      }
      if (value[index] === '[') {
        let end = index + 1;
        while (end < value.length && value[end] !== ']') end += 1;
        const symbol = value.slice(index + 1, end);
        if (end < value.length && this.isChord(symbol)) {
          chords.push({ symbol, characterOffset: lyrics.length, timestamp: null, confidence: null });
          index = end + 1;
          continue;
        }
      }
      lyrics += value[index];
      index += 1;
    }
    return { lyrics, chords, startTime: null, endTime: null };
  }

  static serializeLine(line, chordDisplay) {
    const grouped = new Map();
    (line.chords || []).forEach((chord, chordIndex) => {
      const offset = Math.max(0, Math.min(String(line.lyrics || '').length, Number(chord.characterOffset) || 0));
      if (!grouped.has(offset)) grouped.set(offset, []);
      grouped.get(offset).push({ ...chord, chordIndex });
    });
    let output = '';
    const lyrics = String(line.lyrics || '');
    for (let offset = 0; offset <= lyrics.length; offset += 1) {
      (grouped.get(offset) || []).forEach(chord => {
        const symbol = chordDisplay ? chordDisplay(chord.symbol, chord) : chord.symbol;
        output += `[${String(symbol).replace(/\\/g, '\\\\').replace(/]/g, '\\]')}]`;
      });
      if (offset < lyrics.length) output += this.escapeLyricCharacter(lyrics[offset]);
    }
    return output;
  }

  static sectionStarts() {
    return {
      start_of_verse: { type: 'verse', label: 'Verse' }, sov: { type: 'verse', label: 'Verse' },
      start_of_chorus: { type: 'chorus', label: 'Chorus' }, soc: { type: 'chorus', label: 'Chorus' },
      start_of_bridge: { type: 'bridge', label: 'Bridge' }, sob: { type: 'bridge', label: 'Bridge' }
    };
  }

  static sectionEnds() {
    return new Set(['end_of_verse', 'eov', 'end_of_chorus', 'eoc', 'end_of_bridge', 'eob']);
  }

  static sectionDirective(type) {
    return {
      verse: { start: 'start_of_verse', end: 'end_of_verse', label: 'Verse' },
      chorus: { start: 'start_of_chorus', end: 'end_of_chorus', label: 'Chorus' },
      bridge: { start: 'start_of_bridge', end: 'end_of_bridge', label: 'Bridge' }
    }[type] || null;
  }

  static isChord(value) {
    return /^(?:N\.C\.|[A-G](?:#{1,2}|b{1,2})?[^\s\]/]*(?:\/[A-G](?:#{1,2}|b{1,2})?)?)$/.test(value);
  }

  static escapeLyricCharacter(character) {
    return /[\\[\]{}]/.test(character) ? `\\${character}` : character;
  }

  static escapeDirective(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/}/g, '\\}');
  }

  static unescape(value) {
    return String(value).replace(/\\(.)/g, '$1');
  }

  static songModel() {
    if (typeof SongModel !== 'undefined') return SongModel;
    if (typeof require !== 'undefined') return require('./songModel');
    throw new Error('SongModel is required');
  }
}

if (typeof window !== 'undefined') window.ChordPro = ChordPro;
if (typeof module !== 'undefined' && module.exports) module.exports = ChordPro;
