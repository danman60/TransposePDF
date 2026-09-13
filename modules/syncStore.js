/** Offline-first team synchronization over injected Supabase and LibraryStore clients. */
class SyncStore {
  constructor({ client, library, teamId, clock = () => Date.now(), random = Math.random } = {}) {
    if (!client || !library) throw new Error('Supabase client and LibraryStore are required');
    this.client = client;
    this.library = library;
    this.teamId = String(teamId || '');
    this.clock = clock;
    this.random = random;
    this.draining = null;
  }

  setTeam(teamId) {
    this.teamId = String(teamId || '');
  }

  async enqueue(entityType, entityId, payload, { expectedRevision = 0, operation = 'upsert' } = {}) {
    this.validateEntity(entityType, operation);
    if (!this.teamId) throw new Error('teamId is required');
    const record = {
      id: this.createId(), teamId: this.teamId, entityType, entityId: String(entityId),
      payload: this.sanitize(payload || {}), expectedRevision: Number(expectedRevision) || 0,
      operation, status: 'pending', attempts: 0, nextAttemptAt: 0,
      createdAt: new Date(this.clock()).toISOString(), lastError: null
    };
    await this.library.putRecord('syncOutbox', record);
    return record;
  }

  async drain() {
    if (this.draining) return this.draining;
    this.draining = this.runDrain().finally(() => { this.draining = null; });
    return this.draining;
  }

  async runDrain() {
    if (!this.teamId) return { pushed: 0, conflicts: 0, deferred: 0 };
    const now = this.clock();
    const records = (await this.library.getAllRecords('syncOutbox'))
      .filter(item => item.teamId === this.teamId && item.status !== 'conflict' && Number(item.nextAttemptAt || 0) <= now)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const result = { pushed: 0, conflicts: 0, deferred: 0 };
    for (const record of records) {
      try {
        const response = await this.client.rpc('sync_upsert', {
          p_team_id: record.teamId, p_entity_type: record.entityType,
          p_entity_id: record.entityId, p_payload: record.payload,
          p_expected_revision: record.expectedRevision, p_operation: record.operation,
          p_operation_id: record.id
        });
        if (response.error) throw response.error;
        if (response.data?.conflict) {
          await this.recordConflict(record, response.data.remote);
          await this.library.deleteRecord('syncOutbox', record.id);
          result.conflicts += 1;
        } else {
          await this.library.deleteRecord('syncOutbox', record.id);
          result.pushed += 1;
        }
      } catch (error) {
        record.attempts = Number(record.attempts || 0) + 1;
        record.status = 'pending';
        record.lastError = String(error?.message || error).slice(0, 500);
        record.nextAttemptAt = now + this.backoff(record.attempts);
        await this.library.putRecord('syncOutbox', record);
        result.deferred += 1;
      }
    }
    return result;
  }

  async pull({ limit = 200 } = {}) {
    if (!this.teamId) return { applied: 0, cursor: 0 };
    const cursorKey = `syncCursor:${this.teamId}`;
    const cursorRecord = await this.library.getRecord('meta', cursorKey);
    let cursor = Number(cursorRecord?.value) || 0;
    const { data, error } = await this.client.rpc('sync_changes_since', {
      p_team_id: this.teamId, p_cursor: cursor, p_limit: Math.min(1000, Math.max(1, Number(limit) || 200))
    });
    if (error) throw error;
    let applied = 0;
    for (const change of data || []) {
      await this.applyRemote(change);
      cursor = Math.max(cursor, Number(change.sequence) || 0);
      applied += 1;
    }
    await this.library.putRecord('meta', { key: cursorKey, value: cursor });
    return { applied, cursor };
  }

  async applyRemote(change) {
    const stores = { song: 'songs', session: 'sessions', version: 'versions', correction: 'meta' };
    const store = stores[change.entity_type];
    if (!store) return;
    const id = String(change.entity_id);
    if (change.entity_type === 'correction') {
      await this.library.putRecord('meta', {
        key: `teamCorrection:${this.teamId}:${id}`, value: change.payload || {},
        remoteRevision: Number(change.revision) || 0, deletedAt: change.deleted_at || null
      });
      return;
    }
    const existing = await this.library.getRecord(store, id);
    if (existing?.syncState === 'dirty') {
      await this.recordConflict({ entityType: change.entity_type, entityId: id, payload: existing }, change);
      return;
    }
    const payload = this.sanitize(change.payload || {});
    const record = {
      ...payload, id, teamId: this.teamId, remoteRevision: Number(change.revision) || 0,
      syncState: 'synced', deletedAt: change.deleted_at || null
    };
    if (change.operation === 'delete') record.archivedAt = change.deleted_at || new Date(this.clock()).toISOString();
    await this.library.putRecord(store, record);
  }

  async recordConflict(local, remote) {
    const id = this.createId();
    const conflict = {
      key: `syncConflict:${id}`, id, teamId: this.teamId,
      entityType: local.entityType, entityId: local.entityId,
      local: this.sanitize(local.payload || {}), remote: this.sanitize(remote || {}),
      createdAt: new Date(this.clock()).toISOString(), status: 'unresolved'
    };
    await this.library.putRecord('meta', conflict);
    return conflict;
  }

  async conflicts() {
    return (await this.library.getAllRecords('meta'))
      .filter(item => String(item.key || '').startsWith('syncConflict:') && item.teamId === this.teamId && item.status === 'unresolved');
  }

  backoff(attempt) {
    const base = Math.min(300000, 1000 * (2 ** Math.min(8, Math.max(0, attempt - 1))));
    return Math.round(base * (0.8 + this.random() * 0.4));
  }

  validateEntity(entityType, operation) {
    if (!['song', 'session', 'version', 'correction'].includes(entityType)) throw new Error('Invalid sync entity type');
    if (!['upsert', 'delete'].includes(operation)) throw new Error('Invalid sync operation');
  }

  sanitize(value, depth = 0) {
    if (depth > 12) return null;
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return value.slice(0, 500000);
    if (Array.isArray(value)) return value.map(item => this.sanitize(item, depth + 1));
    if (!value || typeof value !== 'object') return null;
    const blocked = /(rawanalysis|transcript|authoritativelyrics|audio|pdf|blob|bytes|filepath|localpath|recordingfingerprint)/i;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [key, this.sanitize(item, depth + 1)]));
  }

  createId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return this.library.createId();
  }
}

if (typeof window !== 'undefined') window.SyncStore = SyncStore;
if (typeof module !== 'undefined' && module.exports) module.exports = SyncStore;
