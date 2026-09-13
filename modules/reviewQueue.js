/** Deterministic low-confidence review workflow for canonical SongModel data. */
class ReviewQueue {
  constructor(song, { threshold = 0.65, clock = () => new Date().toISOString() } = {}) {
    this.song = this.clone(song || {});
    this.threshold = this.normalizeThreshold(threshold);
    this.clock = clock;
    this.history = [];
    this.ensureMetadata();
  }

  setThreshold(threshold) {
    this.threshold = this.normalizeThreshold(threshold);
    return this.items();
  }

  items() {
    const reviewed = this.song.source.reviewQueue.items;
    const output = [];
    (this.song.sections || []).forEach((section, sectionIndex) => {
      (section.lines || []).forEach((line, lineIndex) => {
        const lineId = line.id || `line-${sectionIndex + 1}-${lineIndex + 1}`;
        if (this.isLow(line.lyricConfidence)) {
          const id = `lyric:${lineId}`;
          if (!reviewed[id]) output.push({
            id, kind: 'lyric', value: line.lyrics || '', confidence: Number(line.lyricConfidence),
            timestamp: line.startTime ?? null, sectionIndex, lineIndex, chordIndex: null
          });
        }
        (line.chords || []).forEach((chord, chordIndex) => {
          if (!this.isLow(chord.confidence)) return;
          const chordId = chord.id || `${lineId}-${chordIndex + 1}`;
          const id = `chord:${chordId}`;
          if (!reviewed[id]) output.push({
            id, kind: 'chord', value: chord.symbol || '', confidence: Number(chord.confidence),
            timestamp: chord.timestamp ?? line.startTime ?? null,
            sectionIndex, lineIndex, chordIndex, characterOffset: Number(chord.characterOffset) || 0
          });
        });
      });
    });
    return output.sort((left, right) => {
      const leftTime = left.timestamp === null ? Infinity : Number(left.timestamp);
      const rightTime = right.timestamp === null ? Infinity : Number(right.timestamp);
      return leftTime - rightTime
        || left.sectionIndex - right.sectionIndex
        || left.lineIndex - right.lineIndex
        || (left.chordIndex ?? -1) - (right.chordIndex ?? -1)
        || left.id.localeCompare(right.id);
    });
  }

  accept(itemId) {
    return this.commit(itemId, 'accepted');
  }

  edit(itemId, value) {
    const target = this.find(itemId);
    if (!target) return false;
    this.pushHistory();
    if (target.kind === 'chord') {
      const symbol = String(value || '').trim();
      if (!symbol) {
        this.history.pop();
        return false;
      }
      target.chord.symbol = symbol;
      target.chord.confidence = null;
    } else {
      target.line.lyrics = String(value ?? '');
      target.line.lyricConfidence = null;
    }
    this.mark(itemId, 'edited', target.kind, value);
    return true;
  }

  remove(itemId) {
    const target = this.find(itemId);
    if (!target) return false;
    this.pushHistory();
    if (target.kind === 'chord') target.line.chords.splice(target.chordIndex, 1);
    else {
      target.line.lyrics = '';
      target.line.lyricConfidence = null;
    }
    this.mark(itemId, 'removed', target.kind, null);
    return true;
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.song = previous;
    this.ensureMetadata();
    return true;
  }

  result() {
    return this.clone(this.song);
  }

  commit(itemId, status) {
    const target = this.find(itemId);
    if (!target) return false;
    this.pushHistory();
    this.mark(itemId, status, target.kind, target.kind === 'chord' ? target.chord.symbol : target.line.lyrics);
    return true;
  }

  find(itemId) {
    for (let sectionIndex = 0; sectionIndex < (this.song.sections || []).length; sectionIndex += 1) {
      const section = this.song.sections[sectionIndex];
      for (let lineIndex = 0; lineIndex < (section.lines || []).length; lineIndex += 1) {
        const line = section.lines[lineIndex];
        const lineId = line.id || `line-${sectionIndex + 1}-${lineIndex + 1}`;
        if (itemId === `lyric:${lineId}`) return { kind: 'lyric', line, sectionIndex, lineIndex };
        for (let chordIndex = 0; chordIndex < (line.chords || []).length; chordIndex += 1) {
          const chord = line.chords[chordIndex];
          const chordId = chord.id || `${lineId}-${chordIndex + 1}`;
          if (itemId === `chord:${chordId}`) return { kind: 'chord', line, chord, sectionIndex, lineIndex, chordIndex };
        }
      }
    }
    return null;
  }

  mark(id, status, kind, value) {
    this.song.source.reviewQueue.items[id] = {
      status, kind, value: value ?? null, reviewedAt: this.clock()
    };
  }

  pushHistory() {
    this.history.push(this.clone(this.song));
    if (this.history.length > 100) this.history.shift();
  }

  ensureMetadata() {
    this.song.source = this.song.source && typeof this.song.source === 'object' ? this.song.source : {};
    const existing = this.song.source.reviewQueue;
    this.song.source.reviewQueue = {
      version: 1,
      items: existing?.items && typeof existing.items === 'object' ? existing.items : {}
    };
  }

  isLow(confidence) {
    return confidence !== null && confidence !== undefined
      && Number.isFinite(Number(confidence)) && Number(confidence) < this.threshold;
  }

  normalizeThreshold(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0.65;
  }

  clone(value) {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }
}

if (typeof window !== 'undefined') window.ReviewQueue = ReviewQueue;
if (typeof module !== 'undefined' && module.exports) module.exports = ReviewQueue;
