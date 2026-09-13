/** Authoring workflow controller. Proxies UIController state while keeping its public facade stable. */
class AuthoringController {
  constructor(ui) {
    this.ui = ui;
    return new Proxy(this, {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
        const value = ui[property];
        return typeof value === 'function' ? value.bind(ui) : value;
      },
      set(target, property, value, receiver) {
        if (Reflect.has(target, property) && property !== 'ui') return Reflect.set(target, property, value, receiver);
        ui[property] = value;
        return true;
      }
    });
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

}

if (typeof window !== 'undefined') window.AuthoringController = AuthoringController;
if (typeof module !== 'undefined' && module.exports) module.exports = AuthoringController;
