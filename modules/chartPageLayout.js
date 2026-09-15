/** Shared, deterministic A4 layout plan for editor and structured PDF output. */
class ChartPageLayout {
  static spec(layoutOrColumns = 1, requestedFontSize = 13, marginName = 'standard') {
    const layout = typeof layoutOrColumns === 'object' ? layoutOrColumns || {} : { columns: layoutOrColumns, fontSize: requestedFontSize, margin: marginName };
    const count = Math.max(1, Math.min(3, Math.trunc(Number(layout.columns) || 1)));
    const sizes = { letter: [612, 792], a4: [595.28, 841.89], legal: [612, 1008], tabloid: [792, 1224] };
    let [pageWidth, pageHeight] = layout.pageSize === 'custom'
      ? [Math.max(288, Math.min(1296, Number(layout.customPage?.width) || 612)), Math.max(288, Math.min(1296, Number(layout.customPage?.height) || 792))]
      : sizes[layout.pageSize] || sizes.a4;
    if (layout.orientation === 'landscape' && pageHeight > pageWidth) [pageWidth, pageHeight] = [pageHeight, pageWidth];
    if (layout.orientation !== 'landscape' && pageWidth > pageHeight) [pageWidth, pageHeight] = [pageHeight, pageWidth];
    const marginPresets = { narrow: 24, standard: 36, wide: 54 }; const fallbackMargin = marginPresets[layout.margin] || marginPresets.standard;
    const margins = Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side,
      layout.margins?.[side] == null ? fallbackMargin : Math.max(0, Math.min(144, Number(layout.margins[side]) || 0))]));
    const margin = margins.left; const gutter = Math.max(6, Math.min(72, Number(layout.gutter) || 18));
    // One song-level point size drives wrapping and both renderers.
    const fontSize = Math.max(10, Math.min(18, Math.round(Number(layout.fontSize) || 13)));
    const lineHeight = fontSize * 1.2; const headerHeight = 44;
    const printableWidth = Math.max(144, pageWidth - margins.left - margins.right - gutter * (count - 1));
    const rawRatios = Array.isArray(layout.columnRatios) && layout.columnRatios.length === count
      ? layout.columnRatios.map(value => Math.max(.15, Number(value) || 0)) : Array(count).fill(1 / count);
    const ratioTotal = rawRatios.reduce((sum, value) => sum + value, 0) || 1;
    const columnRatios = rawRatios.map(value => value / ratioTotal);
    const columnWidths = columnRatios.map(value => printableWidth * value);
    const columnOffsets = columnWidths.map((_, index) => margins.left + columnWidths.slice(0, index).reduce((sum, value) => sum + value, 0) + gutter * index);
    const maxCharactersByColumn = columnWidths.map(value => Math.max(18, Math.floor(value / (fontSize * .6))));
    const columnWidth = columnWidths[0];
    return { columns: count, pageWidth, pageHeight, margin, margins, gutter, fontSize, lineHeight, headerHeight,
      printableWidth, columnWidth, columnWidths, columnOffsets, columnRatios, maxCharactersByColumn,
      maxCharacters: Math.min(...maxCharactersByColumn),
      rowsPerColumn: Math.floor((pageHeight - margins.top - margins.bottom - headerHeight) / lineHeight) };
  }

  static wrapLine(line, maxCharacters) {
    const lyrics = String(line?.lyrics || '');
    const chords = (line?.chords || []).map(chord => ({ ...chord, characterOffset: Math.max(0, Number(chord.characterOffset) || 0) }));
    const extent = Math.max(lyrics.length, ...chords.map(chord => chord.characterOffset + String(chord.symbol || '').length), 0);
    if (extent <= maxCharacters) return [{ lyrics, chords, sourceStart: 0, sourceEnd: extent }];
    const segments = []; let start = 0;
    while (start < extent) {
      let end = Math.min(extent, start + maxCharacters);
      if (end < lyrics.length) { const space = lyrics.lastIndexOf(' ', end); if (space > start) end = space; }
      const raw = lyrics.slice(start, end); const leading = raw.match(/^\s*/)?.[0].length || 0;
      segments.push({ lyrics: raw.trim(), sourceStart: start + leading, sourceEnd: end,
        chords: chords.filter(chord => chord.characterOffset >= start && chord.characterOffset < end)
          .map(chord => ({ ...chord, characterOffset: chord.characterOffset - start - leading })) });
      start = end; while (lyrics[start] === ' ') start += 1;
    }
    return segments;
  }

  static sectionRows(section, sectionIndex, spec, spacing = 'normal') {
    const rows = [{ type: 'section', content: String(section?.label || ''), sectionIndex, sectionId: section.id }];
    (section?.lines || []).forEach((line, lineIndex) => {
      const segments = this.wrapLine(line, spec.maxCharacters);
      segments.forEach((segment, segmentIndex) => {
        const segmentState = { firstSegment: segmentIndex === 0, finalSegment: segmentIndex === segments.length - 1 };
        if (segment.chords.length) rows.push({ type: 'chords', ...segment, ...segmentState, sectionIndex, lineIndex, sectionId: section.id, lineId: line.id });
        rows.push({ type: segment.lyrics ? 'text' : 'empty', content: segment.lyrics, ...segment, ...segmentState, sectionIndex, lineIndex, sectionId: section.id, lineId: line.id });
      });
    });
    const gapCount = spacing === 'compact' ? 0 : spacing === 'spacious' ? 2 : 1;
    for (let count = 0; count < gapCount; count += 1) rows.push({ type: 'empty', content: '', sectionIndex, sectionId: section.id, sectionGap: true });
    rows.forEach(row => { row.sectionLabel = String(section?.label || 'Section'); });
    return rows;
  }

  static rowUnits(rows) {
    const units = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const unit = [row];
      if (row.type === 'section') {
        if (rows[index + 1]?.type === 'chords') unit.push(rows[++index]);
        if (rows[index + 1] && rows[index + 1].lineIndex != null) unit.push(rows[++index]);
      } else if (row.type === 'chords' && rows[index + 1]?.lineIndex === row.lineIndex) unit.push(rows[++index]);
      units.push(unit);
    }
    return units;
  }

  static plan(song, options = {}) {
    const layout = song?.layout || {};
    const spec = this.spec(layout);
    const pages = [{ columns: Array.from({ length: spec.columns }, () => []) }];
    let page = 0; let column = 0; let used = 0;
    const advance = () => { column += 1; used = 0; if (column >= spec.columns) { column = 0; page += 1; pages.push({ columns: Array.from({ length: spec.columns }, () => []) }); } };
    const manualBreaks = new Map((layout.breaks || []).map(item => [`${item.sectionId}:${item.lineId || ''}:${item.edge || 'before'}`, item]));
    const breakBefore = unit => unit[0]?.firstSegment === false ? null : manualBreaks.get(`${unit[0]?.sectionId}:${unit[0]?.lineId || ''}:before`);
    const breakAfter = unit => unit[unit.length - 1]?.finalSegment === false ? null : manualBreaks.get(`${unit[unit.length - 1]?.sectionId}:${unit[unit.length - 1]?.lineId || ''}:after`);
    const advanceType = type => { if (type === 'page' && (column || used)) { while (column || used) advance(); } else advance(); };
    const place = (rows, rule = {}) => {
      if (rule.start === 'page' && (page || column || used)) advanceType('page');
      else if (rule.start === 'column' && used) advance();
      if (rule.keepTogether && used && rows.length <= spec.rowsPerColumn && used + rows.length > spec.rowsPerColumn) advance();
      for (const unit of this.rowUnits(rows)) {
        if (!used && unit.every(row => row.sectionGap)) continue;
        const before = breakBefore(unit); if (before && used) advanceType(before.type);
        if (used && used + unit.length > spec.rowsPerColumn) {
          const previous = pages[page].columns[column][used - 1];
          advance();
          if (unit[0]?.type !== 'section' && previous?.sectionIndex === unit[0]?.sectionIndex) {
            pages[page].columns[column].push({ type: 'section', content: `${unit[0].sectionLabel} (continued)`, sectionIndex: unit[0].sectionIndex, sectionLabel: unit[0].sectionLabel, continuation: true });
            used += 1;
          }
        }
        pages[page].columns[column].push(...unit); used += unit.length;
        const after = breakAfter(unit); if (after) {
          pages[page].terminations ||= []; pages[page].terminations.push({ column, breakId: after.id, type: after.type }); advanceType(after.type);
        }
      }
    };
    (song?.sections || []).forEach((section, index) => {
      const rule = layout.sectionRules?.[section.id] || {};
      const spacing = rule.spacing === 'inherit' || !rule.spacing ? (layout.sectionSpacing || 'normal') : rule.spacing;
      const rows = this.sectionRows(section, index, spec, spacing);
      if (rule.spanColumns && spec.columns > 1) {
        if (pages[page].columns.some(items => items.length)) { while (column || used) advance(); }
        pages[page].spanRows = rows; pages[page].spanSectionId = section.id;
        page += 1; column = 0; used = 0; pages.push({ columns: Array.from({ length: spec.columns }, () => []) });
      } else place(rows, rule);
    });
    while (pages.length > 1 && !pages[pages.length - 1].spanRows && pages[pages.length - 1].columns.every(rows => !rows.length)) pages.pop();
    const metadata = [];
    const writer = String(song?.credits?.writer?.value || '').trim(); const arranger = String(song?.credits?.arranger?.value || '').trim();
    const arrangement = String(song?.arrangement?.mode === 'manual' ? song?.arrangement?.value || '' : song?.arrangement?.inferredValue || '').trim();
    if (writer || options.includeEmptyMetadata) metadata.push({ field: 'writer', value: writer });
    if (arranger || options.includeEmptyMetadata) metadata.push({ field: 'arranger', value: arranger });
    if (arrangement) metadata.push({ field: 'arrangement', value: arrangement });
    const metadataRows = metadata.reduce((total, row) => total + (row.field === 'arrangement' ? 4 : 1), 0);
    const balanceFinalPage = reservedRows => {
      const finalPage = pages[pages.length - 1];
      const finalRows = finalPage.columns.flat();
      const usableRows = spec.rowsPerColumn - reservedRows;
      if (spec.columns <= 1 || !finalRows.length || finalRows.length > usableRows * spec.columns) return;
      const units = this.rowUnits(finalRows); const target = Math.ceil(finalRows.length / spec.columns);
      const balanced = Array.from({ length: spec.columns }, () => []); let columnIndex = 0;
      units.forEach(unit => {
        if (columnIndex < spec.columns - 1 && balanced[columnIndex].length && balanced[columnIndex].length + unit.length > target) {
          const previous = balanced[columnIndex][balanced[columnIndex].length - 1]; columnIndex += 1;
          if (unit[0]?.type !== 'section' && previous?.sectionIndex === unit[0]?.sectionIndex) balanced[columnIndex].push({ type: 'section', content: `${unit[0].sectionLabel} (continued)`, sectionIndex: unit[0].sectionIndex, sectionLabel: unit[0].sectionLabel, continuation: true });
        }
        balanced[columnIndex].push(...unit);
      });
      finalPage.columns = balanced;
    };
    const canBalanceFinalPage = () => layout.balance !== 'off' && !pages[pages.length - 1].terminations?.length && !pages[pages.length - 1].spanRows;
    if (canBalanceFinalPage()) balanceFinalPage(metadataRows);
    const lastPage = pages[pages.length - 1];
    const maxUsed = Math.max(...lastPage.columns.map(rows => rows.length), 0);
    if (metadata.length && maxUsed + metadataRows > spec.rowsPerColumn) {
      const next = { columns: Array.from({ length: spec.columns }, () => []) };
      const source = [...lastPage.columns].reverse().find(rows => rows.length) || [];
      const sectionIndex = source[source.length - 1]?.sectionIndex;
      const moved = [];
      while (source.length && source[source.length - 1]?.sectionIndex === sectionIndex) moved.unshift(source.pop());
      next.columns[0].push(...moved);
      pages.push(next);
    }
    if (canBalanceFinalPage()) balanceFinalPage(metadataRows);
    const warnings = [];
    pages.forEach((item, pageIndex) => item.columns.forEach((rows, columnIndex) => {
      if (rows.length > spec.rowsPerColumn) warnings.push({ type: 'overflow', page: pageIndex + 1, column: columnIndex + 1, message: `Page ${pageIndex + 1}, column ${columnIndex + 1} overflows by ${rows.length - spec.rowsPerColumn} rows` });
      const termination = item.terminations?.find(value => value.column === columnIndex);
      if (termination && rows.length && rows.length < Math.floor(spec.rowsPerColumn * .35)) warnings.push({ type: 'sparse', page: pageIndex + 1, column: columnIndex + 1, breakId: termination.breakId, message: `Manual ${termination.type} break leaves page ${pageIndex + 1}, column ${columnIndex + 1} sparse` });
    }));
    return { spec, pages, metadata, metadataRows, warnings };
  }
}

if (typeof window !== 'undefined') window.ChartPageLayout = ChartPageLayout;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartPageLayout;
