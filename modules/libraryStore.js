/**
 * Offline-first persistence for canonical songs, live sessions, and recovery drafts.
 */
class LibraryStore {
  static DATABASE_NAME = 'transposepdf-library';
  static DATABASE_VERSION = 2;
  static DEFAULT_SESSION_ID = 'default-session';

  constructor(indexedDBFactory = typeof indexedDB !== 'undefined' ? indexedDB : null) {
    this.indexedDB = indexedDBFactory;
    this.database = null;
  }

  async open() {
    if (this.database) return this.database;
    if (!this.indexedDB) throw new Error('IndexedDB is not available');
    this.database = await new Promise((resolve, reject) => {
      const request = this.indexedDB.open(LibraryStore.DATABASE_NAME, LibraryStore.DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const transaction = request.transaction;
        if (!database.objectStoreNames.contains('songs')) {
          const songs = database.createObjectStore('songs', { keyPath: 'id' });
          songs.createIndex('updatedAt', 'updatedAt');
          songs.createIndex('archivedAt', 'archivedAt');
        }
        if (!database.objectStoreNames.contains('sessions')) {
          const sessions = database.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('updatedAt', 'updatedAt');
        }
        if (!database.objectStoreNames.contains('drafts')) {
          const drafts = database.createObjectStore('drafts', { keyPath: 'id' });
          drafts.createIndex('savedAt', 'savedAt');
          drafts.createIndex('entityId', 'entityId');
        }
        if (!database.objectStoreNames.contains('versions')) {
          const versions = database.createObjectStore('versions', { keyPath: 'id' });
          versions.createIndex('songId', 'songId');
          versions.createIndex('createdAt', 'createdAt');
          versions.createIndex('songIdCreatedAt', ['songId', 'createdAt']);
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains('syncOutbox')) {
          const outbox = database.createObjectStore('syncOutbox', { keyPath: 'id' });
          outbox.createIndex('createdAt', 'createdAt');
          outbox.createIndex('status', 'status');
        }
        const songs = transaction.objectStore('songs');
        if (!songs.indexNames.contains('searchText')) songs.createIndex('searchText', 'searchText');
        if (!songs.indexNames.contains('titleNormalized')) songs.createIndex('titleNormalized', 'titleNormalized');
        if (!songs.indexNames.contains('artistNormalized')) songs.createIndex('artistNormalized', 'artistNormalized');
        if (request.oldVersion === 1) {
          songs.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) return;
            cursor.update(this.withSearchFields(cursor.value));
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open song library'));
      request.onblocked = () => reject(new Error('Song library upgrade is blocked by another tab'));
    });
    this.database.onversionchange = () => this.close();
    await this.ensureDefaultSession();
    await this.ensureActiveSession();
    return this.database;
  }

  close() {
    this.database?.close();
    this.database = null;
  }

  createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  sanitizeSong(song) {
    const output = this.clone(song || {});
    output.id = String(output.id || this.createId());
    output.source = this.sanitizeSource(output.source);
    delete output.file;
    delete output.audio;
    delete output.audioBlob;
    delete output.pdf;
    delete output.pdfBlob;
    return output;
  }

  sanitizeSource(source) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const blocked = /^(rawAnalysis|transcript|transcriptText|authoritativeLyrics|audio|audioBlob|audioBytes|pdf|pdfBlob|pdfBytes|path|filePath|localPath|jobId|recordingFingerprint)$/i;
    const safe = {};
    Object.entries(source).forEach(([key, value]) => {
      if (blocked.test(key) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)
        || (typeof Blob !== 'undefined' && value instanceof Blob)) return;
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) safe[key] = value.map(item => this.sanitizeNested(item));
        else safe[key] = this.sanitizeNested(value);
      } else {
        safe[key] = value;
      }
    });
    return safe;
  }

  sanitizeNested(value) {
    if (!value || typeof value !== 'object') return value;
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)
      || (typeof Blob !== 'undefined' && value instanceof Blob)) return undefined;
    if (Array.isArray(value)) return value.map(item => this.sanitizeNested(item)).filter(item => item !== undefined);
    const output = {};
    const blocked = /(transcript|authoritativeLyrics|audio|pdf|blob|bytes|path|jobId)/i;
    Object.entries(value).forEach(([key, item]) => {
      if (blocked.test(key)) return;
      const sanitized = this.sanitizeNested(item);
      if (sanitized !== undefined) output[key] = sanitized;
    });
    return output;
  }

  normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  }

  withSearchFields(record) {
    const copy = { ...record };
    copy.titleNormalized = this.normalizeSearch(record?.song?.title);
    copy.artistNormalized = this.normalizeSearch(record?.song?.artist);
    copy.keyNormalized = this.normalizeSearch(record?.song?.originalKey || record?.song?.key);
    copy.searchText = [copy.titleNormalized, copy.artistNormalized, copy.keyNormalized]
      .filter(Boolean).join(' ');
    return copy;
  }

  async saveSong(song, {
    expectedRevision = null, checkpoint = false, checkpointLabel = '', checkpointReason = 'save'
  } = {}) {
    await this.open();
    const id = String(song?.id || this.createId());
    const storeNames = checkpoint ? ['songs', 'versions'] : 'songs';
    return this.runTransaction(storeNames, 'readwrite', async stores => {
      const songStore = checkpoint ? stores.songs : stores;
      const existing = await this.request(songStore.get(id));
      this.assertRevision(existing, expectedRevision, 'song', id);
      const now = new Date().toISOString();
      const record = this.withSearchFields({
        id,
        schemaVersion: 1,
        song: this.sanitizeSong({ ...song, id }),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        revision: (existing?.revision || 0) + 1,
        archivedAt: existing?.archivedAt || null,
        sourceSummary: {
          type: song?.sourceType || 'manual',
          importedAt: existing?.sourceSummary?.importedAt || now
        }
      });
      await this.request(songStore.put(record));
      if (checkpoint) {
        await this.writeVersion(stores.versions, record, checkpointLabel, checkpointReason);
        await this.pruneAutomaticVersions(stores.versions, id);
      }
      return this.clone(record);
    });
  }

  async getSong(id) {
    return this.getRecord('songs', String(id));
  }

  async listSongs({ includeArchived = false } = {}) {
    const records = await this.getAllRecords('songs');
    return records
      .filter(record => includeArchived || !record.archivedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  listLibrary(options = {}) {
    return this.listSongs(options);
  }

  async searchSongs(query, { includeArchived = false, limit = 100 } = {}) {
    const tokens = this.normalizeSearch(query).split(' ').filter(Boolean);
    const records = await this.listSongs({ includeArchived });
    if (!tokens.length) return records.slice(0, limit);
    return records.filter(record => {
      const haystack = record.searchText || this.withSearchFields(record).searchText;
      return tokens.every(token => haystack.includes(token));
    }).slice(0, Math.max(0, Number(limit) || 0));
  }

  searchLibrary(query, options = {}) {
    return this.searchSongs(query, options);
  }

  async archiveSong(id, { expectedRevision = null } = {}) {
    await this.open();
    return this.runTransaction('songs', 'readwrite', async store => {
      const record = await this.request(store.get(String(id)));
      if (!record) return null;
      this.assertRevision(record, expectedRevision, 'song', String(id));
      record.archivedAt = new Date().toISOString();
      record.updatedAt = record.archivedAt;
      record.revision += 1;
      await this.request(store.put(record));
      return this.clone(record);
    });
  }

  async ensureDefaultSession() {
    if (!this.database) return null;
    return this.runTransaction('sessions', 'readwrite', async store => {
      const existing = await this.request(store.get(LibraryStore.DEFAULT_SESSION_ID));
      if (existing) return this.clone(existing);
      const now = new Date().toISOString();
      const session = {
        id: LibraryStore.DEFAULT_SESSION_ID,
        schemaVersion: 1,
        name: 'Current Session',
        items: [],
        activeItemId: null,
        createdAt: now,
        updatedAt: now,
        revision: 1
      };
      await this.request(store.add(session));
      return this.clone(session);
    });
  }

  async ensureActiveSession() {
    if (!this.database) return LibraryStore.DEFAULT_SESSION_ID;
    return this.runTransaction('meta', 'readwrite', async store => {
      const existing = await this.request(store.get('activeSessionId'));
      if (existing?.value) return String(existing.value);
      await this.request(store.put({ key: 'activeSessionId', value: LibraryStore.DEFAULT_SESSION_ID }));
      return LibraryStore.DEFAULT_SESSION_ID;
    });
  }

  async getActiveSessionId() {
    await this.open();
    const record = await this.getRecord('meta', 'activeSessionId');
    return String(record?.value || LibraryStore.DEFAULT_SESSION_ID);
  }

  async setActiveSessionId(sessionId) {
    await this.open();
    const id = String(sessionId);
    return this.runTransaction(['sessions', 'meta'], 'readwrite', async stores => {
      const session = await this.request(stores.sessions.get(id));
      if (!session) throw new Error(`Session ${id} does not exist`);
      await this.request(stores.meta.put({ key: 'activeSessionId', value: id }));
      return id;
    });
  }

  async saveSession(session, { expectedRevision = null } = {}) {
    await this.open();
    const id = String(session?.id || this.createId());
    return this.runTransaction('sessions', 'readwrite', async store => {
      const existing = await this.request(store.get(id));
      this.assertRevision(existing, expectedRevision, 'session', id);
      const now = new Date().toISOString();
      const items = (session?.items || []).map((item, position) => ({
        id: String(item.id || this.createId()),
        songId: String(item.songId),
        position,
        transpose: Number(item.transpose) || 0,
        spellingPolicy: item.spellingPolicy || 'contextual',
        view: this.sanitizeNested(this.clone(item.view || {}))
      }));
      const activeItemId = items.some(item => item.id === session?.activeItemId)
        ? session.activeItemId
        : (items[0]?.id || null);
      const record = {
        id,
        schemaVersion: 1,
        name: String(session?.name || 'Untitled Session'),
        items,
        activeItemId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        revision: (existing?.revision || 0) + 1
      };
      await this.request(store.put(record));
      return this.clone(record);
    });
  }

  async getSession(id = LibraryStore.DEFAULT_SESSION_ID) {
    return this.getRecord('sessions', String(id));
  }

  async listSessions() {
    const sessions = await this.getAllRecords('sessions');
    return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async createSession(name = 'Untitled Session') {
    const saved = await this.saveSession({
      id: this.createId(), name: String(name).trim() || 'Untitled Session', items: [], activeItemId: null
    }, { expectedRevision: 0 });
    await this.setActiveSessionId(saved.id);
    return saved;
  }

  async selectSession(sessionId) {
    const id = await this.setActiveSessionId(sessionId);
    return this.getSession(id);
  }

  async duplicateSession(sessionId, { name = null, activate = true } = {}) {
    const source = await this.getSession(sessionId);
    if (!source) throw new Error(`Session ${sessionId} does not exist`);
    const items = source.items.map(item => ({ ...this.clone(item), id: this.createId() }));
    const activeIndex = source.items.findIndex(item => item.id === source.activeItemId);
    const saved = await this.saveSession({
      id: this.createId(),
      name: String(name || `${source.name} Copy`),
      items,
      activeItemId: items[activeIndex]?.id || items[0]?.id || null
    }, { expectedRevision: 0 });
    if (activate) await this.setActiveSessionId(saved.id);
    return saved;
  }

  async deleteSession(sessionId, { expectedRevision = null } = {}) {
    await this.open();
    const id = String(sessionId);
    return this.runTransaction(['sessions', 'meta'], 'readwrite', async stores => {
      const sessions = await this.request(stores.sessions.getAll());
      const target = sessions.find(session => session.id === id);
      if (!target) return false;
      this.assertRevision(target, expectedRevision, 'session', id);
      if (sessions.length === 1) throw new Error('Cannot delete the only session');
      await this.request(stores.sessions.delete(id));
      const pointer = await this.request(stores.meta.get('activeSessionId'));
      if (pointer?.value === id) {
        const fallback = sessions.filter(session => session.id !== id)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
        await this.request(stores.meta.put({ key: 'activeSessionId', value: fallback.id }));
      }
      return true;
    });
  }

  async addExistingSong(sessionId, songId, options = {}) {
    const [session, song] = await Promise.all([this.getSession(sessionId), this.getSong(songId)]);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);
    if (!song || song.archivedAt) throw new Error(`Song ${songId} does not exist`);
    const item = {
      id: this.createId(), songId: String(songId),
      transpose: Number(options.transpose) || 0,
      spellingPolicy: options.spellingPolicy || 'contextual',
      view: this.clone(options.view || {})
    };
    const draft = this.clone(session);
    draft.items.push(item);
    if (options.activate !== false) draft.activeItemId = item.id;
    const saved = await this.saveSession(draft, { expectedRevision: session.revision });
    return { session: saved, item: this.clone(saved.items.find(entry => entry.id === item.id)) };
  }

  addLibrarySongToSession(sessionId, songId, options = {}) {
    return this.addExistingSong(sessionId, songId, options);
  }

  async listSongVersions(songId) {
    const records = await this.getAllRecords('versions');
    return records.filter(version => version.songId === String(songId))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)
        || right.revision - left.revision);
  }

  async labelSongVersion(versionId, label) {
    await this.open();
    return this.runTransaction('versions', 'readwrite', async store => {
      const version = await this.request(store.get(String(versionId)));
      if (!version) throw new Error(`Song version ${versionId} does not exist`);
      version.label = String(label || '').trim();
      version.named = Boolean(version.label);
      await this.request(store.put(version));
      if (!version.named) await this.pruneAutomaticVersions(store, version.songId);
      return this.clone(version);
    });
  }

  async restoreSongVersion(versionId, { expectedRevision = null, label = '' } = {}) {
    await this.open();
    const id = String(versionId);
    return this.runTransaction(['songs', 'versions'], 'readwrite', async stores => {
      const version = await this.request(stores.versions.get(id));
      if (!version) throw new Error(`Song version ${id} does not exist`);
      const existing = await this.request(stores.songs.get(version.songId));
      if (!existing) throw new Error(`Song ${version.songId} does not exist`);
      this.assertRevision(existing, expectedRevision, 'song', version.songId);
      const now = new Date().toISOString();
      const record = this.withSearchFields({
        ...existing,
        song: this.sanitizeSong({ ...this.clone(version.song), id: version.songId }),
        updatedAt: now,
        revision: existing.revision + 1
      });
      await this.request(stores.songs.put(record));
      await this.writeVersion(stores.versions, record, String(label || '').trim(), 'restore');
      await this.pruneAutomaticVersions(stores.versions, version.songId);
      return this.clone(record);
    });
  }

  async writeVersion(store, songRecord, label = '', reason = 'save') {
    const cleanLabel = String(label || '').trim();
    const version = {
      id: this.createId(),
      schemaVersion: 1,
      songId: songRecord.id,
      revision: songRecord.revision,
      song: this.clone(songRecord.song),
      label: cleanLabel,
      named: Boolean(cleanLabel),
      reason: String(reason || 'save'),
      createdAt: songRecord.updatedAt || new Date().toISOString()
    };
    await this.request(store.add(version));
    return version;
  }

  async pruneAutomaticVersions(store, songId) {
    const versions = (await this.request(store.getAll()))
      .filter(version => version.songId === String(songId) && !version.named)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)
        || right.revision - left.revision);
    await Promise.all(versions.slice(50).map(version => this.request(store.delete(version.id))));
  }

  async saveDraft(entityId, editor, { baseRevision = 0, id = null } = {}) {
    await this.open();
    const draftId = id || `song:${entityId}`;
    const record = {
      id: String(draftId),
      schemaVersion: 1,
      entityId: String(entityId),
      entityType: 'song',
      baseRevision: Number(baseRevision) || 0,
      editor: this.sanitizeNested(this.clone(editor || {})),
      savedAt: new Date().toISOString()
    };
    await this.putRecord('drafts', record);
    return this.clone(record);
  }

  async getDraft(entityId) {
    await this.open();
    const direct = await this.getRecord('drafts', `song:${entityId}`);
    if (direct) return direct;
    const drafts = await this.getAllRecords('drafts');
    return drafts.find(draft => draft.entityId === String(entityId)) || null;
  }

  async listDrafts() {
    const drafts = await this.getAllRecords('drafts');
    return drafts.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  async deleteDraft(entityId) {
    await this.open();
    const draft = await this.getDraft(entityId);
    if (!draft) return false;
    await this.deleteRecord('drafts', draft.id);
    return true;
  }

  async getRecoverableDraft(entityId) {
    const [draft, song] = await Promise.all([this.getDraft(entityId), this.getSong(entityId)]);
    if (!draft) return null;
    if (!song) return draft;
    return draft.baseRevision >= song.revision && draft.savedAt > song.updatedAt ? draft : null;
  }

  assertRevision(existing, expectedRevision, entityType, id) {
    if (expectedRevision === null || expectedRevision === undefined) return;
    const actual = existing?.revision || 0;
    if (actual === expectedRevision) return;
    const error = new Error(`${entityType} ${id} changed in another tab`);
    error.name = 'ConflictError';
    error.expectedRevision = expectedRevision;
    error.actualRevision = actual;
    throw error;
  }

  async getRecord(storeName, id) {
    await this.open();
    return this.runTransaction(storeName, 'readonly', async store => {
      const value = await this.request(store.get(id));
      return value ? this.clone(value) : null;
    });
  }

  async getAllRecords(storeName) {
    await this.open();
    return this.runTransaction(storeName, 'readonly', async store => {
      const values = await this.request(store.getAll());
      return this.clone(values);
    });
  }

  async putRecord(storeName, value) {
    await this.open();
    return this.runTransaction(storeName, 'readwrite', async store => {
      await this.request(store.put(value));
      return value;
    });
  }

  async deleteRecord(storeName, id) {
    await this.open();
    return this.runTransaction(storeName, 'readwrite', async store => {
      await this.request(store.delete(id));
      return true;
    });
  }

  request(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  async runTransaction(storeName, mode, operation) {
    const names = Array.isArray(storeName) ? storeName : [storeName];
    const transaction = this.database.transaction(names, mode);
    const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]));
    const argument = Array.isArray(storeName) ? stores : stores[names[0]];
    const completed = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
    try {
      const result = await operation(argument, transaction);
      await completed;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch (_) { /* Transaction already completed or aborted. */ }
      try { await completed; } catch (_) { /* Preserve the operation error. */ }
      throw error;
    }
  }
}

if (typeof window !== 'undefined') window.LibraryStore = LibraryStore;
if (typeof module !== 'undefined' && module.exports) module.exports = LibraryStore;
