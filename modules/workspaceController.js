/** Stable delegated event boundary for the session selector and rendered chart controls. */
class WorkspaceController {
  constructor(uiController, root) {
    this.ui = uiController;
    this.root = root;
    this.attached = false;
    this.listeners = {};
    this.selectedChordIds = new Set();
  }

  attach() {
    if (this.attached || !this.root) return this;
    this.listeners.click = event => this.handleClick(event);
    this.listeners.change = event => this.handleChange(event);
    this.listeners.dragstart = event => this.handleDragStart(event);
    this.listeners.dragover = event => this.handleDragOver(event);
    this.listeners.drop = event => this.handleDrop(event);
    this.listeners.dragend = event => this.handleDragEnd(event);
    this.listeners.focusin = event => this.handleFocusIn(event);
    this.listeners.focusout = event => this.handleFocusOut(event);
    this.listeners.keydown = event => this.handleKeyDown(event);
    this.listeners.paste = event => this.handlePaste(event);
    this.listeners.pointerdown = event => this.handlePointerDown(event);
    this.listeners.pointermove = event => this.handlePointerMove(event);
    this.listeners.pointerup = event => this.handlePointerUp(event);
    this.listeners.pointercancel = event => this.handlePointerCancel(event);
    this.listeners.dblclick = event => this.handleDoubleClick(event);
    this.listeners.contextmenu = event => this.handleContextMenu(event);
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.addEventListener(name, listener));
    this.documentPointerDown = event => { if (!event.target.closest?.('.chart-context-menu')) this.closeContextMenu(); };
    this.documentKeyDown = event => { if (!this.root.contains(event.target)) this.handleKeyDown(event); };
    this.windowDismissMenu = event => {
      if (event?.type === 'scroll' && this.contextMenu && (event.target === this.contextMenu || this.contextMenu.contains?.(event.target))) return;
      this.closeContextMenu();
    };
    document.addEventListener('pointerdown', this.documentPointerDown);
    document.addEventListener('keydown', this.documentKeyDown);
    window.addEventListener('resize', this.windowDismissMenu);
    window.addEventListener('scroll', this.windowDismissMenu, true);
    this.attached = true;
    return this;
  }

  detach() {
    if (!this.attached || !this.root) return;
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.removeEventListener(name, listener));
    document.removeEventListener('pointerdown', this.documentPointerDown);
    document.removeEventListener('keydown', this.documentKeyDown);
    window.removeEventListener('resize', this.windowDismissMenu);
    window.removeEventListener('scroll', this.windowDismissMenu, true);
    this.closeContextMenu();
    this.listeners = {};
    this.attached = false;
  }

  handleClick(event) {
    const contextAction = event.target.closest?.('[data-context-command]');
    if (contextAction && this.contextState) {
      event.preventDefault();
      this.runContextCommand(contextAction.dataset.contextCommand, contextAction.dataset);
      this.closeContextMenu();
      return;
    }
    const chord = event.target.closest?.('.inline-chord-anchor[data-chord-id]');
    if (chord && this.root.contains(chord)) {
      this.selectInlineChord(chord, event.shiftKey);
      return;
    }
    const target = event.target.closest?.('[data-action], [data-song-id]');
    if (!target || !this.root.contains(target)) return;
    const action = target.dataset.action || (target.matches('.song-selector-item') ? 'select-song' : '');
    const songId = target.dataset.songId || target.closest('[data-song-id]')?.dataset.songId
      || target.closest('[data-reorder-id]')?.dataset.reorderId;
    if (!action || !songId) return;
    const actions = {
      'select-song': () => this.ui.selectActiveSong(songId),
      'edit-song': () => this.ui.openAuthoring(songId),
      'focus-chart': () => this.ui.focusInlineChart(songId),
      'open-history': () => this.ui.openHistory(songId),
      'transpose-song': () => this.ui.transposeSong(songId, Number(target.dataset.semitones) || 0),
      'reset-song': () => this.ui.resetSong(songId),
      'add-chart-line': () => this.ui.insertInlineChartLine(songId, Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex), null),
      'add-section-before': () => this.ui.addInlineSection(songId, Number(target.dataset.sectionIndex)),
      'add-section-after': () => this.ui.addInlineSection(songId, Number(target.dataset.sectionIndex) + 1),
      'add-section-end': () => this.ui.addInlineSection(songId),
      'copy-section-chords': () => this.ui.copyInlineSectionChords(songId, Number(target.dataset.sourceSectionIndex), Number(target.dataset.sectionIndex)),
      'duplicate-section': () => this.ui.duplicateInlineSection(songId, Number(target.dataset.sectionIndex)),
      'delete-section': () => this.ui.deleteInlineSection(songId, Number(target.dataset.sectionIndex)),
      'move-section': () => this.ui.moveInlineSection(songId, Number(target.dataset.sectionIndex), target.dataset.direction === 'up' ? -1 : 1),
      'set-layout-columns': () => this.ui.setSongLayoutColumns(songId, Number(target.dataset.columns)),
      'toggle-layout-mode': () => this.ui.toggleSongLayoutMode(songId),
      'clear-layout-breaks': () => this.ui.clearSongLayoutBreaks(songId),
      'save-layout-preset': () => this.ui.saveSongLayoutPreset(songId),
      'use-song-order': () => this.ui.useInferredArrangement(songId),
      'move-song': () => this.moveSong(target, songId),
      'remove-song': () => this.ui.removeSessionSong(songId)
    };
    if (actions[action]) {
      event.preventDefault();
      this.closeContextMenu();
      actions[action]();
    }
  }

  handleChange(event) {
    const target = event.target.closest?.('[data-action][data-song-id]');
    if (!target || !this.root.contains(target)) return;
    if (target.dataset.action === 'set-spelling') this.ui.setSpellingPolicy(target.dataset.songId, target.value);
    if (target.dataset.action === 'set-chart-view') this.ui.setChartView(target.dataset.songId, target.dataset.field, target.value);
    if (target.dataset.action === 'set-chart-font-size') this.ui.setSongFontSize(target.dataset.songId, Number(target.value));
    if (target.dataset.action === 'set-layout-field') this.ui.setSongLayoutField(target.dataset.songId, target.dataset.layoutField, target.value);
    if (target.dataset.action === 'set-layout-balance') this.ui.setSongLayoutField(target.dataset.songId, 'balance', target.checked ? 'auto' : 'off');
    if (target.dataset.action === 'set-layout-preset') this.ui.setSongLayoutPreset(target.dataset.songId, target.value);
    if (target.dataset.action === 'set-layout-number') this.ui.setSongLayoutNumber(target.dataset.songId, target.dataset.layoutField, target.value, target.dataset.unit);
  }

  handleDragStart(event) {
    const layoutBoundary = event.target.closest?.('.layout-break-target.has-layout-break');
    if (layoutBoundary && this.root.contains(layoutBoundary)) {
      this.layoutDrag = { songId: layoutBoundary.dataset.songId, type: layoutBoundary.dataset.breakType || 'column', breakId: layoutBoundary.dataset.breakId };
      event.dataTransfer?.setData('text/layout-break', this.layoutDrag.type);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      return;
    }
    const chord = event.target.closest?.('.inline-chord-anchor');
    if (chord && this.root.contains(chord)) {
      this.inlineDrag = {
        songId: chord.closest('.lead-sheet[data-song-id]')?.dataset.songId,
        sectionIndex: Number(chord.dataset.sectionIndex), lineIndex: Number(chord.dataset.lineIndex),
        chordId: chord.dataset.chordId,
        copy: Boolean(event.altKey)
      };
      chord.classList.add('dragging');
      event.dataTransfer?.setData('text/chord-id', chord.dataset.chordId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = this.inlineDrag.copy ? 'copy' : 'move';
      return;
    }
    const sectionHandle = event.target.closest?.('.section-drag-handle');
    const section = sectionHandle?.closest('.section-block[data-section-reorder-index]');
    if (section && this.root.contains(section)) {
      this.sectionDrag = { songId: section.closest('.lead-sheet')?.dataset.songId,
        sectionIndex: Number(section.dataset.sectionReorderIndex), copy: Boolean(event.altKey), insertionIndex: null };
      section.classList.add('section-dragging');
      event.dataTransfer?.setData('text/section-index', String(section.dataset.sectionReorderIndex));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = this.sectionDrag.copy ? 'copy' : 'move';
      return;
    }
    const row = event.target.closest?.('[data-reorder-id]');
    if (row && this.root.contains(row)) event.dataTransfer?.setData('text/song-id', row.dataset.reorderId);
  }

  handleDragOver(event) {
    const layoutTarget = event.target.closest?.('.layout-break-target');
    if (layoutTarget && this.layoutDrag) {
      event.preventDefault(); this.root.querySelectorAll('.layout-drop-active').forEach(item => item.classList.remove('layout-drop-active'));
      layoutTarget.classList.add('layout-drop-active'); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; return;
    }
    const chart = event.target.closest?.('.structured-chart');
    if (chart && this.sectionDrag) {
      event.preventDefault();
      this.updateSectionDropIndicator(chart, event.clientX, event.clientY);
      if (event.dataTransfer) event.dataTransfer.dropEffect = this.sectionDrag.copy ? 'copy' : 'move';
      return;
    }
    const chordLine = event.target.closest?.('.lead-sheet .chord-line[data-section-index]');
    if (chordLine && this.inlineDrag) {
      event.preventDefault();
      this.root.querySelectorAll('.author-drop-target').forEach(item => item.classList.remove('author-drop-target'));
      chordLine.classList.add('author-drop-target');
      const width = this.ui.authoringController.measureAuthorCharacterWidth(chordLine);
      const offset = Math.max(0, Math.round((event.clientX - chordLine.getBoundingClientRect().left) / width));
      chordLine.style.setProperty('--drop-caret-left', `${offset * width}px`);
      return;
    }
    if (event.target.closest?.('[data-reorder-id]')) event.preventDefault();
  }

  handleDrop(event) {
    const layoutTarget = event.target.closest?.('.layout-break-target');
    if (layoutTarget && this.layoutDrag) {
      event.preventDefault(); const drag = this.layoutDrag; this.layoutDrag = null;
      this.root.querySelectorAll('.layout-drop-active').forEach(item => item.classList.remove('layout-drop-active'));
      this.ui.setLayoutBreak(drag.songId, Number(layoutTarget.dataset.sectionIndex), Number(layoutTarget.dataset.lineIndex), drag.type, 'after', drag.breakId); return;
    }
    const chart = event.target.closest?.('.structured-chart');
    if (chart && this.sectionDrag) {
      event.preventDefault();
      const source = this.sectionDrag; this.sectionDrag = null;
      this.clearSectionDropIndicator();
      this.ui.placeInlineSection(source.songId, source.sectionIndex, source.insertionIndex, { copy: source.copy });
      return;
    }
    const chordLine = event.target.closest?.('.lead-sheet .chord-line[data-section-index]');
    if (chordLine && this.inlineDrag) {
      event.preventDefault();
      const width = this.ui.authoringController.measureAuthorCharacterWidth(chordLine);
      const offset = (Number(chordLine.dataset.sourceStart) || 0) + Math.max(0, Math.round((event.clientX - chordLine.getBoundingClientRect().left) / width));
      const source = this.inlineDrag;
      this.inlineDrag = null;
      this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => {
        item.classList.remove('dragging', 'author-drop-target'); item.style.removeProperty('--drop-caret-left');
      });
      this.ui.moveInlineChord(source, {
        sectionIndex: Number(chordLine.dataset.sectionIndex), lineIndex: Number(chordLine.dataset.lineIndex)
      }, offset, { copy: source.copy });
      return;
    }
    const row = event.target.closest?.('[data-reorder-id]');
    if (!row || !this.root.contains(row)) return;
    event.preventDefault();
    const songId = event.dataTransfer?.getData('text/song-id');
    if (songId) this.ui.reorderSessionSong(songId, [...row.parentElement.children].indexOf(row));
  }

  updateSectionDropIndicator(chart, clientX, clientY) {
    const sections = [...chart.querySelectorAll('.section-block[data-section-reorder-index]')];
    if (!sections.length) return;
    const candidates = [];
    sections.forEach((section, index) => {
      const box = section.getBoundingClientRect();
      const dx = clientX < box.left ? box.left - clientX : clientX > box.right ? clientX - box.right : 0;
      candidates.push({ section, index, edge: 'before', distance: Math.hypot(dx, clientY - box.top) });
      candidates.push({ section, index: index + 1, edge: 'after', distance: Math.hypot(dx, clientY - box.bottom) });
    });
    const nearest = candidates.sort((a, b) => a.distance - b.distance)[0];
    this.clearSectionDropIndicator(false);
    nearest.section.classList.add(nearest.edge === 'before' ? 'section-drop-before' : 'section-drop-after');
    this.sectionDrag.insertionIndex = nearest.index;
  }

  clearSectionDropIndicator(clearDrag = true) {
    this.root.querySelectorAll('.section-drop-before, .section-drop-after, .section-dragging').forEach(item => {
      item.classList.remove('section-drop-before', 'section-drop-after', 'section-dragging');
    });
    if (clearDrag) this.sectionDrag = null;
  }

  handleDragEnd() {
    this.clearSectionDropIndicator();
    this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => {
      item.classList.remove('dragging', 'author-drop-target'); item.style.removeProperty('--drop-caret-left');
    });
    this.inlineDrag = null;
    this.layoutDrag = null;
    this.root.querySelectorAll('.layout-drop-active').forEach(item => item.classList.remove('layout-drop-active'));
  }

  moveSong(target, songId) {
    const row = target.closest('[data-reorder-id]');
    if (!row) return;
    const delta = target.dataset.direction === 'up' ? -1 : 1;
    this.ui.reorderSessionSong(songId, [...row.parentElement.children].indexOf(row) + delta);
  }

  inlineTarget(event) {
    const target = event.target.closest?.('[data-inline-field][contenteditable]');
    return target && this.root.contains(target) ? target : null;
  }

  handleFocusIn(event) {
    const target = this.inlineTarget(event);
    if (!target) return;
    target.dataset.originalText = target.textContent || '';
    target.classList.remove('inline-edit-empty');
    target.classList.remove('inline-edit-invalid');
    target.removeAttribute('aria-invalid');
  }

  handleFocusOut(event) {
    const target = this.inlineTarget(event);
    if (!target || target.dataset.inlineSaving === 'true') return;
    const next = (target.textContent || '').replace(/[\r\n]+/g, '');
    if (next === (target.dataset.originalText || '')) {
      if (!next && target.dataset.inlineField === 'section-label') {
        const sheet = target.closest('.lead-sheet[data-song-id]');
        this.ui.resolvePendingSection(sheet?.dataset.songId, Number(target.dataset.sectionIndex));
        return;
      }
      if (!next) target.classList.add('inline-edit-empty');
      return;
    }
    target.dataset.inlineSaving = 'true';
    this.ui.commitInlineChartEdit(target, next);
  }

  handleKeyDown(event) {
    if (event.key === 'Escape' && this.contextMenu) {
      event.preventDefault();
      this.closeContextMenu();
      return;
    }
    const activeEdit = this.inlineTarget(event);
    const hasUnsavedText = activeEdit && (activeEdit.textContent || '') !== (activeEdit.dataset.originalText || '');
    if ((event.altKey || event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.isComposing && !hasUnsavedText && this.ui.hasInlineUndo?.()) {
      event.preventDefault();
      this.selectedChordIds.clear();
      this.ui.undoInlineEdit();
      return;
    }
    if (event.key === 'Delete' && this.selectedChordIds.size && !event.isComposing) {
      const sheet = event.target.closest?.('.lead-sheet[data-song-id]')
        || this.root.querySelector('.inline-chord-anchor.is-selected')?.closest('.lead-sheet[data-song-id]');
      if (sheet && this.root.contains(sheet)) {
        event.preventDefault();
        const ids = [...this.selectedChordIds];
        this.selectedChordIds.clear();
        this.ui.deleteInlineChords(sheet.dataset.songId, ids);
        return;
      }
    }
    const target = this.inlineTarget(event);
    if (!target || event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (target.dataset.inlineField === 'lyrics') {
        target.dataset.inlineSaving = 'true';
        const segmentStart = Number(target.dataset.sourceStart) || 0;
        const segmentEnd = Number(target.dataset.sourceEnd);
        const caret = segmentStart + this.caretOffset(target);
        const song = this.ui.currentSongs.find(item => String(item.id) === String(target.closest('.lead-sheet[data-song-id]')?.dataset.songId));
        const sourceLine = song?.sections?.[Number(target.dataset.sectionIndex)]?.lines?.[Number(target.dataset.lineIndex)]?.lyrics || '';
        const currentLyrics = Number.isFinite(segmentEnd)
          ? `${sourceLine.slice(0, segmentStart)}${target.textContent || ''}${sourceLine.slice(segmentEnd)}` : target.textContent || '';
        this.ui.insertInlineChartLine(
          target.closest('.lead-sheet[data-song-id]')?.dataset.songId,
          Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex), caret, currentLyrics
        );
      } else target.blur();
    }
    if (target.dataset.inlineField === 'section-label' && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.ui.moveInlineSection(target.closest('.lead-sheet[data-song-id]')?.dataset.songId,
        Number(target.dataset.sectionIndex), event.key === 'ArrowUp' ? -1 : 1);
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && target.dataset.inlineField === 'lyrics' && !(target.textContent || '')) {
      event.preventDefault();
      target.dataset.inlineSaving = 'true';
      this.ui.removeInlineChartLine(
        target.closest('.lead-sheet[data-song-id]')?.dataset.songId,
        Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex)
      );
    } else if (target.dataset.inlineField === 'lyrics' && (event.key === 'Backspace' || event.key === 'Delete')) {
      const caret = this.caretOffset(target);
      const length = LyricAnchor.graphemes(target.textContent || '').length;
      if ((event.key === 'Backspace' && caret === 0) || (event.key === 'Delete' && caret === length)) {
        event.preventDefault(); target.dataset.inlineSaving = 'true';
        this.ui.joinInlineChartLine(target.closest('.lead-sheet[data-song-id]')?.dataset.songId,
          Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex), event.key === 'Backspace' ? -1 : 1);
      }
    }
    if (event.key === 'Escape') {
      event.preventDefault(); target.textContent = target.dataset.originalText || ''; target.blur();
    }
  }

  selectInlineChord(chord, additive = false) {
    const id = String(chord.dataset.chordId || '');
    if (!id) return;
    if (!additive) this.selectedChordIds.clear();
    if (additive && this.selectedChordIds.has(id)) this.selectedChordIds.delete(id);
    else this.selectedChordIds.add(id);
    this.root.querySelectorAll('.inline-chord-anchor[data-chord-id]').forEach(item => {
      const selected = this.selectedChordIds.has(String(item.dataset.chordId));
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-selected', String(selected));
    });
  }

  caretOffset(target) {
    const selection = window.getSelection?.();
    if (!selection?.rangeCount || !target.contains(selection.anchorNode)) return LyricAnchor.graphemes(target.textContent || '').length;
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(target); range.setEnd(selection.anchorNode, selection.anchorOffset);
    return LyricAnchor.graphemes(range.toString()).length;
  }

  handlePaste(event) {
    const target = this.inlineTarget(event);
    if (!target) return;
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') || '').replace(/[\r\n]+/g, ' ');
    document.execCommand('insertText', false, text);
  }

  handlePointerDown(event) {
    const divider = event.target.closest?.('.column-divider-handle[data-column-divider]');
    if (divider && this.root.contains(divider)) {
      event.preventDefault(); const songId = divider.dataset.songId;
      const song = this.ui.currentSongs.find(item => String(item.id) === String(songId));
      const container = divider.closest('.chart-page-columns'); const page = divider.closest('.chart-page');
      if (!song || !container || !page) return;
      const spec = ChartPageLayout.spec(song.layout); const rect = container.getBoundingClientRect();
      const pageWidthPx = page.getBoundingClientRect().width; const gutterPx = spec.gutter / spec.pageWidth * pageWidthPx;
      this.columnDividerDrag = { pointerId: event.pointerId, songId, index: Number(divider.dataset.columnDivider),
        rect, gutterPx, printablePx: rect.width - gutterPx * (spec.columns - 1), ratios: [...spec.columnRatios] };
      divider.classList.add('is-dragging'); return;
    }
    const boundary = event.target.closest?.('.layout-break-target.has-layout-break');
    if (boundary && this.root.contains(boundary)) {
      event.preventDefault();
      this.layoutPointerDrag = { pointerId: event.pointerId, songId: boundary.dataset.songId,
        type: boundary.dataset.breakType || 'column', breakId: boundary.dataset.breakId, source: boundary };
      boundary.setPointerCapture?.(event.pointerId); boundary.classList.add('layout-dragging'); return;
    }
    const chord = event.target.closest?.('.inline-chord-anchor');
    if (!chord || !this.root.contains(chord)) return;
    this.pointerDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false,
      element: chord,
      source: { songId: chord.closest('.lead-sheet[data-song-id]')?.dataset.songId,
        sectionIndex: Number(chord.dataset.sectionIndex), lineIndex: Number(chord.dataset.lineIndex), chordId: chord.dataset.chordId },
      copy: Boolean(event.altKey) };
  }

  handlePointerMove(event) {
    if (this.columnDividerDrag?.pointerId === event.pointerId) {
      event.preventDefault(); const ratios = this.previewColumnDivider(event.clientX);
      if (ratios) this.columnDividerDrag.previewRatios = ratios; return;
    }
    if (this.layoutPointerDrag?.pointerId === event.pointerId) {
      event.preventDefault();
      const target = this.nearestLayoutTarget(event.clientX, event.clientY);
      this.root.querySelectorAll('.layout-drop-active').forEach(item => item.classList.remove('layout-drop-active'));
      if (target) { target.classList.add('layout-drop-active'); this.layoutPointerDrag.target = target; }
      return;
    }
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    if (!drag.active) {
      drag.active = true;
      drag.element?.setPointerCapture?.(event.pointerId);
      drag.element?.classList.add('dragging');
      window.getSelection?.()?.removeAllRanges();
    }
    event.preventDefault();
    const line = document.elementFromPoint(event.clientX, event.clientY)?.closest('.lead-sheet .chord-line[data-section-index]');
    if (!line) return;
    this.root.querySelectorAll('.author-drop-target').forEach(item => item.classList.remove('author-drop-target'));
    line.classList.add('author-drop-target');
    const width = this.ui.authoringController.measureAuthorCharacterWidth(line);
    const offset = Math.max(0, Math.round((event.clientX - line.getBoundingClientRect().left) / width));
    line.style.setProperty('--drop-caret-left', `${offset * width}px`);
  }

  handlePointerUp(event) {
    if (this.columnDividerDrag?.pointerId === event.pointerId) {
      const drag = this.columnDividerDrag; const ratios = this.previewColumnDivider(event.clientX) || drag.previewRatios;
      this.columnDividerDrag = null; this.root.querySelectorAll('.column-divider-handle.is-dragging').forEach(item => item.classList.remove('is-dragging'));
      if (ratios) this.ui.setSongColumnDivider(drag.songId, drag.index, ratios.slice(0, drag.index + 1).reduce((sum, value) => sum + value, 0));
      return;
    }
    if (this.layoutPointerDrag?.pointerId === event.pointerId) {
      const drag = this.layoutPointerDrag; this.layoutPointerDrag = null;
      const target = this.nearestLayoutTarget(event.clientX, event.clientY) || drag.target;
      this.root.querySelectorAll('.layout-drop-active, .layout-dragging').forEach(item => item.classList.remove('layout-drop-active', 'layout-dragging'));
      if (target) this.ui.setLayoutBreak(drag.songId, Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex), drag.type, 'after', drag.breakId);
      return;
    }
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const line = document.elementFromPoint(event.clientX, event.clientY)?.closest('.lead-sheet .chord-line[data-section-index]');
    this.pointerDrag = null;
    this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => { item.classList.remove('dragging', 'author-drop-target'); item.style.removeProperty('--drop-caret-left'); });
    if (!drag.active || !line) return;
    event.preventDefault();
    const width = this.ui.authoringController.measureAuthorCharacterWidth(line);
    this.ui.moveInlineChord(drag.source, { sectionIndex: Number(line.dataset.sectionIndex), lineIndex: Number(line.dataset.lineIndex) },
      (Number(line.dataset.sourceStart) || 0) + Math.max(0, Math.round((event.clientX - line.getBoundingClientRect().left) / width)), { copy: drag.copy });
  }

  handlePointerCancel(event) {
    if (this.columnDividerDrag?.pointerId === event.pointerId) {
      this.columnDividerDrag = null; this.root.querySelectorAll('.column-divider-handle.is-dragging').forEach(item => item.classList.remove('is-dragging')); this.ui.displaySongs(); return;
    }
    if (this.layoutPointerDrag?.pointerId === event.pointerId) {
      this.layoutPointerDrag = null; this.root.querySelectorAll('.layout-drop-active, .layout-dragging').forEach(item => item.classList.remove('layout-drop-active', 'layout-dragging')); return;
    }
    if (!this.pointerDrag || this.pointerDrag.pointerId !== event.pointerId) return;
    this.pointerDrag = null;
    this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => {
      item.classList.remove('dragging', 'author-drop-target');
      item.style.removeProperty('--drop-caret-left');
    });
  }

  nearestLayoutTarget(x, y) {
    const targets = [...this.root.querySelectorAll('.layout-break-target')]; let nearest = null; let distance = Infinity;
    targets.forEach(item => { const rect = item.getBoundingClientRect(); const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = Math.abs(y - (rect.top + rect.height / 2)); const value = Math.hypot(dx, dy); if (value < distance) { distance = value; nearest = item; } });
    return nearest;
  }

  previewColumnDivider(clientX) {
    const drag = this.columnDividerDrag; if (!drag || drag.printablePx <= 0) return null;
    const ratios = [...drag.ratios]; const previous = ratios.slice(0, drag.index).reduce((sum, value) => sum + value, 0);
    const next = ratios.slice(0, drag.index + 2).reduce((sum, value) => sum + value, 0);
    const raw = (clientX - drag.rect.left - drag.gutterPx * (drag.index + .5)) / drag.printablePx;
    const target = Math.max(previous + .15, Math.min(next - .15, raw));
    ratios[drag.index] = target - previous; ratios[drag.index + 1] = next - target;
    this.root.querySelectorAll(`.lead-sheet[data-song-id="${CSS.escape(String(drag.songId))}"] .chart-page-columns`).forEach(container => {
      container.style.gridTemplateColumns = ratios.map(value => `${value}fr`).join(' ');
      const width = container.getBoundingClientRect().width; const printable = width - drag.gutterPx * (ratios.length - 1);
      container.querySelectorAll('.column-divider-handle').forEach(handle => { const index = Number(handle.dataset.columnDivider);
        const left = (printable * ratios.slice(0, index + 1).reduce((sum, value) => sum + value, 0) + drag.gutterPx * (index + .5)) / width * 100;
        handle.style.setProperty('--divider-left', `${left}%`); });
    });
    this.ui.previewSongLayout(drag.songId, { columnRatios: ratios });
    this.root.querySelectorAll(`.lead-sheet[data-song-id="${CSS.escape(String(drag.songId))}"] .column-divider-handle[data-column-divider="${drag.index}"]`).forEach(item => item.classList.add('is-dragging'));
    return ratios;
  }

  handleDoubleClick(event) {
    const boundary = event.target.closest?.('.layout-break-target.has-layout-break');
    if (boundary && this.root.contains(boundary)) {
      event.preventDefault(); this.ui.removeSongLayoutBreak(boundary.dataset.songId, boundary.dataset.breakId); return;
    }
    if (event.target.closest?.('.inline-chord-anchor')) return;
    const chordLine = event.target.closest?.('.lead-sheet .chord-line[data-section-index]');
    if (!chordLine || !this.root.contains(chordLine)) return;
    const sheet = chordLine.closest('.lead-sheet[data-song-id]');
    if (!sheet) return;
    event.preventDefault();
    const width = this.ui.authoringController.measureAuthorCharacterWidth(chordLine);
    const offset = (Number(chordLine.dataset.sourceStart) || 0) + Math.max(0, Math.round((event.clientX - chordLine.getBoundingClientRect().left) / width));
    this.ui.insertInlineChord(sheet.dataset.songId, Number(chordLine.dataset.sectionIndex),
      Number(chordLine.dataset.lineIndex), offset);
  }

  handleContextMenu(event) {
    const sheet = event.target.closest?.('.lead-sheet[data-song-id]');
    if (!sheet || !this.root.contains(sheet)) return;
    const chord = event.target.closest?.('.inline-chord-anchor[data-chord-id]');
    const lyric = event.target.closest?.('[data-inline-field="lyrics"]');
    const sectionLabel = event.target.closest?.('[data-inline-field="section-label"]');
    const lane = event.target.closest?.('.chord-line[data-section-index]');
    const editable = event.target.closest?.('[contenteditable="true"], [contenteditable="plaintext-only"]');
    if (editable && !chord && !lyric && !sectionLabel) return;
    event.preventDefault();
    this.closeContextMenu();
    const section = event.target.closest?.('.section-block[data-section-reorder-index]');
    const sectionIndex = section ? Number(section.dataset.sectionReorderIndex) : null;
    const songId = sheet.dataset.songId;
    const lineIndex = lyric ? Number(lyric.dataset.lineIndex) : lane ? Number(lane.dataset.lineIndex) : null;
    const chartLine = (lyric || lane)?.closest?.('.chart-line');
    const lineRect = chartLine?.getBoundingClientRect();
    const insertionLineIndex = Number.isFinite(lineIndex) ? lineIndex + (lineRect && event.clientY > lineRect.top + lineRect.height / 2 ? 1 : 0) : null;
    const width = lane ? this.ui.authoringController.measureAuthorCharacterWidth(lane) : 1;
    const offset = lane ? Math.max(0, Math.round((event.clientX - lane.getBoundingClientRect().left) / width)) : 0;
    const song = this.ui.currentSongs.find(item => String(item.id) === String(songId));
    this.contextState = { songId, sectionIndex, lineIndex, chordId: chord?.dataset.chordId || null,
      characterOffset: chord ? Number(chord.dataset.characterOffset) || 0 : offset,
      insertionLineIndex,
      caretOffset: lyric ? (Number(lyric.dataset.sourceStart) || 0) + this.caretOffset(lyric) : 0,
      lyricText: lyric ? (() => { const start = Number(lyric.dataset.sourceStart) || 0; const end = Number(lyric.dataset.sourceEnd); const source = song?.sections?.[sectionIndex]?.lines?.[lineIndex]?.lyrics || ''; return Number.isFinite(end) ? `${source.slice(0, start)}${lyric.textContent || ''}${source.slice(end)}` : lyric.textContent || ''; })() : '' };
    let actions;
    if (chord) {
      actions = [['Add section here', 'section-here-line'], ['Add section above', 'section-above'], ['Add section below', 'section-below'], ['Edit chord', 'edit-chord'], ['Delete chord', 'delete-chord', 'danger'], ['Duplicate chord', 'duplicate-chord'], ['Copy chord', 'copy-chord'],
        ['Move to previous lyric line', 'move-chord-prev'], ['Move to next lyric line', 'move-chord-next'],
        ['Mark spelling canonical', 'canonical-chord'], ['Set exact timing…', 'time-chord'], ['Flag for review', 'review-chord']];
      (song?.sections || []).forEach((item, index) => { if (index !== sectionIndex) actions.push([`Copy to ${item.label || `section ${index + 1}`}`, 'copy-chord-section', '', index]); });
    } else if (lyric) {
      actions = [['Add section here', 'section-here-line'], ['Add section above', 'section-above'], ['Add section below', 'section-below'], ['Add line above', 'line-above'], ['Add line below', 'line-below'], ['Split line at cursor', 'split-line'],
        ['End column after this line', 'column-break'], ['Start new page after this line', 'page-break'],
        ['Join with previous', 'join-prev'], ['Join with next', 'join-next'], ['Paste lyrics here', 'paste-lyrics'],
        ['Clear chords from line', 'clear-line-chords', 'danger'], ['Copy chord pattern from matching section', 'copy-line-pattern']];
    } else if (lane) {
      actions = [['Add section here', 'section-here-line'], ['Add section above', 'section-above'], ['Add section below', 'section-below'], ['Add chord here', 'add-chord'], ['Paste copied chord', 'paste-chord'], ['Paste chord sequence…', 'paste-chord-sequence'],
        ['Add N.C.', 'add-no-chord'], ['Copy matching section chords', 'copy-matching-section']];
    } else if (Number.isFinite(sectionIndex)) {
      actions = [['Add section above', 'section-above'], ['Add section below', 'section-below'], ['Rename section', 'rename-section'],
        ['Duplicate section', 'duplicate-section-context'], ['Copy matching chords', 'copy-matching-section'], ['Copy entire section', 'duplicate-section-context'],
        ['Keep section together', 'keep-section'], ['Start in next column', 'start-section-column'], ['Start on next page', 'start-section-page'], ['Span all columns', 'span-section'], ['Reset section flow', 'reset-section-flow'], ['Compact section spacing', 'section-space-compact'], ['Normal section spacing', 'section-space-normal'], ['Spacious section spacing', 'section-space-spacious'],
        ['Move left / up', 'section-prev'], ['Move right / down', 'section-next'], ['Delete section', 'delete-section-context', 'danger']];
    } else {
      this.contextState.sectionIndex = this.nearestSectionInsertion(sheet, event.clientX, event.clientY);
      actions = [['Add section here', 'section-here']];
    }
    if (Number.isFinite(sectionIndex) && !(song?.sections?.[sectionIndex]?.lines || []).some(item => item.chords?.length)) {
      const targetType = Arrangement.normalizeType(song.sections[sectionIndex]?.label || song.sections[sectionIndex]?.type);
      const sources = song.sections.map((item, index) => ({ item, index,
        sameType: Arrangement.normalizeType(item.label || item.type) === targetType }))
        .filter(source => source.index !== sectionIndex && (source.item.lines || []).some(item => item.chords?.length))
        .sort((left, right) => Number(right.sameType) - Number(left.sameType) || left.index - right.index);
      const insertAt = Math.min(3, actions.length);
      actions.splice(insertAt, 0, ...sources.map(source => [`Use chords from ${source.item.label || `section ${source.index + 1}`}`, 'copy-chords-from-section', '', source.index]));
    }
    const menu = document.createElement('div');
    menu.className = 'chart-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Chart actions');
    menu.innerHTML = actions.map(([label, command, tone, destination]) => `<button type="button" role="menuitem" data-context-command="${command}"${tone ? ` data-tone="${tone}"` : ''}${Number.isFinite(destination) ? ` data-destination-section="${destination}"` : ''}>${label}</button>`).join('');
    this.root.appendChild(menu);
    const menuWidth = 240; const height = Math.min(window.innerHeight * .72, actions.length * 42 + 12);
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))}px`;
    this.contextMenu = menu;
    menu.querySelector('button')?.focus();
  }

  closeContextMenu() {
    this.contextMenu?.remove();
    this.contextMenu = null;
  }

  nearestSectionInsertion(sheet, x, y) {
    const sections = [...sheet.querySelectorAll('.section-block[data-section-reorder-index]')];
    if (!sections.length) return 0;
    let nearest = sections[0]; let distance = Infinity;
    sections.forEach(item => { const rect = item.getBoundingClientRect(); const value = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2)); if (value < distance) { distance = value; nearest = item; } });
    const rect = nearest.getBoundingClientRect(); const index = Number(nearest.dataset.sectionReorderIndex);
    return index + ((y > rect.top + rect.height / 2 || (Math.abs(y - (rect.top + rect.height / 2)) < rect.height / 2 && x > rect.left + rect.width / 2)) ? 1 : 0);
  }

  async runContextCommand(command, data = {}) {
    const state = this.contextState; if (!state) return;
    const source = { songId: state.songId, sectionIndex: state.sectionIndex, lineIndex: state.lineIndex, chordId: state.chordId };
    const adjacent = delta => ({ sectionIndex: state.sectionIndex, lineIndex: state.lineIndex + delta });
    const commands = {
      'edit-chord': () => this.ui.focusInlineChord(state.songId, state.chordId),
      'delete-chord': () => this.ui.deleteInlineChords(state.songId, [state.chordId]),
      'duplicate-chord': () => this.ui.moveInlineChord(source, adjacent(0), state.characterOffset + 2, { copy: true }),
      'copy-chord': () => { this.copiedChord = source; this.ui.updateStatus('Chord copied', 'success'); },
      'move-chord-prev': () => this.ui.moveInlineChord(source, adjacent(-1), state.characterOffset),
      'move-chord-next': () => this.ui.moveInlineChord(source, adjacent(1), state.characterOffset),
      'copy-chord-section': () => this.ui.copyInlineChordToSection(source, Number(data.destinationSection)),
      'canonical-chord': () => this.ui.markInlineChordCanonical(source),
      'time-chord': () => this.ui.setInlineChordTiming(source),
      'review-chord': () => this.ui.flagInlineChordForReview(source),
      'line-above': () => this.ui.addInlineChartLineAt(state.songId, state.sectionIndex, state.lineIndex),
      'line-below': () => this.ui.addInlineChartLineAt(state.songId, state.sectionIndex, state.lineIndex + 1),
      'split-line': () => this.ui.insertInlineChartLine(state.songId, state.sectionIndex, state.lineIndex, state.caretOffset, state.lyricText),
      'join-prev': () => this.ui.joinInlineChartLine(state.songId, state.sectionIndex, state.lineIndex, -1),
      'join-next': () => this.ui.joinInlineChartLine(state.songId, state.sectionIndex, state.lineIndex, 1),
      'paste-lyrics': async () => this.ui.replaceInlineLyrics(state.songId, state.sectionIndex, state.lineIndex, await navigator.clipboard.readText()),
      'clear-line-chords': () => this.ui.clearInlineLineChords(state.songId, state.sectionIndex, state.lineIndex),
      'copy-line-pattern': () => this.ui.copyMatchingLinePattern(state.songId, state.sectionIndex, state.lineIndex),
      'column-break': () => this.ui.setLayoutBreak(state.songId, state.sectionIndex, state.lineIndex, 'column'),
      'page-break': () => this.ui.setLayoutBreak(state.songId, state.sectionIndex, state.lineIndex, 'page'),
      'add-chord': () => this.ui.insertInlineChord(state.songId, state.sectionIndex, state.lineIndex, state.characterOffset),
      'paste-chord': () => this.ui.pasteInlineChord(this.copiedChord, state),
      'paste-chord-sequence': () => this.ui.insertInlineChordSequence(state),
      'add-no-chord': () => this.ui.insertInlineChord(state.songId, state.sectionIndex, state.lineIndex, state.characterOffset, 'N.C.'),
      'copy-matching-section': () => this.ui.copyMatchingSectionChords(state.songId, state.sectionIndex),
      'copy-chords-from-section': () => this.ui.copyInlineSectionChords(state.songId, Number(data.destinationSection), state.sectionIndex),
      'section-above': () => this.ui.addInlineSection(state.songId, state.sectionIndex),
      'section-below': () => this.ui.addInlineSection(state.songId, state.sectionIndex + 1),
      'section-here': () => this.ui.addInlineSection(state.songId, state.sectionIndex),
      'section-here-line': () => this.ui.splitInlineSectionAt(state.songId, state.sectionIndex, state.insertionLineIndex),
      'rename-section': () => this.ui.focusInlineSectionLabel(state.songId, state.sectionIndex),
      'duplicate-section-context': () => this.ui.duplicateInlineSection(state.songId, state.sectionIndex),
      'section-prev': () => this.ui.moveInlineSection(state.songId, state.sectionIndex, -1),
      'section-next': () => this.ui.moveInlineSection(state.songId, state.sectionIndex, 1),
      'delete-section-context': () => this.ui.deleteInlineSection(state.songId, state.sectionIndex)
      ,'keep-section': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { keepTogether: true })
      ,'start-section-column': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { start: 'column' })
      ,'start-section-page': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { start: 'page' })
      ,'span-section': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { spanColumns: true })
      ,'reset-section-flow': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { keepTogether: false, start: 'auto', spanColumns: false, spacing: 'inherit' })
      ,'section-space-compact': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { spacing: 'compact' })
      ,'section-space-normal': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { spacing: 'normal' })
      ,'section-space-spacious': () => this.ui.setSectionLayoutRule(state.songId, state.sectionIndex, { spacing: 'spacious' })
    };
    try { await commands[command]?.(); } catch (error) { this.ui.updateStatus(error?.message || 'Action could not be completed', 'error'); }
  }
}

if (typeof window !== 'undefined') window.WorkspaceController = WorkspaceController;
if (typeof module !== 'undefined' && module.exports) module.exports = WorkspaceController;
