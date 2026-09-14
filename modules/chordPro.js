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
      metadata = { title: '', artist: '', originalKey: 'C', tempo: null, timeSignature: '', credits: {} };
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
      else if (name === 'composer' || name === 'writer') metadata.credits.writer = { value, provenance: 'imported' };
      else if (name === 'x_arranger') metadata.credits.arranger = { value, provenance: 'imported' };
      else if (name === 'x_arrangement') metadata.arrangement = { mode: 'manual', value, inferredValue: '', updatedAt: null };
      else if (name === 'x_columns') metadata.layout = { columns: Math.max(1, Math.min(3, Math.trunc(Number(value) || 1))), columnsProvenance: 'imported' };
      else if (this.sectionStarts()[name]) {
        pushSection();
        const definition = this.sectionStarts()[name];
        current = { type: definition.type, label: value || definition.label, lines: [] };
      } else if (this.sectionEnds().has(name)) {
        pushSection();
      } else {
        unknown.push({ name, value, sourceLine, raw: rawLine });
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
    if (song.credits?.writer?.value) directive('composer', song.credits.writer.value);
    if (song.credits?.arranger?.value) directive('x_arranger', song.credits.arranger.value);
    if (song.arrangement?.mode === 'manual') directive('x_arrangement', song.arrangement.value || '');
    if (song.layout?.columns && (song.layout.columns !== 1 || song.layout.columnsProvenance !== 'default')) {
      directive('x_columns', String(song.layout.columns));
    }
    const emitted = new Set(['title', 't', 'subtitle', 'st', 'artist', 'key', 'tempo', 'time',
      'time_signature', 'capo', 'composer', 'writer', 'x_arranger', 'x_arrangement', 'x_columns']);
    (song.source?.chordPro?.directives || []).forEach(item => {
      if (emitted.has(String(item.name || '').toLowerCase())) return;
      if (item.raw) lines.push(item.raw);
      else directive(item.name, item.value || '');
    });

    (song.sections || []).forEach(section => {
      const pair = this.sectionDirective(section.type);
      if (pair) directive(pair.start, section.label || pair.label);
      (section.lines || []).forEach(line => lines.push(this.serializeLine(line, chordDisplay)));
      if (pair) directive(pair.end, '');
    });
    return `${lines.join('\n')}\n`;
  }

  static parseDirective(line) {
    const match = String(line).trim().match(/^\{([a-z][a-z0-9_-]*)(?:\s*:\s*(.*))?\}$/i);
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
      start_of_bridge: { type: 'bridge', label: 'Bridge' }, sob: { type: 'bridge', label: 'Bridge' },
      start_of_pre_chorus: { type: 'pre-chorus', label: 'Pre-Chorus' }, sop: { type: 'pre-chorus', label: 'Pre-Chorus' },
      start_of_intro: { type: 'intro', label: 'Intro' }, soi: { type: 'intro', label: 'Intro' },
      start_of_outro: { type: 'outro', label: 'Outro' }, soo: { type: 'outro', label: 'Outro' },
      start_of_instrumental: { type: 'instrumental', label: 'Instrumental' },
      start_of_interlude: { type: 'interlude', label: 'Interlude' },
      start_of_tag: { type: 'tag', label: 'Tag' }, start_of_vamp: { type: 'vamp', label: 'Vamp' },
      start_of_refrain: { type: 'refrain', label: 'Refrain' }, start_of_solo: { type: 'solo', label: 'Solo' }
    };
  }

  static sectionEnds() {
    return new Set(['end_of_verse', 'eov', 'end_of_chorus', 'eoc', 'end_of_bridge', 'eob',
      'end_of_pre_chorus', 'eop', 'end_of_intro', 'eoi', 'end_of_outro', 'eoo',
      'end_of_instrumental', 'end_of_interlude', 'end_of_tag', 'end_of_vamp',
      'end_of_refrain', 'end_of_solo']);
  }

  static sectionDirective(type) {
    return {
      verse: { start: 'start_of_verse', end: 'end_of_verse', label: 'Verse' },
      chorus: { start: 'start_of_chorus', end: 'end_of_chorus', label: 'Chorus' },
      bridge: { start: 'start_of_bridge', end: 'end_of_bridge', label: 'Bridge' },
      'pre-chorus': { start: 'start_of_pre_chorus', end: 'end_of_pre_chorus', label: 'Pre-Chorus' },
      intro: { start: 'start_of_intro', end: 'end_of_intro', label: 'Intro' },
      outro: { start: 'start_of_outro', end: 'end_of_outro', label: 'Outro' },
      instrumental: { start: 'start_of_instrumental', end: 'end_of_instrumental', label: 'Instrumental' },
      interlude: { start: 'start_of_interlude', end: 'end_of_interlude', label: 'Interlude' },
      tag: { start: 'start_of_tag', end: 'end_of_tag', label: 'Tag' },
      vamp: { start: 'start_of_vamp', end: 'end_of_vamp', label: 'Vamp' },
      refrain: { start: 'start_of_refrain', end: 'end_of_refrain', label: 'Refrain' },
      solo: { start: 'start_of_solo', end: 'end_of_solo', label: 'Solo' }
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
