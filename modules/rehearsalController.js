/** In-memory timed rehearsal playback; media and paths are never serialized. */
class RehearsalController {
  constructor({ audio = null, source = null, song = null } = {}) {
    this.audio = audio || (typeof Audio !== 'undefined' ? new Audio() : null);
    if (!this.audio) throw new Error('An audio element is required');
    this.song = song || { sections: [] };
    this.subscribers = new Set();
    this.follow = true;
    this.loop = null;
    this.ownedObjectUrl = null;
    this.lines = [];
    this.chords = [];
    this.boundUpdate = () => this.handleTimeUpdate();
    this.boundState = () => this.notify();
    this.audio.addEventListener('timeupdate', this.boundUpdate);
    ['play', 'pause', 'ratechange', 'durationchange', 'ended'].forEach(name =>
      this.audio.addEventListener(name, this.boundState));
    this.setSong(this.song);
    if (source) this.setSource(source);
  }

  setSong(song) {
    this.song = song || { sections: [] };
    this.lines = [];
    this.chords = [];
    (this.song.sections || []).forEach((section, sectionIndex) =>
      (section.lines || []).forEach((line, lineIndex) => {
        if (line.startTime !== null && line.startTime !== undefined && Number.isFinite(Number(line.startTime))) this.lines.push({
          sectionIndex, lineIndex, line,
          start: Number(line.startTime),
          end: line.endTime !== null && line.endTime !== undefined && Number.isFinite(Number(line.endTime))
            ? Number(line.endTime) : Infinity
        });
        (line.chords || []).forEach((chord, chordIndex) => {
          if (chord.timestamp === null || chord.timestamp === undefined || !Number.isFinite(Number(chord.timestamp))) return;
          this.chords.push({ sectionIndex, lineIndex, chordIndex, chord, time: Number(chord.timestamp) });
        });
      }));
    this.lines.sort((a, b) => a.start - b.start || a.sectionIndex - b.sectionIndex || a.lineIndex - b.lineIndex);
    this.chords.sort((a, b) => a.time - b.time || a.sectionIndex - b.sectionIndex || a.lineIndex - b.lineIndex || a.chordIndex - b.chordIndex);
    this.notify();
  }

  setSource(source) {
    this.releaseObjectUrl();
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      this.ownedObjectUrl = URL.createObjectURL(source);
      this.audio.src = this.ownedObjectUrl;
    } else {
      this.audio.src = String(source || '');
    }
    this.notify();
  }

  async play() {
    await this.audio.play();
    this.notify();
  }

  pause() {
    this.audio.pause();
    this.notify();
  }

  seek(seconds) {
    const duration = Number(this.audio.duration);
    const maximum = Number.isFinite(duration) ? duration : Infinity;
    this.audio.currentTime = Math.max(0, Math.min(maximum, Number(seconds) || 0));
    this.handleTimeUpdate();
  }

  setRate(rate) {
    this.audio.playbackRate = Math.max(0.5, Math.min(2, Number(rate) || 1));
    this.notify();
  }

  loopLine(sectionIndex, lineIndex) {
    const target = this.lines.find(line => line.sectionIndex === sectionIndex && line.lineIndex === lineIndex);
    if (!target || !Number.isFinite(target.end) || target.end <= target.start) return false;
    this.loop = { sectionIndex, lineIndex, start: target.start, end: target.end };
    this.notify();
    return true;
  }

  clearLoop() {
    this.loop = null;
    this.notify();
  }

  pauseFollow() {
    this.follow = false;
    this.notify();
  }

  resumeFollow() {
    this.follow = true;
    this.notify();
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    listener(this.state());
    return () => this.subscribers.delete(listener);
  }

  state() {
    const time = Number(this.audio.currentTime) || 0;
    const line = this.activeAt(this.lines, time, 'start');
    const chord = this.activeAt(this.chords, time, 'time');
    return {
      playing: !this.audio.paused,
      currentTime: time,
      duration: this.audio.duration !== null && this.audio.duration !== undefined && Number.isFinite(Number(this.audio.duration))
        ? Number(this.audio.duration) : null,
      rate: Number(this.audio.playbackRate) || 1,
      follow: this.follow,
      loop: this.loop ? { ...this.loop } : null,
      activeLine: line ? { sectionIndex: line.sectionIndex, lineIndex: line.lineIndex } : null,
      activeChord: chord ? { sectionIndex: chord.sectionIndex, lineIndex: chord.lineIndex, chordIndex: chord.chordIndex } : null
    };
  }

  activeAt(items, time, field) {
    let low = 0;
    let high = items.length - 1;
    let found = -1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (items[middle][field] <= time) {
        found = middle;
        low = middle + 1;
      } else high = middle - 1;
    }
    if (found < 0) return null;
    const item = items[found];
    if (field === 'start' && time > item.end) return null;
    return item;
  }

  handleTimeUpdate() {
    if (this.loop && this.audio.currentTime >= this.loop.end) {
      this.audio.currentTime = this.loop.start;
      if (this.audio.paused) this.audio.play().catch(() => {});
    }
    this.notify();
  }

  notify() {
    const state = this.state();
    this.subscribers.forEach(listener => listener(state));
  }

  releaseObjectUrl() {
    if (!this.ownedObjectUrl) return;
    URL.revokeObjectURL(this.ownedObjectUrl);
    this.ownedObjectUrl = null;
  }

  destroy() {
    this.audio.pause();
    this.audio.removeEventListener('timeupdate', this.boundUpdate);
    ['play', 'pause', 'ratechange', 'durationchange', 'ended'].forEach(name =>
      this.audio.removeEventListener(name, this.boundState));
    this.releaseObjectUrl();
    this.subscribers.clear();
  }
}

if (typeof window !== 'undefined') window.RehearsalController = RehearsalController;
if (typeof module !== 'undefined' && module.exports) module.exports = RehearsalController;
