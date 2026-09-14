/**
 * UI Controller Module
 * Manages user interface state, interactions, and updates
 */

class UIController {
  constructor(observability = null) {
    this.currentSongs = [];
    this.isProcessing = false;
    this.currentFile = null;
    this.exportFilename = 'Transposed Songbook';
    this.editingSongId = null;
    this.audioAbortController = null;
    this.audioJobId = null;
    this.lyricsFileRead = Promise.resolve();
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
    const sessionTelemetry = typeof SessionTelemetry !== 'undefined' ? new SessionTelemetry() : null;
    this.observability = observability || (typeof Observability !== 'undefined' ? new Observability() : null);
    this.observability?.setTelemetry?.(sessionTelemetry);
    // Read-only compatibility view; Observability owns the telemetry transport.
    Object.defineProperty(this, 'telemetry', { enumerable: true, get: () => this.observability?.telemetry || null });
    this.activeSession = null;
    this.activeSongId = null;
    this.songRevisions = new Map();
    this.autosaveTimer = null;
    this.pendingRecoveryDraft = null;
    this.authorDraftPersistentId = null;
    this.sessionSaveQueue = Promise.resolve();
    this.pendingTranspose = new Map();
    this.reviewQueue = null;
    this.rehearsal = null;
    this.rehearsalSongId = null;
    this.currentAudioObjectUrl = null;
    this.audioJobClient = typeof AudioJobClient !== 'undefined' ? new AudioJobClient() : null;
    
    // Initialize UI elements
    this.initializeElements();
    this.chartRenderer = new ChartRenderer({ MusicTheoryClass: MusicTheory, escapeHtml: value => this.escapeHtml(value) });
    this.authoringController = new AuthoringController(this);
    this.workspaceController = new WorkspaceController(this, this.elements.sessionWorkspace).attach();
    this.initializeLiveControllers();
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
      sessionWorkspace: document.getElementById('sessionWorkspace'),
      songSelectorList: document.getElementById('songSelectorList'),
      sidebarSongControls: document.getElementById('sidebarSongControls'),
      songLibrarySidebar: document.getElementById('songLibrarySidebar'),
      sidebarCollapseToggle: document.getElementById('sidebarCollapseToggle'),
      songToolsToggle: document.getElementById('songToolsToggle'),
      songToolsClose: document.getElementById('songToolsClose'),
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
      companionButton: document.getElementById('companionButton'),
      controlsButton: document.getElementById('controlsButton'),
      controlDrawer: document.getElementById('controlDrawer'),
      closeControlsButton: document.getElementById('closeControlsButton'),
      connectMidiButton: document.getElementById('connectMidiButton'),
      midiStatus: document.getElementById('midiStatus'),
      bindingList: document.getElementById('bindingList'),
      bindingConflict: document.getElementById('bindingConflict'),
      replaceBindingButton: document.getElementById('replaceBindingButton'),
      reviewButton: document.getElementById('reviewButton'),
      reviewBadge: document.getElementById('reviewBadge'),
      reviewRail: document.getElementById('reviewRail'),
      reviewItem: document.getElementById('reviewItem'),
      closeReviewButton: document.getElementById('closeReviewButton'),
      reviewAccept: document.getElementById('reviewAccept'),
      reviewEdit: document.getElementById('reviewEdit'),
      reviewRemove: document.getElementById('reviewRemove'),
      reviewUndo: document.getElementById('reviewUndo'),
      performanceButton: document.getElementById('performanceButton'),
      performanceShell: document.getElementById('performanceShell'),
      performanceTitle: document.getElementById('performanceTitle'),
      performanceChart: document.getElementById('performanceChart'),
      performanceExit: document.getElementById('performanceExit'),
      performancePrev: document.getElementById('performancePrev'),
      performanceNext: document.getElementById('performanceNext'),
      performanceFont: document.getElementById('performanceFont'),
      performanceColumns: document.getElementById('performanceColumns'),
      performanceAutoscroll: document.getElementById('performanceAutoscroll'),
      rehearsalPanel: document.getElementById('rehearsalPanel'),
      rehearsalAudio: document.getElementById('rehearsalAudio'),
      rehearsalAvailability: document.getElementById('rehearsalAvailability'),
      rehearsalPlay: document.getElementById('rehearsalPlay'),
      rehearsalSeek: document.getElementById('rehearsalSeek'),
      rehearsalRate: document.getElementById('rehearsalRate'),
      rehearsalLoop: document.getElementById('rehearsalLoop'),
      rehearsalFollow: document.getElementById('rehearsalFollow'),
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
      sidebarCreateChartButton: document.getElementById('sidebarCreateChartButton'),
      sidebarImportPdfButton: document.getElementById('sidebarImportPdfButton'),
      sidebarImportChordProButton: document.getElementById('sidebarImportChordProButton'),
      sidebarImportAudioButton: document.getElementById('sidebarImportAudioButton'),
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
  initializeLiveControllers() {
    this.performance = new PerformanceController({
      getSongs: () => this.currentSongs,
      getActiveSongId: () => this.activeSongId,
      selectSong: id => this.selectActiveSong(id),
      render: state => this.renderPerformance(state)
    });
    this.performance.bindGestureSurface(this.elements.performanceShell);
    this.controlBindings = new ControlBindings({ actions: {
      previous: () => this.performance.previous(), next: () => this.performance.next(),
      transposeDown: () => this.transposeSong(this.activeSongId, -1),
      transposeUp: () => this.transposeSong(this.activeSongId, 1),
      playPause: () => this.toggleRehearsal()
    }});
    const assignBinding = this.controlBindings.assign.bind(this.controlBindings);
    this.controlBindings.assign = (...args) => {
      const result = assignBinding(...args);
      queueMicrotask(() => this.renderBindings());
      return result;
    };
    document.addEventListener('keydown', event => {
      const capturing = Boolean(this.controlBindings.captureState);
      this.controlBindings.handleKeydown(event);
      if (capturing) this.renderBindings();
    });
    this.renderBindings();
  }

  attachEventListeners() {
    const sidebarCollapsed = localStorage.getItem('transposepdf.sidebar-collapsed') === 'true';
    this.setSidebarCollapsed(sidebarCollapsed);
    this.elements.sidebarCollapseToggle?.addEventListener('click', () => {
      this.setSidebarCollapsed(!this.elements.sessionWorkspace?.classList.contains('sidebar-collapsed'));
    });
    this.elements.songToolsToggle?.addEventListener('click', () => {
      const open = this.elements.songLibrarySidebar?.dataset.mobileOpen !== 'true';
      if (this.elements.songLibrarySidebar) this.elements.songLibrarySidebar.dataset.mobileOpen = String(open);
      this.elements.songToolsToggle.setAttribute('aria-expanded', String(open));
      this.elements.songToolsToggle.textContent = open ? 'Close song tools' : 'Song tools';
    });
    this.elements.songToolsClose?.addEventListener('click', () => {
      if (this.elements.songLibrarySidebar) this.elements.songLibrarySidebar.dataset.mobileOpen = 'false';
      this.elements.songToolsToggle?.setAttribute('aria-expanded', 'false');
      if (this.elements.songToolsToggle) this.elements.songToolsToggle.textContent = 'Song tools';
      this.elements.songToolsToggle?.focus();
    });
    // File input
    this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));

    this.elements.createChartButton.addEventListener('click', () => this.openAuthoring());
    this.elements.importPdfButton.addEventListener('click', () => this.showStartView('pdf'));
    this.elements.importAudioButton.addEventListener('click', () => this.showStartView('audio'));
    this.elements.sidebarCreateChartButton?.addEventListener('click', () => this.openAuthoring());
    this.elements.sidebarImportPdfButton?.addEventListener('click', () => this.showStartView('pdf'));
    this.elements.sidebarImportAudioButton?.addEventListener('click', () => this.showStartView('audio'));
    this.elements.cancelImportButton.addEventListener('click', () => this.showStartView());
    this.elements.cancelAuthorButton.addEventListener('click', () => this.closeAuthoring());
    this.elements.cancelAudioButton.addEventListener('click', () => this.cancelAudioAnalysis());
    this.elements.audioFileButton.addEventListener('click', () => this.elements.audioFileInput.click());
    this.elements.lyricsFileButton.addEventListener('click', () => this.elements.lyricsFileInput.click());
    this.elements.audioFileInput.addEventListener('change', event => this.handleAudioUpload(event));
    this.elements.lyricsFileInput.addEventListener('change', event => {
      this.lyricsFileRead = this.handleLyricsFile(event);
    });
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
    this.elements.sidebarImportChordProButton?.addEventListener('click', () => this.elements.chordProFileInput.click());
    this.elements.chordProFileInput?.addEventListener('change', event => this.importChordPro(event));
    this.elements.companionButton?.addEventListener('click', () => this.openCompanion());
    this.elements.performanceButton?.addEventListener('click', () => this.enterPerformance());
    this.elements.performanceExit?.addEventListener('click', () => this.performance.exit());
    this.elements.performancePrev?.addEventListener('click', () => this.performance.previous());
    this.elements.performanceNext?.addEventListener('click', () => this.performance.next());
    this.elements.performanceFont?.addEventListener('input', event => this.performance.setFontScale(event.target.value));
    this.elements.performanceColumns?.addEventListener('change', event => this.performance.setColumns(event.target.value));
    this.elements.performanceAutoscroll?.addEventListener('change', event => this.performance.setAutoscroll(event.target.checked));
    this.elements.controlsButton?.addEventListener('click', () => { this.elements.controlDrawer.hidden = false; });
    this.elements.closeControlsButton?.addEventListener('click', () => { this.elements.controlDrawer.hidden = true; });
    this.elements.connectMidiButton?.addEventListener('click', async () => {
      const connected = await this.controlBindings.connectMIDI();
      this.elements.midiStatus.textContent = connected ? 'MIDI connected' : 'MIDI unavailable';
    });
    this.elements.replaceBindingButton?.addEventListener('click', () => { this.controlBindings.replaceConflict(); this.renderBindings(); });
    this.elements.reviewButton?.addEventListener('click', () => this.openReview());
    this.elements.closeReviewButton?.addEventListener('click', () => { this.elements.reviewRail.hidden = true; });
    this.elements.reviewAccept?.addEventListener('click', () => this.applyReview('accept'));
    this.elements.reviewEdit?.addEventListener('click', () => this.applyReview('edit'));
    this.elements.reviewRemove?.addEventListener('click', () => this.applyReview('remove'));
    this.elements.reviewUndo?.addEventListener('click', () => this.applyReview('undo'));
    this.elements.rehearsalPlay?.addEventListener('click', () => this.toggleRehearsal());
    this.elements.rehearsalSeek?.addEventListener('input', event => this.rehearsal?.seek(event.target.value));
    this.elements.rehearsalRate?.addEventListener('change', event => this.rehearsal?.setRate(event.target.value));
    this.elements.rehearsalLoop?.addEventListener('click', () => this.toggleRehearsalLoop());
    this.elements.rehearsalFollow?.addEventListener('click', () => { this.rehearsal?.follow ? this.rehearsal.pauseFollow() : this.rehearsal?.resumeFollow(); });
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

  setSidebarCollapsed(collapsed) {
    const isDesktop = window.matchMedia('(min-width: 901px)').matches;
    const next = Boolean(collapsed && isDesktop);
    this.elements.sessionWorkspace?.classList.toggle('sidebar-collapsed', next);
    this.elements.sidebarCollapseToggle?.setAttribute('aria-expanded', String(!next));
    this.elements.sidebarCollapseToggle?.setAttribute('title', next ? 'Expand song tools' : 'Collapse song tools');
    const icon = this.elements.sidebarCollapseToggle?.querySelector('[aria-hidden="true"]');
    const label = this.elements.sidebarCollapseToggle?.querySelector('.sidebar-collapse-label');
    if (icon) icon.textContent = next ? '›' : '‹';
    if (label) label.textContent = next ? 'Expand' : 'Collapse';
    try { localStorage.setItem('transposepdf.sidebar-collapsed', String(next)); } catch (_) { /* optional preference */ }
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
    this.observability?.emit(eventType, data, {
      screen: this.observability?.screen,
      songId: song?.id || this.activeSongId,
      sourceType: song?.sourceType || null
    });
  }

  updateTelemetrySnapshot(extra = {}) {
    try {
      const rehearsalState = this.rehearsal?.state();
      this.observability?.updateSnapshot({
        screen: this.observability.screen,
        activeSongId: this.activeSongId,
        currentSongs: this.currentSongs.map(song => ({ ...song, telemetryId: String(song.id) })),
        editor: this.elements.authorSection?.style.display !== 'none' ? this.editorSnapshot() : null,
        ...extra
      });
      if (this.observability?.snapshot) Object.assign(this.observability.snapshot, {
        sessionName: this.activeSession?.name || 'Current Session',
        performance: rehearsalState
          ? { currentTime: rehearsalState.currentTime, ...rehearsalState.activeLine }
          : { scrollTop: this.performance?.scrollPositions.get(String(this.activeSongId)) || 0 }
      });
    } catch (_) {}
  }

  setScreen(screen, data = {}) {
    this.observability?.setScreen(screen, data);
    this.updateTelemetrySnapshot();
  }

  showStartView(mode = 'start') {
    this.elements.startSection.style.display = mode === 'start' && !this.currentSongs.length ? 'block' : 'none';
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
    // Reload can finish networking before IndexedDB/session hydration finishes.
    // Never let a new import race the restored session and overwrite its state.
    await this.ready;
    // File selection events can arrive back-to-back. Finish reading an authoritative
    // lyric sheet before snapshotting the text into the audio-analysis request.
    await this.lyricsFileRead;
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
      const result = this.audioJobClient
        ? await this.audioJobClient.wait(payload.jobId, {
          signal: this.audioAbortController.signal,
          onProgress: job => this.updateAudioProgress(job.stage, job.progress, 'Lyrics, key, and chord timing remain editable when complete.'),
          pollingFallback: (jobId, options) => this.audioJobClient.poll(jobId, options)
        })
        : await this.waitForAudioJob(payload.jobId, this.audioAbortController.signal);
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
      this.enableRehearsal(file, savedSong);
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

  openAuthoring(...args) { return this.authoringController.openAuthoring(...args); }
  closeAuthoring(...args) { return this.authoringController.closeAuthoring(...args); }
  async saveAuthoredSong(...args) { return this.authoringController.saveAuthoredSong(...args); }
  updateAuthorPreview(...args) { return this.authoringController.updateAuthorPreview(...args); }
  setAuthorPane(...args) { return this.authoringController.setAuthorPane(...args); }
  nudgeSelectedAuthorChord(...args) { return this.authoringController.nudgeSelectedAuthorChord(...args); }
  handleAuthorPointerDown(...args) { return this.authoringController.handleAuthorPointerDown(...args); }
  handleAuthorPointerMove(...args) { return this.authoringController.handleAuthorPointerMove(...args); }
  handleAuthorPointerUp(...args) { return this.authoringController.handleAuthorPointerUp(...args); }
  clearAuthorPointerDrag(...args) { return this.authoringController.clearAuthorPointerDrag(...args); }
  authorChordKey(...args) { return this.authoringController.authorChordKey(...args); }
  selectAuthorChord(...args) { return this.authoringController.selectAuthorChord(...args); }
  restoreAuthorChordSelection(...args) { return this.authoringController.restoreAuthorChordSelection(...args); }
  saveAuthorTimingOverride(...args) { return this.authoringController.saveAuthorTimingOverride(...args); }
  applyAuthorTimingOverrides(...args) { return this.authoringController.applyAuthorTimingOverrides(...args); }
  handleAuthorChordDragStart(...args) { return this.authoringController.handleAuthorChordDragStart(...args); }
  handleAuthorChordDragOver(...args) { return this.authoringController.handleAuthorChordDragOver(...args); }
  handleAuthorChordDragLeave(...args) { return this.authoringController.handleAuthorChordDragLeave(...args); }
  handleAuthorChordDrop(...args) { return this.authoringController.handleAuthorChordDrop(...args); }
  handleAuthorChordKeydown(...args) { return this.authoringController.handleAuthorChordKeydown(...args); }
  moveAuthorChord(...args) { return this.authoringController.moveAuthorChord(...args); }
  availableChordOffset(...args) { return this.authoringController.availableChordOffset(...args); }
  measureAuthorCharacterWidth(...args) { return this.authoringController.measureAuthorCharacterWidth(...args); }
  clearAuthorDragState(...args) { return this.authoringController.clearAuthorDragState(...args); }
  announceAuthorEdit(...args) { return this.authoringController.announceAuthorEdit(...args); }
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
    this.refreshReviewQueue();

    // Clear container
    this.elements.songsContainer.innerHTML = '';
    
    // Create full lead sheet view for each song
    const activeSong = this.currentSongs.find(song => String(song.id) === String(this.activeSongId));
    this.renderSidebarSongControls(activeSong);
    this.elements.songsContainer.appendChild(this.createLeadSheetView(activeSong, this.currentSongs.indexOf(activeSong)));
    
    // Show sections
    this.elements.uploadSection.style.display = 'none';
    this.elements.startSection.style.display = 'none';
    this.elements.authorSection.style.display = 'none';
    this.elements.songsSection.style.display = 'block';
    this.elements.exportButton.disabled = false;
    this.setScreen('songs');
    this.updateTelemetrySnapshot();
    if (this.performance?.state.active) this.renderPerformance(this.performance.snapshot());
    this.syncRehearsalAvailability();
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
        const id = this.escapeHtml(String(song.id));
        return `<div class="song-selector-row" draggable="true" data-reorder-id="${id}" data-song-id="${id}"><button type="button" class="song-selector-item${active ? ' active' : ''}" data-action="select-song" data-song-id="${id}" aria-current="${active ? 'true' : 'false'}"><strong>${this.escapeHtml(song.title)}</strong><span>${this.escapeHtml(song.currentKey)}</span></button><button type="button" class="song-row-action" data-action="move-song" data-direction="up" data-song-id="${id}" aria-label="Move ${this.escapeHtml(song.title)} up">↑</button><button type="button" class="song-row-action" data-action="move-song" data-direction="down" data-song-id="${id}" aria-label="Move ${this.escapeHtml(song.title)} down">↓</button><button type="button" class="song-row-action danger" data-action="remove-song" data-song-id="${id}" aria-label="Remove ${this.escapeHtml(song.title)} from session">×</button></div>`;
      }).join('');
    }
  }

  renderSidebarSongControls(song) {
    if (!this.elements.sidebarSongControls || !song) return;
    const songId = this.escapeHtml(String(song.id));
    const transposition = Number(song.transposition) || 0;
    this.elements.sidebarSongControls.innerHTML = `
      <div class="sidebar-song-heading"><span class="sidebar-eyebrow">Now editing</span><h2>${this.escapeHtml(song.title)}</h2><p><strong id="keyIndicator-${song.id}">Key of ${this.escapeHtml(song.currentKey)}</strong><span>Original ${this.escapeHtml(song.originalKey)}</span></p></div>
      <button class="sidebar-edit-state edit-song-button" data-action="focus-chart" data-song-id="${songId}" type="button">Editing on chart</button>
      <div class="sidebar-control-group">
        <label>Chord spelling<select class="spelling-policy" data-action="set-spelling" data-song-id="${songId}" aria-label="Chord spelling for ${this.escapeHtml(song.title)}"><option value="contextual"${(song.spellingPolicy || 'contextual') === 'contextual' ? ' selected' : ''}>Contextual</option><option value="flats"${song.spellingPolicy === 'flats' ? ' selected' : ''}>Prefer flats</option><option value="sharps"${song.spellingPolicy === 'sharps' ? ' selected' : ''}>Prefer sharps</option><option value="preserve"${song.spellingPolicy === 'preserve' ? ' selected' : ''}>Preserve</option></select></label>
        <label>Notation<select class="view-notation" data-action="set-chart-view" data-field="notation" data-song-id="${songId}"><option value="chords"${(song.sessionView?.notation || 'chords') === 'chords' ? ' selected' : ''}>Chord symbols</option><option value="nashville"${song.sessionView?.notation === 'nashville' ? ' selected' : ''}>Nashville</option></select></label>
        <label>Capo<select class="view-capo" data-action="set-chart-view" data-field="capo" data-song-id="${songId}">${Array.from({length: 12}, (_, value) => `<option value="${value}"${Number(song.sessionView?.capo || 0) === value ? ' selected' : ''}>${value ? `Capo ${value}` : 'No capo'}</option>`).join('')}</select></label>
        <label>Instrument<select class="view-instrument" data-action="set-chart-view" data-field="instrument" data-song-id="${songId}">${[['concert','Concert'],['bb','B♭'],['eb','E♭'],['f','F']].map(([value,label]) => `<option value="${value}"${(song.sessionView?.instrument || 'concert') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
      </div>
      <div class="sidebar-transpose" aria-label="Transpose ${this.escapeHtml(song.title)}"><span>Transpose</span><div><button data-action="transpose-song" data-song-id="${songId}" data-semitones="-1" type="button" aria-label="Transpose down">−</button><output id="transposeValue-${song.id}">${transposition > 0 ? `+${transposition}` : transposition}<small>semitones</small></output><button data-action="transpose-song" data-song-id="${songId}" data-semitones="1" type="button" aria-label="Transpose up">+</button></div></div>
      <fieldset class="sidebar-columns"><legend>Columns</legend><div role="group" aria-label="Chart columns">${[1, 2, 3].map(columns => `<button type="button" data-action="set-layout-columns" data-song-id="${songId}" data-columns="${columns}" aria-pressed="${Number(song.layout?.columns || 1) === columns}">${columns}</button>`).join('')}</div><small>Wide chart and PDF</small></fieldset>
      <label class="sidebar-font-size">Text size<select data-action="set-chart-font-size" data-song-id="${songId}" aria-label="Chart text size for ${this.escapeHtml(song.title)}">${Array.from({length: 9}, (_, index) => index + 10).map(size => `<option value="${size}"${Number(song.layout?.fontSize || 13) === size ? ' selected' : ''}>${size} pt</option>`).join('')}</select><small>Editor and PDF</small></label>
      <div class="sidebar-tool-links"><button data-action="reset-song" data-song-id="${songId}" type="button">↺ Reset original key</button><button data-action="open-history" data-song-id="${songId}" type="button">◷ Version history</button></div>`;
  }

  async setSongLayoutColumns(songId, value) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return false;
    const edited = SongModel.create(song);
    edited.layout = { ...edited.layout, columns: Math.max(1, Math.min(3, Math.round(Number(value) || 1))), columnsProvenance: 'manual' };
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.displaySongs();
      this.track('chart.layout.changed', { columns: saved.layout.columns }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async setSongFontSize(songId, value) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return false;
    const edited = SongModel.create(song);
    edited.layout = { ...edited.layout, fontSize: Math.max(10, Math.min(18, Math.round(Number(value) || 13))) };
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.displaySongs();
      this.track('chart.layout.changed', { columns: saved.layout.columns, fontSize: saved.layout.fontSize }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async useInferredArrangement(songId) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return false;
    const edited = SongModel.create(song);
    const inferredValue = typeof Arrangement !== 'undefined' ? Arrangement.infer(edited.sections) : SongModel.inferArrangement(edited.sections);
    edited.arrangement = { mode: 'auto', value: inferredValue, inferredValue, updatedAt: Date.now() };
    try {
      await this.persistSong(edited, { addToSession: false });
      this.displaySongs();
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
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
    
    // Create the lead sheet content area
    const leadSheetContent = this.renderLeadSheetContent(song);
    
    sheet.innerHTML = `
      <div class="lead-sheet-content" id="leadSheet-${song.id}">
        ${leadSheetContent}
      </div>
    `;
    
    return sheet;
  }
  
  /**
   * Render the actual lead sheet content exactly like the PDF layout
   */
  renderLeadSheetContent(song, options = {}) {
    return this.chartRenderer.renderLeadSheetContent(song, { editable: options.editable ?? true, ...options });
  }

  recordInlineUndo(song) {
    if (!song) return;
    this.inlineUndoStack ||= [];
    this.inlineUndoStack.push({ songId: String(song.id), song: SongModel.create(song) });
    if (this.inlineUndoStack.length > 50) this.inlineUndoStack.shift();
  }

  hasInlineUndo() { return Boolean(this.inlineUndoStack?.length); }

  async undoInlineEdit() {
    const undo = this.inlineUndoStack?.pop();
    if (!undo) return false;
    try {
      const saved = await this.persistSong(SongModel.create(undo.song), { addToSession: false });
      this.updateLeadSheetDisplay(saved);
      this.updateStatus('Chart change undone', 'success');
      this.track('chart.edit.undone', {}, saved);
      return true;
    } catch (_) { this.inlineUndoStack.push(undo); return false; }
  }

  async commitInlineChartEdit(target, value) {
    const sheet = target.closest('.lead-sheet[data-song-id]');
    const song = this.currentSongs.find(item => String(item.id) === String(sheet?.dataset.songId));
    if (!song) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const field = target.dataset.inlineField;
    if (field === 'writer' || field === 'arranger') {
      edited.credits[field] = { value: String(value).replace(/[\r\n]+/g, '').trim(), provenance: 'manual', updatedAt: Date.now() };
    } else if (field === 'arrangement') {
      edited.arrangement = { ...(edited.arrangement || {}), mode: 'manual', value: String(value).replace(/[\r\n]+/g, ''), updatedAt: Date.now() };
    }
    const sectionIndex = Number(target.dataset.sectionIndex);
    const section = edited.sections[sectionIndex];
    if (!['writer', 'arranger', 'arrangement'].includes(field) && !section) return false;
    if (target.dataset.inlineField === 'section-label') {
      section.label = String(value).replace(/[\r\n]+/g, '').trim();
      section.labelProvenance = 'manual';
      delete section.pendingSection;
      this.updateInferredArrangement(edited);
    }
    const line = section?.lines?.[Number(target.dataset.lineIndex)];
    if (!['section-label', 'writer', 'arranger', 'arrangement'].includes(field) && !line) return false;
    if (target.dataset.inlineField === 'lyrics') {
      const segmentText = String(value).replace(/[\r\n]+/g, '');
      const sourceStart = Number(target.dataset.sourceStart);
      const sourceEnd = Number(target.dataset.sourceEnd);
      const nextLyrics = Number.isFinite(sourceStart) && Number.isFinite(sourceEnd)
        ? `${String(line.lyrics || '').slice(0, sourceStart)}${segmentText}${String(line.lyrics || '').slice(sourceEnd)}`
        : segmentText;
      Object.assign(line, LyricAnchor.reconcileLine(line, line.lyrics || '', nextLyrics));
    }
    if (target.dataset.inlineField === 'chord') {
      const chordId = target.dataset.chordId || target.closest('.inline-chord-anchor')?.dataset.chordId;
      const index = line.chords.findIndex(chord => String(chord.id) === String(chordId));
      if (index < 0) return false;
      const symbol = String(value).replace(/\s+/g, '').trim();
      const view = { ...(edited.sessionView || {}), spellingPolicy: edited.spellingPolicy };
      const converted = new MusicTheory().canonicalChordFromDisplay(symbol, edited, view);
      if (!converted.ok) {
        target.dataset.inlineSaving = 'false';
        target.classList.add('inline-edit-invalid');
        target.setAttribute('aria-invalid', 'true');
        target.title = converted.error;
        this.updateStatus(converted.error, 'error');
        this.track('chart.inline_edit.invalid', { field: 'chord', value: symbol }, song);
        return false;
      }
      if (symbol) {
        line.chords[index].symbol = converted.canonical;
        line.chords[index].originalSymbol = converted.canonical;
        line.chords[index].manualEntry = converted.manualEntry;
        delete line.chords[index].displaySpelling;
      }
      else line.chords.splice(index, 1);
    }
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      this.updateStatus('Chart edit saved', 'success');
      this.track('chart.inline_edit.saved', { field: target.dataset.inlineField }, saved);
      return true;
    } catch (error) {
      this.updateLeadSheetDisplay(this.currentSongs.find(item => String(item.id) === String(song.id)) || song);
      return false;
    }
  }

  async insertInlineChartLine(songId, sectionIndex, lineIndex, caretOffset = null, currentLyrics = null) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const source = song?.sections?.[sectionIndex]?.lines?.[lineIndex];
    if (!song || !source) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    let line = edited.sections[sectionIndex].lines[lineIndex];
    if (currentLyrics != null) Object.assign(line, LyricAnchor.reconcileLine(line, line.lyrics || '', String(currentLyrics).replace(/[\r\n]+/g, '')));
    const splitAt = caretOffset == null ? LyricAnchor.graphemes(line.lyrics).length : Number(caretOffset);
    let parts;
    if (caretOffset == null) parts = [line, { id: SongModel.createId('line'), lyrics: '', chords: [], startTime: null, endTime: null, lyricConfidence: null, timedWords: [] }];
    else parts = LyricAnchor.splitLine(line, splitAt, SongModel.createId('line'));
    edited.sections[sectionIndex].lines.splice(lineIndex, 1, ...parts);
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      requestAnimationFrame(() => {
        const selector = `.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="lyrics"][data-section-index="${sectionIndex}"][data-line-index="${lineIndex + 1}"]`;
        const target = this.elements.songsContainer.querySelector(selector);
        target?.focus();
        const selection = window.getSelection?.();
        if (target && selection) { const range = document.createRange(); range.selectNodeContents(target); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); }
      });
      this.updateStatus('New lyric line added', 'success');
      this.track('chart.line.inserted', { sectionIndex, lineIndex: lineIndex + 1 }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async removeInlineChartLine(songId, sectionIndex, lineIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const lines = song?.sections?.[sectionIndex]?.lines;
    if (!song || !lines?.[lineIndex] || lines.length <= 1 || lines[lineIndex].lyrics) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const editedLines = edited.sections[sectionIndex].lines;
    const removed = editedLines[lineIndex];
    const focusIndex = lineIndex > 0 ? lineIndex - 1 : 0;
    const destination = editedLines[lineIndex > 0 ? lineIndex - 1 : 1];
    if (removed.chords?.length) destination.chords.push(...removed.chords);
    editedLines.splice(lineIndex, 1);
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      requestAnimationFrame(() => {
        const target = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="lyrics"][data-section-index="${sectionIndex}"][data-line-index="${focusIndex}"]`);
        target?.focus();
      });
      this.updateStatus('Empty lyric line removed', 'success');
      this.track('chart.line.removed', { sectionIndex, lineIndex }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async joinInlineChartLine(songId, sectionIndex, lineIndex, direction) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const lines = song?.sections?.[sectionIndex]?.lines;
    const otherIndex = lineIndex + direction;
    if (!lines?.[lineIndex] || !lines?.[otherIndex]) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const targetLines = edited.sections[sectionIndex].lines;
    const leftIndex = Math.min(lineIndex, otherIndex);
    const leftLength = LyricAnchor.graphemes(targetLines[leftIndex].lyrics).length;
    targetLines.splice(leftIndex, 2, LyricAnchor.joinLines(targetLines[leftIndex], targetLines[leftIndex + 1]));
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      requestAnimationFrame(() => {
        const target = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="lyrics"][data-section-index="${sectionIndex}"][data-line-index="${leftIndex}"]`);
        target?.focus();
        if (target && direction < 0) {
          const selection = window.getSelection?.(); const range = document.createRange();
          range.setStart(target.firstChild || target, Math.min(leftLength, target.firstChild?.length || 0)); range.collapse(true);
          selection?.removeAllRanges(); selection?.addRange(range);
        }
      });
      this.track('chart.line.joined', { sectionIndex, lineIndex: leftIndex }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  updateInferredArrangement(song) {
    const inferredValue = typeof Arrangement !== 'undefined' ? Arrangement.infer(song.sections || []) : SongModel.inferArrangement(song.sections || []);
    song.arrangement = { ...(song.arrangement || {}), inferredValue };
    if (song.arrangement.mode !== 'manual') song.arrangement.value = inferredValue;
  }

  async mutateInlineSections(songId, eventName, mutate) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return false;
    const previous = SongModel.create(song); const edited = SongModel.create(song);
    mutate(edited.sections); this.updateInferredArrangement(edited); edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved); this.track(eventName, {}, saved); return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async addInlineSection(songId, index) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const insertionIndex = Number.isFinite(index) ? Math.max(0, Math.min(song?.sections?.length || 0, index)) : (song?.sections?.length || 0);
    const saved = await this.mutateInlineSections(songId, 'chart.section.added', sections => sections.splice(insertionIndex, 0, {
      id: SongModel.createId('section'), type: 'section', label: '', labelProvenance: 'pending', pendingSection: true,
      lines: [{ id: SongModel.createId('line'), lyrics: '', chords: [], startTime: null, endTime: null, lyricConfidence: null, timedWords: [] }]
    }));
    if (saved) requestAnimationFrame(() => {
      const target = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="section-label"][data-section-index="${insertionIndex}"]`);
      target?.focus();
      if (target) {
        const selection = window.getSelection?.(); const range = document.createRange();
        range.selectNodeContents(target); selection?.removeAllRanges(); selection?.addRange(range);
      }
    });
    return saved;
  }

  resolvePendingSection(songId, sectionIndex) {
    return this.mutateInlineSections(songId, 'chart.section.pending_resolved', sections => {
      const section = sections[sectionIndex]; if (!section?.pendingSection) return;
      const meaningful = (section.lines || []).filter(line => line.lyrics || line.chords?.length);
      if (sectionIndex > 0) sections[sectionIndex - 1].lines.push(...meaningful);
      else if (meaningful.length) { section.pendingSection = false; section.labelProvenance = 'manual'; return; }
      sections.splice(sectionIndex, 1);
    });
  }

  async splitInlineSectionAt(songId, sectionIndex, lineIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const lines = song?.sections?.[sectionIndex]?.lines || [];
    const splitIndex = Math.max(0, Math.min(lines.length, Number(lineIndex) || 0));
    if (splitIndex === 0) return this.addInlineSection(songId, sectionIndex);
    if (splitIndex >= lines.length) return this.addInlineSection(songId, sectionIndex + 1);
    const newSectionIndex = sectionIndex + 1;
    const saved = await this.mutateInlineSections(songId, 'chart.section.split', sections => {
      const source = sections[sectionIndex];
      const movedLines = source.lines.splice(splitIndex);
      sections.splice(newSectionIndex, 0, { id: SongModel.createId('section'), type: 'section', label: '', labelProvenance: 'pending', pendingSection: true, lines: movedLines });
    });
    if (saved) requestAnimationFrame(() => this.focusInlineSectionLabel(songId, newSectionIndex));
    return saved;
  }

  async copyInlineSectionChords(songId, sourceIndex, targetIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const source = song?.sections?.[sourceIndex];
    const target = song?.sections?.[targetIndex];
    if (!song || !source || !target || (target.lines || []).some(line => line.chords?.length)) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const sourceLines = edited.sections[sourceIndex].lines || [];
    const targetSection = edited.sections[targetIndex];
    if (targetSection.lines.length === 1 && !targetSection.lines[0].lyrics && sourceLines.length > 1) {
      while (targetSection.lines.length < sourceLines.length) targetSection.lines.push({
        id: SongModel.createId('line'), lyrics: '', chords: [], startTime: null, endTime: null,
        lyricConfidence: null, timedWords: []
      });
    }
    let copied = 0;
    targetSection.lines.forEach((targetLine, lineIndex) => {
      const sourceLine = sourceLines[lineIndex];
      if (!sourceLine) return;
      const sourceLength = Math.max(1, LyricAnchor.graphemes(sourceLine.lyrics || '').length);
      const targetLength = LyricAnchor.graphemes(targetLine.lyrics || '').length;
      targetLine.chords = (sourceLine.chords || []).map(chord => {
        const relativeOffset = targetLength
          ? Math.round((Number(chord.characterOffset) || 0) / sourceLength * targetLength)
          : Number(chord.characterOffset) || 0;
        const copy = {
          ...chord,
          id: this.createStableChordId(),
          characterOffset: relativeOffset,
          confidence: null,
          manualEntry: { provenance: 'manual', enteredSymbol: chord.symbol }
        };
        copy.anchor = LyricAnchor.create(targetLine.lyrics || '', relativeOffset, 'manual');
        copy.timestamp = SongModel.timestampForCharacterOffset(targetLine, relativeOffset, null);
        copied += 1;
        return copy;
      });
    });
    if (!copied) return false;
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      this.updateStatus(`${copied} chord${copied === 1 ? '' : 's'} copied from ${source.label || `section ${sourceIndex + 1}`}`, 'success');
      this.track('chart.section.chords_copied', { sourceIndex, targetIndex, count: copied }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  duplicateInlineSection(songId, index) {
    return this.placeInlineSection(songId, index, index + 1, { copy: true });
  }

  deleteInlineSection(songId, index) {
    return this.mutateInlineSections(songId, 'chart.section.deleted', sections => { if (sections.length > 1) sections.splice(index, 1); });
  }

  moveInlineSection(songId, index, delta) { return this.reorderInlineSection(songId, index, index + delta); }

  reorderInlineSection(songId, from, to) {
    const insertionIndex = Number(to) > Number(from) ? Number(to) + 1 : Number(to);
    return this.placeInlineSection(songId, from, insertionIndex);
  }

  placeInlineSection(songId, from, insertionIndex, { copy = false } = {}) {
    return this.mutateInlineSections(songId, copy ? 'chart.section.duplicated' : 'chart.section.reordered', sections => {
      if (from < 0 || from >= sections.length) return;
      const boundary = Math.max(0, Math.min(sections.length, Number(insertionIndex)));
      if (!copy && (boundary === from || boundary === from + 1)) return;
      let section;
      if (copy) {
        section = JSON.parse(JSON.stringify(sections[from]));
        section.id = SongModel.createId('section'); section.labelProvenance = 'manual';
        section.lines.forEach(line => { line.id = SongModel.createId('line'); line.chords.forEach(chord => { chord.id = this.createStableChordId(); }); });
      } else {
        [section] = sections.splice(from, 1);
      }
      const destination = copy ? boundary : boundary - (boundary > from ? 1 : 0);
      sections.splice(destination, 0, section);
    });
  }

  focusInlineChart(songId) {
    const sheet = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"]`);
    const target = sheet?.querySelector('[data-inline-field="lyrics"]');
    target?.focus();
    this.updateStatus('Edit lyrics in place. Type chord symbols or drag them anywhere above a lyric line.', 'success');
  }

  createStableChordId() {
    if (globalThis.crypto?.randomUUID) return `chord-${globalThis.crypto.randomUUID()}`;
    return `chord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async moveInlineChord(source, destination, desiredOffset, { copy = false } = {}) {
    const song = this.currentSongs.find(item => String(item.id) === String(source.songId));
    if (!song) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const sourceLine = edited.sections?.[source.sectionIndex]?.lines?.[source.lineIndex];
    const destinationLine = edited.sections?.[destination.sectionIndex]?.lines?.[destination.lineIndex];
    const chord = sourceLine?.chords?.find(item => String(item.id) === String(source.chordId));
    if (!chord || !destinationLine) return false;
    if (!copy) sourceLine.chords.splice(sourceLine.chords.indexOf(chord), 1);
    const placedChord = copy ? { ...chord, id: this.createStableChordId() } : chord;
    placedChord.characterOffset = this.authoringController.availableChordOffset(destinationLine.chords, desiredOffset, placedChord.symbol);
    placedChord.anchor = LyricAnchor.create(destinationLine.lyrics || '', placedChord.characterOffset, 'manual');
    placedChord.timestamp = SongModel.timestampForCharacterOffset(destinationLine, placedChord.characterOffset, placedChord.timestamp);
    placedChord.confidence = null;
    destinationLine.chords.push(placedChord);
    destinationLine.chords.sort((left, right) => left.characterOffset - right.characterOffset);
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      this.updateStatus(`${placedChord.symbol} ${copy ? 'copied' : 'moved'} to column ${placedChord.characterOffset + 1}`, 'success');
      this.track(copy ? 'chart.chord.copied' : 'chart.chord.dragged', { sectionIndex: destination.sectionIndex, lineIndex: destination.lineIndex, characterOffset: placedChord.characterOffset }, saved);
      return true;
    } catch (_) { return false; }
  }

  async deleteInlineChords(songId, chordIds) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const ids = new Set((chordIds || []).map(String));
    if (!song || !ids.size) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    let removed = 0;
    (edited.sections || []).forEach(section => (section.lines || []).forEach(line => {
      const before = line.chords?.length || 0;
      line.chords = (line.chords || []).filter(chord => !ids.has(String(chord.id)));
      removed += before - line.chords.length;
    }));
    if (!removed) return false;
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      this.updateStatus(`${removed} chord${removed === 1 ? '' : 's'} deleted · Ctrl+Z to undo`, 'success');
      this.track('chart.chord.deleted', { count: removed }, saved);
      return true;
    } catch (_) { return false; }
  }

  async undoInlineChordDelete() {
    return this.undoInlineEdit();
  }

  focusInlineChord(songId, chordId) {
    const target = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] .inline-chord-anchor[data-chord-id="${CSS.escape(String(chordId))}"] [data-inline-field="chord"]`);
    target?.focus();
    if (target) { const selection = window.getSelection?.(); const range = document.createRange(); range.selectNodeContents(target); selection?.removeAllRanges(); selection?.addRange(range); }
  }

  focusInlineSectionLabel(songId, sectionIndex) {
    const target = this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="section-label"][data-section-index="${sectionIndex}"]`);
    target?.focus();
    if (target) { const selection = window.getSelection?.(); const range = document.createRange(); range.selectNodeContents(target); selection?.removeAllRanges(); selection?.addRange(range); }
  }

  async mutateInlineContext(songId, eventName, mutate, status) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    if (!song) return false;
    const previous = SongModel.create(song); const edited = SongModel.create(song);
    if (mutate(edited) === false) return false;
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved); this.updateStatus(status, 'success'); this.track(eventName, {}, saved); return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  async addInlineChartLineAt(songId, sectionIndex, insertionIndex) {
    const saved = await this.mutateInlineContext(songId, 'chart.line.inserted', song => {
      const lines = song.sections?.[sectionIndex]?.lines; if (!lines) return false;
      lines.splice(Math.max(0, Math.min(lines.length, insertionIndex)), 0, { id: SongModel.createId('line'), lyrics: '', chords: [], startTime: null, endTime: null, lyricConfidence: null, timedWords: [] });
    }, 'New lyric line added');
    if (saved) requestAnimationFrame(() => this.elements.songsContainer.querySelector(`.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] [data-inline-field="lyrics"][data-section-index="${sectionIndex}"][data-line-index="${insertionIndex}"]`)?.focus());
    return saved;
  }

  replaceInlineLyrics(songId, sectionIndex, lineIndex, text) {
    return this.mutateInlineContext(songId, 'chart.inline_edit.saved', song => {
      const line = song.sections?.[sectionIndex]?.lines?.[lineIndex]; if (!line) return false;
      Object.assign(line, LyricAnchor.reconcileLine(line, line.lyrics || '', String(text || '').replace(/[\r\n]+/g, ' ')));
    }, 'Lyrics pasted');
  }

  clearInlineLineChords(songId, sectionIndex, lineIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    return this.deleteInlineChords(songId, song?.sections?.[sectionIndex]?.lines?.[lineIndex]?.chords?.map(chord => chord.id) || []);
  }

  copyMatchingLinePattern(songId, sectionIndex, lineIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const sections = song?.sections || []; const target = sections[sectionIndex];
    const targetType = Arrangement.normalizeType(target?.label || target?.type);
    let sourceIndex = -1;
    for (let index = sectionIndex - 1; index >= 0; index -= 1) { if (Arrangement.normalizeType(sections[index]?.label || sections[index]?.type) === targetType) { sourceIndex = index; break; } }
    const sourceLine = song?.sections?.[sourceIndex]?.lines?.[lineIndex];
    if (!sourceLine) return false;
    return this.mutateInlineContext(songId, 'chart.line.chords_copied', edited => {
      const target = edited.sections[sectionIndex].lines[lineIndex]; if (target.chords?.length) return false;
      const sourceLength = Math.max(1, LyricAnchor.graphemes(sourceLine.lyrics || '').length); const targetLength = LyricAnchor.graphemes(target.lyrics || '').length;
      target.chords = sourceLine.chords.map(chord => { const offset = targetLength ? Math.round((chord.characterOffset || 0) / sourceLength * targetLength) : chord.characterOffset || 0; return { ...chord, id: this.createStableChordId(), characterOffset: offset, confidence: null, timestamp: SongModel.timestampForCharacterOffset(target, offset, null), anchor: LyricAnchor.create(target.lyrics || '', offset, 'manual'), manualEntry: { provenance: 'manual', enteredSymbol: chord.symbol } }; });
    }, 'Chord pattern copied');
  }

  copyInlineChordToSection(source, targetSectionIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(source.songId));
    const targetLineIndex = Math.min(source.lineIndex, Math.max(0, (song?.sections?.[targetSectionIndex]?.lines?.length || 1) - 1));
    return this.moveInlineChord(source, { sectionIndex: targetSectionIndex, lineIndex: targetLineIndex }, 0, { copy: true });
  }

  pasteInlineChord(copied, target) {
    if (!copied) { this.updateStatus('Copy a chord first', 'info'); return false; }
    return this.moveInlineChord(copied, { sectionIndex: target.sectionIndex, lineIndex: target.lineIndex }, target.characterOffset, { copy: true });
  }

  markInlineChordCanonical(source) {
    return this.mutateInlineContext(source.songId, 'chart.chord.canonicalized', song => { const chord = song.sections?.[source.sectionIndex]?.lines?.[source.lineIndex]?.chords?.find(item => String(item.id) === String(source.chordId)); if (!chord) return false; chord.originalSymbol = chord.symbol; chord.manualEntry = { provenance: 'manual', enteredSymbol: chord.symbol }; chord.confidence = null; }, 'Chord spelling marked canonical');
  }

  setInlineChordTiming(source) {
    const value = window.prompt('Exact chord time in seconds'); if (value === null) return false;
    const timing = Number(value); if (!Number.isFinite(timing) || timing < 0) { this.updateStatus('Enter a valid time in seconds', 'error'); return false; }
    return this.mutateInlineContext(source.songId, 'chart.chord.timing_changed', song => { const chord = song.sections?.[source.sectionIndex]?.lines?.[source.lineIndex]?.chords?.find(item => String(item.id) === String(source.chordId)); if (!chord) return false; chord.timestamp = timing; chord.timingEdited = true; chord.confidence = null; }, `Chord time set to ${timing.toFixed(2)} seconds`);
  }

  flagInlineChordForReview(source) {
    return this.mutateInlineContext(source.songId, 'chart.chord.flagged', song => { const chord = song.sections?.[source.sectionIndex]?.lines?.[source.lineIndex]?.chords?.find(item => String(item.id) === String(source.chordId)); if (!chord) return false; chord.confidence = 0; chord.manualReview = true; }, 'Chord flagged for review');
  }

  copyMatchingSectionChords(songId, sectionIndex) {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const sourceIndex = this.chartRenderer.matchingChordSectionIndex(song?.sections || [], sectionIndex);
    if (sourceIndex < 0) { this.updateStatus('No earlier matching section with chords', 'info'); return false; }
    return this.copyInlineSectionChords(songId, sourceIndex, sectionIndex);
  }

  insertInlineChordSequence(state) {
    const value = window.prompt('Chord sequence, separated by spaces'); if (!value) return false;
    const symbols = value.trim().split(/\s+/).filter(Boolean); if (!symbols.length) return false;
    const current = this.currentSongs.find(item => String(item.id) === String(state.songId));
    const theory = new MusicTheory(); const view = { ...(current?.sessionView || {}), spellingPolicy: current?.spellingPolicy };
    const convertedSymbols = symbols.map(symbol => theory.canonicalChordFromDisplay(symbol, current, view));
    const invalid = convertedSymbols.find(item => !item.ok);
    if (invalid) { this.updateStatus(invalid.error, 'error'); return false; }
    return this.mutateInlineContext(state.songId, 'chart.chord.sequence_inserted', song => {
      const line = song.sections?.[state.sectionIndex]?.lines?.[state.lineIndex]; if (!line) return false;
      let offset = state.characterOffset;
      convertedSymbols.forEach(converted => { const chord = { id: this.createStableChordId(), symbol: converted.canonical, originalSymbol: converted.canonical, manualEntry: converted.manualEntry, confidence: null, characterOffset: this.authoringController.availableChordOffset(line.chords, offset, converted.canonical), timestamp: null }; chord.anchor = LyricAnchor.create(line.lyrics || '', chord.characterOffset, 'manual'); chord.timestamp = SongModel.timestampForCharacterOffset(line, chord.characterOffset, null); line.chords.push(chord); offset = chord.characterOffset + chord.symbol.length + 1; });
      line.chords.sort((a, b) => a.characterOffset - b.characterOffset);
    }, `${convertedSymbols.length} chords inserted`);
  }

  async insertInlineChord(songId, sectionIndex, lineIndex, desiredOffset, enteredSymbol = 'C') {
    const song = this.currentSongs.find(item => String(item.id) === String(songId));
    const sourceLine = song?.sections?.[sectionIndex]?.lines?.[lineIndex];
    if (!song || !sourceLine) return false;
    const previous = SongModel.create(song);
    const edited = SongModel.create(song);
    const line = edited.sections[sectionIndex].lines[lineIndex];
    const view = { ...(edited.sessionView || {}), spellingPolicy: edited.spellingPolicy };
    const placeholder = new MusicTheory().canonicalChordFromDisplay(enteredSymbol, edited, view);
    if (!placeholder.ok) {
      this.updateStatus(placeholder.error, 'error');
      return false;
    }
    const chord = {
      id: this.createStableChordId(), symbol: placeholder.canonical, originalSymbol: placeholder.canonical,
      manualEntry: placeholder.manualEntry, confidence: null,
      characterOffset: this.authoringController.availableChordOffset(line.chords, desiredOffset, placeholder.canonical),
      timestamp: null
    };
    chord.anchor = LyricAnchor.create(line.lyrics || '', chord.characterOffset, 'manual');
    chord.timestamp = SongModel.timestampForCharacterOffset(line, chord.characterOffset, null);
    line.chords.push(chord);
    line.chords.sort((left, right) => left.characterOffset - right.characterOffset);
    edited.songText = SongModel.toSongText(edited);
    try {
      const saved = await this.persistSong(edited, { addToSession: false });
      this.recordInlineUndo(previous);
      if (saved.sourceType === 'audio') this.correctionMemory.learn(previous, saved);
      this.updateLeadSheetDisplay(saved);
      requestAnimationFrame(() => {
        const selector = `.lead-sheet[data-song-id="${CSS.escape(String(songId))}"] .inline-chord-anchor[data-chord-id="${CSS.escape(String(chord.id))}"] [data-inline-field="chord"]`;
        const target = this.elements.songsContainer.querySelector(selector);
        if (!target) return;
        target.focus();
        const selection = window.getSelection?.();
        if (selection) { const range = document.createRange(); range.selectNodeContents(target); selection.removeAllRanges(); selection.addRange(range); }
      });
      this.updateStatus(`New chord at column ${chord.characterOffset + 1}`, 'success');
      this.track('chart.chord.inserted', { sectionIndex, lineIndex, characterOffset: chord.characterOffset }, saved);
      return true;
    } catch (_) { this.updateLeadSheetDisplay(song); return false; }
  }

  renderStructuredContent(song, options = {}) {
    return this.chartRenderer.renderStructuredContent(song, options);
  }

  renderChordAnchors(chords, options = {}) {
    return this.chartRenderer.renderChordAnchors(chords, options);
  }

  transposeForSong(symbol, song, musicTheory = new MusicTheory()) {
    return this.chartRenderer.transposeForSong(symbol, song, musicTheory);
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
    const diff = this.lineDiff(before, after);
    const changed = diff.filter(line => line.kind !== 'unchanged').length;
    const rows = diff.map(line => {
      const marker = line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' ';
      const label = line.kind === 'added' ? 'Added' : line.kind === 'removed' ? 'Removed' : 'Unchanged';
      return `<div class="diff-line diff-line--${line.kind}"><span class="diff-marker" aria-hidden="true">${marker}</span><span class="sr-only">${label}: </span><code>${this.escapeHtml(line.text || ' ')}</code></div>`;
    }).join('');
    this.elements.historyPreview.innerHTML = `<strong>${this.escapeHtml(version.label || `Revision ${version.revision}`)}</strong><p>${changed} changed line${changed === 1 ? '' : 's'} · ${after.length} lines in this version</p><div class="history-diff" aria-label="Line changes">${rows}</div>`;
  }

  lineDiff(before, after) {
    const rows = before.length + 1;
    const columns = after.length + 1;
    const lengths = Array.from({ length: rows }, () => new Uint32Array(columns));
    for (let left = before.length - 1; left >= 0; left -= 1) {
      for (let right = after.length - 1; right >= 0; right -= 1) {
        lengths[left][right] = before[left] === after[right]
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
      }
    }
    const diff = [];
    let left = 0;
    let right = 0;
    while (left < before.length || right < after.length) {
      if (left < before.length && right < after.length && before[left] === after[right]) {
        diff.push({ kind: 'unchanged', text: before[left] }); left += 1; right += 1;
      } else if (right < after.length && (left === before.length || lengths[left][right + 1] >= lengths[left + 1][right])) {
        diff.push({ kind: 'added', text: after[right] }); right += 1;
      } else {
        diff.push({ kind: 'removed', text: before[left] }); left += 1;
      }
    }
    return diff;
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
    return this.chartRenderer.groupTextItemsByPage(textItems);
  }
  
  /**
   * Group items by lines based on Y position
   */
  groupItemsByLines(pageItems, tolerance = 10) {
    return this.chartRenderer.groupItemsByLines(pageItems, tolerance);
  }
  
  /**
   * Get CSS class for PDF text item
   */
  getPDFItemClass(item, isChordLine) {
    return this.chartRenderer.getPDFItemClass(item, isChordLine);
  }
  
  /**
   * Check if text is a section header
   */
  isSectionHeader(text) {
    return this.chartRenderer.isSectionHeader(text);
  }
  
  /**
   * Transpose chords within a text item
   */
  transposeTextItem(text, transposition, musicTheory, song = null) {
    return this.chartRenderer.transposeTextItem(text, transposition, musicTheory, song);
  }
  
  /**
   * Check if text contains musical chords
   */
  containsChords(text) {
    return this.chartRenderer.containsChords(text);
  }
  
  /**
   * Render chords within a line with proper spacing
   */
  renderChordsInLine(line, chords, transposition, musicTheory) {
    return this.chartRenderer.renderChordsInLine(line, chords, transposition, musicTheory);
  }
  
  /**
   * Determine the type of text line for styling
   */
  getLineType(line) {
    return this.chartRenderer.getLineType(line);
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

  renderPerformance(state) {
    this.elements.performanceShell.hidden = !state.active;
    document.body.classList.toggle('performance-active', state.active);
    if (!state.active) return;
    const song = this.currentSongs.find(item => String(item.id) === String(this.activeSongId));
    if (!song) return;
    this.elements.performanceTitle.textContent = song.title;
    this.elements.performanceChart.innerHTML = this.renderLeadSheetContent(song, { editable: false, columns: state.columns });
    this.elements.performanceChart.style.fontSize = `${state.fontScale}em`;
    this.elements.performanceChart.style.removeProperty('column-count');
    this.elements.performanceChart.dataset.reducedMotion = String(state.reducedMotion);
  }

  enterPerformance() {
    const song = this.currentSongs.find(item => String(item.id) === String(this.activeSongId));
    const columns = Math.max(1, Math.min(3, Number(song?.layout?.columns) || 1));
    this.performance.setColumns(columns);
    if (this.elements.performanceColumns) this.elements.performanceColumns.value = String(columns);
    return this.performance.enter({ fullscreen: true, fullscreenElement: this.elements.performanceShell });
  }

  renderBindings() {
    const labels = { previous: 'Previous song', next: 'Next song', transposeDown: 'Transpose down', transposeUp: 'Transpose up', playPause: 'Play / pause' };
    this.elements.bindingList.innerHTML = Object.entries(labels).map(([action, label]) => {
      const key = this.controlBindings.keyboard[action]?.key || this.controlBindings.keyboard[action]?.code || 'Not set';
      const midi = this.controlBindings.midi[action];
      return `<div class="binding-row"><strong>${label}</strong><span>${this.escapeHtml(key)} · ${midi ? `${midi.kind} ${midi.number + 1}` : 'No MIDI'}</span><button type="button" data-bind-key="${action}">Set key</button><button type="button" data-bind-midi="${action}">Learn MIDI</button></div>`;
    }).join('');
    this.elements.bindingList.querySelectorAll('[data-bind-key]').forEach(button => button.addEventListener('click', () => {
      this.controlBindings.capture(button.dataset.bindKey, 'keyboard'); button.textContent = 'Press a key…';
    }));
    this.elements.bindingList.querySelectorAll('[data-bind-midi]').forEach(button => button.addEventListener('click', () => {
      this.controlBindings.capture(button.dataset.bindMidi, 'midi'); button.textContent = 'Move footswitch…';
    }));
    this.elements.bindingConflict.hidden = !this.controlBindings.pendingConflict;
    if (this.controlBindings.pendingConflict) this.elements.bindingConflict.querySelector('span').textContent = `Already assigned to ${this.controlBindings.pendingConflict.conflictAction}.`;
  }

  refreshReviewQueue() {
    const song = this.currentSongs.find(item => String(item.id) === String(this.activeSongId));
    this.reviewQueue = song ? new ReviewQueue(song) : null;
    const count = this.reviewQueue?.items().length || 0;
    this.elements.reviewBadge.textContent = String(count);
    this.elements.reviewButton.disabled = !count;
    return count;
  }

  openReview() {
    if (!this.refreshReviewQueue()) return;
    this.elements.reviewRail.hidden = false;
    this.renderReviewItem();
  }

  renderReviewItem() {
    const item = this.reviewQueue?.items()[0];
    this.elements.reviewUndo.disabled = !this.reviewQueue?.history.length;
    if (!item) {
      this.elements.reviewItem.innerHTML = '<p>Review complete.</p>';
      this.elements.reviewBadge.textContent = '0';
      return;
    }
    this.elements.reviewItem.innerHTML = `<span class="review-kind">${item.kind}</span><strong>${this.escapeHtml(item.value)}</strong><p>${Math.round(item.confidence * 100)}% confidence</p>`;
  }

  async applyReview(action) {
    if (!this.reviewQueue) return;
    const item = this.reviewQueue.items()[0];
    if (action === 'undo') this.reviewQueue.undo();
    else if (!item) return;
    else if (action === 'accept') this.reviewQueue.accept(item.id);
    else if (action === 'remove') this.reviewQueue.remove(item.id);
    else if (action === 'edit') {
      const value = window.prompt(`Edit ${item.kind}`, item.value); if (value === null) return;
      this.reviewQueue.edit(item.id, value);
    }
    try {
      const saved = await this.persistSong(this.reviewQueue.result(), { addToSession: false });
      this.updateLeadSheetDisplay(saved);
      this.elements.reviewBadge.textContent = String(this.reviewQueue.items().length);
      this.elements.reviewRail.hidden = false;
      this.renderReviewItem();
    } catch (error) { this.handleSessionStoreError(error, 'review.save'); }
  }

  enableRehearsal(file, song) {
    this.rehearsal?.destroy();
    this.rehearsal = new RehearsalController({ audio: this.elements.rehearsalAudio, source: file, song });
    this.rehearsalSongId = String(song.id);
    [this.elements.rehearsalPlay, this.elements.rehearsalSeek, this.elements.rehearsalRate, this.elements.rehearsalLoop, this.elements.rehearsalFollow].forEach(element => { element.disabled = false; });
    this.elements.rehearsalAvailability.textContent = 'Current-page recording ready.';
    this.rehearsal.subscribe(state => this.renderRehearsalState(state));
  }

  syncRehearsalAvailability() {
    const available = Boolean(this.rehearsal && String(this.activeSongId) === this.rehearsalSongId);
    [this.elements.rehearsalPlay, this.elements.rehearsalSeek, this.elements.rehearsalRate, this.elements.rehearsalLoop, this.elements.rehearsalFollow].forEach(element => { element.disabled = !available; });
    this.elements.rehearsalAvailability.textContent = available
      ? 'Current-page recording ready.'
      : 'Import audio on this page to enable rehearsal for this song.';
    if (!available) this.rehearsal?.pause();
  }

  renderRehearsalState(state) {
    this.elements.rehearsalPlay.textContent = state.playing ? 'Pause' : 'Play';
    this.elements.rehearsalSeek.max = String(state.duration || 0);
    this.elements.rehearsalSeek.value = String(state.currentTime);
    this.elements.rehearsalFollow.textContent = state.follow ? 'Follow on' : 'Follow off';
    this.elements.rehearsalLoop.classList.toggle('active', Boolean(state.loop));
    document.querySelectorAll('.rehearsal-active-line,.rehearsal-active-chord').forEach(element => element.classList.remove('rehearsal-active-line','rehearsal-active-chord'));
    if (state.activeLine) {
      const line = document.querySelector(`#leadSheet-${CSS.escape(String(this.activeSongId))} [data-section-index="${state.activeLine.sectionIndex}"][data-line-index="${state.activeLine.lineIndex}"]`)?.closest('.chart-line');
      line?.classList.add('rehearsal-active-line');
      if (state.follow) line?.scrollIntoView({ block: 'center', behavior: this.performance.state.reducedMotion ? 'auto' : 'smooth' });
    }
    if (state.activeChord) document.querySelector(`#leadSheet-${CSS.escape(String(this.activeSongId))} [data-section-index="${state.activeChord.sectionIndex}"][data-line-index="${state.activeChord.lineIndex}"] .chord-token:nth-child(${state.activeChord.chordIndex + 1})`)?.classList.add('rehearsal-active-chord');
  }

  toggleRehearsal() {
    if (!this.rehearsal) return;
    return this.elements.rehearsalAudio.paused ? this.rehearsal.play() : this.rehearsal.pause();
  }

  toggleRehearsalLoop() {
    if (!this.rehearsal) return;
    if (this.rehearsal.loop) return this.rehearsal.clearLoop();
    const active = this.rehearsal.state().activeLine;
    if (active) this.rehearsal.loopLine(active.sectionIndex, active.lineIndex);
  }

  openCompanion() {
    this.updateTelemetrySnapshot({
      sessionName: this.activeSession?.name || 'Current Session',
      activeCursor: this.rehearsal?.state().currentTime ?? this.performance.scrollPositions.get(String(this.activeSongId)) ?? 0
    });
    window.open('/companion.html', 'transposepdf-companion');
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
      chordDisplay: (symbol, chord) => this.chartRenderer.displayStoredChord(chord, song, musicTheory)
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
