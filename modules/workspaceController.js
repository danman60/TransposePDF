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
    this.listeners.focusin = event => this.handleFocusIn(event);
    this.listeners.focusout = event => this.handleFocusOut(event);
    this.listeners.keydown = event => this.handleKeyDown(event);
    this.listeners.paste = event => this.handlePaste(event);
    this.listeners.pointerdown = event => this.handlePointerDown(event);
    this.listeners.pointermove = event => this.handlePointerMove(event);
    this.listeners.pointerup = event => this.handlePointerUp(event);
    this.listeners.pointercancel = event => this.handlePointerCancel(event);
    this.listeners.dblclick = event => this.handleDoubleClick(event);
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.addEventListener(name, listener));
    this.attached = true;
    return this;
  }

  detach() {
    if (!this.attached || !this.root) return;
    Object.entries(this.listeners).forEach(([name, listener]) => this.root.removeEventListener(name, listener));
    this.listeners = {};
    this.attached = false;
  }

  handleClick(event) {
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
      'duplicate-section': () => this.ui.duplicateInlineSection(songId, Number(target.dataset.sectionIndex)),
      'delete-section': () => this.ui.deleteInlineSection(songId, Number(target.dataset.sectionIndex)),
      'move-section': () => this.ui.moveInlineSection(songId, Number(target.dataset.sectionIndex), target.dataset.direction === 'up' ? -1 : 1),
      'set-layout-columns': () => this.ui.setSongLayoutColumns(songId, Number(target.dataset.columns)),
      'use-song-order': () => this.ui.useInferredArrangement(songId),
      'move-song': () => this.moveSong(target, songId),
      'remove-song': () => this.ui.removeSessionSong(songId)
    };
    if (actions[action]) {
      event.preventDefault();
      actions[action]();
    }
  }

  handleChange(event) {
    const target = event.target.closest?.('[data-action][data-song-id]');
    if (!target || !this.root.contains(target)) return;
    if (target.dataset.action === 'set-spelling') this.ui.setSpellingPolicy(target.dataset.songId, target.value);
    if (target.dataset.action === 'set-chart-view') this.ui.setChartView(target.dataset.songId, target.dataset.field, target.value);
  }

  handleDragStart(event) {
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
        sectionIndex: Number(section.dataset.sectionReorderIndex) };
      event.dataTransfer?.setData('text/section-index', String(section.dataset.sectionReorderIndex));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      return;
    }
    const row = event.target.closest?.('[data-reorder-id]');
    if (row && this.root.contains(row)) event.dataTransfer?.setData('text/song-id', row.dataset.reorderId);
  }

  handleDragOver(event) {
    const section = event.target.closest?.('.section-block[data-section-reorder-index]');
    if (section && this.sectionDrag) { event.preventDefault(); section.classList.add('section-drop-target'); return; }
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
    const section = event.target.closest?.('.section-block[data-section-reorder-index]');
    if (section && this.sectionDrag) {
      event.preventDefault();
      const source = this.sectionDrag; this.sectionDrag = null;
      this.root.querySelectorAll('.section-drop-target').forEach(item => item.classList.remove('section-drop-target'));
      this.ui.reorderInlineSection(source.songId, source.sectionIndex, Number(section.dataset.sectionReorderIndex));
      return;
    }
    const chordLine = event.target.closest?.('.lead-sheet .chord-line[data-section-index]');
    if (chordLine && this.inlineDrag) {
      event.preventDefault();
      const width = this.ui.authoringController.measureAuthorCharacterWidth(chordLine);
      const offset = Math.max(0, Math.round((event.clientX - chordLine.getBoundingClientRect().left) / width));
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
      if (!next) target.classList.add('inline-edit-empty');
      return;
    }
    target.dataset.inlineSaving = 'true';
    this.ui.commitInlineChartEdit(target, next);
  }

  handleKeyDown(event) {
    if (event.altKey && event.key.toLowerCase() === 'z' && !event.isComposing) {
      event.preventDefault();
      this.selectedChordIds.clear();
      this.ui.undoInlineChordDelete();
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
        const caret = this.caretOffset(target);
        this.ui.insertInlineChartLine(
          target.closest('.lead-sheet[data-song-id]')?.dataset.songId,
          Number(target.dataset.sectionIndex), Number(target.dataset.lineIndex), caret, target.textContent || ''
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
    const chord = event.target.closest?.('.inline-chord-anchor');
    if (!chord || !this.root.contains(chord)) return;
    this.pointerDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false,
      element: chord,
      source: { songId: chord.closest('.lead-sheet[data-song-id]')?.dataset.songId,
        sectionIndex: Number(chord.dataset.sectionIndex), lineIndex: Number(chord.dataset.lineIndex), chordId: chord.dataset.chordId },
      copy: Boolean(event.altKey) };
  }

  handlePointerMove(event) {
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
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const line = document.elementFromPoint(event.clientX, event.clientY)?.closest('.lead-sheet .chord-line[data-section-index]');
    this.pointerDrag = null;
    this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => { item.classList.remove('dragging', 'author-drop-target'); item.style.removeProperty('--drop-caret-left'); });
    if (!drag.active || !line) return;
    event.preventDefault();
    const width = this.ui.authoringController.measureAuthorCharacterWidth(line);
    this.ui.moveInlineChord(drag.source, { sectionIndex: Number(line.dataset.sectionIndex), lineIndex: Number(line.dataset.lineIndex) },
      Math.max(0, Math.round((event.clientX - line.getBoundingClientRect().left) / width)), { copy: drag.copy });
  }

  handlePointerCancel(event) {
    if (!this.pointerDrag || this.pointerDrag.pointerId !== event.pointerId) return;
    this.pointerDrag = null;
    this.root.querySelectorAll('.dragging, .author-drop-target').forEach(item => {
      item.classList.remove('dragging', 'author-drop-target');
      item.style.removeProperty('--drop-caret-left');
    });
  }

  handleDoubleClick(event) {
    if (event.target.closest?.('.inline-chord-anchor')) return;
    const chordLine = event.target.closest?.('.lead-sheet .chord-line[data-section-index]');
    if (!chordLine || !this.root.contains(chordLine)) return;
    const sheet = chordLine.closest('.lead-sheet[data-song-id]');
    if (!sheet) return;
    event.preventDefault();
    const width = this.ui.authoringController.measureAuthorCharacterWidth(chordLine);
    const offset = Math.max(0, Math.round((event.clientX - chordLine.getBoundingClientRect().left) / width));
    this.ui.insertInlineChord(sheet.dataset.songId, Number(chordLine.dataset.sectionIndex),
      Number(chordLine.dataset.lineIndex), offset);
  }
}

if (typeof window !== 'undefined') window.WorkspaceController = WorkspaceController;
if (typeof module !== 'undefined' && module.exports) module.exports = WorkspaceController;
