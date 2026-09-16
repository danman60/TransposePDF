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
    if (typeof ChartPageLayout !== 'undefined') return this.renderPlannedStructuredContent(song, options);
    const musicTheory = this.musicTheory();
    const sections = song.sections || [];
    const columns = Math.max(1, Math.min(3, Number(options.columns ?? song.layout?.columns) || 1));
    const editable = Boolean(options.editable);
    const arrangement = song.arrangement?.mode === 'manual'
      ? String(song.arrangement?.value || '')
      : String(song.arrangement?.inferredValue || (typeof Arrangement !== 'undefined' ? Arrangement.infer(sections) : ''));
    const metadata = `<footer class="chart-metadata" aria-label="Song credits and arrangement">
      ${this.renderMetadataField('Writer', 'writer', song.credits?.writer?.value, editable, song.id)}
      ${this.renderMetadataField('Arrangement by', 'arranger', song.credits?.arranger?.value, editable, song.id)}
      <div class="chart-metadata-row chart-arrangement-row"><span class="chart-metadata-label">Arrangement</span><div class="chart-metadata-value${arrangement ? '' : ' inline-edit-empty'}"${editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit arrangement order" spellcheck="false" data-inline-field="arrangement" data-placeholder="${this.escape(song.arrangement?.inferredValue || 'V1 C V2 C B C')}"` : ''}>${this.escape(arrangement)}</div>${editable && song.arrangement?.mode === 'manual' ? `<button type="button" class="use-song-order" data-action="use-song-order" data-song-id="${this.escape(song.id)}">Use song order</button>` : ''}</div>
    </footer>`;
    return `<div class="structured-chart" data-layout-columns="${columns}" style="--chart-columns:${columns}">${sections.map((section, sectionIndex) => {
      const sourceIndex = this.matchingChordSectionIndex(sections, sectionIndex);
      const chordOffer = editable && sourceIndex >= 0
        ? `<button type="button" class="copy-section-chords" data-action="copy-section-chords" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" data-source-section-index="${sourceIndex}">Use chords from ${this.escape(sections[sourceIndex].label || `section ${sourceIndex + 1}`)}</button>`
        : '';
      const label = options.editable
        ? `<div class="section-heading"><span class="section-drag-handle" draggable="true" tabindex="0" aria-label="Drag to reorder section" title="Drag section">⠿</span><div class="section-label${section.label ? '' : ' inline-edit-empty'}" contenteditable="plaintext-only" role="textbox" aria-label="Edit section label" spellcheck="true" data-inline-field="section-label" data-section-index="${sectionIndex}" data-placeholder="Section">${this.escape(section.label || '')}</div><div class="section-actions" aria-label="Section actions"><button type="button" data-action="add-section-before" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Add section before">+ before</button><button type="button" data-action="add-section-after" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Add section after">+ after</button><button type="button" data-action="duplicate-section" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Duplicate section">Duplicate</button><button type="button" data-action="move-section" data-direction="up" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" aria-label="Move section up">↑</button><button type="button" data-action="move-section" data-direction="down" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" aria-label="Move section down">↓</button><button type="button" data-action="delete-section" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" title="Delete section">Delete</button></div></div>`
        : (section.label ? `<div class="section-label">${this.escape(section.label)}</div>` : '');
      const lines = (section.lines || []).map((line, lineIndex) => {
        const chords = (line.chords || []).map((chord, chordIndex) => ({
          ...chord,
          chordIndex,
          displaySymbol: this.displayStoredChord(chord, song, musicTheory)
        }));
        const visualColumns = Math.max(24, String(line.lyrics || '').length,
          ...chords.map(chord => (Number(chord.characterOffset) || 0) + String(chord.displaySymbol || chord.symbol || '').length));
        const lineFit = (150 / visualColumns).toFixed(4);
        return `<div class="chart-line" style="--line-columns:${visualColumns};--line-fit:${lineFit}cqi">
          ${options.editable ? this.renderLineControls(song.id, sectionIndex, lineIndex) : ''}
          <div class="chord-line" aria-label="Chords" data-section-index="${sectionIndex}" data-line-index="${lineIndex}">${this.renderChordAnchors(chords, { ...options, sectionIndex, lineIndex })}</div>
          <div class="lyric-line${line.lyrics ? '' : ' inline-edit-empty'}"${options.editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit lyrics" spellcheck="true" data-inline-field="lyrics" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" data-placeholder="Type lyrics"` : ''}>${this.escape(line.lyrics || '')}${!line.lyrics && !options.editable ? '&nbsp;' : ''}</div>
          ${options.editable ? `<button type="button" class="inline-add-line" data-action="add-chart-line" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" aria-label="Add lyric line after this line" title="Add line">+ line</button>` : ''}
        </div>`;
      }).join('');
      return `<section class="section-block" data-section-reorder-index="${sectionIndex}">${label}${chordOffer}${lines}</section>`;
    }).join('')}${editable ? `<button type="button" class="add-section-primary" data-action="add-section-end" data-song-id="${this.escape(song.id)}">+ Add section</button>` : ''}${metadata}</div>`;
  }

  renderPlannedStructuredContent(song, options = {}) {
    const editable = Boolean(options.editable);
    const plannedSong = { ...song, layout: { ...(song.layout || {}), columns: Number(options.columns ?? song.layout?.columns) || 1 } };
    const plan = ChartPageLayout.plan(plannedSong, { includeEmptyMetadata: editable });
    const pageHtml = plan.pages.map((page, pageIndex) => {
      const regions = page.regions || (page.spanRows ? [{ kind: 'span', rows: page.spanRows }] : [{ kind: 'columns', columns: page.columns }]);
      const pageHasLaterContent = plan.pages.slice(pageIndex + 1).some(item => item.regions?.length || item.spanRows?.length || item.columns?.some(items => items.some(row => row.lineId)));
      const content = regions.map((region, regionIndex) => {
        if (region.kind === 'span') return `<div class="chart-page-region chart-page-span">${this.renderPlannedColumn(region.rows, song, { ...options, editable, bare: true })}</div>`;
        const later = regions.slice(regionIndex + 1).length > 0 || pageHasLaterContent;
        return this.renderPlannedColumnsRegion(region.columns, song, plan.spec, { ...options, editable, hasFollowingRegion: later });
      }).join('');
      const mixed = Boolean(page.regions);
      const continuationHidden = pageIndex > 0 && song.layout?.continuationHeader === 'none';
      return `<section class="chart-page${song.layout?.layoutMode ? ' layout-mode' : ''}" data-chart-page="${pageIndex + 1}" data-typography="${plan.spec.typography}" style="--page-columns:${page.spanRows ? 1 : plan.spec.columns};--column-template:${page.spanRows ? '1fr' : plan.spec.columnRatios.map(value => `${value}fr`).join(' ')};--chart-font-size:${plan.spec.fontSize};--chart-render-font:${(plan.spec.fontSize / plan.spec.pageWidth * 100).toFixed(4)}cqi;--arrangement-render-font:${(18 / plan.spec.pageWidth * 100).toFixed(4)}cqi;--footer-reserved-height:${(plan.metadataRows * plan.spec.lineHeight / plan.spec.pageWidth * 100).toFixed(4)}cqi;--page-header-height:${(plan.spec.headerHeight / plan.spec.pageWidth * 100).toFixed(4)}cqi;--page-aspect:${plan.spec.pageWidth}/${plan.spec.pageHeight};--page-margin-top:${(plan.spec.margins.top / plan.spec.pageHeight * 100).toFixed(4)}%;--page-margin-right:${(plan.spec.margins.right / plan.spec.pageWidth * 100).toFixed(4)}%;--page-margin-bottom:${(plan.spec.margins.bottom / plan.spec.pageHeight * 100).toFixed(4)}%;--page-margin-left:${(plan.spec.margins.left / plan.spec.pageWidth * 100).toFixed(4)}%;--page-gutter:${(plan.spec.gutter / plan.spec.pageWidth * 100).toFixed(4)}cqi">
        <div class="chart-page-body">
          <header class="chart-page-header${continuationHidden || song.layout?.headerVisibility === 'none' || (song.layout?.headerVisibility === 'first' && pageIndex > 0) ? ' continuation-header-hidden' : ''}">${continuationHidden || song.layout?.headerVisibility === 'none' || (song.layout?.headerVisibility === 'first' && pageIndex > 0) ? '' : `<strong>${this.escape(song.title)}${pageIndex ? ' · continued' : ''}</strong><span>${this.escape(this.plannedKeyText(song))}</span>`}</header>
          <div class="${mixed ? 'chart-page-flow' : 'chart-page-flow chart-page-flow-single'}">${content}</div>
          ${song.layout?.footerVisibility !== 'none' && (song.layout?.footerVisibility === 'all' || pageIndex === plan.pages.length - 1) ? this.renderPlannedFooter(plan.metadata, song, editable, plan) : ''}
        </div>
        ${song.layout?.pageNumbers ? `<div class="chart-page-number" aria-label="Page ${pageIndex + 1} of ${plan.pages.length}">${pageIndex + 1} / ${plan.pages.length}</div>` : ''}
      </section>`;
    }).join('');
    const warnings = plan.warnings?.length ? `<aside class="layout-warnings" aria-label="Layout warnings">${plan.warnings.map(item => `<div>${this.escape(item.message)}</div>`).join('')}</aside>` : '';
    return `<div class="structured-chart paginated-chart${song.layout?.layoutMode ? ' is-layout-mode' : ''}" data-layout-columns="${plan.spec.columns}" style="--chart-columns:${plan.spec.columns}">${warnings}${pageHtml}${editable ? `<button type="button" class="add-section-primary" data-action="add-section-end" data-song-id="${this.escape(song.id)}">+ Add section</button>` : ''}</div>`;
  }

  renderPlannedColumnsRegion(columns, song, spec, options = {}) {
    const content = columns.map((rows, columnIndex) => {
      const lastLine = [...rows].reverse().find(row => row.lineId && row.finalSegment !== false);
      const hasFollowingContent = columns.slice(columnIndex + 1).some(items => items.some(row => row.lineId)) || options.hasFollowingRegion;
      const alreadyManual = lastLine && (song.layout?.breaks || []).some(item => item.sectionId === lastLine.sectionId && item.lineId === lastLine.lineId && item.edge === 'after');
      const autoBoundary = song.layout?.layoutMode && hasFollowingContent && lastLine && !alreadyManual ? {
        type: columnIndex === spec.columns - 1 && !options.hasFollowingRegion ? 'page' : 'column', sectionIndex: lastLine.sectionIndex,
        lineIndex: lastLine.lineIndex, columnNumber: columnIndex + 1
      } : null;
      return this.renderPlannedColumn(rows, song, { ...options, autoBoundary });
    }).join('');
    const dividers = song.layout?.layoutMode && spec.columns > 1
      ? spec.columnRatios.slice(0, -1).map((_, dividerIndex) => {
        const contentWidth = spec.pageWidth - spec.margins.left - spec.margins.right;
        const left = (spec.columnWidths.slice(0, dividerIndex + 1).reduce((sum, value) => sum + value, 0) + spec.gutter * (dividerIndex + .5)) / contentWidth * 100;
        return `<div class="column-divider-handle" style="--divider-left:${left.toFixed(4)}%" data-column-divider="${dividerIndex}" data-song-id="${this.escape(song.id)}" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize columns ${dividerIndex + 1} and ${dividerIndex + 2}"><span>Drag column width</span></div>`;
      }).join('') : '';
    return `<div class="chart-page-region chart-page-columns">${content}${dividers}</div>`;
  }

  renderPlannedFooter(metadata, song, editable, plan) {
    if (!metadata?.length) return '';
    const resize = editable ? `<div class="footer-resize-handle" data-footer-resize data-song-id="${this.escape(song.id)}" data-footer-rows="${plan.metadataRows}" data-min-footer-rows="${plan.naturalMetadataRows}" role="separator" tabindex="0" aria-orientation="horizontal" aria-label="Resize credits and arrangement area. Arrow keys resize; double click resets."><span>Drag footer height</span></div>` : '';
    return `<footer class="chart-page-footer" aria-label="Song credits and arrangement">${resize}${metadata.map(row => {
      const labels = { writer: 'Written by', arranger: 'Arrangement by', arrangement: 'Arrangement', recording: 'Recording', copyright: 'Copyright', ccliSongNumber: 'CCLI Song #', ccliLicenseNumber: 'CCLI License #' };
      return `<div class="planned-footer-row planned-footer-${row.field}"><span>${labels[row.field]}</span><div${editable ? ` contenteditable="plaintext-only" role="textbox" data-inline-field="${row.field}" data-song-id="${this.escape(song.id)}"` : ''}>${this.escape(row.value || '')}</div>${editable && row.field === 'arrangement' && song.arrangement?.mode === 'manual' ? `<button type="button" class="use-song-order" data-action="use-song-order" data-song-id="${this.escape(song.id)}">Use song order</button>` : ''}</div>`;
    }).join('')}</footer>`;
  }

  plannedKeyText(song) {
    let text = `Original Key: ${song.originalKey}`;
    if (Number(song.transposition)) text += ` | Transposed Key: ${song.currentKey} (${song.transposition > 0 ? '+' : ''}${song.transposition})`;
    return text;
  }

  renderPlannedColumn(rows, song, options) {
    const groups = [];
    rows.forEach(row => {
      if (row.metadata) { groups.push({ metadata: true, rows: [row] }); return; }
      const last = groups[groups.length - 1];
      if (last && !last.metadata && last.sectionIndex === row.sectionIndex) last.rows.push(row);
      else groups.push({ sectionIndex: row.sectionIndex, rows: [row] });
    });
    const content = groups.map(group => group.metadata
      ? this.renderPlannedMetadata(group.rows[0], song, options.editable)
      : this.renderPlannedSection(group, song, options)).join('');
    const auto = options.editable && options.autoBoundary ? `<div class="layout-break-target has-layout-break auto-layout-break" data-layout-boundary="true" data-break-id="" data-break-type="${options.autoBoundary.type}" data-song-id="${this.escape(song.id)}" data-section-index="${options.autoBoundary.sectionIndex}" data-line-index="${options.autoBoundary.lineIndex}" tabindex="0" role="separator" aria-label="Drag automatic ${options.autoBoundary.type} termination"><span>${options.autoBoundary.type === 'page' ? 'Page ends here' : `Column ${options.autoBoundary.columnNumber} ends here`}</span></div>` : '';
    return options.bare ? content : `<div class="chart-page-column">${content}${auto}</div>`;
  }

  renderPlannedMetadata(row, song, editable) {
    if (row.type === 'empty') return '<div class="planned-row planned-empty-row"></div>';
    const prefixes = { writer: 'Written by: ', arranger: 'Arrangement by: ', arrangement: 'Arrangement: ', recording: 'Recording: ', copyright: 'Copyright: ', ccliSongNumber: 'CCLI Song #: ', ccliLicenseNumber: 'CCLI License #: ' };
    const prefix = prefixes[row.field] || '';
    const value = row.field === 'writer' ? song.credits?.writer?.value
      : row.field === 'arranger' ? song.credits?.arranger?.value
      : row.field === 'arrangement' ? (song.arrangement?.mode === 'manual' ? song.arrangement?.value : song.arrangement?.inferredValue)
      : song.metadata?.[row.field] ?? row.content;
    return `<div class="planned-row planned-metadata-row${row.field === 'arrangement' ? ' planned-arrangement-row' : ''}"><span>${this.escape(prefix)}</span><span${editable ? ` contenteditable="plaintext-only" role="textbox" data-inline-field="${row.field}" data-song-id="${this.escape(song.id)}"` : ''}>${this.escape(value || '')}</span></div>`;
  }

  renderPlannedSection(group, song, options) {
    const sectionIndex = Number(group.sectionIndex);
    const section = song.sections?.[sectionIndex];
    if (!section) return '';
    const hasHeading = group.rows.some(row => row.type === 'section');
    const headingRow = group.rows.find(row => row.type === 'section');
    const heading = hasHeading ? (headingRow.continuation
      ? `<div class="section-label section-continuation">${this.escape(headingRow.content)}</div>`
      : this.renderPlannedSectionHeading(section, sectionIndex, song, options.editable)) : '';
    const lineRows = group.rows.filter(row => !['section'].includes(row.type));
    const lines = [];
    for (let index = 0; index < lineRows.length; index += 1) {
      const row = lineRows[index];
      if (row.type === 'empty' && row.lineIndex == null) { lines.push('<div class="planned-section-gap" aria-hidden="true"></div>'); continue; }
      if (row.type === 'notation') { lines.push(this.renderNotationLine(row, song, options)); continue; }
      if (row.type === 'chords') {
        const lyric = lineRows[index + 1]?.lineIndex === row.lineIndex ? lineRows[++index] : { ...row, type: 'empty', content: '' };
        lines.push(this.renderPlannedLine(row, lyric, song, options));
      } else if (row.lineIndex != null) lines.push(this.renderPlannedLine(null, row, song, options));
    }
    return `<section class="section-block planned-section-block" data-section-reorder-index="${sectionIndex}">${heading}${lines.join('')}</section>`;
  }

  renderPlannedSectionHeading(section, sectionIndex, song, editable) {
    if (!editable) return section.label ? `<div class="section-label">${this.escape(section.label)}</div>` : '';
    const chordCount = (section.lines || []).reduce((count, line) => count + (line.chords?.length || 0), 0);
    return `<div class="section-heading"><button type="button" class="section-collapse-toggle" data-action="toggle-section-collapse" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" aria-expanded="true" title="Collapse section">▾</button><span class="section-drag-handle" draggable="true" tabindex="0" aria-label="Drag to reorder section">⠿</span><div class="section-label${section.label ? '' : ' inline-edit-empty'}" contenteditable="plaintext-only" role="textbox" data-inline-field="section-label" data-section-index="${sectionIndex}" data-placeholder="Section">${this.escape(section.label || '')}</div><span class="section-collapse-summary">${section.lines?.length || 0} lines · ${chordCount} chords</span></div>`;
  }

  renderNotationLine(row, song, options) {
    const line = song.sections?.[Number(row.sectionIndex)]?.lines?.[Number(row.lineIndex)];
    const notation = typeof ChartNotation !== 'undefined' ? ChartNotation.parse(line?.notation?.source || row.content || '') : line?.notation;
    const display = (notation?.runs || []).map(run => {
      let text = run.text;
      if (run.type === 'chord') text = this.displayStoredChord(line?.chords?.[run.chordIndex] || { symbol: run.text }, song, this.musicTheory());
      return `<span class="notation-run notation-${this.escape(run.type)}">${this.escape(text)}</span>`;
    }).join('<span class="notation-space"> </span>');
    return `<div class="chart-line planned-chart-line notation-chart-line">${options.editable ? this.renderLineControls(song.id, row.sectionIndex, row.lineIndex) : ''}<div class="notation-line"${options.editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit musical notation" spellcheck="false" data-inline-field="notation" data-section-index="${row.sectionIndex}" data-line-index="${row.lineIndex}"` : ''}>${display}</div></div>`;
  }

  renderLineControls(songId, sectionIndex, lineIndex) {
    return `<label class="line-select-control" contenteditable="false" title="Select whole line"><input type="checkbox" class="line-select-checkbox" data-song-id="${this.escape(songId)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" aria-label="Select whole line"></label><div class="chart-line-controls" contenteditable="false"><span class="line-drag-handle" draggable="true" tabindex="0" role="button" aria-label="Drag whole line" title="Drag whole line; Alt-drag to copy" data-song-id="${this.escape(songId)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}">⠿</span><button type="button" class="line-delete-button" data-action="delete-chart-line" data-song-id="${this.escape(songId)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" aria-label="Delete whole line" title="Delete whole line">×</button></div>`;
  }

  renderPlannedLine(chordRow, lyricRow, song, options) {
    const row = lyricRow || chordRow;
    const sectionIndex = Number(row.sectionIndex); const lineIndex = Number(row.lineIndex);
    const sourceStart = Number(row.sourceStart) || 0; const sourceEnd = Number(row.sourceEnd) || sourceStart;
    const original = song.sections?.[sectionIndex]?.lines?.[lineIndex];
    const finalSegment = sourceEnd >= String(original?.lyrics || '').length;
    const chords = (chordRow?.chords || []).map(chord => ({ ...chord,
      chordIndex: (original?.chords || []).findIndex(item => String(item.id) === String(chord.id)),
      displaySymbol: this.displayStoredChord(chord, song, this.musicTheory()) }));
    const breakItem = (song.layout?.breaks || []).find(item => item.sectionId === song.sections?.[sectionIndex]?.id && item.lineId === original?.id && item.edge === 'after');
    const boundary = options.editable && finalSegment && song.layout?.layoutMode ? `<div class="layout-break-target${breakItem ? ' has-layout-break' : ''}" data-layout-boundary="true" data-break-id="${this.escape(breakItem?.id || '')}" data-break-type="${breakItem?.type || 'column'}" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" tabindex="${breakItem ? '0' : '-1'}" role="separator" aria-label="${breakItem ? `Drag ${breakItem.type} termination; double click to reset` : 'Layout drop point'}" title="${breakItem ? `Drag ${breakItem.type} termination` : 'Drop a termination line here'}"><span>${breakItem ? `${breakItem.type === 'page' ? 'Page' : 'Column'} ends here` : ''}</span></div>` : '';
    return `<div class="chart-line planned-chart-line${chordRow ? '' : ' planned-text-only'}" data-source-start="${sourceStart}" data-source-end="${sourceEnd}">
      ${options.editable && finalSegment ? this.renderLineControls(song.id, sectionIndex, lineIndex) : ''}
      ${chordRow ? `<div class="chord-line" aria-label="Chords" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" data-source-start="${sourceStart}">${this.renderChordAnchors(chords, { ...options, sectionIndex, lineIndex, sourceStart, anchorText: row.content || '', typography: song.layout?.typography || 'mono', fontSize: song.layout?.fontSize || 13 })}</div>` : ''}
      <div class="lyric-line${row.content ? '' : ' inline-edit-empty'}"${options.editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit lyrics" data-inline-field="lyrics" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" data-source-start="${sourceStart}" data-source-end="${sourceEnd}" data-placeholder="Type lyrics"` : ''}>${this.escape(row.content || '')}</div>
      ${options.editable && finalSegment ? `<button type="button" class="inline-add-line" data-action="add-chart-line" data-song-id="${this.escape(song.id)}" data-section-index="${sectionIndex}" data-line-index="${lineIndex}" aria-label="Add lyric line after this line" title="Add line">+ line</button>` : ''}
    </div>${boundary}`;
  }

  matchingChordSectionIndex(sections, targetIndex) {
    const target = sections[targetIndex];
    const normalize = value => typeof Arrangement !== 'undefined'
      ? Arrangement.normalizeType(value) : String(value || '').toLowerCase().replace(/[\s_-]*\d+$/, '');
    const targetType = normalize(target?.label || target?.type);
    if (!target || targetType === 'section' || (target.lines || []).some(line => line.chords?.length)) return -1;
    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      const source = sections[index];
      if (normalize(source?.label || source?.type) === targetType && (source.lines || []).some(line => line.chords?.length)) return index;
    }
    return -1;
  }

  renderMetadataField(label, field, value, editable, songId) {
    const text = String(value || '');
    if (!editable && !text) return '';
    return `<div class="chart-metadata-row"><span class="chart-metadata-label">${this.escape(label)}</span><div class="chart-metadata-value${text ? '' : ' inline-edit-empty'}"${editable ? ` contenteditable="plaintext-only" role="textbox" aria-label="Edit ${this.escape(label.toLowerCase())}" spellcheck="true" data-inline-field="${field}" data-placeholder="Add ${this.escape(label.toLowerCase())}" data-song-id="${this.escape(songId)}"` : ''}>${this.escape(text)}</div></div>`;
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
        const measured = options.typography === 'sans' && typeof ChartTextMetrics !== 'undefined'
          ? ChartTextMetrics.positionAtOffset(options.anchorText || '', Number(chord.characterOffset) || 0, Number(options.fontSize) || 13, 'sans') / (Number(options.fontSize) || 13)
          : null;
        output.push(`<span class="inline-chord-anchor" tabindex="0" role="button" aria-label="Select or drag ${symbol}; double click to edit" style="${measured == null ? `--chord-column:${Number(chord.characterOffset) || 0}` : `--chord-x:${measured.toFixed(4)}em`}" data-chord-id="${this.escape(chord.id)}" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" data-character-offset="${Number(chord.characterOffset) || 0}" data-source-start="${Number(options.sourceStart) || 0}" data-timestamp="${timestamp}"><span class="chord-token inline-chord-edit" contenteditable="false" aria-label="Chord ${symbol}" spellcheck="false" data-inline-field="chord" data-section-index="${options.sectionIndex}" data-line-index="${options.lineIndex}" data-chord-index="${chord.chordIndex}" title="Single click to select; drag to move; double click to edit">${symbol}</span><span class="inline-chord-drag-handle" contenteditable="false" aria-hidden="true">⋮</span></span>`);
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
