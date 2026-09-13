/** Local-only semantic telemetry for following an active TransposePDF session. */
class SessionTelemetry {
  static SESSION_KEY = 'transposepdf.telemetry-session.v1';

  constructor(options = {}) {
    this.endpoint = options.endpoint || '/api/telemetry/events';
    this.sessionId = options.sessionId || this.getSessionId();
    this.screen = 'start';
    this.sequence = 0;
    this.queue = [];
    this.snapshot = null;
    this.flushTimer = null;
    this.snapshotRevision = 0;
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flush({ beacon: true }));
    }
  }

  getSessionId() {
    try {
      let value = window.sessionStorage.getItem(SessionTelemetry.SESSION_KEY);
      if (!value) {
        value = crypto.randomUUID();
        window.sessionStorage.setItem(SessionTelemetry.SESSION_KEY, value);
      }
      return value;
    } catch (_) {
      return typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000';
    }
  }

  emit(eventType, data = {}, context = {}) {
    this.queue.push({
      schemaVersion: 1,
      clientSeq: ++this.sequence,
      occurredAt: new Date().toISOString(),
      eventType,
      screen: context.screen || this.screen,
      songId: context.songId || null,
      sourceType: context.sourceType || null,
      sourceId: context.sourceId || null,
      data: this.clean(data)
    });
    if (this.queue.length >= 10) this.flush();
    else this.scheduleFlush();
  }

  setScreen(screen, data = {}) {
    if (screen === this.screen) return;
    const previous = this.screen;
    this.screen = screen;
    this.emit('screen.changed', { from: previous, to: screen, ...data }, { screen });
  }

  updateSnapshot(snapshot) {
    this.snapshotRevision += 1;
    this.snapshot = this.cleanSnapshot({
      ...snapshot,
      schemaVersion: 1,
      sessionId: this.sessionId,
      screen: snapshot.screen || this.screen,
      clientRevision: this.snapshotRevision,
      updatedAt: new Date().toISOString()
    });
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 500);
  }

  async flush(options = {}) {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.queue.length && !this.snapshot) return;
    const events = this.queue.splice(0);
    const snapshot = this.snapshot;
    this.snapshot = null;
    const body = JSON.stringify({ sessionId: this.sessionId, events, snapshot });
    try {
      if (options.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        if (navigator.sendBeacon(this.endpoint, new Blob([body], { type: 'application/json' }))) return;
      }
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      });
      if (!response.ok) throw new Error(`Telemetry ${response.status}`);
    } catch (_) {
      // Observability must never interrupt editing, importing, or exporting.
    }
  }

  cleanSnapshot(snapshot) {
    const cleanSong = song => ({
      telemetryId: song.telemetryId || null,
      title: song.title || '',
      sourceType: song.sourceType || null,
      originalKey: song.originalKey || '',
      currentKey: song.currentKey || '',
      transposition: Number(song.transposition) || 0,
      sections: (song.sections || []).map(section => ({
        id: section.id || null,
        type: section.type || 'section',
        label: section.label || '',
        lines: (section.lines || []).map(line => ({
          id: line.id || null,
          lyrics: line.lyrics || '',
          startTime: line.startTime ?? null,
          endTime: line.endTime ?? null,
          chords: (line.chords || []).map(chord => ({
            id: chord.id || null,
            symbol: chord.symbol || '',
            characterOffset: Number(chord.characterOffset) || 0,
            timestamp: chord.timestamp ?? null
          }))
        }))
      }))
    });
    return this.clean({
      schemaVersion: 1,
      sessionId: snapshot.sessionId,
      updatedAt: snapshot.updatedAt,
      clientRevision: snapshot.clientRevision,
      screen: snapshot.screen,
      activeSongId: snapshot.activeSongId || null,
      activeJob: snapshot.activeJob || null,
      currentSongs: (snapshot.currentSongs || []).map(cleanSong),
      editor: snapshot.editor || null,
      lastError: snapshot.lastError || null
    });
  }

  clean(value, depth = 0) {
    if (depth > 12 || value === undefined) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 2000);
    if (Array.isArray(value)) return value.slice(0, 1000).map(item => this.clean(item, depth + 1));
    if (typeof value === 'object') {
      const forbidden = new Set(['rawAnalysis', 'transcriptText', 'authoritativeLyrics', 'textItems', 'audio', 'pdf', 'path', 'bytes', 'stack']);
      return Object.fromEntries(Object.entries(value).slice(0, 500)
        .filter(([key]) => !forbidden.has(key))
        .map(([key, item]) => [key.slice(0, 80), this.clean(item, depth + 1)]));
    }
    return String(value).slice(0, 2000);
  }
}

if (typeof window !== 'undefined') window.SessionTelemetry = SessionTelemetry;
if (typeof module !== 'undefined' && module.exports) module.exports = SessionTelemetry;
