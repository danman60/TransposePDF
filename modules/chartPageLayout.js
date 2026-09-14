/** Shared, deterministic A4 layout plan for editor and structured PDF output. */
class ChartPageLayout {
  static spec(columns = 1) {
    const count = Math.max(1, Math.min(3, Math.trunc(Number(columns) || 1)));
    const pageWidth = 595.28; const pageHeight = 841.89; const margin = 50; const gutter = 18;
    const fontSize = 11; const lineHeight = 15; const headerHeight = 47;
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
    return rows;
  }

  static plan(song) {
    const spec = this.spec(song?.layout?.columns);
    const pages = [{ columns: Array.from({ length: spec.columns }, () => []) }];
    let page = 0; let column = 0; let used = 0;
    const advance = () => { column += 1; used = 0; if (column >= spec.columns) { column = 0; page += 1; pages.push({ columns: Array.from({ length: spec.columns }, () => []) }); } };
    const place = rows => {
      if (rows.length <= spec.rowsPerColumn && used && used + rows.length > spec.rowsPerColumn) advance();
      for (const row of rows) { if (used >= spec.rowsPerColumn) advance(); pages[page].columns[column].push(row); used += 1; }
    };
    (song?.sections || []).forEach((section, index) => place(this.sectionRows(section, index, spec)));
    const credits = [];
    const writer = String(song?.credits?.writer?.value || '').trim(); const arranger = String(song?.credits?.arranger?.value || '').trim();
    const arrangement = String(song?.arrangement?.mode === 'manual' ? song?.arrangement?.value || '' : song?.arrangement?.inferredValue || '').trim();
    if (writer) credits.push({ type: 'text', content: `Written by: ${writer}`, metadata: true });
    if (arranger) credits.push({ type: 'text', content: `Arrangement by: ${arranger}`, metadata: true });
    if (arrangement) credits.push({ type: 'text', content: `Arrangement: ${arrangement}`, metadata: true });
    if (credits.length) {
      const creditRows = [{ type: 'empty', content: '', metadata: true }, ...credits];
      const candidates = pages.flatMap((candidatePage, pageIndex) => candidatePage.columns.map((rows, index) =>
        ({ pageIndex, index, remaining: spec.rowsPerColumn - rows.length })))
        .filter(candidate => candidate.remaining >= creditRows.length)
        .sort((a, b) => b.pageIndex - a.pageIndex || b.remaining - a.remaining);
      if (candidates.length) pages[candidates[0].pageIndex].columns[candidates[0].index].push(...creditRows);
      else {
        place(creditRows);
        const lastPage = pages[pages.length - 1];
        if (pages.length > 1 && lastPage.columns.flat().every(row => row.metadata)) {
          const previous = pages[pages.length - 2];
          const source = [...previous.columns].reverse().find(rows => rows.some(row => !row.metadata));
          const destination = lastPage.columns.find(rows => rows.length) || lastPage.columns[0];
          if (source?.length) destination.unshift(...source.splice(Math.max(0, source.length - creditRows.length)));
        }
      }
    }
    return { spec, pages };
  }
}

if (typeof window !== 'undefined') window.ChartPageLayout = ChartPageLayout;
if (typeof module !== 'undefined' && module.exports) module.exports = ChartPageLayout;
