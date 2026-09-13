/**
 * Offline-first persistence for canonical songs, live sessions, and recovery drafts.
 */
class LibraryStore {
  static DATABASE_NAME = 'transposepdf-library';
  static DATABASE_VERSION = 1;
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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open song library'));
      request.onblocked = () => reject(new Error('Song library upgrade is blocked by another tab'));
    });
    this.database.onversionchange = () => this.close();
    await this.ensureDefaultSession();
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

  async saveSong(song, { expectedRevision = null } = {}) {
    await this.open();
    const id = String(song?.id || this.createId());
    return this.runTransaction('songs', 'readwrite', async store => {
      const existing = await this.request(store.get(id));
      this.assertRevision(existing, expectedRevision, 'song', id);
      const now = new Date().toISOString();
      const record = {
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
      };
      await this.request(store.put(record));
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
    const transaction = this.database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const completed = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    });
    const result = await operation(store);
    await completed;
    return result;
  }
}

if (typeof window !== 'undefined') window.LibraryStore = LibraryStore;
if (typeof module !== 'undefined' && module.exports) module.exports = LibraryStore;
