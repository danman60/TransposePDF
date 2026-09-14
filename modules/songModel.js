/**
 * Canonical song model shared by manual, PDF, and future audio imports.
 */
class SongModel {
  static SCHEMA_VERSION = 2;

  static createId(prefix) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  static create(input = {}) {
    const Anchor = typeof LyricAnchor !== 'undefined'
      ? LyricAnchor
      : (typeof require === 'function' ? require('./lyricAnchor') : null);
    const imported = input.sourceType && input.sourceType !== 'manual';
    const normalizedSections = (input.sections || []).map((section, sectionIndex) => ({
      ...section,
      id: section.id || this.createId('section'),
      type: section.type || 'section',
      label: section.label || '',
      labelProvenance: section.labelProvenance || (imported ? 'imported' : 'inferred'),
      lines: (section.lines || []).map((line, lineIndex) => ({
        ...line,
        id: line.id || this.createId('line'),
        lyrics: line.lyrics || '',
        chords: (line.chords || []).map(chord => {
          const characterOffset = Math.max(0, Number(chord.characterOffset) || 0);
          const provenance = chord.anchor?.provenance
            || (chord.manualEntry?.provenance === 'manual' ? 'manual' : imported ? 'imported' : 'inferred');
          return { ...chord, id: chord.id || this.createId('chord'), symbol: chord.symbol ?? '',
            ...(chord.originalSymbol ? { originalSymbol: chord.originalSymbol } : {}),
            ...(chord.manualEntry?.provenance === 'manual' ? { manualEntry: { ...chord.manualEntry } } : {}),
            characterOffset,
            anchor: chord.anchor?.version === 1 ? { ...chord.anchor, provenance }
              : Anchor.create(line.lyrics || '', characterOffset, provenance),
            timestamp: chord.timestamp ?? null, confidence: chord.confidence ?? null };
        }),
        startTime: line.startTime ?? null,
        endTime: line.endTime ?? null,
        lyricConfidence: line.lyricConfidence ?? null,
        timedWords: line.timedWords || []
      }))
    }));
    const sections = this.collapseUnsectionedSections(normalizedSections);

    const song = {
      ...input,
      schemaVersion: this.SCHEMA_VERSION,
      id: input.id ?? Date.now(),
      title: input.title || 'Untitled Song',
      artist: input.artist || '',
      originalKey: input.originalKey || 'C',
      currentKey: input.currentKey || input.originalKey || 'C',
      transposition: Number(input.transposition) || 0,
      tempo: input.tempo ?? null,
      timeSignature: input.timeSignature || '',
      sourceType: input.sourceType || 'manual',
      spellingPolicy: input.spellingPolicy || 'contextual',
      view: this.normalizeView(input.view),
      sections,
      source: input.source || {},
      textItems: input.textItems || [],
      pageStart: input.pageStart,
      pageEnd: input.pageEnd,
      keyConfidence: input.keyConfidence ?? null,
      chords: input.chords || []
    };

    song.credits = {
      writer: this.normalizeCredit(input.credits?.writer),
      arranger: this.normalizeCredit(input.credits?.arranger)
    };
    song.layout = {
      columns: Math.max(1, Math.min(3, Math.trunc(Number(input.layout?.columns) || 1))),
      fontSize: Math.max(10, Math.min(18, Math.round(Number(input.layout?.fontSize) || 13))),
      columnsProvenance: ['default', 'manual', 'imported'].includes(input.layout?.columnsProvenance)
        ? input.layout.columnsProvenance : 'default'
    };
    const inferredValue = input.arrangement?.inferredValue || this.inferArrangement(sections);
    const mode = input.arrangement?.mode === 'manual' ? 'manual' : 'auto';
    song.arrangement = { mode,
      value: mode === 'manual' ? String(input.arrangement?.value ?? '') : String(input.arrangement?.value || inferredValue),
      inferredValue, updatedAt: input.arrangement?.updatedAt ?? null };

    song.songText = this.toSongText(song);
    return song;
  }

  static collapseUnsectionedSections(sections = []) {
    const placeholders = new Set(['', 'ns', 'no section', 'new section', 'unsectioned']);
    const result = [];
    let hasRealSection = false;
    sections.forEach(section => {
      const label = String(section.label || '').trim().toLowerCase();
      const unsectioned = !section.pendingSection && placeholders.has(label);
      if (unsectioned && hasRealSection && result.length) {
        const meaningful = (section.lines || []).filter(line => line.lyrics || line.chords?.length);
        result[result.length - 1].lines.push(...meaningful);
        return;
      }
      result.push(section);
      if (!placeholders.has(label)) hasRealSection = true;
    });
    return result.length ? result : sections;
  }

  static normalizeCredit(value) {
    const credit = value && typeof value === 'object' ? value : { value: value || '' };
    return { value: String(credit.value || ''),
      provenance: ['manual', 'imported', 'inferred'].includes(credit.provenance) ? credit.provenance : 'inferred',
      updatedAt: credit.updatedAt ?? null };
  }

  static inferArrangement(sections) {
    const Engine = typeof Arrangement !== 'undefined'
      ? Arrangement
      : (typeof require === 'function' ? require('./arrangement') : null);
    return Engine
      ? Engine.infer(sections || [])
      : (sections || []).map(section => String(section.label || section.type || '').trim()).filter(Boolean).join(' ');
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
    let current = { id: this.createId('section'), type: 'section', label: '', lines: [] };

    const pushSection = () => {
      if (current.lines.length || current.label) sections.push(current);
    };

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const trimmed = row.trim();
      const bracketedHeader = trimmed.match(/^\[([^\]\r\n]+)\]\s*:?$/);
      const knownHeader = trimmed.match(/^(?:(final)\s+)?(verse|chorus|bridge|pre-chorus|intro|outro|instrumental|tag|interlude|vamp|refrain)(?:\s+\d+)?\s*:?$/i);
      const headerLabel = bracketedHeader?.[1]?.trim() || (knownHeader ? trimmed.replace(/:$/, '').trim() : '');
      const recognizedHeader = Boolean(
        bracketedHeader
        || (knownHeader && (!knownHeader[1] || knownHeader[2].toLowerCase() === 'chorus'))
      );

      if (recognizedHeader) {
        pushSection();
        const typeMatch = headerLabel.match(/^(?:final\s+)?(verse|chorus|bridge|pre-chorus|intro|outro|instrumental|tag|interlude|vamp|refrain)/i);
        current = {
          id: this.createId('section'),
          type: typeMatch ? typeMatch[1].toLowerCase() : 'section',
          label: headerLabel,
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
    return sections.length ? sections : [{ id: this.createId('section'), type: 'section', label: '', lines: [] }];
  }

  static isChordRow(row) {
    const tokens = String(row).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    const chordPattern = /^(?:N\.C\.|[A-G](?:#{1,2}|b{1,2})?(?:(?:maj|min|m|dim|aug|sus|add|omit|no|alt|[+°ø])?\d*(?:[#b]\d+|add\d+|no\d+|omit\d+|sus\d*)*)?(?:\/[A-G](?:#{1,2}|b{1,2})?)?)$/i;
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

  static retainAnalysisMetadata(edited, previous) {
    const oldLines = (previous.sections || []).flatMap(section => section.lines || []);
    const newLines = (edited.sections || []).flatMap(section => section.lines || []);
    const matchedOldLines = new Set();

    (edited.sections || []).forEach((section, sectionIndex) => {
      const oldSection = previous.sections?.[sectionIndex];
      if (oldSection?.id) section.id = oldSection.id;
    });

    newLines.forEach((line, lineIndex) => {
      const normalizedLyrics = this.normalizeLyrics(line.lyrics);
      let oldLineIndex = oldLines.findIndex((candidate, candidateIndex) =>
        !matchedOldLines.has(candidateIndex)
        && this.normalizeLyrics(candidate.lyrics) === normalizedLyrics
      );
      if (oldLineIndex < 0 && oldLines[lineIndex] && !matchedOldLines.has(lineIndex)) {
        oldLineIndex = lineIndex;
      }
      const oldLine = oldLineIndex >= 0 ? oldLines[oldLineIndex] : null;
      if (!oldLine) return;
      matchedOldLines.add(oldLineIndex);
      if (oldLine.id) line.id = oldLine.id;
      line.startTime = oldLine.startTime ?? null;
      line.endTime = oldLine.endTime ?? null;
      line.lyricConfidence = oldLine.lyricConfidence ?? null;
      line.timedWords = oldLine.timedWords || [];
      const available = [...(oldLine.chords || [])];
      (line.chords || []).forEach((chord, chordIndex) => {
        const explicitTimestamp = chord.timestamp !== null && chord.timestamp !== undefined;
        let bestIndex = available.findIndex(candidate =>
          candidate.symbol === chord.symbol
          && Number(candidate.characterOffset) === Number(chord.characterOffset)
        );
        if (bestIndex < 0) {
          bestIndex = available.findIndex(candidate =>
            Number(candidate.characterOffset) === Number(chord.characterOffset)
          );
        }
        if (bestIndex < 0) {
          bestIndex = available.findIndex(candidate => candidate.symbol === chord.symbol);
        }
        if (bestIndex < 0 && chordIndex < available.length) bestIndex = chordIndex;
        const match = bestIndex >= 0 ? available.splice(bestIndex, 1)[0] : null;
        const unchanged = Boolean(match
          && match.symbol === chord.symbol
          && Number(match.characterOffset) === Number(chord.characterOffset));

        if (match?.id) chord.id = match.id;
        if (explicitTimestamp) return;
        if (unchanged) {
          chord.timestamp = match.timestamp ?? null;
          chord.confidence = match.confidence ?? null;
          return;
        }
        chord.timestamp = this.timestampForCharacterOffset(line, chord.characterOffset, match?.timestamp);
        chord.confidence = null;
      });
    });
    edited.tempo = previous.tempo ?? edited.tempo;
    edited.timeSignature = previous.timeSignature || edited.timeSignature;
    edited.keyConfidence = previous.keyConfidence ?? edited.keyConfidence;
    edited.spellingPolicy = previous.spellingPolicy || edited.spellingPolicy || 'contextual';
    edited.view = this.normalizeView(previous.view || edited.view);
    edited.chords = previous.chords || [];
    edited.songText = this.toSongText(edited);
    return edited;
  }

  static normalizeLyrics(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  static normalizeView(view = {}) {
    const notation = view.notation === 'nashville' ? 'nashville' : 'chords';
    const instruments = new Set(['concert', 'bb', 'eb', 'f']);
    const instrument = instruments.has(String(view.instrument || '').toLowerCase())
      ? String(view.instrument).toLowerCase()
      : 'concert';
    return {
      notation,
      capo: Math.max(0, Math.min(11, Math.trunc(Number(view.capo) || 0))),
      instrument
    };
  }

  static timestampForCharacterOffset(line, characterOffset, fallback = null) {
    const offset = Math.max(0, Number(characterOffset) || 0);
    const words = (line.timedWords || [])
      .map(word => ({
        offset: Number(word.character_offset ?? word.characterOffset),
        start: Number(word.start),
        end: word.end === null || word.end === undefined ? null : Number(word.end)
      }))
      .filter(word => Number.isFinite(word.offset) && Number.isFinite(word.start))
      .sort((left, right) => left.offset - right.offset);

    if (words.length) {
      if (offset <= words[0].offset) return words[0].start;
      for (let index = 0; index < words.length - 1; index += 1) {
        const left = words[index];
        const right = words[index + 1];
        if (offset > right.offset) continue;
        const distance = right.offset - left.offset;
        if (!distance) return left.start;
        const ratio = (offset - left.offset) / distance;
        return left.start + ((right.start - left.start) * ratio);
      }
      const last = words[words.length - 1];
      return Number.isFinite(last.end) ? last.end : last.start;
    }

    const start = line.startTime === null || line.startTime === undefined ? NaN : Number(line.startTime);
    const end = line.endTime === null || line.endTime === undefined ? NaN : Number(line.endTime);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const lyricLength = Math.max(1, String(line.lyrics || '').length);
      return start + ((end - start) * Math.min(offset, lyricLength) / lyricLength);
    }
    return fallback ?? null;
  }
}

if (typeof window !== 'undefined') window.SongModel = SongModel;
if (typeof module !== 'undefined' && module.exports) module.exports = SongModel;
