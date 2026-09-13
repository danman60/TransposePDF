/**
 * Authoritative serialized session state over LibraryStore.
 * UI consumers read hydratedSongs/currentSong and issue commands through this facade.
 */
class SessionStore {
  constructor(options = {}) {
    this.library = options.libraryStore || new LibraryStore();
    this.songModel = options.songModel || SongModel;
    this.musicTheory = options.musicTheory || new MusicTheory();
    this.activeSession = null;
    this.songRecords = new Map();
    this.hydratedSongs = [];
    this.lastConflict = null;
    this.listeners = new Set();
    this.commandTail = Promise.resolve();
  }

  get songs() {
    return this.hydratedSongs;
  }

  get currentSong() {
    if (!this.activeSession) return null;
    const active = this.activeSession.items.find(item => item.id === this.activeSession.activeItemId);
    return active ? this.hydratedSongs.find(song => song.sessionItemId === active.id) || null : null;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('SessionStore listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(type, detail = {}) {
    const snapshot = this.snapshot();
    this.listeners.forEach(listener => listener({ type, detail, snapshot }));
  }

  snapshot() {
    return {
      activeSession: this.activeSession ? this.library.clone(this.activeSession) : null,
      songs: this.hydratedSongs.map(song => this.songModel.create(song)),
      conflict: this.lastConflict ? { ...this.lastConflict } : null
    };
  }

  serialize(command) {
    const execution = this.commandTail.then(() => command());
    this.commandTail = execution.catch(() => undefined);
    return execution;
  }

  async hydrate(sessionId = LibraryStore.DEFAULT_SESSION_ID) {
    return this.serialize(async () => this.hydrateNow(sessionId));
  }

  async hydrateNow(sessionId = LibraryStore.DEFAULT_SESSION_ID) {
    await this.library.open();
    const session = await this.library.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);
    const records = await Promise.all(session.items.map(item => this.library.getSong(item.songId)));
    this.activeSession = session;
    this.songRecords.clear();
    records.filter(Boolean).forEach(record => this.songRecords.set(record.id, record));
    this.rebuildHydratedSongs();
    this.lastConflict = null;
    this.notify('hydrated', { sessionId: session.id });
    return this.snapshot();
  }

  rebuildHydratedSongs() {
    if (!this.activeSession) {
      this.hydratedSongs = [];
      return;
    }
    this.hydratedSongs = this.activeSession.items.flatMap(item => {
      const record = this.songRecords.get(item.songId);
      if (!record || record.archivedAt) return [];
      const song = this.songModel.create(record.song);
      song.transposition = Number(item.transpose) || 0;
      song.spellingPolicy = item.spellingPolicy || 'contextual';
      song.currentKey = this.musicTheory.transposeKey
        ? this.musicTheory.transposeKey(song.originalKey, song.transposition, song.spellingPolicy)
        : this.musicTheory.transposeChord(song.originalKey, song.transposition);
      song.sessionView = this.library.clone(item.view || {});
      song.sessionItemId = item.id;
      song.libraryRevision = record.revision;
      return [song];
    });
  }

  createSession(name = 'Untitled Session') {
    return this.serialize(async () => {
      const saved = await this.library.saveSession({
        id: this.library.createId(), name: String(name).trim() || 'Untitled Session', items: [], activeItemId: null
      }, { expectedRevision: 0 });
      this.activeSession = saved;
      this.songRecords.clear();
      this.rebuildHydratedSongs();
      this.notify('session.created', { sessionId: saved.id });
      return this.snapshot();
    });
  }

  selectSession(sessionId) {
    return this.hydrate(sessionId);
  }

  renameSession(name) {
    return this.mutateSession('session.renamed', session => {
      session.name = String(name).trim() || 'Untitled Session';
    });
  }

  addSong(song, options = {}) {
    return this.serialize(async () => {
      this.requireSession();
      const normalized = this.songModel.create(song);
      if (!normalized.id || this.songRecords.has(String(normalized.id))) normalized.id = this.library.createId();
      normalized.id = String(normalized.id);
      const songRecord = await this.executeWithConflict('song', normalized.id, () =>
        this.library.saveSong(normalized, { expectedRevision: options.expectedRevision ?? 0 }));
      this.songRecords.set(songRecord.id, songRecord);
      const item = {
        id: this.library.createId(), songId: songRecord.id,
        transpose: Number(options.transpose) || 0,
        spellingPolicy: options.spellingPolicy || normalized.spellingPolicy || 'contextual',
        view: this.library.clone(options.view || {})
      };
      const draft = this.library.clone(this.activeSession);
      draft.items.push(item);
      draft.activeItemId = options.activate === false ? draft.activeItemId : item.id;
      await this.saveActiveSession(draft);
      this.rebuildHydratedSongs();
      this.notify('song.added', { songId: songRecord.id, itemId: item.id });
      return this.songModel.create(this.hydratedSongs.find(entry => String(entry.id) === songRecord.id));
    });
  }

  commitSong(song, options = {}) {
    return this.serialize(async () => {
      this.requireSession();
      const id = String(song?.id || '');
      const existing = this.songRecords.get(id);
      if (!existing) throw new Error(`Song ${id} is not loaded in the active session`);
      const record = await this.executeWithConflict('song', id, () => this.library.saveSong(
        this.songModel.create({ ...song, id }),
        { expectedRevision: options.expectedRevision ?? existing.revision }
      ));
      this.songRecords.set(id, record);
      this.rebuildHydratedSongs();
      this.notify('song.committed', { songId: id, revision: record.revision });
      return this.songModel.create(this.hydratedSongs.find(entry => String(entry.id) === id));
    });
  }

  selectSong(songOrItemId) {
    return this.mutateSession('song.selected', session => {
      const id = String(songOrItemId);
      const item = session.items.find(entry => entry.id === id || entry.songId === id);
      if (!item) throw new Error(`Song ${id} is not in the active session`);
      session.activeItemId = item.id;
    });
  }

  removeSong(songOrItemId) {
    return this.mutateSession('song.removed', session => {
      const id = String(songOrItemId);
      const index = session.items.findIndex(item => item.id === id || item.songId === id);
      if (index < 0) throw new Error(`Song ${id} is not in the active session`);
      const [removed] = session.items.splice(index, 1);
      if (session.activeItemId === removed.id) {
        session.activeItemId = session.items[Math.min(index, session.items.length - 1)]?.id || null;
      }
    });
  }

  reorderSong(songOrItemId, destinationIndex) {
    return this.mutateSession('song.reordered', session => {
      const id = String(songOrItemId);
      const from = session.items.findIndex(item => item.id === id || item.songId === id);
      if (from < 0) throw new Error(`Song ${id} is not in the active session`);
      const target = Math.max(0, Math.min(session.items.length - 1, Number(destinationIndex) || 0));
      const [item] = session.items.splice(from, 1);
      session.items.splice(target, 0, item);
    });
  }

  updateSongOverrides(songOrItemId, overrides = {}) {
    return this.mutateSession('song.overrides.updated', session => {
      const id = String(songOrItemId);
      const item = session.items.find(entry => entry.id === id || entry.songId === id);
      if (!item) throw new Error(`Song ${id} is not in the active session`);
      if (overrides.transpose !== undefined) item.transpose = Number(overrides.transpose) || 0;
      if (overrides.spellingPolicy !== undefined) {
        const allowed = ['contextual', 'flats', 'sharps', 'preserve'];
        if (!allowed.includes(overrides.spellingPolicy)) throw new Error('Invalid spelling policy');
        item.spellingPolicy = overrides.spellingPolicy;
      }
      if (overrides.view !== undefined) item.view = this.library.clone(overrides.view || {});
    });
  }

  mutateSession(eventType, mutation) {
    return this.serialize(async () => {
      this.requireSession();
      const draft = this.library.clone(this.activeSession);
      mutation(draft);
      await this.saveActiveSession(draft);
      this.rebuildHydratedSongs();
      this.notify(eventType);
      return this.snapshot();
    });
  }

  async saveActiveSession(draft) {
    const expectedRevision = this.activeSession.revision;
    const saved = await this.executeWithConflict('session', draft.id, () =>
      this.library.saveSession(draft, { expectedRevision }));
    this.activeSession = saved;
    this.lastConflict = null;
    return saved;
  }

  async executeWithConflict(entityType, id, operation) {
    try {
      return await operation();
    } catch (error) {
      if (error?.name !== 'ConflictError') throw error;
      this.lastConflict = {
        entityType, id: String(id), expectedRevision: error.expectedRevision,
        actualRevision: error.actualRevision, message: error.message
      };
      this.notify('conflict', this.lastConflict);
      throw error;
    }
  }

  requireSession() {
    if (!this.activeSession) throw new Error('Hydrate or create a session before issuing commands');
  }
}

if (typeof window !== 'undefined') window.SessionStore = SessionStore;
if (typeof module !== 'undefined' && module.exports) module.exports = SessionStore;
