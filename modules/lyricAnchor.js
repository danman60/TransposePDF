/** Pure semantic lyric anchors. Offsets exposed to the app are grapheme insertion points. */
class LyricAnchor {
  static graphemes(value) {
    const text = String(value || '');
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
        .map(item => item.segment);
    }
    return Array.from(text);
  }

  static words(value) {
    const text = String(value || '');
    const graphemes = this.graphemes(text);
    const codeUnitToGrapheme = index => this.graphemes(text.slice(0, index)).length;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)]
        .filter(item => item.isWordLike)
        .map(item => ({
          text: item.segment,
          normalized: this.normalizeToken(item.segment),
          start: codeUnitToGrapheme(item.index),
          end: codeUnitToGrapheme(item.index + item.segment.length)
        }));
    }
    const output = [];
    const pattern = /[\p{L}\p{N}\p{M}]+/gu;
    let match;
    while ((match = pattern.exec(text))) {
      output.push({ text: match[0], normalized: this.normalizeToken(match[0]),
        start: codeUnitToGrapheme(match.index), end: codeUnitToGrapheme(match.index + match[0].length) });
    }
    return output;
  }

  static normalizeToken(value) {
    return String(value || '').normalize('NFC').toLocaleLowerCase();
  }

  static clampOffset(lyrics, offset) {
    return Math.max(0, Math.min(this.graphemes(lyrics).length, Math.trunc(Number(offset) || 0)));
  }

  static create(lyrics, characterOffset, provenance = 'inferred') {
    const graphemes = this.graphemes(lyrics);
    const point = this.clampOffset(lyrics, characterOffset);
    const words = this.words(lyrics);
    const containing = words.find(word => point >= word.start && point <= word.end);
    const nearest = containing || words.reduce((best, word) => {
      const distance = Math.min(Math.abs(point - word.start), Math.abs(point - word.end));
      return !best || distance < best.distance ? { ...word, distance } : best;
    }, null);
    const word = nearest?.normalized !== undefined ? nearest : null;
    const occurrence = word
      ? words.slice(0, words.indexOf(words.find(candidate => candidate.start === word.start)))
        .filter(candidate => candidate.normalized === word.normalized).length
      : 0;
    const inside = word && point > word.start && point < word.end;
    const affinity = inside ? 'inside' : word && point > word.end ? 'after' : 'before';
    return {
      version: 1,
      token: word?.normalized || '',
      tokenOccurrence: occurrence,
      graphemeOffset: word ? Math.max(0, Math.min(point - word.start, word.end - word.start)) : 0,
      affinity,
      leftContext: graphemes.slice(Math.max(0, point - 6), point).join(''),
      rightContext: graphemes.slice(point, point + 6).join(''),
      provenance: ['manual', 'imported', 'inferred'].includes(provenance) ? provenance : 'inferred'
    };
  }

  static contextScore(anchor, lyrics, point) {
    const chars = this.graphemes(lyrics);
    const left = chars.slice(Math.max(0, point - 6), point).join('');
    const right = chars.slice(point, point + 6).join('');
    let score = 0;
    for (let size = 1; size <= 6; size += 1) {
      if (anchor.leftContext?.slice(-size) === left.slice(-size)) score += 1;
      if (anchor.rightContext?.slice(0, size) === right.slice(0, size)) score += 1;
    }
    return score;
  }

  static mapEditPoint(oldLyrics, newLyrics, oldPoint) {
    const before = this.graphemes(oldLyrics);
    const after = this.graphemes(newLyrics);
    let prefix = 0;
    while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < before.length - prefix && suffix < after.length - prefix
      && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
    if (oldPoint <= prefix) return oldPoint;
    if (oldPoint >= before.length - suffix) return after.length - (before.length - oldPoint);
    return prefix;
  }

  static resolve(anchor, oldLyrics, newLyrics, oldOffset = 0) {
    const source = anchor?.version === 1 ? { ...anchor } : this.create(oldLyrics, oldOffset, 'inferred');
    const oldPoint = this.clampOffset(oldLyrics, oldOffset);
    const mapped = this.clampOffset(newLyrics, this.mapEditPoint(oldLyrics, newLyrics, oldPoint));
    const candidates = this.words(newLyrics).filter(word => word.normalized === source.token);
    let point = mapped;
    let needsReview = false;
    if (source.token && candidates.length) {
      const ranked = candidates.map((word, index) => {
        const candidatePoint = Math.min(word.end, word.start + (source.graphemeOffset || 0));
        const occurrenceBonus = index === source.tokenOccurrence ? 20 : 0;
        const context = this.contextScore(source, newLyrics, candidatePoint);
        return { word, point: candidatePoint, context,
          score: occurrenceBonus + context,
          distance: Math.abs(candidatePoint - mapped) };
      }).sort((a, b) => b.score - a.score || a.distance - b.distance || a.word.start - b.word.start);
      const winner = ranked[0];
      // A deleted anchored occurrence must stay at deletion boundary, not jump to an unrelated repeat.
      const mappedInsideWinner = mapped >= winner.word.start && mapped <= winner.word.end;
      const credible = winner.context >= 6 || mappedInsideWinner || winner.distance <= 1;
      if (credible) point = winner.point;
      else needsReview = true;
    } else if (source.token) {
      const editedWord = source.affinity === 'inside'
        ? this.words(newLyrics).find(word => mapped > word.start && mapped < word.end)
        : null;
      if (editedWord) point = mapped;
      else needsReview = true;
    }
    const resolved = this.create(newLyrics, point, source.provenance);
    if (needsReview) {
      resolved.token = source.token;
      resolved.tokenOccurrence = source.tokenOccurrence;
      resolved.graphemeOffset = source.graphemeOffset;
      resolved.affinity = source.affinity;
      resolved.needsReview = true;
    }
    return { characterOffset: point, anchor: resolved };
  }

  static reconcileLine(line, oldLyrics, newLyrics) {
    return {
      ...line,
      lyrics: String(newLyrics || ''),
      chords: (line.chords || []).map(chord => ({ ...chord,
        ...this.resolve(chord.anchor, oldLyrics, newLyrics, chord.characterOffset) }))
    };
  }

  static splitLine(line, splitOffset, newLineId) {
    const chars = this.graphemes(line.lyrics);
    const point = Math.max(0, Math.min(chars.length, Math.trunc(Number(splitOffset) || 0)));
    const leftLyrics = chars.slice(0, point).join('');
    const rightLyrics = chars.slice(point).join('');
    const leftChords = [];
    const rightChords = [];
    (line.chords || []).forEach(chord => {
      if ((Number(chord.characterOffset) || 0) < point) {
        leftChords.push({ ...chord, ...this.resolve(chord.anchor, line.lyrics, leftLyrics, chord.characterOffset) });
      } else {
        const offset = Math.max(0, (Number(chord.characterOffset) || 0) - point);
        rightChords.push({ ...chord, characterOffset: offset,
          anchor: this.create(rightLyrics, offset, chord.anchor?.provenance || 'inferred') });
      }
    });
    return [{ ...line, lyrics: leftLyrics, chords: leftChords }, {
      ...line, id: newLineId, lyrics: rightLyrics, chords: rightChords
    }];
  }

  static joinLines(left, right, separator = '') {
    const shift = this.graphemes(left.lyrics).length + this.graphemes(separator).length;
    const lyrics = `${left.lyrics || ''}${separator}${right.lyrics || ''}`;
    return { ...left, lyrics, chords: [
      ...(left.chords || []).map(chord => ({ ...chord, ...this.resolve(chord.anchor, left.lyrics, lyrics, chord.characterOffset) })),
      ...(right.chords || []).map(chord => {
        const offset = shift + (Number(chord.characterOffset) || 0);
        return { ...chord, characterOffset: offset,
          anchor: this.create(lyrics, offset, chord.anchor?.provenance || 'inferred') };
      })
    ] };
  }
}

if (typeof window !== 'undefined') window.LyricAnchor = LyricAnchor;
if (typeof module !== 'undefined' && module.exports) module.exports = LyricAnchor;
