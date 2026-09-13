/**
 * Browser-local learning from explicitly saved audio-chart corrections.
 * Raw analyzer output remains under song.source.rawAnalysis.
 */
class ChordCorrectionMemory {
  static STORAGE_KEY = 'transposepdf.chord-corrections.v1';

  constructor(storage = typeof window !== 'undefined' ? window.localStorage : null) {
    this.storage = storage;
  }

  read() {
    if (!this.storage) return { version: 1, records: [] };
    try {
      const value = JSON.parse(this.storage.getItem(ChordCorrectionMemory.STORAGE_KEY) || 'null');
      if (value?.version === 1 && Array.isArray(value.records)) return value;
    } catch (_) {
      // A damaged preference must never stop chart editing.
    }
    return { version: 1, records: [] };
  }

  write(value) {
    if (!this.storage) return;
    try {
      this.storage.setItem(ChordCorrectionMemory.STORAGE_KEY, JSON.stringify(value));
    } catch (_) {
      // Private browsing and storage quotas may deny writes.
    }
  }

  clear() {
    try {
      this.storage?.removeItem(ChordCorrectionMemory.STORAGE_KEY);
    } catch (_) {
      // Treat unavailable storage as already clear.
    }
  }

  learn(previous, edited, baselines = {}) {
    if (previous?.sourceType !== 'audio') return { learned: 0, removed: 0 };
    const rawSections = baselines.rawSections
      || previous.source?.rawAnalysis?.sections
      || previous.sections
      || [];
    const visible = this.flatten(baselines.visibleSections || previous.sections || []);
    const baseline = this.flatten(rawSections);
    const accepted = this.flatten(edited?.sections || []);
    const state = this.read();
    let learned = 0;
    let removed = 0;

    visible.forEach(visibleGuess => {
      const correction = this.matchEditedAnchor(visibleGuess, accepted);
      if (!correction || correction.symbol === visibleGuess.symbol) return;
      const guess = this.matchEditedAnchor(visibleGuess, baseline) || visibleGuess;
      const index = Math.max(0, baseline.indexOf(guess));
      const context = this.contextFor(baseline, index, previous.originalKey);
      const songFingerprint = this.songFingerprint(previous);
      const existingIndexes = state.records
        .map((record, recordIndex) => {
          const matches = record.kind === 'enharmonic'
            ? this.sameEnharmonicSource(record.guessed, guess.symbol)
            : this.sameContext(record, guess.symbol, context);
          return matches ? recordIndex : -1;
        })
        .filter(recordIndex => recordIndex >= 0);

      if (correction.symbol === guess.symbol) {
        existingIndexes.reverse().forEach(recordIndex => state.records.splice(recordIndex, 1));
        removed += existingIndexes.length;
        return;
      }

      const kind = this.isEnharmonicChange(guess.symbol, correction.symbol) ? 'enharmonic' : 'harmonic';
      const record = {
        guessed: guess.symbol,
        corrected: correction.symbol,
        key: context.key,
        previous: context.previous,
        next: context.next,
        songFingerprint,
        sectionIndex: guess.sectionIndex,
        lineIndex: guess.lineIndex,
        lyrics: guess.lyrics,
        characterOffset: guess.characterOffset,
        timestamp: guess.timestamp ?? null,
        confidence: guess.confidence ?? null,
        kind,
        confirmations: 1,
        updatedAt: new Date().toISOString()
      };
      const matchingIndex = state.records.findIndex(item => item.kind === kind && (
        kind === 'enharmonic'
          ? this.sameEnharmonicSource(item.guessed, guess.symbol)
          : this.sameContext(item, guess.symbol, context)
      ));
      if (matchingIndex >= 0) {
        const old = state.records[matchingIndex];
        record.confirmations = old.corrected === record.corrected ? (old.confirmations || 1) + 1 : 1;
        state.records[matchingIndex] = record;
      } else {
        state.records.push(record);
      }
      learned += 1;
    });

    this.write(state);
    return { learned, removed };
  }

  apply(song) {
    const output = this.clone(song);
    if (output?.sourceType !== 'audio') return { song: output, applied: 0 };
    const rawSections = this.clone(song.sections || []);
    const rawChords = this.clone(song.chords || []);
    output.source = {
      ...(output.source || {}),
      rawAnalysis: output.source?.rawAnalysis || { sections: rawSections, chords: rawChords }
    };

    const state = this.read();
    const anchors = this.flatten(output.sections || []);
    const rawSymbols = anchors.map(anchor => anchor.symbol);
    const songFingerprint = this.songFingerprint(output);
    let applied = 0;
    const appliedAnchors = new Set();

    state.records
      .filter(record => record.kind === 'harmonic' && record.songFingerprint === songFingerprint)
      .forEach(record => {
        const candidates = anchors.filter(anchor => !appliedAnchors.has(anchor));
        if (!candidates.length) return;
        const sameLyrics = record.lyrics
          ? candidates.filter(anchor => anchor.lyrics === record.lyrics)
          : [];
        const sameLine = candidates.filter(anchor =>
          record.sectionIndex === anchor.sectionIndex && record.lineIndex === anchor.lineIndex
        );
        let lyricLine = sameLyrics;
        if (sameLyrics.length && record.timestamp !== null) {
          const nearest = sameLyrics.reduce((best, anchor) => {
            if (anchor.timestamp === null) return best;
            if (!best || Math.abs(anchor.timestamp - record.timestamp) < Math.abs(best.timestamp - record.timestamp)) {
              return anchor;
            }
            return best;
          }, null);
          if (nearest) {
            lyricLine = sameLyrics.filter(anchor =>
              anchor.sectionIndex === nearest.sectionIndex && anchor.lineIndex === nearest.lineIndex
            );
          }
        }
        const pool = lyricLine.length ? lyricLine : sameLine.length ? sameLine : candidates;
        const matchedLyrics = Boolean(sameLyrics.length);
        const target = pool.reduce((best, anchor) =>
          this.locationDistance(record, anchor, matchedLyrics) <= this.locationDistance(record, best, matchedLyrics)
            ? anchor : best
        );
        const maximumDistance = sameLyrics.length || sameLine.length ? 12 : 5;
        if (this.locationDistance(record, target, matchedLyrics) > maximumDistance) return;
        appliedAnchors.add(target);
        if (target.anchor.symbol === record.corrected) return;
        target.anchor.symbol = record.corrected;
        applied += 1;
      });

    anchors.forEach((anchor, index) => {
      if (appliedAnchors.has(anchor)) return;
      const context = {
        key: output.originalKey || 'C',
        previous: index ? rawSymbols[index - 1] : null,
        next: index + 1 < rawSymbols.length ? rawSymbols[index + 1] : null
      };
      const harmonic = state.records.find(record =>
        record.kind === 'harmonic' && this.sameContext(record, anchor.symbol, context)
      );
      const enharmonic = state.records.find(record =>
        record.kind === 'enharmonic' && this.sameEnharmonicSource(record.guessed, anchor.symbol)
      );
      const rule = harmonic || enharmonic;
      if (rule && rule.corrected !== anchor.symbol) {
        anchor.anchor.symbol = rule.corrected;
        applied += 1;
      }
    });
    output.source.learnedCorrectionsApplied = applied;
    return { song: output, applied };
  }

  flatten(sections) {
    const anchors = [];
    (sections || []).forEach((section, sectionIndex) => {
      (section.lines || []).forEach((line, lineIndex) => {
        (line.chords || []).forEach((anchor, chordIndex) => anchors.push({
          anchor,
          symbol: anchor.symbol,
          characterOffset: Number(anchor.characterOffset) || 0,
          timestamp: anchor.timestamp ?? null,
          confidence: anchor.confidence ?? null,
          lyrics: line.lyrics || '',
          sectionIndex,
          lineIndex,
          chordIndex,
          lineChordCount: (line.chords || []).length
        }));
      });
    });
    return anchors;
  }

  matchEditedAnchor(guess, accepted) {
    const candidates = accepted.filter(item =>
      item.sectionIndex === guess.sectionIndex && item.lineIndex === guess.lineIndex
    );
    if (!candidates.length) return null;
    const positioned = candidates.find(item => item.characterOffset === guess.characterOffset);
    if (positioned) return positioned;
    if (candidates.length === guess.lineChordCount && guess.chordIndex < candidates.length) {
      return candidates[guess.chordIndex];
    }
    if (guess.timestamp !== null) {
      const timed = candidates.find(item =>
        item.timestamp !== null && Math.abs(item.timestamp - guess.timestamp) < 0.05
      );
      if (timed) return timed;
    }
    return null;
  }

  contextFor(anchors, index, key) {
    return {
      key: key || 'C',
      previous: index ? anchors[index - 1].symbol : null,
      next: index + 1 < anchors.length ? anchors[index + 1].symbol : null
    };
  }

  sameContext(record, guessed, context) {
    return record.guessed === guessed
      && record.key === context.key
      && (record.previous ?? null) === context.previous
      && (record.next ?? null) === context.next;
  }

  sameEnharmonicSource(left, right) {
    const a = this.parseChord(left);
    const b = this.parseChord(right);
    return Boolean(a && b && a.pitch === b.pitch && a.suffix === b.suffix);
  }

  sameSongLocation(record, anchor) {
    if (record.timestamp !== null && anchor.timestamp !== null) {
      return Math.abs(record.timestamp - anchor.timestamp) < 0.75;
    }
    return record.sectionIndex === anchor.sectionIndex
      && record.lineIndex === anchor.lineIndex
      && record.characterOffset === anchor.characterOffset;
  }

  locationDistance(record, anchor, matchedLyrics = false) {
    if (matchedLyrics) return Math.abs(record.characterOffset - anchor.characterOffset);
    if (record.sectionIndex === anchor.sectionIndex && record.lineIndex === anchor.lineIndex) {
      return Math.abs(record.characterOffset - anchor.characterOffset);
    }
    if (record.timestamp !== null && anchor.timestamp !== null) return Math.abs(record.timestamp - anchor.timestamp);
    return Infinity;
  }

  songFingerprint(song) {
    const source = song?.source || {};
    const value = [
      song?.title || '',
      source.filename || '',
      source.authoritativeLyrics || source.transcriptText || ''
    ].join('\n').toLowerCase();
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `song-${(hash >>> 0).toString(16)}`;
  }

  isEnharmonicChange(left, right) {
    const a = this.parseChord(left);
    const b = this.parseChord(right);
    return Boolean(a && b && a.pitch === b.pitch && a.suffix === b.suffix && a.root !== b.root);
  }

  parseChord(symbol) {
    const match = String(symbol || '').match(/^([A-G])([#b]?)(.*)$/);
    if (!match) return null;
    const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]];
    const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    return {
      root: `${match[1]}${match[2]}`,
      pitch: (natural + accidental + 12) % 12,
      suffix: match[3]
    };
  }

  clone(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }
}

if (typeof window !== 'undefined') window.ChordCorrectionMemory = ChordCorrectionMemory;
if (typeof module !== 'undefined' && module.exports) module.exports = ChordCorrectionMemory;
