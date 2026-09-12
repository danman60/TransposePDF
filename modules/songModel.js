/**
 * Canonical song model shared by manual, PDF, and future audio imports.
 */
class SongModel {
  static create(input = {}) {
    const sections = (input.sections || []).map((section, sectionIndex) => ({
      id: section.id || `section-${sectionIndex + 1}`,
      type: section.type || 'section',
      label: section.label || '',
      lines: (section.lines || []).map((line, lineIndex) => ({
        id: line.id || `line-${sectionIndex + 1}-${lineIndex + 1}`,
        lyrics: line.lyrics || '',
        chords: (line.chords || []).map(chord => ({
          symbol: chord.symbol || '',
          characterOffset: Math.max(0, Number(chord.characterOffset) || 0),
          timestamp: chord.timestamp ?? null,
          confidence: chord.confidence ?? null
        })),
        startTime: line.startTime ?? null,
        endTime: line.endTime ?? null
      }))
    }));

    const song = {
      id: input.id ?? Date.now(),
      title: input.title || 'Untitled Song',
      artist: input.artist || '',
      originalKey: input.originalKey || 'C',
      currentKey: input.currentKey || input.originalKey || 'C',
      transposition: Number(input.transposition) || 0,
      tempo: input.tempo ?? null,
      timeSignature: input.timeSignature || '',
      sourceType: input.sourceType || 'manual',
      sections,
      source: input.source || {},
      textItems: input.textItems || [],
      pageStart: input.pageStart,
      pageEnd: input.pageEnd,
      keyConfidence: input.keyConfidence ?? null,
      chords: input.chords || []
    };

    song.songText = this.toSongText(song);
    return song;
  }

  static fromManual({ title, originalKey, content, artist = '' }) {
    return this.create({
      title: (title || '').trim() || 'Untitled Song',
      artist: (artist || '').trim(),
      originalKey: (originalKey || '').trim() || 'C',
      currentKey: (originalKey || '').trim() || 'C',
      sourceType: 'manual',
      sections: this.parseEditorText(content || '')
    });
  }

  static fromPDFSong(song) {
    if (song.sections?.length) {
      return this.create({ ...song, sourceType: song.sourceType || 'pdf' });
    }

    return this.create({
      ...song,
      sourceType: 'pdf',
      source: { ...(song.source || {}), preserveLayout: true },
      sections: this.parseEditorText(song.songText || '')
    });
  }

  static parseEditorText(text) {
    const rows = String(text).replace(/\r/g, '').split('\n');
    const sections = [];
    let current = { id: 'section-1', type: 'section', label: '', lines: [] };

    const pushSection = () => {
      if (current.lines.length || current.label) sections.push(current);
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const trimmed = row.trim();
      const header = trimmed.match(/^\[?(verse|chorus|bridge|pre-chorus|intro|outro|instrumental)(?:\s+\d+)?\]?:?$/i);

      if (header) {
        pushSection();
        current = {
          id: `section-${sections.length + 1}`,
          type: header[1].toLowerCase(),
          label: trimmed.replace(/^\[|\]$|:$/g, ''),
          lines: []
        };
        continue;
      }

      if (this.isChordRow(row) && index + 1 < rows.length && !this.isChordRow(rows[index + 1])) {
        const lyricRow = rows[index + 1];
        current.lines.push({
          lyrics: lyricRow,
          chords: this.parseChordRow(row),
          startTime: null,
          endTime: null
        });
        index += 1;
        continue;
      }

      current.lines.push({ lyrics: row, chords: [], startTime: null, endTime: null });
    }

    pushSection();
    return sections.length ? sections : [{ id: 'section-1', type: 'section', label: '', lines: [] }];
  }

  static isChordRow(row) {
    const tokens = String(row).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    const chordPattern = /^[A-G](?:#{1,2}|b{1,2})?(?:maj|min|m|dim|aug|sus|add)?\d*(?:\([^)]*\))?(?:\/[A-G](?:#{1,2}|b{1,2})?)?$/i;
    return tokens.every(token => chordPattern.test(token));
  }

  static parseChordRow(row) {
    const chords = [];
    const pattern = /\S+/g;
    let match;
    while ((match = pattern.exec(String(row))) !== null) {
      chords.push({
        symbol: match[0],
        characterOffset: match.index,
        timestamp: null,
        confidence: null
      });
    }
    return chords;
  }

  static toSongText(song) {
    return (song.sections || []).flatMap(section => {
      const output = [];
      if (section.label) output.push(section.label);
      for (const line of section.lines || []) {
        if (line.chords?.length) output.push(this.buildChordRow(line));
        output.push(line.lyrics || '');
      }
      return output;
    }).join('\n');
  }

  static buildChordRow(line) {
    const characters = [];
    const sorted = [...(line.chords || [])].sort((a, b) => a.characterOffset - b.characterOffset);
    for (const chord of sorted) {
      const offset = Math.max(0, chord.characterOffset || 0);
      while (characters.length < offset) characters.push(' ');
      const symbol = chord.symbol || '';
      for (let i = 0; i < symbol.length; i += 1) characters[offset + i] = symbol[i];
    }
    return characters.map(value => value || ' ').join('').trimEnd();
  }

  static toEditorText(song) {
    return this.toSongText(song);
  }
}

if (typeof window !== 'undefined') window.SongModel = SongModel;
if (typeof module !== 'undefined' && module.exports) module.exports = SongModel;
