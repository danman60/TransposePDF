/** Read-only live companion for a sanitized SessionTelemetry snapshot. */
class CompanionView {
  static POLL_INTERVAL_MS = 1000;
  static STALE_AFTER_MS = 5000;

  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/telemetry/state';
    this.fetch = options.fetch || window.fetch.bind(window);
    this.timer = null;
    this.polling = false;
    this.lastRevision = null;
    this.lastReceivedAt = 0;
    this.wakeLock = null;
    this.elements = this.collectElements();
  }

  collectElements() {
    const byId = id => document.getElementById(id);
    return {
      root: byId('companion'), waiting: byId('waiting'), stage: byId('stage'),
      connection: byId('connection'), connectionText: byId('connectionText'),
      sessionName: byId('sessionName'), sectionLabel: byId('sectionLabel'),
      songTitle: byId('songTitle'), songKey: byId('songKey'),
      currentChords: byId('currentChords'), currentLyrics: byId('currentLyrics'),
      nextChords: byId('nextChords'), nextLyrics: byId('nextLyrics'),
      nextLine: byId('nextLine'), wakeButton: byId('wakeButton'),
      fullscreenButton: byId('fullscreenButton')
    };
  }

  start() {
    this.elements.fullscreenButton?.addEventListener('click', () => this.toggleFullscreen());
    this.elements.wakeButton?.addEventListener('click', () => this.toggleWakeLock());
    document.addEventListener('fullscreenchange', () => this.syncFullscreenLabel());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.elements.wakeButton?.getAttribute('aria-pressed') === 'true') {
        this.requestWakeLock();
      }
    });
    this.poll();
  }

  stop() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.poll(), CompanionView.POLL_INTERVAL_MS);
  }

  async poll() {
    if (this.polling) return;
    this.polling = true;
    try {
      const response = await this.fetch(this.endpoint, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Companion state ${response.status}`);
      const state = await response.json();
      this.lastReceivedAt = Date.now();
      this.render(state);
      this.setConnection(state?.snapshot ? 'live' : 'waiting');
    } catch (_) {
      this.setConnection(this.lastReceivedAt ? 'stale' : 'disconnected');
    } finally {
      this.polling = false;
      this.schedule();
    }
  }

  render(state) {
    const snapshot = this.safeObject(state?.snapshot);
    const songs = Array.isArray(snapshot.currentSongs) ? snapshot.currentSongs : [];
    const activeSong = songs.find(song => String(song?.telemetryId || song?.id) === String(snapshot.activeSongId)) || songs[0];
    if (!activeSong) {
      this.elements.waiting.hidden = false;
      this.elements.stage.hidden = true;
      this.elements.sessionName.textContent = this.safeText(snapshot.sessionName || 'Live companion');
      return;
    }

    const position = this.resolvePosition(snapshot, activeSong);
    const flatLines = this.flattenLines(activeSong);
    const currentIndex = this.resolveLineIndex(flatLines, position);
    const current = flatLines[currentIndex] || flatLines[0] || { line: {}, section: {} };
    const next = flatLines[currentIndex + 1] || null;
    const revision = state?.snapshotRevision ?? snapshot.clientRevision;

    this.elements.waiting.hidden = true;
    this.elements.stage.hidden = false;
    this.elements.sessionName.textContent = this.safeText(snapshot.sessionName || snapshot.activeSessionName || state?.sessionName || 'Live session');
    this.elements.sectionLabel.textContent = this.safeText(current.section?.label || current.section?.type || 'Current section');
    this.elements.songTitle.textContent = this.safeText(activeSong.title || 'Untitled Song');
    this.elements.songKey.textContent = this.safeText(activeSong.currentKey || activeSong.originalKey || '—');
    this.renderLine(current.line, this.elements.currentChords, this.elements.currentLyrics);
    this.elements.nextLine.hidden = !next;
    if (next) this.renderLine(next.line, this.elements.nextChords, this.elements.nextLyrics);

    if (revision !== this.lastRevision) {
      this.elements.stage.classList.remove('is-updating');
      requestAnimationFrame(() => this.elements.stage.classList.add('is-updating'));
      this.lastRevision = revision;
    }
  }

  safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  safeText(value, limit = 2000) {
    return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit);
  }

  flattenLines(song) {
    return (Array.isArray(song?.sections) ? song.sections : []).flatMap(section =>
      (Array.isArray(section?.lines) ? section.lines : []).map(line => ({ section, line }))
    );
  }

  resolvePosition(snapshot, song) {
    return this.safeObject(snapshot.performance || snapshot.position || snapshot.editor || song.position);
  }

  resolveLineIndex(lines, position) {
    const lineId = position.currentLineId || position.lineId;
    const sectionId = position.currentSectionId || position.sectionId;
    let index = lines.findIndex(entry => String(entry.line?.id) === String(lineId));
    if (index >= 0) return index;
    index = lines.findIndex(entry => String(entry.section?.id) === String(sectionId));
    if (index >= 0) return index;
    const elapsed = Number(position.elapsedTime ?? position.currentTime);
    if (Number.isFinite(elapsed)) {
      const timed = lines.findIndex(entry => Number(entry.line?.startTime) <= elapsed
        && (entry.line?.endTime == null || elapsed < Number(entry.line.endTime)));
      if (timed >= 0) return timed;
    }
    return 0;
  }

  renderLine(line, chordElement, lyricElement) {
    const safeLine = this.safeObject(line);
    chordElement.textContent = this.formatChords(safeLine.chords);
    lyricElement.textContent = this.safeText(safeLine.lyrics || 'Instrumental');
  }

  formatChords(chords) {
    const output = [];
    (Array.isArray(chords) ? chords : []).slice(0, 64).forEach(chord => {
      const symbol = this.safeText(chord?.symbol, 32);
      if (!symbol) return;
      const offset = Math.max(0, Math.min(240, Number(chord?.characterOffset) || 0));
      while (output.length < offset) output.push(' ');
      if (output.length && output[output.length - 1] !== ' ') output.push(' ');
      [...symbol].forEach(character => output.push(character));
    });
    return output.join('').trimEnd();
  }

  setConnection(state) {
    const stale = this.lastReceivedAt && Date.now() - this.lastReceivedAt > CompanionView.STALE_AFTER_MS;
    const resolved = stale && state !== 'disconnected' ? 'stale' : state;
    const labels = { live: 'Live', waiting: 'Waiting', stale: 'Connection stale', disconnected: 'Disconnected' };
    this.elements.root.dataset.state = resolved;
    this.elements.connectionText.textContent = labels[resolved];
  }

  async toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) { /* Browser retains normal display mode. */ }
    this.syncFullscreenLabel();
  }

  syncFullscreenLabel() {
    this.elements.fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
  }

  async toggleWakeLock() {
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.wakeLock = null;
      this.elements.wakeButton.setAttribute('aria-pressed', 'false');
      this.elements.wakeButton.textContent = 'Keep awake';
      return;
    }
    await this.requestWakeLock();
  }

  async requestWakeLock() {
    try {
      if (!navigator.wakeLock?.request) throw new Error('Wake lock unavailable');
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
        this.elements.wakeButton.setAttribute('aria-pressed', 'false');
        this.elements.wakeButton.textContent = 'Keep awake';
      }, { once: true });
      this.elements.wakeButton.setAttribute('aria-pressed', 'true');
      this.elements.wakeButton.textContent = 'Awake';
    } catch (_) {
      this.elements.wakeButton.textContent = 'Wake unavailable';
    }
  }
}

if (typeof window !== 'undefined') {
  window.CompanionView = CompanionView;
  window.addEventListener('DOMContentLoaded', () => {
    window.companionView = new CompanionView();
    window.companionView.start();
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = CompanionView;
