/**
 * UI Controller Module
 * Manages user interface state, interactions, and updates
 */

class UIController {
  constructor() {
    this.currentSongs = [];
    this.isProcessing = false;
    this.currentFile = null;
    this.exportFilename = 'Transposed Songbook';
    this.editingSongId = null;
    this.audioAbortController = null;
    this.audioJobId = null;
    this.correctionMemory = new ChordCorrectionMemory();
    this.authorDrag = null;
    this.selectedAuthorChord = null;
    this.authorTimingOverrides = new Map();
    this.authorDraft = null;
    this.authorPointerDrag = null;
    this.lastFocusedElement = null;
    this.libraryStore = typeof LibraryStore !== 'undefined' ? new LibraryStore() : null;
    this.sessionStore = this.libraryStore && typeof SessionStore !== 'undefined'
      ? new SessionStore({ libraryStore: this.libraryStore }) : null;
    this.telemetry = typeof SessionTelemetry !== 'undefined' ? new SessionTelemetry() : null;
    this.activeSession = null;
    this.activeSongId = null;
    this.songRevisions = new Map();
    this.autosaveTimer = null;
    this.pendingRecoveryDraft = null;
    this.authorDraftPersistentId = null;
    this.sessionSaveQueue = Promise.resolve();
    this.pendingTranspose = new Map();
    
    // Initialize UI elements
    this.initializeElements();
    this.attachEventListeners();
    this.initializeDragAndDrop();
    this.ready = this.initializePersistence();
  }

  /**
   * Initialize UI element references
   */
  initializeElements() {
    this.elements = {
      // File upload
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput'),
      uploadProgress: document.getElementById('uploadProgress'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
      uploadProgressTrack: document.getElementById('uploadProgressTrack'),
      
      // Sections
      startSection: document.getElementById('startSection'),
      authorSection: document.getElementById('authorSection'),
      audioSection: document.getElementById('audioSection'),
      uploadSection: document.getElementById('uploadSection'),
      songsSection: document.getElementById('songsSection'),
      exportSection: document.getElementById('exportSection'),
      
      // Songs
      songCount: document.getElementById('songCount'),
      songsContainer: document.getElementById('songsContainer'),
      songSelectorList: document.getElementById('songSelectorList'),
      activeSongSelect: document.getElementById('activeSongSelect'),
      librarySongCount: document.getElementById('librarySongCount'),
      sessionName: document.getElementById('sessionName'),
      sessionSelect: document.getElementById('sessionSelect'),
      newSessionButton: document.getElementById('newSessionButton'),
      duplicateSessionButton: document.getElementById('duplicateSessionButton'),
      deleteSessionButton: document.getElementById('deleteSessionButton'),
      sessionSaveState: document.getElementById('sessionSaveState'),
      recoveryBanner: document.getElementById('recoveryBanner'),
      recoveryMessage: document.getElementById('recoveryMessage'),
      restoreDraftButton: document.getElementById('restoreDraftButton'),
      discardDraftButton: document.getElementById('discardDraftButton'),
      librarySearch: document.getElementById('librarySearch'),
      librarySearchResults: document.getElementById('librarySearchResults'),
      historyDrawer: document.getElementById('historyDrawer'),
      historyList: document.getElementById('historyList'),
      historyPreview: document.getElementById('historyPreview'),
      closeHistoryButton: document.getElementById('closeHistoryButton'),

      // Authoring
      createChartButton: document.getElementById('createChartButton'),
      importPdfButton: document.getElementById('importPdfButton'),
      importChordProButton: document.getElementById('importChordProButton'),
      chordProFileInput: document.getElementById('chordProFileInput'),
      cancelImportButton: document.getElementById('cancelImportButton'),
      cancelAuthorButton: document.getElementById('cancelAuthorButton'),
      saveChartButton: document.getElementById('saveChartButton'),
      authorHeading: document.getElementById('authorHeading'),
      authorTitle: document.getElementById('authorTitle'),
      authorKey: document.getElementById('authorKey'),
      authorContent: document.getElementById('authorContent'),
      authorPreview: document.getElementById('authorPreview'),
      authorPreviewStatus: document.getElementById('authorPreviewStatus'),
      chordEditBar: document.getElementById('chordEditBar'),
      selectedChordLabel: document.getElementById('selectedChordLabel'),
      chordTimingInput: document.getElementById('chordTimingInput'),
      authorAnnouncement: document.getElementById('authorAnnouncement'),
      authorSourceTab: document.getElementById('authorSourceTab'),
      authorPreviewTab: document.getElementById('authorPreviewTab'),
      authorSourcePane: document.getElementById('authorSourcePane'),
      authorPreviewPane: document.getElementById('authorPreviewPane'),
      importAudioButton: document.getElementById('importAudioButton'),
      cancelAudioButton: document.getElementById('cancelAudioButton'),
      audioFileButton: document.getElementById('audioFileButton'),
      audioFileInput: document.getElementById('audioFileInput'),
      audioJob: document.getElementById('audioJob'),
      audioJobStage: document.getElementById('audioJobStage'),
      audioJobPercent: document.getElementById('audioJobPercent'),
      audioJobProgress: document.getElementById('audioJobProgress'),
      audioJobProgressTrack: document.getElementById('audioJobProgressTrack'),
      audioJobMessage: document.getElementById('audioJobMessage'),
      audioLyricsInput: document.getElementById('audioLyricsInput'),
      lyricsFileInput: document.getElementById('lyricsFileInput'),
      lyricsFileButton: document.getElementById('lyricsFileButton'),
      lyricsSourceStatus: document.getElementById('lyricsSourceStatus'),
      
      // Export
      exportButton: document.getElementById('exportButton'),
      exportFilename: document.getElementById('exportFilename'),
      exportFinalButton: document.getElementById('exportFinalButton'),
      exportChordProButton: document.getElementById('exportChordProButton'),
      exportProgress: document.getElementById('exportProgress'),
      exportProgressFill: document.getElementById('exportProgressFill'),
      exportProgressText: document.getElementById('exportProgressText'),
      exportProgressTrack: document.getElementById('exportProgressTrack'),
      
      // Status and errors
      statusIndicator: document.getElementById('statusIndicator'),
      errorPanel: document.getElementById('errorPanel'),
      errorMessage: document.getElementById('errorMessage'),
      errorRetry: document.getElementById('errorRetry'),
      errorClose: document.getElementById('errorClose'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingText: document.getElementById('loadingText'),
      
      // Health check (development)
      healthCheck: document.getElementById('healthCheck'),
      healthResults: document.getElementById('healthResults')
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // File input
    this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    this.elements.createChartButton.addEventListener('click', () => this.openAuthoring());
    this.elements.importPdfButton.addEventListener('click', () => this.showStartView('pdf'));
    this.elements.importAudioButton.addEventListener('click', () => this.showStartView('audio'));
    this.elements.cancelImportButton.addEventListener('click', () => this.showStartView());
    this.elements.cancelAuthorButton.addEventListener('click', () => this.closeAuthoring());
    this.elements.cancelAudioButton.addEventListener('click', () => this.cancelAudioAnalysis());
    this.elements.audioFileButton.addEventListener('click', () => this.elements.audioFileInput.click());
    this.elements.lyricsFileButton.addEventListener('click', () => this.elements.lyricsFileInput.click());
    this.elements.audioFileInput.addEventListener('change', event => this.handleAudioUpload(event));
    this.elements.lyricsFileInput.addEventListener('change', event => this.handleLyricsFile(event));
    this.elements.audioLyricsInput.addEventListener('input', () => this.updateLyricsSourceStatus());
    this.elements.saveChartButton.addEventListener('click', () => this.saveAuthoredSong());
    this.elements.authorContent.addEventListener('input', () => this.updateAuthorPreview(true));
    this.elements.authorTitle.addEventListener('input', () => this.updateAuthorPreview());
    this.elements.authorKey.addEventListener('change', () => this.updateAuthorPreview());
    this.elements.authorPreview.addEventListener('click', event => this.selectAuthorChord(event));
    this.elements.authorPreview.addEventListener('focusin', event => this.selectAuthorChord(event));
    this.elements.authorPreview.addEventListener('keydown', event => this.handleAuthorChordKeydown(event));
    this.elements.authorPreview.addEventListener('dragstart', event => this.handleAuthorChordDragStart(event));
    this.elements.authorPreview.addEventListener('dragover', event => this.handleAuthorChordDragOver(event));
    this.elements.authorPreview.addEventListener('dragleave', event => this.handleAuthorChordDragLeave(event));
    this.elements.authorPreview.addEventListener('drop', event => this.handleAuthorChordDrop(event));
    this.elements.authorPreview.addEventListener('dragend', () => this.clearAuthorDragState());
    this.elements.authorPreview.addEventListener('pointerdown', event => this.handleAuthorPointerDown(event));
    this.elements.authorPreview.addEventListener('pointermove', event => this.handleAuthorPointerMove(event));
    this.elements.authorPreview.addEventListener('pointerup', event => this.handleAuthorPointerUp(event));
    this.elements.authorPreview.addEventListener('pointercancel', () => this.clearAuthorPointerDrag());
    this.elements.chordTimingInput.addEventListener('change', () => this.saveAuthorTimingOverride());
    this.elements.authorSourceTab.addEventListener('click', () => this.setAuthorPane('source'));
    this.elements.authorPreviewTab.addEventListener('click', () => this.setAuthorPane('preview'));
    this.elements.chordEditBar.addEventListener('click', event => {
      const direction = event.target.closest('[data-chord-move]')?.dataset.chordMove;
      if (direction) this.nudgeSelectedAuthorChord(direction);
    });
    
    // Upload area click
    this.elements.uploadArea.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
    
    // Export buttons
    this.elements.exportButton.addEventListener('click', this.showExportSection.bind(this));
    this.elements.exportFinalButton.addEventListener('click', this.handleExport.bind(this));
    this.elements.exportChordProButton?.addEventListener('click', () => this.exportChordPro());
    
    // Filename input
    this.elements.exportFilename.addEventListener('input', (e) => {
      this.exportFilename = e.target.value || 'Transposed Songbook';
    });
    this.elements.activeSongSelect?.addEventListener('change', event => this.selectActiveSong(event.target.value));
    this.elements.sessionName?.addEventListener('input', () => this.scheduleSessionSave());
    this.elements.sessionSelect?.addEventListener('change', event => this.switchSession(event.target.value));
    this.elements.newSessionButton?.addEventListener('click', () => this.createNamedSession());
    this.elements.duplicateSessionButton?.addEventListener('click', () => this.duplicateCurrentSession());
    this.elements.deleteSessionButton?.addEventListener('click', () => this.deleteCurrentSession());
    this.elements.librarySearch?.addEventListener('input', event => this.searchLibrary(event.target.value));
    this.elements.closeHistoryButton?.addEventListener('click', () => { this.elements.historyDrawer.hidden = true; });
    this.elements.importChordProButton?.addEventListener('click', () => this.elements.chordProFileInput.click());
    this.elements.chordProFileInput?.addEventListener('change', event => this.importChordPro(event));
    this.elements.restoreDraftButton?.addEventListener('click', () => this.restoreRecoveryDraft());
    this.elements.discardDraftButton?.addEventListener('click', () => this.discardRecoveryDraft());
    ['input', 'change'].forEach(name => {
      this.elements.authorTitle.addEventListener(name, () => this.scheduleDraftSave('editor.changed'));
      this.elements.authorKey.addEventListener(name, () => this.scheduleDraftSave('editor.changed'));
      this.elements.authorContent.addEventListener(name, () => this.scheduleDraftSave('editor.changed'));
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flushDraftSave();
    });
  }

  async initializePersistence() {
    this.setSaveState('Saving…');
    try {
      if (!this.sessionStore) throw new Error('Persistent session unavailable');
      await this.sessionStore.hydrate();
      this.syncFromSessionStore();
      this.elements.sessionName.value = this.activeSession?.name || 'My songs';
      await this.refreshSessionList();
      await this.searchLibrary('');
      if (this.currentSongs.length) this.displaySongs();
      await this.offerNewestRecoveryDraft();
      this.setSaveState('Saved');
      this.track('session.started', { songCount: this.currentSongs.length });
      this.updateTelemetrySnapshot();
    } catch (error) {
      this.setSaveState('Save failed');
      this.track('ui.error', { operation: 'restore', errorCode: 'persistence_failed' });
    }
  }

  syncFromSessionStore(ephemeralSongs = []) {
    const prior = new Map([...this.currentSongs, ...ephemeralSongs].map(song => [String(song.id), song]));
    this.activeSession = this.sessionStore?.activeSession || null;
    this.currentSongs = (this.sessionStore?.songs || []).map(song => {
      const runtime = prior.get(String(song.id));
      const hydrated = runtime?.source?.rawAnalysis
        ? SongModel.create({ ...song, source: runtime.source })
        : SongModel.create(song);
      hydrated.sessionView = { ...(song.sessionView || {}) };
      hydrated.sessionItemId = song.sessionItemId;
      hydrated.libraryRevision = song.libraryRevision;
      return hydrated;
    });
    this.activeSongId = this.sessionStore?.currentSong?.id || this.currentSongs[0]?.id || null;
    this.songRevisions = new Map([...(this.sessionStore?.songRecords || new Map()).entries()]
      .map(([id, record]) => [id, record.revision]));
  }

  async refreshSessionList() {
    const sessions = await this.sessionStore.listSessions();
    this.elements.sessionSelect.innerHTML = sessions.map(session =>
      `<option value="${this.escapeHtml(session.id)}"${session.id === this.activeSession?.id ? ' selected' : ''}>${this.escapeHtml(session.name)}</option>`
    ).join('');
    this.elements.deleteSessionButton.disabled = sessions.length < 2;
  }

  async switchSession(sessionId) {
    try {
      await this.sessionStore.selectSession(sessionId);
      this.syncFromSessionStore();
      this.elements.sessionName.value = this.activeSession.name;
      await this.refreshSessionList();
      await this.searchLibrary(this.elements.librarySearch.value);
      this.currentSongs.length ? this.displaySongs() : this.showStartView();
    } catch (error) { this.handleSessionStoreError(error, 'session.select'); }
  }

  async createNamedSession() {
    const name = window.prompt('Name this session', 'New Session');
    if (name === null) return;
    try {
      await this.sessionStore.createSession(name);
      this.syncFromSessionStore();
      this.elements.sessionName.value = this.activeSession.name;
      await this.refreshSessionList();
      this.showStartView();
    } catch (error) { this.handleSessionStoreError(error, 'session.create'); }
  }

  async duplicateCurrentSession() {
    try {
      await this.sessionStore.duplicateSession();
      this.syncFromSessionStore();
      this.elements.sessionName.value = this.activeSession.name;
      await this.refreshSessionList();
      this.currentSongs.length ? this.displaySongs() : this.showStartView();
    } catch (error) { this.handleSessionStoreError(error, 'session.duplicate'); }
  }

  async deleteCurrentSession() {
    if (!window.confirm(`Delete session “${this.activeSession?.name}”? Songs remain in your library.`)) return;
    try {
      await this.sessionStore.deleteSession(this.activeSession.id, { expectedRevision: this.activeSession.revision });
      this.syncFromSessionStore();
      this.elements.sessionName.value = this.activeSession.name;
      await this.refreshSessionList();
      this.currentSongs.length ? this.displaySongs() : this.showStartView();
    } catch (error) { this.handleSessionStoreError(error, 'session.delete'); }
  }

  async searchLibrary(query = '') {
    const records = await this.libraryStore.searchSongs(query, { limit: 30 });
    const present = new Set(this.activeSession?.items.map(item => item.songId) || []);
    this.elements.librarySearchResults.innerHTML = records.filter(record => !present.has(record.id)).map(record =>
      `<button type="button" data-library-song="${this.escapeHtml(record.id)}"><span>${this.escapeHtml(record.song.title)}</span><small>${this.escapeHtml(record.song.originalKey)}</small></button>`
    ).join('') || '<p class="empty-note">No other saved songs</p>';
    this.elements.librarySearchResults.querySelectorAll('[data-library-song]').forEach(button => button.addEventListener('click', async () => {
      try {
        await this.sessionStore.addExistingSong(button.dataset.librarySong);
        this.syncFromSessionStore(); this.displaySongs(); await this.searchLibrary(this.elements.librarySearch.value);
      } catch (error) { this.handleSessionStoreError(error, 'library.add'); }
    }));
  }

  handleSessionStoreError(error, operation) {
    this.setSaveState('Save failed');
    this.track('ui.error', { operation, errorCode: error?.name || 'session_failed' });
    if (error?.name === 'ConflictError') {
      this.showError('This session changed in another tab. Reload to review the newer version before saving again.');
    }
    return error;
  }

  setSaveState(value) {
    if (this.elements.sessionSaveState) this.elements.sessionSaveState.textContent = value;
  }

  track(eventType, data = {}, song = null) {
    try {
      this.telemetry?.emit(eventType, data, {
        screen: this.telemetry?.screen,
        songId: song?.id || this.activeSongId,
        sourceType: song?.sourceType || null
      });
    } catch (_) {}
  }

  updateTelemetrySnapshot(extra = {}) {
    try {
      this.telemetry?.updateSnapshot({
        screen: this.telemetry.screen,
        activeSongId: this.activeSongId,
        currentSongs: this.currentSongs,
        editor: this.elements.authorSection?.style.display !== 'none' ? this.editorSnapshot() : null,
        ...extra
      });
    } catch (_) {}
  }

  setScreen(screen, data = {}) {
    try { this.telemetry?.setScreen(screen, data); } catch (_) {}
    this.updateTelemetrySnapshot();
  }

  showStartView(mode = 'start') {
    this.elements.startSection.style.display = mode === 'start' ? 'block' : 'none';
    this.elements.uploadSection.style.display = mode === 'pdf' ? 'block' : 'none';
    this.elements.audioSection.style.display = mode === 'audio' ? 'block' : 'none';
    this.elements.authorSection.style.display = 'none';
    this.elements.songsSection.style.display = mode === 'start' && this.currentSongs.length ? 'block' : 'none';
    const telemetryScreen = mode === 'audio' ? 'audio-import' : mode === 'pdf' ? 'pdf-import' : 'start';
    this.setScreen(telemetryScreen);
  }

  async persistSong(song, { addToSession = true } = {}) {
    if (!this.sessionStore) return song;
    this.setSaveState('Saving…');
    try {
      const exists = this.sessionStore.songRecords.has(String(song.id));
      if (addToSession && !exists) await this.sessionStore.addSong(song, {
        transpose: song.transposition,
        spellingPolicy: song.spellingPolicy,
        view: song.sessionView || song.view || {}
      });
      else await this.sessionStore.commitSong(song);
      this.syncFromSessionStore([song]);
      this.setSaveState('Saved');
      return this.currentSongs.find(item => String(item.id) === String(song.id)) || song;
    } catch (error) {
      throw this.handleSessionStoreError(error, 'song.save');
    }
  }

  persistSession() {
    return this.persistSessionNow();
  }

  async persistSessionNow() {
    if (!this.sessionStore?.activeSession) return;
    try {
      await this.sessionStore.renameSession(this.elements.sessionName?.value.trim() || 'My songs');
      this.syncFromSessionStore();
      await this.refreshSessionList();
      this.setSaveState('Saved');
      this.updateTelemetrySnapshot();
    } catch (error) {
      throw this.handleSessionStoreError(error, 'session.save');
    }
  }

  scheduleSessionSave() {
    this.setSaveState('Saving…');
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => this.persistSession().catch(() => this.setSaveState('Save failed')), 500);
  }

  editorSnapshot() {
    return {
      title: this.elements.authorTitle.value,
      originalKey: this.elements.authorKey.value,
      content: this.elements.authorContent.value,
      timingOverrides: [...this.authorTimingOverrides.entries()]
    };
  }

  scheduleDraftSave(eventType = 'editor.changed') {
    if (this.elements.authorSection?.style.display === 'none') return;
    this.setSaveState('Saving…');
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.flushDraftSave(), 700);
    this.track(eventType, {}, this.currentSongs.find(song => String(song.id) === String(this.editingSongId)));
    this.updateTelemetrySnapshot();
  }

  async flushDraftSave() {
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
    if (!this.libraryStore || this.elements.authorSection?.style.display === 'none') return;
    const entityId = this.editingSongId || this.authorDraftPersistentId;
    if (!entityId) return;
    try {
      await this.libraryStore.saveDraft(entityId, this.editorSnapshot(), {
        id: `song:${entityId}`,
        baseRevision: this.songRevisions.get(String(entityId)) || 0
      });
      this.setSaveState('Saved');
    } catch (_) {
      this.setSaveState('Save failed');
    }
  }

  async offerNewestRecoveryDraft() {
    const drafts = await this.libraryStore.listDrafts();
    for (const draft of drafts) {
      const recoverable = await this.libraryStore.getRecoverableDraft(draft.entityId);
      if (!recoverable) continue;
      this.pendingRecoveryDraft = recoverable;
      this.elements.recoveryMessage.textContent = `Unsaved changes from ${new Date(recoverable.savedAt).toLocaleString()} are available.`;
      this.elements.recoveryBanner.hidden = false;
      return;
    }
  }

  restoreRecoveryDraft() {
    const draft = this.pendingRecoveryDraft;
    if (!draft) return;
    const song = this.currentSongs.find(item => String(item.id) === draft.entityId);
    this.openAuthoring(song?.id || null);
    this.authorDraftPersistentId = draft.entityId;
    this.elements.authorTitle.value = draft.editor.title || '';
    this.elements.authorKey.value = draft.editor.originalKey || 'C';
    this.elements.authorContent.value = draft.editor.content || '';
    this.authorTimingOverrides = new Map(draft.editor.timingOverrides || []);
    this.updateAuthorPreview(true);
    this.elements.recoveryBanner.hidden = true;
    this.track('draft.recovered');
  }

  async discardRecoveryDraft() {
    if (!this.pendingRecoveryDraft) return;
    await this.libraryStore.deleteDraft(this.pendingRecoveryDraft.entityId);
    this.pendingRecoveryDraft = null;
    this.elements.recoveryBanner.hidden = true;
    this.track('draft.discarded');
  }

  async handleAudioUpload(event) {
    const file = event.target.files?.[0];
    if (!file || this.isProcessing) return;

    this.isProcessing = true;
    this.audioAbortController = new AbortController();
    this.elements.audioJob.style.display = 'block';
    this.updateAudioProgress('Uploading recording', 5, 'Sending audio to the analysis server.');
    this.track('import.started', { type: 'audio', size: file.size });
    this.setScreen('audio-import');

    try {
      const formData = new FormData();
      formData.append('audio', file);
      const authoritativeLyrics = this.elements.audioLyricsInput.value;
      if (authoritativeLyrics.trim()) formData.append('authoritativeLyrics', authoritativeLyrics);
      const response = await fetch('/api/audio-jobs', {
        method: 'POST', body: formData, signal: this.audioAbortController.signal
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Upload failed (${response.status})`);

      this.audioJobId = payload.jobId;
      const result = await this.waitForAudioJob(payload.jobId, this.audioAbortController.signal);
      const normalizedResult = this.normalizeAnalyzedSongSpellings(result);
      normalizedResult.source = {
        ...(normalizedResult.source || {}),
        rawAnalysis: result.source?.rawAnalysis || {
          sections: JSON.parse(JSON.stringify(result.sections || [])),
          chords: JSON.parse(JSON.stringify(result.chords || []))
        }
      };
      const learned = this.correctionMemory.apply(normalizedResult);
      const analyzedSong = SongModel.create({ ...learned.song, id: this.libraryStore?.createId() || String(Date.now()) });
      const editableSong = SongModel.fromManual({
        title: analyzedSong.title,
        originalKey: analyzedSong.originalKey,
        content: SongModel.toEditorText(analyzedSong)
      });
      editableSong.id = analyzedSong.id;
      editableSong.sourceType = 'audio';
      editableSong.source = analyzedSong.source;
      SongModel.retainAnalysisMetadata(editableSong, analyzedSong);
      const visibleLearning = this.correctionMemory.apply(editableSong);
      const song = SongModel.create({ ...visibleLearning.song, id: analyzedSong.id });
      const savedSong = await this.persistSong(song);
      const learnedStatus = learned.savedEditsApplied
        ? ' · restored your saved chart edits'
        : learned.applied
          ? ` · applied ${learned.applied} learned correction${learned.applied === 1 ? '' : 's'}`
          : '';
      this.updateStatus(`Created draft for ${song.title}${learnedStatus}`, 'success');
      this.elements.audioFileInput.value = '';
      this.clearAudioLyrics();
      this.elements.audioJob.style.display = 'none';
      this.openAuthoring(savedSong.id);
      this.track('import.completed', { type: 'audio' }, savedSong);
    } catch (error) {
      if (this.audioJobId && error.name !== 'AbortError') {
        fetch(`/api/audio-jobs/${encodeURIComponent(this.audioJobId)}`, { method: 'DELETE' }).catch(() => {});
      }
      if (error.name !== 'AbortError') {
        this.track('import.failed', { type: 'audio' });
        this.updateAudioProgress('Analysis failed', 0, error.message);
        this.showError(`Recording analysis failed: ${error.message}`);
        this.updateStatus('Recording analysis failed', 'error');
      }
    } finally {
      this.isProcessing = false;
      this.audioAbortController = null;
      this.audioJobId = null;
      this.elements.audioFileInput.value = '';
    }
  }

  async waitForAudioJob(jobId, signal) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      const response = await fetch(`/api/audio-jobs/${encodeURIComponent(jobId)}`, { signal });
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || `Status check failed (${response.status})`);
      this.updateAudioProgress(job.stage, job.progress, 'Lyrics, key, and chord timing remain editable when complete.');
      if (job.status === 'complete') return job.result;
      if (job.status === 'error') throw new Error(job.error || 'Audio analysis failed');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Audio analysis exceeded 10 minutes');
  }

  async cancelAudioAnalysis() {
    const jobId = this.audioJobId;
    this.audioAbortController?.abort();
    if (jobId) {
      fetch(`/api/audio-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => {});
    }
    this.elements.audioJob.style.display = 'none';
    this.elements.audioFileInput.value = '';
    this.clearAudioLyrics();
    this.updateStatus('Recording analysis cancelled', 'info');
    this.showStartView();
  }

  async handleLyricsFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain') {
      this.showError('Choose a plain-text (.txt) lyric sheet');
      event.target.value = '';
      return;
    }
    try {
      this.elements.audioLyricsInput.value = await file.text();
      this.updateLyricsSourceStatus(file.name);
    } catch (error) {
      this.showError(`Could not read lyric sheet: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  }

  updateLyricsSourceStatus(filename = '') {
    const supplied = this.elements.audioLyricsInput.value.trim();
    this.elements.lyricsSourceStatus.textContent = supplied
      ? `${filename ? `${filename} loaded. ` : ''}Supplied lyrics will override recognized wording.`
      : 'No lyric sheet supplied — recording transcription will be used.';
  }

  clearAudioLyrics() {
    this.elements.audioLyricsInput.value = '';
    this.elements.lyricsFileInput.value = '';
    this.updateLyricsSourceStatus();
  }

  updateAudioProgress(stage, progress, message) {
    const percent = Math.max(0, Math.min(100, Number(progress) || 0));
    this.elements.audioJobStage.textContent = stage;
    this.elements.audioJobPercent.textContent = `${percent}%`;
    this.elements.audioJobProgress.style.width = `${percent}%`;
    this.elements.audioJobProgressTrack.setAttribute('aria-valuenow', String(percent));
    this.elements.audioJobMessage.textContent = message;
    this.track('import.progress', { type: 'audio', stage, progress: percent });
    this.updateTelemetrySnapshot({ activeJob: { stage, progress: percent } });
  }

  normalizeAnalyzedSongSpellings(song) {
    const output = SongModel.create(song);
    const musicTheory = new MusicTheory();
    (output.sections || []).forEach(section => (section.lines || []).forEach(line => {
      (line.chords || []).forEach(chord => {
        chord.symbol = musicTheory.spellChordForKey(chord.symbol, output.originalKey, { policy: 'contextual' });
      });
    }));
    output.songText = SongModel.toSongText(output);
    return output;
  }

  openAuthoring(songId = null) {
    const song = songId === null ? null : this.currentSongs.find(item => String(item.id) === String(songId));
    this.editingSongId = song?.id ?? null;
    this.selectedAuthorChord = null;
    this.authorTimingOverrides.clear();
    this.authorDraft = song ? SongModel.create(song) : null;
    this.authorDraftPersistentId = song?.id || this.libraryStore?.createId() || String(Date.now());
    this.authorLastSerializedText = song ? SongModel.toEditorText(song) : '';
    this.elements.chordEditBar.hidden = true;
    this.elements.authorHeading.textContent = song ? 'Edit chord sheet' : 'Create a chord sheet';
    this.elements.saveChartButton.textContent = song ? 'Save changes' : 'Add chord sheet';
    this.elements.authorTitle.value = song?.title || '';
    this.elements.authorKey.value = song?.originalKey || 'C';
    this.elements.authorContent.value = song ? SongModel.toEditorText(song) : '';
    this.elements.startSection.style.display = 'none';
    this.elements.uploadSection.style.display = 'none';
    this.elements.audioSection.style.display = 'none';
    this.elements.songsSection.style.display = 'none';
    this.elements.exportSection.style.display = 'none';
    this.elements.authorSection.style.display = 'block';
    this.updateAuthorPreview();
    this.elements.authorTitle.focus();
    this.setScreen('author-source', { songId: song?.id || null });
    this.track('editor.opened', {}, song);
  }

  closeAuthoring() {
    this.flushDraftSave();
    this.editingSongId = null;
    this.selectedAuthorChord = null;
    this.authorTimingOverrides.clear();
    this.authorDraft = null;
    this.elements.authorSection.style.display = 'none';
    if (this.currentSongs.length) {
      this.displaySongs();
    } else {
      this.showStartView();
    }
  }

  async saveAuthoredSong() {
    const title = this.elements.authorTitle.value.trim();
    const content = this.elements.authorContent.value;
    if (!title) {
      this.showError('Enter a song title before saving');
      return;
    }
    if (!content.trim()) {
      this.showError('Add lyrics or chords before saving');
      return;
    }

    const authored = this.authorDraft
      ? SongModel.create({ ...this.authorDraft, title, originalKey: this.elements.authorKey.value, currentKey: this.elements.authorKey.value })
      : SongModel.fromManual({ title, originalKey: this.elements.authorKey.value, content });
    if (!authored.id || typeof authored.id !== 'string') authored.id = this.authorDraftPersistentId;

    if (this.editingSongId !== null) {
      const index = this.currentSongs.findIndex(song => song.id === this.editingSongId);
      const previous = this.currentSongs[index];
      authored.id = previous.id;
      authored.sourceType = previous.sourceType;
      authored.source = { ...(previous.source || {}), preserveLayout: false, edited: true };
      authored.textItems = previous.textItems || [];
      const visibleBaseline = SongModel.fromManual({
        title: previous.title,
        originalKey: previous.originalKey,
        content: SongModel.toEditorText(previous)
      });
      const rawSong = {
        ...previous,
        sections: previous.source?.rawAnalysis?.sections || previous.sections
      };
      const rawBaseline = SongModel.fromManual({
        title: previous.title,
        originalKey: previous.originalKey,
        content: SongModel.toEditorText(rawSong)
      });
      SongModel.retainAnalysisMetadata(rawBaseline, rawSong);
      SongModel.retainAnalysisMetadata(authored, previous);
      this.applyAuthorTimingOverrides(authored);
      const learning = this.correctionMemory.learn(previous, authored, {
        visibleSections: visibleBaseline.sections,
        rawSections: rawBaseline.sections
      });
      authored.source.correctionsLearned = learning.learned;
      authored.source.savedEditsLearned = learning.savedEdits;
      authored.source.correctionsPersisted = learning.persisted;
    }

    try {
      const savedSong = await this.persistSong(authored, { addToSession: this.editingSongId === null });
      if (String(this.sessionStore.currentSong?.id) !== String(savedSong.id)) {
        await this.sessionStore.selectSong(savedSong.id);
        this.syncFromSessionStore([savedSong]);
      }
      await this.libraryStore?.deleteDraft(this.editingSongId || this.authorDraftPersistentId);
    } catch (error) {
      if (error?.name !== 'ConflictError') this.showError(`Could not save chart: ${error.message}`);
      return;
    }

    this.editingSongId = null;
    this.authorDraft = null;
    this.elements.authorSection.style.display = 'none';
    const learnedCount = authored.source?.savedEditsLearned || authored.source?.correctionsLearned || 0;
    const learnedStatus = learnedCount
      ? ` · learned ${learnedCount} correction${learnedCount === 1 ? '' : 's'}`
      : '';
    const persistenceWarning = authored.source?.correctionsPersisted === false
      ? ' · chart saved for this session, but learning could not be stored in this browser'
      : '';
    this.updateStatus(`Saved ${authored.title}${learnedStatus}${persistenceWarning}`, persistenceWarning ? 'warning' : 'success');
    this.track('chart.saved', {}, authored);
    this.displaySongs();
  }

  updateAuthorPreview(forceParse = false) {
    const canReuseDraft = !forceParse && this.authorDraft
      && this.elements.authorContent.value === this.authorLastSerializedText;
    const draft = canReuseDraft ? this.authorDraft : SongModel.fromManual({
      title: this.elements.authorTitle.value || 'Untitled Song',
      originalKey: this.elements.authorKey.value,
      content: this.elements.authorContent.value
    });
    draft.title = this.elements.authorTitle.value || 'Untitled Song';
    draft.originalKey = this.elements.authorKey.value;
    if (this.editingSongId !== null) {
      const previous = this.currentSongs.find(song => String(song.id) === String(this.editingSongId));
      if (previous) SongModel.retainAnalysisMetadata(draft, previous);
    }
    this.applyAuthorTimingOverrides(draft);
    this.authorDraft = draft;
    this.authorLastSerializedText = this.elements.authorContent.value;
    const populated = draft.sections.some(section => section.lines.some(line => line.lyrics || line.chords.length));
    this.elements.authorPreview.innerHTML = populated ? this.renderStructuredContent(draft, { interactive: true }) : '';
    this.elements.authorPreviewStatus.textContent = populated ? 'Drag chords to place them, or focus one and use arrow keys' : 'Start typing to preview your chart';
    if (this.selectedAuthorChord) this.restoreAuthorChordSelection();
  }

  setAuthorPane(pane) {
    const preview = pane === 'preview';
    this.elements.authorSourceTab.classList.toggle('active', !preview);
    this.elements.authorPreviewTab.classList.toggle('active', preview);
    this.elements.authorSourceTab.setAttribute('aria-selected', String(!preview));
    this.elements.authorPreviewTab.setAttribute('aria-selected', String(preview));
    this.elements.authorSourcePane.classList.toggle('active', !preview);
    this.elements.authorPreviewPane.classList.toggle('active', preview);
    if (preview) this.updateAuthorPreview();
  }

  nudgeSelectedAuthorChord(direction) {
    const selection = this.selectedAuthorChord;
    if (!selection) return;
    const token = this.elements.authorPreview.querySelector(`button.chord-token[data-chord-id="${CSS.escape(selection.chordId)}"]`);
    if (!token) return;
    const source = { ...selection };
    const destination = { sectionIndex: source.sectionIndex, lineIndex: source.lineIndex };
    let offset = Number(token.dataset.characterOffset) || 0;
    if (direction === 'left') offset = Math.max(0, offset - 1);
    if (direction === 'right') offset += 1;
    if (direction === 'up') destination.lineIndex = Math.max(0, destination.lineIndex - 1);
    if (direction === 'down') destination.lineIndex += 1;
    this.moveAuthorChord(source, destination, offset, true);
  }

  handleAuthorPointerDown(event) {
    const token = event.target.closest('button.chord-token');
    if (!token || event.pointerType === 'mouse') return;
    this.authorPointerDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      source: {
        sectionIndex: Number(token.dataset.sectionIndex),
        lineIndex: Number(token.dataset.lineIndex),
        chordIndex: Number(token.dataset.chordIndex),
        chordId: token.dataset.chordId
      }
    };
    token.setPointerCapture(event.pointerId);
  }

  handleAuthorPointerMove(event) {
    const drag = this.authorPointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.active = true;
    event.preventDefault();
    const line = document.elementFromPoint(event.clientX, event.clientY)?.closest('.chord-line[data-section-index]');
    if (!line) return;
    this.elements.authorPreview.querySelectorAll('.author-drop-target').forEach(item => item.classList.remove('author-drop-target'));
    line.classList.add('author-drop-target');
    const rect = line.getBoundingClientRect();
    const width = this.measureAuthorCharacterWidth(line);
    const offset = Math.max(0, Math.round((event.clientX - rect.left) / width));
    line.style.setProperty('--drop-caret-left', `${offset * width}px`);
  }

  handleAuthorPointerUp(event) {
    const drag = this.authorPointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.active) {
      event.preventDefault();
      const line = document.elementFromPoint(event.clientX, event.clientY)?.closest('.chord-line[data-section-index]');
      if (line) {
        const rect = line.getBoundingClientRect();
        const width = this.measureAuthorCharacterWidth(line);
        this.moveAuthorChord(drag.source, {
          sectionIndex: Number(line.dataset.sectionIndex),
          lineIndex: Number(line.dataset.lineIndex)
        }, Math.max(0, Math.round((event.clientX - rect.left) / width)));
      }
    }
    this.clearAuthorPointerDrag();
  }

  clearAuthorPointerDrag() {
    this.authorPointerDrag = null;
    this.clearAuthorDragState();
  }

  authorChordKey(chordId) {
    return String(chordId || '');
  }

  selectAuthorChord(event) {
    const token = event.target.closest('button.chord-token');
    if (!token) return;
    this.selectedAuthorChord = {
      sectionIndex: Number(token.dataset.sectionIndex),
      lineIndex: Number(token.dataset.lineIndex),
      chordIndex: Number(token.dataset.chordIndex),
      chordId: token.dataset.chordId
    };
    this.restoreAuthorChordSelection();
  }

  restoreAuthorChordSelection() {
    const selection = this.selectedAuthorChord;
    if (!selection) return;
    const selector = `button.chord-token[data-chord-id="${CSS.escape(selection.chordId)}"]`;
    const token = this.elements.authorPreview.querySelector(selector);
    this.elements.authorPreview.querySelectorAll('button.chord-token').forEach(item => item.setAttribute('aria-pressed', String(item === token)));
    if (!token) {
      this.selectedAuthorChord = null;
      this.elements.chordEditBar.hidden = true;
      return;
    }
    const key = this.authorChordKey(selection.chordId);
    const override = this.authorTimingOverrides.get(key);
    const timestamp = override ?? token.dataset.timestamp;
    this.elements.selectedChordLabel.textContent = `${token.textContent} selected`;
    this.elements.chordTimingInput.value = timestamp === '' || timestamp === undefined ? '' : Number(timestamp).toFixed(2);
    this.elements.chordEditBar.hidden = false;
  }

  saveAuthorTimingOverride() {
    if (!this.selectedAuthorChord) return;
    const value = this.elements.chordTimingInput.value;
    const key = this.authorChordKey(this.selectedAuthorChord.chordId);
    if (value === '') {
      this.authorTimingOverrides.delete(key);
      this.announceAuthorEdit('Custom chord time cleared');
      this.scheduleDraftSave('chord.timing_changed');
      return;
    }
    if (!Number.isFinite(Number(value)) || Number(value) < 0) return;
    this.authorTimingOverrides.set(key, Number(value));
    this.announceAuthorEdit(`Chord time set to ${Number(value).toFixed(2)} seconds`);
    this.scheduleDraftSave('chord.timing_changed');
  }

  applyAuthorTimingOverrides(song) {
    this.authorTimingOverrides.forEach((timestamp, key) => {
      const chord = (song.sections || []).flatMap(section => section.lines || [])
        .flatMap(line => line.chords || []).find(item => item.id === key);
      if (!chord) return;
      chord.timestamp = timestamp;
      chord.confidence = null;
      chord.timingEdited = true;
    });
  }

  handleAuthorChordDragStart(event) {
    const token = event.target.closest('button.chord-token');
    if (!token) return;
    this.authorDrag = {
      sectionIndex: Number(token.dataset.sectionIndex),
      lineIndex: Number(token.dataset.lineIndex),
      chordIndex: Number(token.dataset.chordIndex),
      chordId: token.dataset.chordId
    };
    token.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(this.authorDrag));
  }

  handleAuthorChordDragOver(event) {
    const line = event.target.closest('.chord-line[data-section-index]');
    if (!line || !this.authorDrag) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    this.elements.authorPreview.querySelectorAll('.author-drop-target').forEach(item => item.classList.remove('author-drop-target'));
    line.classList.add('author-drop-target');
    const rect = line.getBoundingClientRect();
    const characterWidth = this.measureAuthorCharacterWidth(line);
    const offset = Math.max(0, Math.round((event.clientX - rect.left) / characterWidth));
    line.style.setProperty('--drop-caret-left', `${offset * characterWidth}px`);
  }

  handleAuthorChordDragLeave(event) {
    const line = event.target.closest('.chord-line[data-section-index]');
    if (line && !line.contains(event.relatedTarget)) line.classList.remove('author-drop-target');
  }

  handleAuthorChordDrop(event) {
    const line = event.target.closest('.chord-line[data-section-index]');
    if (!line || !this.authorDrag) return;
    event.preventDefault();
    const destination = {
      sectionIndex: Number(line.dataset.sectionIndex),
      lineIndex: Number(line.dataset.lineIndex)
    };
    const rect = line.getBoundingClientRect();
    const characterWidth = this.measureAuthorCharacterWidth(line);
    const offset = Math.max(0, Math.round((event.clientX - rect.left) / characterWidth));
    this.moveAuthorChord(this.authorDrag, destination, offset);
    this.clearAuthorDragState();
  }

  handleAuthorChordKeydown(event) {
    const token = event.target.closest('button.chord-token');
    if (!token) return;
    if (event.key === 'Escape') {
      token.blur();
      this.selectedAuthorChord = null;
      this.elements.chordEditBar.hidden = true;
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const source = {
      sectionIndex: Number(token.dataset.sectionIndex),
      lineIndex: Number(token.dataset.lineIndex),
      chordIndex: Number(token.dataset.chordIndex),
      chordId: token.dataset.chordId
    };
    const amount = event.shiftKey ? 4 : 1;
    const destination = { sectionIndex: source.sectionIndex, lineIndex: source.lineIndex };
    let offset = Number(token.dataset.characterOffset) || 0;
    if (event.key === 'ArrowLeft') offset = Math.max(0, offset - amount);
    if (event.key === 'ArrowRight') offset += amount;
    if (event.key === 'ArrowUp') destination.lineIndex = Math.max(0, source.lineIndex - 1);
    if (event.key === 'ArrowDown') destination.lineIndex += 1;
    this.moveAuthorChord(source, destination, offset, true);
  }

  moveAuthorChord(source, destination, offset, restoreFocus = false) {
    const draft = this.authorDraft || SongModel.fromManual({
      title: this.elements.authorTitle.value || 'Untitled Song', originalKey: this.elements.authorKey.value,
      content: this.elements.authorContent.value
    });
    const sourceLine = draft.sections?.[source.sectionIndex]?.lines?.[source.lineIndex];
    const destinationLine = draft.sections?.[destination.sectionIndex]?.lines?.[destination.lineIndex];
    const chord = sourceLine?.chords?.find(item => item.id === source.chordId) || sourceLine?.chords?.[source.chordIndex];
    if (!chord || !destinationLine) return;
    sourceLine.chords.splice(sourceLine.chords.indexOf(chord), 1);
    chord.characterOffset = this.availableChordOffset(destinationLine.chords, offset, chord.symbol);
    if (!this.authorTimingOverrides.has(this.authorChordKey(chord.id))) {
      chord.timestamp = SongModel.timestampForCharacterOffset(destinationLine, chord.characterOffset, chord.timestamp);
      chord.confidence = null;
    }
    destinationLine.chords.push(chord);
    destinationLine.chords.sort((a, b) => a.characterOffset - b.characterOffset);
    const chordIndex = destinationLine.chords.indexOf(chord);
    this.elements.authorContent.value = SongModel.toEditorText(draft);
    this.authorLastSerializedText = this.elements.authorContent.value;
    this.selectedAuthorChord = { ...destination, chordIndex, chordId: chord.id };
    this.authorDraft = draft;
    const populated = draft.sections.some(section => section.lines.some(line => line.lyrics || line.chords.length));
    this.elements.authorPreview.innerHTML = populated ? this.renderStructuredContent(draft, { interactive: true }) : '';
    this.restoreAuthorChordSelection();
    if (restoreFocus) {
      const selected = this.elements.authorPreview.querySelector('button.chord-token[aria-pressed="true"]');
      selected?.focus();
    }
    this.announceAuthorEdit(`${chord.symbol} moved to column ${chord.characterOffset + 1}`);
    this.scheduleDraftSave('chord.dragged');
  }

  availableChordOffset(chords, desired, symbol) {
    let offset = Math.max(0, Number(desired) || 0);
    const sorted = [...(chords || [])].sort((a, b) => a.characterOffset - b.characterOffset);
    while (sorted.some(chord => {
      const start = Number(chord.characterOffset) || 0;
      const end = start + String(chord.symbol || '').length;
      return offset < end && offset + String(symbol || '').length > start;
    })) offset += 1;
    return offset;
  }

  measureAuthorCharacterWidth(line) {
    const context = document.createElement('canvas').getContext('2d');
    const style = getComputedStyle(line);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText('0').width || 9.6;
  }

  clearAuthorDragState() {
    this.authorDrag = null;
    this.elements.authorPreview.querySelectorAll('.dragging, .author-drop-target').forEach(item => {
      item.classList.remove('dragging', 'author-drop-target');
      item.style.removeProperty('--drop-caret-left');
    });
  }

  announceAuthorEdit(message) {
    this.elements.authorAnnouncement.textContent = '';
    requestAnimationFrame(() => { this.elements.authorAnnouncement.textContent = message; });
  }

  /**
   * Initialize drag and drop functionality
   */
  initializeDragAndDrop() {
    const uploadArea = this.elements.uploadArea;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('drag-over');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('drag-over');
      }, false);
    });
    
    uploadArea.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  /**
   * Prevent default drag behaviors
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle file drop
   */
  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Handle file selection
   */
  handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Process uploaded file
   */
  async processFile(file) {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      this.showLoading('Processing PDF file...');
      this.showUploadProgress(0);
      
      // Validate file
      if (!await PDFProcessor.isPDFFile(file)) {
        throw new Error('Please select a valid PDF file');
      }
      
      this.currentFile = file;
      this.track('import.started', { type: 'pdf', size: file.size });
      this.setScreen('pdf-import');
      this.updateStatus('Loading PDF...', 'info');
      
      // Process PDF
      const pdfProcessor = new PDFProcessor();
      const pdfData = await pdfProcessor.loadPDF(file);
      
      this.showUploadProgress(30);
      this.updateStatus('Separating songs...', 'info');
      
      // Separate songs
      const songSeparator = new SongSeparator();
      const songs = songSeparator.separateSongs(pdfData.textItems);
      
      this.showUploadProgress(70);
      this.updateStatus('Analyzing chords...', 'info');
      
      // Process each song
      const importedSongs = songs.map((song, index) => ({
        ...SongModel.fromPDFSong(song),
        id: this.libraryStore?.createId() || `${Date.now()}-${index}`,
        transposition: 0
      }));
      for (const song of importedSongs) await this.persistSong(song);
      if (importedSongs.length) {
        await this.sessionStore.selectSong(importedSongs[0].id);
        this.syncFromSessionStore(importedSongs);
      }
      
      this.showUploadProgress(100);
      this.updateStatus(`Successfully loaded ${songs.length} songs`, 'success');
      
      // Show results
      this.hideLoading();
      this.hideUploadProgress();
      this.displaySongs();
      this.track('import.completed', { type: 'pdf', songCount: songs.length });
      
    } catch (error) {
      this.track('import.failed', { type: 'pdf' });
      this.hideLoading();
      this.hideUploadProgress();
      this.showError(error.message);
      this.updateStatus('Error processing file', 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Display songs as full lead sheets with transpose controls
   */
  displaySongs() {
    if (!this.currentSongs || this.currentSongs.length === 0) {
      this.elements.songsSection.style.display = 'none';
      return;
    }
    
    // Update song count
    this.elements.songCount.textContent = this.currentSongs.length;
    
    if (!this.currentSongs.some(song => String(song.id) === String(this.activeSongId))) {
      this.activeSongId = this.currentSongs[0].id;
    }
    this.renderSongSelectors();

    // Clear container
    this.elements.songsContainer.innerHTML = '';
    
    // Create full lead sheet view for each song
    const activeSong = this.currentSongs.find(song => String(song.id) === String(this.activeSongId));
    this.elements.songsContainer.appendChild(this.createLeadSheetView(activeSong, this.currentSongs.indexOf(activeSong)));
    
    // Show sections
    this.elements.uploadSection.style.display = 'none';
    this.elements.startSection.style.display = 'block';
    this.elements.authorSection.style.display = 'none';
    this.elements.songsSection.style.display = 'block';
    this.elements.exportButton.disabled = false;
    this.setScreen('songs');
    this.updateTelemetrySnapshot();
  }

  renderSongSelectors() {
    const options = this.currentSongs.map(song =>
      `<option value="${this.escapeHtml(String(song.id))}"${String(song.id) === String(this.activeSongId) ? ' selected' : ''}>${this.escapeHtml(song.title)} · ${this.escapeHtml(song.currentKey)}</option>`
    ).join('');
    if (this.elements.activeSongSelect) this.elements.activeSongSelect.innerHTML = options;
    if (this.elements.librarySongCount) this.elements.librarySongCount.textContent = this.currentSongs.length;
    if (this.elements.songSelectorList) {
      this.elements.songSelectorList.innerHTML = this.currentSongs.map(song => {
        const active = String(song.id) === String(this.activeSongId);
        return `<div class="song-selector-row" draggable="true" data-reorder-id="${this.escapeHtml(String(song.id))}"><button type="button" class="song-selector-item${active ? ' active' : ''}" data-song-id="${this.escapeHtml(String(song.id))}" aria-current="${active ? 'true' : 'false'}"><strong>${this.escapeHtml(song.title)}</strong><span>${this.escapeHtml(song.currentKey)}</span></button><button type="button" class="song-row-action" data-move-song="up" aria-label="Move ${this.escapeHtml(song.title)} up">↑</button><button type="button" class="song-row-action" data-move-song="down" aria-label="Move ${this.escapeHtml(song.title)} down">↓</button><button type="button" class="song-row-action danger" data-remove-song aria-label="Remove ${this.escapeHtml(song.title)} from session">×</button></div>`;
      }).join('');
      this.elements.songSelectorList.querySelectorAll('[data-song-id]').forEach(button =>
        button.addEventListener('click', () => this.selectActiveSong(button.dataset.songId)));
      this.elements.songSelectorList.querySelectorAll('[data-reorder-id]').forEach(row => {
        row.addEventListener('dragstart', event => event.dataTransfer.setData('text/song-id', row.dataset.reorderId));
        row.addEventListener('dragover', event => event.preventDefault());
        row.addEventListener('drop', event => { event.preventDefault(); this.reorderSessionSong(event.dataTransfer.getData('text/song-id'), [...row.parentElement.children].indexOf(row)); });
        row.querySelectorAll('[data-move-song]').forEach(button => button.addEventListener('click', () => {
          const index = [...row.parentElement.children].indexOf(row) + (button.dataset.moveSong === 'up' ? -1 : 1);
          this.reorderSessionSong(row.dataset.reorderId, index);
        }));
        row.querySelector('[data-remove-song]').addEventListener('click', () => this.removeSessionSong(row.dataset.reorderId));
      });
    }
  }

  async reorderSessionSong(songId, index) {
    try { await this.sessionStore.reorderSong(songId, index); this.syncFromSessionStore(); this.displaySongs(); }
    catch (error) { this.handleSessionStoreError(error, 'song.reorder'); }
  }

  async removeSessionSong(songId) {
    try {
      await this.sessionStore.removeSong(songId); this.syncFromSessionStore();
      await this.searchLibrary(this.elements.librarySearch.value);
      this.currentSongs.length ? this.displaySongs() : this.showStartView();
    } catch (error) { this.handleSessionStoreError(error, 'song.remove'); }
  }

  async selectActiveSong(songId) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return;
    try {
      await this.sessionStore.selectSong(song.id);
      this.syncFromSessionStore();
      this.displaySongs();
      this.track('song.selected', {}, this.sessionStore.currentSong);
    } catch (error) {
      this.handleSessionStoreError(error, 'song.select');
    }
  }

  /**
   * Create full lead sheet view with transpose controls
   */
  createLeadSheetView(song, index) {
    const sheet = document.createElement('div');
    sheet.className = 'lead-sheet';
    sheet.setAttribute('data-song-id', song.id);
    sheet.setAttribute('role', 'article');
    sheet.setAttribute('aria-label', `${song.title} chord sheet`);
    
    // Create transpose controls bar
    const songIdArgument = JSON.stringify(String(song.id));
    const controlsBar = `
      <div class="song-controls">
        <div class="song-header">
          <h2 class="song-title">${this.escapeHtml(song.title)}</h2>
          <div class="song-info">
            <span class="key-indicator" id="keyIndicator-${song.id}">${song.currentKey}</span>
            <span class="original-key">Original: ${song.originalKey}</span>
          </div>
        </div>
        
        <div class="transpose-controls">
          <button class="secondary-button edit-song-button" onclick='window.transposeApp.openAuthoring(${songIdArgument})' title="Edit chord sheet">Edit</button>
          <label class="spelling-policy-label">Spelling
            <select class="spelling-policy" onchange='window.transposeApp.setSpellingPolicy(${songIdArgument}, this.value)' aria-label="Chord spelling for ${this.escapeHtml(song.title)}">
              <option value="contextual"${(song.spellingPolicy || 'contextual') === 'contextual' ? ' selected' : ''}>Contextual</option>
              <option value="flats"${song.spellingPolicy === 'flats' ? ' selected' : ''}>Prefer flats</option>
              <option value="sharps"${song.spellingPolicy === 'sharps' ? ' selected' : ''}>Prefer sharps</option>
              <option value="preserve"${song.spellingPolicy === 'preserve' ? ' selected' : ''}>Preserve</option>
            </select>
          </label>
          <label>Notation<select class="view-notation" onchange='window.transposeApp.setChartView(${songIdArgument}, "notation", this.value)'><option value="chords"${(song.sessionView?.notation || 'chords') === 'chords' ? ' selected' : ''}>Chords</option><option value="nashville"${song.sessionView?.notation === 'nashville' ? ' selected' : ''}>Nashville</option></select></label>
          <label>Capo<select class="view-capo" onchange='window.transposeApp.setChartView(${songIdArgument}, "capo", this.value)'>${Array.from({length: 12}, (_, value) => `<option value="${value}"${Number(song.sessionView?.capo || 0) === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
          <label>Instrument<select class="view-instrument" onchange='window.transposeApp.setChartView(${songIdArgument}, "instrument", this.value)'>${[['concert','Concert'],['bb','B♭'],['eb','E♭'],['f','F']].map(([value,label]) => `<option value="${value}"${(song.sessionView?.instrument || 'concert') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
          <button class="secondary-button history-button" onclick='window.transposeApp.openHistory(${songIdArgument})' type="button">History</button>
          <button class="transpose-button" onclick='window.transposeApp.transposeSong(${songIdArgument}, -1)' title="Transpose down" aria-label="Transpose ${this.escapeHtml(song.title)} down one semitone">−</button>
          <div class="transpose-display">
            <div class="transpose-value" id="transposeValue-${song.id}">${song.transposition > 0 ? `+${song.transposition}` : song.transposition}</div>
            <div class="transpose-label">semitones</div>
          </div>
          <button class="transpose-button" onclick='window.transposeApp.transposeSong(${songIdArgument}, 1)' title="Transpose up" aria-label="Transpose ${this.escapeHtml(song.title)} up one semitone">+</button>
          <button class="reset-button" onclick='window.transposeApp.resetSong(${songIdArgument})' title="Reset to original key" aria-label="Reset ${this.escapeHtml(song.title)} to original key">↺</button>
        </div>
      </div>
    `;
    
    // Create the lead sheet content area
    const leadSheetContent = this.renderLeadSheetContent(song);
    
    sheet.innerHTML = `
      ${controlsBar}
      <div class="lead-sheet-content" id="leadSheet-${song.id}">
        ${leadSheetContent}
      </div>
    `;
    
    return sheet;
  }
  
  /**
   * Render the actual lead sheet content exactly like the PDF layout
   */
  renderLeadSheetContent(song) {
    if (song.sections?.length && (!song.textItems?.length || song.source?.preserveLayout === false || song.sourceType === 'manual')) {
      return this.renderStructuredContent(song);
    }

    const musicTheory = new MusicTheory();
    let html = '<div class="pdf-layout-container">';
    
    // Group text items by page and position to preserve PDF layout
    const pageGroups = this.groupTextItemsByPage(song.textItems);
    
    Object.keys(pageGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pageNum => {
      html += `<div class="pdf-page" data-page="${pageNum}" style="position: relative; min-height: 600px;">`;
      
      // Process items with absolute positioning to match PDF exactly
      const pageItems = pageGroups[pageNum];
      
      // Use absolute positioning for each text item to match PDF exactly
      pageItems.forEach(item => {
        const isChordLine = this.containsChords(item.text);
        const className = this.getPDFItemClass(item, isChordLine);
        
        // Transpose chords if this item contains them
        let displayText = item.text;
        if (isChordLine) {
          displayText = this.transposeTextItem(item.text, song.transposition, musicTheory, song);
        }
        
        // Calculate position with scaling factor to fit display
        const scaleFactor = 0.8; // Increased scale for better readability
        const left = item.x * scaleFactor;
        const top = item.y * scaleFactor;
        const fontSize = (item.fontSize || 12) * scaleFactor;
        
        html += `<div class="${className}" 
                       style="position: absolute; 
                              left: ${left}px; 
                              top: ${top}px; 
                              font-size: ${fontSize}px; 
                              font-weight: ${item.bold ? 'bold' : 'normal'};
                              font-style: ${item.italic ? 'italic' : 'normal'};
                              line-height: 1.2;
                              white-space: nowrap;
                              color: ${className.includes('chord-text') ? '#1976d2' : '#212121'} !important;">
                   ${this.escapeHtml(displayText)}
                 </div>`;
      });
      
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }

  renderStructuredContent(song, options = {}) {
    const musicTheory = new MusicTheory();
    const sections = song.sections || [];
    return `<div class="structured-chart">${sections.map((section, sectionIndex) => {
      const label = section.label ? `<div class="section-label">${this.escapeHtml(section.label)}</div>` : '';
      const lines = (section.lines || []).map((line, lineIndex) => {
        const chords = (line.chords || []).map((chord, chordIndex) => ({
          ...chord,
          chordIndex,
          displaySymbol: this.transposeForSong(chord.symbol, song, musicTheory)
        }));
        return `<div class="chart-line">
          <div class="chord-line" aria-label="Chords" data-section-index="${sectionIndex}" data-line-index="${lineIndex}">${this.renderChordAnchors(chords, { ...options, sectionIndex, lineIndex })}</div>
          <div class="lyric-line">${this.escapeHtml(line.lyrics || '') || '&nbsp;'}</div>
        </div>`;
      }).join('');
      return `<section class="section-block">${label}${lines}</section>`;
    }).join('')}</div>`;
  }

  renderChordAnchors(chords, options = {}) {
    if (!chords.length) return '&nbsp;';
    const output = [];
    let cursor = 0;
    [...chords].sort((a, b) => a.characterOffset - b.characterOffset).forEach(chord => {
      const offset = Math.max(cursor, Number(chord.characterOffset) || 0);
      if (offset > cursor) output.push(this.escapeHtml(' '.repeat(offset - cursor)));
      const symbol = this.escapeHtml(chord.displaySymbol || chord.symbol);
      if (options.interactive) {
        const timestamp = chord.timestamp ?? '';
        output.push(`<button type="button" class="chord-token" draggable="true" aria-pressed="false" data-chord-id="${this.escapeHtml(chord.id)}" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" data-character-offset="${Number(chord.characterOffset) || 0}" data-timestamp="${timestamp}" title="Drag to place; arrow keys move">${symbol}</button>`);
      } else {
        output.push(`<span class="chord-token">${symbol}</span>`);
      }
      cursor = offset + String(chord.displaySymbol || chord.symbol).length;
    });
    return output.join('');
  }

  transposeForSong(symbol, song, musicTheory = new MusicTheory()) {
    const view = { ...(song.sessionView || {}), spellingPolicy: song.spellingPolicy };
    if (view.capo && (!view.spellingPolicy || view.spellingPolicy === 'contextual')) {
      const shapeKey = musicTheory.transposeKey(song.currentKey || song.originalKey, -Number(view.capo), 'contextual');
      view.spellingPolicy = shapeKey.includes('b') ? 'flats' : 'sharps';
    }
    return musicTheory.displayChord(symbol, song, view);
  }

  async setChartView(songId, field, value) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return;
    const view = { ...(song.sessionView || {}) };
    if (field === 'notation') view.notation = value === 'nashville' ? 'nashville' : 'chords';
    if (field === 'capo') {
      view.capo = Math.max(0, Math.min(11, Number(value) || 0));
      if (view.capo) view.instrument = 'concert';
    }
    if (field === 'instrument') {
      view.instrument = ['concert', 'bb', 'eb', 'f'].includes(value) ? value : 'concert';
      if (view.instrument !== 'concert') view.capo = 0;
    }
    try {
      await this.sessionStore.updateSongOverrides(song.id, { view }); this.syncFromSessionStore(); this.displaySongs();
      this.track('view.changed', { field, value }, song);
    } catch (error) { this.handleSessionStoreError(error, 'view.change'); }
  }

  async openHistory(songId) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return;
    const versions = await this.sessionStore.listSongVersions(song.id);
    this.elements.historyDrawer.hidden = false;
    this.elements.historyList.innerHTML = versions.map(version => `<article class="history-item" data-version-id="${this.escapeHtml(version.id)}"><button type="button" data-preview-version><strong>${this.escapeHtml(version.label || `Revision ${version.revision}`)}</strong><span>${new Date(version.createdAt).toLocaleString()}</span></button><button type="button" data-label-version>Label</button><button type="button" data-restore-version>Restore</button></article>`).join('') || '<p>No saved versions yet.</p>';
    this.elements.historyList.querySelectorAll('.history-item').forEach(item => {
      const version = versions.find(entry => entry.id === item.dataset.versionId);
      item.querySelector('[data-preview-version]').addEventListener('click', () => this.previewHistory(song, version));
      item.querySelector('[data-label-version]').addEventListener('click', async () => {
        const label = window.prompt('Version label', version.label || ''); if (label === null) return;
        await this.sessionStore.labelSongVersion(version.id, label); await this.openHistory(song.id);
      });
      item.querySelector('[data-restore-version]').addEventListener('click', async () => {
        if (!window.confirm(`Restore ${version.label || `revision ${version.revision}`}? Current chart becomes a new history entry.`)) return;
        try { await this.sessionStore.restoreSongVersion(version.id); this.syncFromSessionStore(); this.displaySongs(); await this.openHistory(song.id); }
        catch (error) { this.handleSessionStoreError(error, 'history.restore'); }
      });
    });
  }

  previewHistory(current, version) {
    const before = SongModel.toEditorText(current).split('\n');
    const after = SongModel.toEditorText(version.song).split('\n');
    const changed = Math.max(before.length, after.length) - before.filter((line, index) => line === after[index]).length;
    this.elements.historyPreview.innerHTML = `<strong>${this.escapeHtml(version.label || `Revision ${version.revision}`)}</strong><p>${changed} changed line${changed === 1 ? '' : 's'} · ${after.length} total lines</p><pre>${this.escapeHtml(SongModel.toEditorText(version.song))}</pre>`;
  }

  async setSpellingPolicy(songId, policy) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song || !['contextual', 'flats', 'sharps', 'preserve'].includes(policy)) return;
    const previous = SongModel.create(song);
    try {
      await this.sessionStore.updateSongOverrides(song.id, { spellingPolicy: policy });
      this.syncFromSessionStore();
      const updated = this.currentSongs.find(item => String(item.id) === String(song.id));
      const learning = updated.sourceType === 'audio' ? this.correctionMemory.learn(previous, updated) : null;
      this.updateLeadSheetDisplay(updated);
      this.updateStatus(learning?.persisted === false
        ? `Chord spelling set to ${policy} for this session; browser storage is unavailable`
        : `Chord spelling set to ${policy}`, learning?.persisted === false ? 'warning' : 'success');
      this.track('spelling.changed', { policy }, updated);
      this.updateTelemetrySnapshot();
    } catch (error) {
      this.handleSessionStoreError(error, 'spelling.change');
    }
  }
  
  /**
   * Group text items by page number
   */
  groupTextItemsByPage(textItems) {
    const pageGroups = {};
    textItems.forEach(item => {
      if (!pageGroups[item.pageNum]) {
        pageGroups[item.pageNum] = [];
      }
      pageGroups[item.pageNum].push(item);
    });
    return pageGroups;
  }
  
  /**
   * Group items by lines based on Y position
   */
  groupItemsByLines(pageItems, tolerance = 10) {
    const lines = [];
    const processed = new Set();
    
    pageItems.forEach(item => {
      if (processed.has(item.id)) return;
      
      const line = [item];
      processed.add(item.id);
      
      // Find other items on the same line
      pageItems.forEach(otherItem => {
        if (processed.has(otherItem.id)) return;
        
        if (Math.abs(item.y - otherItem.y) <= tolerance) {
          line.push(otherItem);
          processed.add(otherItem.id);
        }
      });
      
      // Sort line items by X position
      line.sort((a, b) => a.x - b.x);
      lines.push(line);
    });
    
    return lines;
  }
  
  /**
   * Get CSS class for PDF text item
   */
  getPDFItemClass(item, isChordLine) {
    let className = 'pdf-text-item';
    
    if (isChordLine) {
      className += ' chord-text';
    } else if (this.isSectionHeader(item.text)) {
      className += ' section-header-text';
    } else if (item.bold || (item.fontSize || 12) > 14) {
      className += ' title-text';
    } else {
      className += ' lyric-text';
    }
    
    return className;
  }
  
  /**
   * Check if text is a section header
   */
  isSectionHeader(text) {
    const sectionPatterns = [
      /^VERSE\s*\d*/i, /^CHORUS\s*\d*/i, /^BRIDGE\s*/i, 
      /^PRE-CHORUS/i, /^INTRO/i, /^OUTRO/i, /^INSTRUMENTAL/i
    ];
    return sectionPatterns.some(pattern => pattern.test(text.trim()));
  }
  
  /**
   * Transpose chords within a text item
   */
  transposeTextItem(text, transposition, musicTheory, song = null) {
    const chords = musicTheory.extractChords(text);
    if (chords.length === 0) return text;
    
    let result = text;
    
    // Process chords in reverse order to avoid position shifting
    chords.sort((a, b) => b.position - a.position);
    
    chords.forEach(chord => {
      const transposedChord = song ? this.transposeForSong(chord.original, song, musicTheory) : musicTheory.transposeChord(chord.original, transposition);
      result = result.substring(0, chord.position) + 
               transposedChord + 
               result.substring(chord.position + chord.original.length);
    });
    
    return result;
  }
  
  /**
   * Check if text contains musical chords
   */
  containsChords(text) {
    if (!text) return false;
    
    const musicTheory = new MusicTheory();
    const chords = musicTheory.extractChords(text);
    return chords.length > 0;
  }
  
  /**
   * Render chords within a line with proper spacing
   */
  renderChordsInLine(line, chords, transposition, musicTheory) {
    if (chords.length === 0) {
      return this.escapeHtml(line);
    }
    
    let html = '';
    let lastPos = 0;
    
    // Sort chords by position
    chords.sort((a, b) => a.position - b.position);
    
    chords.forEach(chord => {
      // Add text before chord
      if (chord.position > lastPos) {
        html += this.escapeHtml(line.substring(lastPos, chord.position));
      }
      
      // Add transposed chord
      const transposedChord = transposition === 0 ? 
        chord.original : 
        musicTheory.transposeChord(chord.original, transposition);
      
      html += `<span class="chord" data-original="${chord.original}" data-transposed="${transposedChord}">${transposedChord}</span>`;
      
      lastPos = chord.position + chord.original.length;
    });
    
    // Add remaining text
    if (lastPos < line.length) {
      html += this.escapeHtml(line.substring(lastPos));
    }
    
    return html;
  }
  
  /**
   * Determine the type of text line for styling
   */
  getLineType(line) {
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('VERSE') || upperLine.includes('CHORUS') || 
        upperLine.includes('BRIDGE') || upperLine.includes('INTRO') ||
        upperLine.includes('OUTRO') || upperLine.includes('PRE-CHORUS')) {
      return 'section-header';
    }
    
    if (/^[A-Z\s]+$/.test(line) && line.length > 3) {
      return 'section-title';  
    }
    
    return 'lyric-line';
  }

  /**
   * Transpose individual song with real-time lead sheet updates
   */
  transposeSong(songId, semitones) {
    const visibleSong = this.currentSongs.find(s => String(s.id) === String(songId));
    if (!visibleSong) return Promise.resolve();
    const pending = this.pendingTranspose.get(String(songId));
    const target = (pending === undefined ? visibleSong.transposition : pending) + semitones;
    this.pendingTranspose.set(String(songId), target);
    const preview = SongModel.create({
      ...visibleSong,
      transposition: target,
      currentKey: new MusicTheory().transposeKey(visibleSong.originalKey, target, visibleSong.spellingPolicy || 'contextual')
    });
    this.updateLeadSheetDisplay(preview);
    this.updateTransposeDisplay(preview);
    const execution = (async () => {
      const song = this.currentSongs.find(s => String(s.id) === String(songId));
      if (!song) return;
      await this.sessionStore.updateSongOverrides(song.id, { transpose: target });
      this.syncFromSessionStore();
      const updated = this.currentSongs.find(s => String(s.id) === String(songId));
      this.updateLeadSheetDisplay(updated);
      this.updateTransposeDisplay(updated);
      if (this.pendingTranspose.get(String(songId)) === target) this.pendingTranspose.delete(String(songId));
      logger.status(`${updated.title}: ${updated.originalKey} → ${updated.currentKey} (${updated.transposition > 0 ? '+' : ''}${updated.transposition})`, 'info');
      this.track('transpose.changed', { semitones: updated.transposition }, updated);
      this.updateTelemetrySnapshot();
    })();
    execution.catch(error => {
      this.handleSessionStoreError(error, 'transpose.change');
    });
    return execution;
  }

  /**
   * Reset individual song to original key
   */
  resetSong(songId) {
    const visibleSong = this.currentSongs.find(s => String(s.id) === String(songId));
    if (!visibleSong) return Promise.resolve();
    this.pendingTranspose.set(String(songId), 0);
    const preview = SongModel.create({
      ...visibleSong,
      transposition: 0,
      currentKey: new MusicTheory().transposeKey(visibleSong.originalKey, 0, visibleSong.spellingPolicy || 'contextual')
    });
    this.updateLeadSheetDisplay(preview);
    this.updateTransposeDisplay(preview);
    const execution = (async () => {
      const song = this.currentSongs.find(s => String(s.id) === String(songId));
      if (!song) return;
      await this.sessionStore.updateSongOverrides(song.id, { transpose: 0 });
      this.syncFromSessionStore();
      const updated = this.currentSongs.find(s => String(s.id) === String(songId));
      this.updateLeadSheetDisplay(updated);
      this.updateTransposeDisplay(updated);
      if (this.pendingTranspose.get(String(songId)) === 0) this.pendingTranspose.delete(String(songId));
      logger.status(`${updated.title}: Reset to original key (${updated.originalKey})`, 'info');
      this.track('transpose.changed', { semitones: 0 }, updated);
      this.updateTelemetrySnapshot();
    })();
    execution.catch(error => {
      this.handleSessionStoreError(error, 'transpose.reset');
    });
    return execution;
  }
  
  /**
   * Update transpose display values
   */
  updateTransposeDisplay(song) {
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      transposeValue.textContent = song.transposition > 0 ? `+${song.transposition}` : song.transposition.toString();
    }
  }

  /**
   * Update lead sheet display with new transposition in real-time
   */
  updateLeadSheetDisplay(song) {
    // Update key indicator
    const keyIndicator = document.getElementById(`keyIndicator-${song.id}`);
    if (keyIndicator) {
      keyIndicator.textContent = song.currentKey;
      keyIndicator.style.backgroundColor = song.transposition !== 0 ? '#ff9800' : '#1976d2';
    }
    
    // Update transpose value display
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      const displayValue = song.transposition === 0 ? '0' : 
                          (song.transposition > 0 ? `+${song.transposition}` : `${song.transposition}`);
      transposeValue.textContent = displayValue;
      transposeValue.style.color = song.transposition !== 0 ? '#ff9800' : '#666';
    }
    
    // Re-render the entire lead sheet content with new chords
    const leadSheetContent = document.getElementById(`leadSheet-${song.id}`);
    if (leadSheetContent) {
      leadSheetContent.innerHTML = this.renderLeadSheetContent(song);
      
      // Add transition effect for smooth chord changes
      leadSheetContent.style.opacity = '0.7';
      setTimeout(() => {
        leadSheetContent.style.opacity = '1';
      }, 150);
    }
  }

  /**
   * Update song card display
   */
  updateSongCard(song) {
    // Update key indicator
    const keyIndicator = document.getElementById(`keyIndicator-${song.id}`);
    if (keyIndicator) {
      keyIndicator.textContent = song.currentKey;
      keyIndicator.style.backgroundColor = song.transposition !== 0 ? '#ff9800' : '#1976d2';
    }
    
    // Update transpose value
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      const displayValue = song.transposition === 0 ? '0' : 
                          (song.transposition > 0 ? `+${song.transposition}` : `${song.transposition}`);
      transposeValue.textContent = displayValue;
      transposeValue.style.color = song.transposition !== 0 ? '#ff9800' : '#757575';
    }
    
    // Update chord preview
    const chordPreview = document.getElementById(`chordPreview-${song.id}`);
    if (chordPreview && song.transposition !== 0) {
      const musicTheory = new MusicTheory();
      const transposedChords = song.chords.slice(0, 10).map(chord =>
        this.transposeForSong(chord.original, song, musicTheory)
      );
      chordPreview.textContent = transposedChords.join(' ');
    } else if (chordPreview) {
      chordPreview.textContent = song.chordsPreview;
    }
  }

  /**
   * Show export section
   */
  showExportSection() {
    this.elements.exportSection.style.display = 'block';
    this.elements.exportSection.scrollIntoView({ behavior: 'smooth' });
    this.setScreen('export');
  }

  async importChordPro(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const songs = ChordPro.parse(await file.text());
      if (!songs.length) throw new Error('No songs found in ChordPro file');
      for (const parsed of songs) {
        parsed.id = this.libraryStore.createId();
        await this.persistSong(parsed);
      }
      this.syncFromSessionStore(songs); this.displaySongs();
      this.updateStatus(`Imported ${songs.length} ChordPro song${songs.length === 1 ? '' : 's'}`, 'success');
    } catch (error) { this.showError(`ChordPro import failed: ${error.message}`); }
    finally { event.target.value = ''; }
  }

  exportChordPro() {
    if (!this.currentSongs.length) return;
    const musicTheory = new MusicTheory();
    const content = this.currentSongs.map(song => ChordPro.serialize(song, {
      chordDisplay: symbol => this.transposeForSong(symbol, song, musicTheory)
    }).trimEnd()).join('\n{new_song}\n');
    const blob = new Blob([`${content}\n`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${new PDFGenerator().sanitizeFilename(this.exportFilename)}.cho`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    this.track('export.completed', { format: 'chordpro', songCount: this.currentSongs.length });
  }

  /**
   * Handle PDF export
   */
  async handleExport() {
    if (this.isProcessing || !this.currentSongs || this.currentSongs.length === 0) return;
    
    try {
      this.isProcessing = true;
      this.showExportProgress(0);
      this.updateStatus('Generating PDF...', 'info');
      this.track('export.opened', { songCount: this.currentSongs.length });
      
      // Generate PDF
      const pdfGenerator = new PDFGenerator();
      this.showExportProgress(30);
      
      const pdf = await pdfGenerator.generatePDF(this.currentSongs, this.exportFilename);
      this.showExportProgress(80);
      
      // Save PDF
      pdfGenerator.savePDF(pdf, this.exportFilename);
      this.showExportProgress(100);
      
      this.updateStatus('PDF exported successfully', 'success');
      this.track('export.completed', { songCount: this.currentSongs.length });
      
      // Hide progress after delay
      setTimeout(() => {
        this.hideExportProgress();
      }, 2000);
      
    } catch (error) {
      this.track('export.failed');
      this.hideExportProgress();
      this.showError(`Export failed: ${error.message}`);
      this.updateStatus('Export failed', 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Show/hide loading overlay
   */
  showLoading(message = 'Processing...') {
    this.elements.loadingText.textContent = message;
    this.elements.loadingOverlay.style.display = 'flex';
    document.getElementById('mainContent')?.setAttribute('aria-busy', 'true');
  }

  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
    document.getElementById('mainContent')?.removeAttribute('aria-busy');
  }

  /**
   * Show/hide upload progress
   */
  showUploadProgress(percentage) {
    this.elements.uploadProgress.style.display = 'block';
    this.elements.progressFill.style.width = `${percentage}%`;
    this.elements.uploadProgressTrack?.setAttribute('aria-valuenow', String(percentage));
    this.elements.progressText.textContent = `Processing... ${percentage}%`;
    this.track('import.progress', { type: 'pdf', progress: percentage });
  }

  hideUploadProgress() {
    this.elements.uploadProgress.style.display = 'none';
  }

  /**
   * Show/hide export progress
   */
  showExportProgress(percentage) {
    this.elements.exportProgress.style.display = 'block';
    this.elements.exportProgressFill.style.width = `${percentage}%`;
    this.elements.exportProgressTrack?.setAttribute('aria-valuenow', String(percentage));
    this.elements.exportProgressText.textContent = `Generating PDF... ${percentage}%`;
  }

  hideExportProgress() {
    this.elements.exportProgress.style.display = 'none';
  }

  /**
   * Update status indicator
   */
  updateStatus(message, type = 'info') {
    this.elements.statusIndicator.textContent = message;
    this.elements.statusIndicator.className = `status-indicator ${type}`;
  }

  /**
   * Show error dialog
   */
  showError(message, allowRetry = false) {
    this.track('ui.error', { operation: 'user-visible', errorCode: 'shown' });
    this.updateTelemetrySnapshot({ lastError: 'user-visible' });
    this.lastFocusedElement = document.activeElement;
    this.elements.errorMessage.textContent = message;
    this.elements.errorRetry.style.display = allowRetry ? 'inline-block' : 'none';
    this.elements.errorPanel.style.display = 'flex';
    this.elements.errorClose.focus();
  }

  /**
   * Hide error dialog
   */
  hideError() {
    this.elements.errorPanel.style.display = 'none';
    this.lastFocusedElement?.focus?.();
    this.lastFocusedElement = null;
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Reset application state
   */
  reset() {
    this.syncFromSessionStore();
    this.currentFile = null;
    this.isProcessing = false;
    
    // Reset UI
    this.elements.uploadSection.style.display = 'flex';
    this.elements.songsSection.style.display = 'none';
    this.elements.exportSection.style.display = 'none';
    this.elements.fileInput.value = '';
    this.elements.songsContainer.innerHTML = '';
    
    this.hideLoading();
    this.hideUploadProgress();
    this.hideExportProgress();
    this.hideError();
    
    this.updateStatus('Ready', 'info');
  }

  /**
   * Show health check (development mode)
   */
  async showHealthCheck() {
    try {
      const results = await healthCheck();
      let html = '';
      
      results.forEach(result => {
        const statusClass = result.status === 'PASS' ? 'pass' : 
                           result.status === 'FAIL' ? 'fail' : 'error';
        html += `
          <div class="health-item">
            <span>${result.name}</span>
            <span class="health-status ${statusClass}">${result.status}</span>
          </div>
        `;
      });
      
      this.elements.healthResults.innerHTML = html;
      this.elements.healthCheck.style.display = 'block';
      
      // Hide after 10 seconds
      setTimeout(() => {
        this.elements.healthCheck.style.display = 'none';
      }, 10000);
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    const editable = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
    if (editable && e.key !== 'Escape') return;
    // Ctrl/Cmd + O: Open file
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      this.elements.fileInput.click();
    }
    
    // Ctrl/Cmd + E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      if (!this.elements.exportButton.disabled) {
        this.handleExport();
      }
    }
    
    // Escape: Close error dialog
    if (e.key === 'Escape') {
      this.hideError();
    }
  }

  /**
   * Initialize keyboard shortcuts
   */
  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  /**
   * Get current application state
   */
  getState() {
    return {
      songCount: this.currentSongs.length,
      isProcessing: this.isProcessing,
      currentFile: this.currentFile?.name || null,
      exportFilename: this.exportFilename,
      songs: this.currentSongs.map(song => ({
        id: song.id,
        title: song.title,
        originalKey: song.originalKey,
        currentKey: song.currentKey,
        transposition: song.transposition,
        chordCount: song.chords.length
      }))
    };
  }
}

// Global functions for onclick handlers
window.transposeApp = null;

window.closeError = function() {
  if (window.transposeApp) {
    window.transposeApp.hideError();
  }
};

window.retryOperation = function() {
  if (window.transposeApp && window.transposeApp.currentFile) {
    window.transposeApp.hideError();
    window.transposeApp.processFile(window.transposeApp.currentFile);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.UIController = UIController;
}
