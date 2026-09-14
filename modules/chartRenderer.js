/** Pure chart HTML renderer shared by workspace, editor preview, and future views. */
class ChartRenderer {
  constructor(options = {}) {
    this.MusicTheoryClass = options.MusicTheoryClass
      || (typeof MusicTheory !== 'undefined' ? MusicTheory : null);
    this.escape = options.escapeHtml || this.defaultEscapeHtml;
  }

  musicTheory() {
    if (!this.MusicTheoryClass) throw new Error('MusicTheory is not available');
    return new this.MusicTheoryClass();
  }

  defaultEscapeHtml(text) {
    return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  renderLeadSheetContent(song, options = {}) {
    if (song.sections?.length
      && (!song.textItems?.length || song.source?.preserveLayout === false || song.sourceType === 'manual')) {
      return this.renderStructuredContent(song, options);
    }

    const musicTheory = this.musicTheory();
    let html = '<div class="pdf-layout-container">';
    const pageGroups = this.groupTextItemsByPage(song.textItems);

    Object.keys(pageGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pageNum => {
      html += `<div class="pdf-page" data-page="${pageNum}" style="position: relative; min-height: 600px;">`;
      pageGroups[pageNum].forEach(item => {
        const isChordLine = this.containsChords(item.text);
        const className = this.getPDFItemClass(item, isChordLine);
        let displayText = item.text;
        if (isChordLine) {
          displayText = this.transposeTextItem(item.text, song.transposition, musicTheory, song);
        }
        const scaleFactor = 0.8;
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
                   ${this.escape(displayText)}
                 </div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  renderStructuredContent(song, options = {}) {
    const musicTheory = this.musicTheory();
    const sections = song.sections || [];
    return `<div class="structured-chart">${sections.map((section, sectionIndex) => {
      const label = options.editable
        ? `<div class="section-heading"><span class="section-drag-handle" draggable="true" tabindex="0" aria-label="Drag to reorder section" title="Drag section">⠿</span><div class="section-label${section.label ? '' : ' inline-edit-empty'}" contenteditable="plaintext-only" role="textbox" aria-label="Edit section label" spellcheck="true" data-inline-field="section-label" data-section-index="${sectionIndex}" data-placeholder="Section">${this.escape(section.label || '')}</div><div class="section-actions" aria-label="Section actions"><button type="button" data-action="add-section-before" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Add section before">+ before</button><button type="button" data-action="add-section-after" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Add section after">+ after</button><button type="button" data-action="duplicate-section" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Duplicate section">Duplicate</button><button type="button" data-action="move-section" data-direction="up" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" aria-label="Move section up">↑</button><button type="button" data-action="move-section" data-direction="down" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" aria-label="Move section down">↓</button><button type="button" data-action="delete-section" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Delete section">Delete</button></div></div>`
        : (section.label ? `<div class="section-label">${this.escape(section.label)}</div>` : '');
      const lines = (section.lines || []).map((line, lineIndex) => {
        const chords = (line.chords || []).map((chord, chordIndex) => ({
          ...chord,
          chordIndex,
          displaySymbol: this.displayStoredChord(chord, song, musicTheory)
        }));
        return `<div class="chart-line">
          <div class="chord-line" aria-label="Chords" data-section-index="${sectionIndex}" data-line-index="${lineIndex}">${this.renderChordAnchors(chords, { ...options, sectionIndex, lineIndex })}</div>
          <div class="lyric-line${line.lyrics ? '' : ' inline-edit-empty'}"${options.editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit lyrics" spellcheck="true" data-inline-field="lyrics" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" data-placeholder="Type lyrics"` : ''}>${this.escape(line.lyrics || '')}${!line.lyrics && !options.editable ? '&nbsp;' : ''}</div>
          ${options.editable ? `<button type="button" class="inline-add-line" data-action="add-chart-line" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" aria-label="Add lyric line after this line" title="Add line">+ line</button>` : ''}
        </div>`;
      }).join('');
      return `<section class="section-block" data-section-reorder-index="${sectionIndex}">${label}${lines}</section>`;
    }).join('')}</div>`;
  }

  renderChordAnchors(chords, options = {}) {
    if (!chords.length) return '&nbsp;';
    const output = [];
    let cursor = 0;
    [...chords].sort((a, b) => a.characterOffset - b.characterOffset).forEach(chord => {
      const offset = Math.max(cursor, Number(chord.characterOffset) || 0);
      if (!options.editable && offset > cursor) output.push(this.escape(' '.repeat(offset - cursor)));
      const symbol = this.escape(chord.displaySymbol || chord.symbol);
      if (options.editable) {
        const timestamp = chord.timestamp ?? '';
        output.push(`<span class="inline-chord-anchor" style="--chord-column:${Number(chord.characterOffset) || 0}" data-chord-id="${this.escape(chord.id)}" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" data-character-offset="${Number(chord.characterOffset) || 0}" data-timestamp="${timestamp}"><span class="chord-token inline-chord-edit" contenteditable="plaintext-only" role="textbox" aria-label="Edit chord ${symbol}" spellcheck="false" data-inline-field="chord" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" title="Type to edit chord">${symbol}</span><span class="inline-chord-drag-handle" contenteditable="false" role="button" tabindex="0" aria-label="Drag ${symbol}" title="Drag chord">⋮</span></span>`);
      } else if (options.interactive) {
        const timestamp = chord.timestamp ?? '';
        output.push(`<button type="button" class="chord-token" draggable="true" aria-pressed="false" data-chord-id="${this.escape(chord.id)}" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" data-character-offset="${Number(chord.characterOffset) || 0}" data-timestamp="${timestamp}" title="Drag to place; arrow keys move">${symbol}</button>`);
      } else {
        output.push(`<span class="chord-token">${symbol}</span>`);
      }
      if (!options.editable) cursor = offset + String(chord.displaySymbol || chord.symbol).length;
    });
    return output.join('');
  }

  transposeForSong(symbol, song, musicTheory = this.musicTheory()) {
    const view = { ...(song.sessionView || {}), spellingPolicy: song.spellingPolicy };
    if (view.capo && (!view.spellingPolicy || view.spellingPolicy === 'contextual')) {
      const shapeKey = musicTheory.transposeKey(song.currentKey || song.originalKey, -Number(view.capo), 'contextual');
      view.spellingPolicy = shapeKey.includes('b') ? 'flats' : 'sharps';
    }
    return musicTheory.displayChord(symbol, song, view);
  }

  displayStoredChord(chord, song, musicTheory = this.musicTheory()) {
    const view = { ...(song.sessionView || {}), spellingPolicy: song.spellingPolicy };
    return chord.manualEntry
      ? musicTheory.displayManualChord(chord.symbol, chord.manualEntry, song, view)
      : this.transposeForSong(chord.symbol, song, musicTheory);
  }

  chordViewSignature(song) {
    const view = song.sessionView || {};
    return [Number(song.transposition) || 0, view.notation || 'chords', Number(view.capo) || 0,
      view.instrument || 'concert'].join('|');
  }

  groupTextItemsByPage(textItems = []) {
    const pageGroups = {};
    textItems.forEach(item => {
      if (!pageGroups[item.pageNum]) pageGroups[item.pageNum] = [];
      pageGroups[item.pageNum].push(item);
    });
    return pageGroups;
  }

  groupItemsByLines(pageItems, tolerance = 10) {
    const lines = [];
    const processed = new Set();
    pageItems.forEach(item => {
      if (processed.has(item.id)) return;
      const line = [item];
      processed.add(item.id);
      pageItems.forEach(otherItem => {
        if (processed.has(otherItem.id)) return;
        if (Math.abs(item.y - otherItem.y) <= tolerance) {
          line.push(otherItem);
          processed.add(otherItem.id);
        }
      });
      line.sort((a, b) => a.x - b.x);
      lines.push(line);
    });
    return lines;
  }

  getPDFItemClass(item, isChordLine) {
    let className = 'pdf-text-item';
    if (isChordLine) className += ' chord-text';
    else if (this.isSectionHeader(item.text)) className += ' section-header-text';
    else if (item.bold || (item.fontSize || 12) > 14) className += ' title-text';
    else className += ' lyric-text';
    return className;
  }

  isSectionHeader(text) {
    const sectionPatterns = [
      /^VERSE\s*\d*/i, /^CHORUS\s*\d*/i, /^BRIDGE\s*/i,
      /^PRE-CHORUS/i, /^INTRO/i, /^OUTRO/i, /^INSTRUMENTAL/i
    ];
    return sectionPatterns.some(pattern => pattern.test(text.trim()));
  }

  transposeTextItem(text, transposition, musicTheory = this.musicTheory(), song = null) {
    if (transposition === 0 && !song) return text;
    const chords = musicTheory.extractChords(text);
    if (!chords.length) return text;
    let result = text;
    chords.sort((a, b) => b.position - a.position).forEach(chord => {
      const transposedChord = song
        ? this.transposeForSong(chord.original, song, musicTheory)
        : musicTheory.transposeChord(chord.original, transposition);
      result = result.substring(0, chord.position) + transposedChord
        + result.substring(chord.position + chord.original.length);
    });
    return result;
  }

  containsChords(text) {
    return Boolean(text && this.musicTheory().extractChords(text).length);
  }

  renderChordsInLine(line, chords, transposition, musicTheory = this.musicTheory()) {
    if (!chords.length) return this.escape(line);
    let html = '';
    let lastPos = 0;
    chords.sort((a, b) => a.position - b.position).forEach(chord => {
      if (chord.position > lastPos) html += this.escape(line.substring(lastPos, chord.position));
      const transposedChord = transposition === 0
        ? chord.original
        : musicTheory.transposeChord(chord.original, transposition);
      html += `<span class="chord" data-original="${chord.original}" data-transposed="${transposedChord}">${transposedChord}</span>`;
      lastPos = chord.position + chord.original.length;
    });
    if (lastPos < line.length) html += this.escape(line.substring(lastPos));
    return html;
  }

  getLineType(line) {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('VERSE') || upperLine.includes('CHORUS')
      || upperLine.includes('BRIDGE') || upperLine.includes('INTRO')
      || upperLine.includes('OUTRO') || upperLine.includes('PRE-CHORUS')) return 'section-header';
    if (/^[A-Z\s]+$/.test(line) && line.length > 3) return 'section-title';
    return 'lyric-line';
  }
}

if (typeof window !== 'undefined') window.ChartRenderer = ChartRenderer;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartRenderer;
