/** Shared, deterministic A4 layout plan for editor and structured PDF output. */
class ChartPageLayout {
  static spec(columns = 1) {
    const count = Math.max(1, Math.min(3, Math.trunc(Number(columns) || 1)));
    const pageWidth = 595.28; const pageHeight = 841.89; const margin = 36; const gutter = 18;
    // Keep 16pt chart type while using a compact professional lead-sheet rhythm.
    // 1.2 line-height prevents a nearly full sheet from spilling a few rows onto
    // an otherwise blank credits page.
    const fontSize = 16; const lineHeight = 19.2; const headerHeight = 44;
    const columnWidth = (pageWidth - margin * 2 - gutter * (count - 1)) / count;
    return { columns: count, pageWidth, pageHeight, margin, gutter, fontSize, lineHeight, headerHeight,
      columnWidth, maxCharacters: Math.max(18, Math.floor(columnWidth / (fontSize * .6))),
      rowsPerColumn: Math.floor((pageHeight - margin * 2 - headerHeight) / lineHeight) };
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

  static sectionRows(section, sectionIndex, spec) {
    const rows = [{ type: 'section', content: String(section?.label || ''), sectionIndex }];
    (section?.lines || []).forEach((line, lineIndex) => {
      this.wrapLine(line, spec.maxCharacters).forEach(segment => {
        if (segment.chords.length) rows.push({ type: 'chords', ...segment, sectionIndex, lineIndex });
        rows.push({ type: segment.lyrics ? 'text' : 'empty', content: segment.lyrics, ...segment, sectionIndex, lineIndex });
      });
    });
    rows.push({ type: 'empty', content: '', sectionIndex });
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
    const spec = this.spec(song?.layout?.columns);
    const pages = [{ columns: Array.from({ length: spec.columns }, () => []) }];
    let page = 0; let column = 0; let used = 0;
    const advance = () => { column += 1; used = 0; if (column >= spec.columns) { column = 0; page += 1; pages.push({ columns: Array.from({ length: spec.columns }, () => []) }); } };
    const place = rows => {
      for (const unit of this.rowUnits(rows)) {
        if (used && used + unit.length > spec.rowsPerColumn) {
          const previous = pages[page].columns[column][used - 1];
          advance();
          if (unit[0]?.type !== 'section' && previous?.sectionIndex === unit[0]?.sectionIndex) {
            pages[page].columns[column].push({ type: 'section', content: `${unit[0].sectionLabel} (continued)`, sectionIndex: unit[0].sectionIndex, sectionLabel: unit[0].sectionLabel, continuation: true });
            used += 1;
          }
        }
        pages[page].columns[column].push(...unit); used += unit.length;
      }
    };
    (song?.sections || []).forEach((section, index) => place(this.sectionRows(section, index, spec)));
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
    balanceFinalPage(metadataRows);
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
    balanceFinalPage(metadataRows);
    return { spec, pages, metadata, metadataRows };
  }
}

if (typeof window !== 'undefined') window.ChartPageLayout = ChartPageLayout;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartPageLayout;
