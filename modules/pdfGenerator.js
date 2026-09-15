/**
 * PDF Generator Module  
 * Handles creation of new PDF files with transposed chords
 */

class PDFGenerator {
  constructor() {
    this.pageWidth = 595.28; // A4 width in points
    this.pageHeight = 841.89; // A4 height in points
    this.margin = 50;
    this.lineHeight = 16;
    this.fontSize = 12;
    this.titleFontSize = 16;
    this.chordFontSize = 10;
  }

  /**
   * Generate PDF from songs with transposed chords
   */
  async generatePDF(songsInput, filename = 'Transposed Songbook') {
    try {
      logger.status('Generating PDF...', 'info');
      logger.startTimer('pdfExport');

      // Ensure we have songs data
      const songs = songsInput || [];
      if (!songs || songs.length === 0) {
        throw new Error('No songs to export');
      }

      // Initialize jsPDF - handle different loading methods
      const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
      if (!jsPDFClass) {
        throw new Error('jsPDF library not available');
      }
      
      const firstSpec = typeof ChartPageLayout !== 'undefined' ? ChartPageLayout.spec(songs[0]?.layout || {}) : { pageWidth: 595.28, pageHeight: 841.89 };
      this.pageWidth = firstSpec.pageWidth; this.pageHeight = firstSpec.pageHeight;
      const pdf = new jsPDFClass({
        orientation: firstSpec.pageWidth > firstSpec.pageHeight ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [firstSpec.pageWidth, firstSpec.pageHeight]
      });

      const hasTitlePage = songs.length > 1;
      if (hasTitlePage) this.addTitlePage(pdf, filename, songs);

      // Add each song
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        logger.status(`Processing song ${i + 1}/${songs.length}: ${song.title}`, 'info');
        
        if (hasTitlePage || i > 0) {
          const spec = typeof ChartPageLayout !== 'undefined' ? ChartPageLayout.spec(song.layout || {}) : firstSpec;
          pdf.addPage([spec.pageWidth, spec.pageHeight], spec.pageWidth > spec.pageHeight ? 'landscape' : 'portrait');
        }
        await this.addSongToPDF(pdf, song);
      }

      logger.endTimer('pdfExport');
      logger.status('PDF generated successfully', 'success');

      return pdf;

    } catch (error) {
      logger.error('Failed to generate PDF', { error: error.message });
      throw error;
    }
  }

  /**
   * Add title page to PDF
   */
  addTitlePage(pdf, title, songs) {
    const centerX = this.pageWidth / 2;
    
    // Main title
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text(title, centerX, 200, { align: 'center' });
    
    // Subtitle
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'normal');
    const subtitle = `${songs.length} Songs - Chord Transposer Pro`;
    pdf.text(subtitle, centerX, 230, { align: 'center' });
    
    // Generation date
    pdf.setFontSize(12);
    const date = new Date().toLocaleDateString();
    pdf.text(`Generated on ${date}`, centerX, 260, { align: 'center' });
    
    // Songs list
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text('Songs in this collection:', this.margin, 320);
    
    let yPos = 350;
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    
    songs.forEach((song, index) => {
      if (yPos > this.pageHeight - this.margin) {
        pdf.addPage();
        yPos = this.margin + 50;
      }
      
      const keyInfo = song.transposition !== 0 ? 
        ` (${song.originalKey} → ${song.currentKey})` : 
        ` (${song.originalKey})`;
      
      pdf.text(`${index + 1}. ${song.title}${keyInfo}`, this.margin, yPos);
      yPos += this.lineHeight;
    });
  }

  /**
   * Add individual song to PDF
   */
  async addSongToPDF(pdf, song) {
    const usesStructuredEditor = Array.isArray(song.sections) && song.sections.length > 0 && song.source?.preserveLayout !== true;
    if (usesStructuredEditor && Array.isArray(song.sections) && song.sections.length > 0) {
      await this.addStructuredSongToPDF(pdf, song);
      return;
    }
    let yPos = this.margin;
    
    // Song title
    pdf.setFontSize(this.titleFontSize);
    pdf.setFont(undefined, 'bold');
    pdf.text(song.title, this.margin, yPos);
    yPos += this.titleFontSize + 10;
    
    // Key information
    pdf.setFontSize(this.fontSize);
    pdf.setFont(undefined, 'normal');
    let keyText = `Original Key: ${song.originalKey}`;
    if (song.transposition !== 0) {
      keyText += ` | Transposed Key: ${song.currentKey} (${song.transposition > 0 ? '+' : ''}${song.transposition})`;
    }
    pdf.text(keyText, this.margin, yPos);
    yPos += this.lineHeight + 5;
    
    // Process song content with transposed chords
    const processedContent = this.processSongContent(song);
    
    // Render content
    for (const line of processedContent) {
      if (yPos > this.pageHeight - this.margin - this.lineHeight) {
        pdf.addPage();
        yPos = this.margin;
      }
      
      await this.renderLine(pdf, line, this.margin, yPos);
      yPos += this.lineHeight;
    }
  }

  getSongHeader(song, continuation = false) {
    let keyText = `Original Key: ${song.originalKey}`;
    if (song.transposition !== 0) {
      keyText += ` | Transposed Key: ${song.currentKey} (${song.transposition > 0 ? '+' : ''}${song.transposition})`;
    }
    return { title: `${song.title}${continuation ? ' (continued)' : ''}`, keyText };
  }

  renderSongHeader(pdf, song, continuation = false) {
    const header = this.getSongHeader(song, continuation);
    let y = this.margin;
    pdf.setFontSize(this.titleFontSize);
    pdf.setFont(undefined, 'bold');
    pdf.text(header.title, this.margin, y);
    y += this.titleFontSize + 10;
    pdf.setFontSize(this.fontSize);
    pdf.setFont(undefined, 'normal');
    pdf.text(header.keyText, this.margin, y);
    return y + this.lineHeight + 5;
  }

  getCreditsRows(song) {
    const rows = [];
    const writer = String(song.credits?.writer?.value || '').trim();
    const arranger = String(song.credits?.arranger?.value || '').trim();
    const arrangement = String(song.arrangement?.mode === 'manual'
      ? song.arrangement?.value || ''
      : song.arrangement?.inferredValue || '').trim();
    if (writer) rows.push(`Written by: ${writer}`);
    if (arranger) rows.push(`Arrangement by: ${arranger}`);
    if (arrangement) rows.push(`Arrangement: ${arrangement}`);
    return rows;
  }

  buildStructuredBlocks(song, maxCharacters, layoutSnapshot = null) {
    return song.sections.map((section, sectionIndex) => {
      const rows = [];
      if (section.label) rows.push({ type: 'section', content: section.label, structured: true });
      (section.lines || []).forEach((line, lineIndex) => {
        this.wrapStructuredLine(line, maxCharacters).forEach(segment => {
          const fontRatio = Number(layoutSnapshot?.lineFontRatios?.[`${sectionIndex}:${lineIndex}`]) || null;
          if (segment.chords.length) rows.push({
            type: 'chords',
            content: this.buildChordRow(segment.chords, song.transposition, new MusicTheory(), song),
            structured: true,
            fontRatio
          });
          rows.push({ type: segment.lyrics ? 'text' : 'empty', content: segment.lyrics || '', structured: true, fontRatio });
        });
      });
      return rows;
    });
  }

  /** Render the exact shared A4 page plan used by the editor. */
  async addStructuredSongToPDF(pdf, song) {
    if (typeof ChartPageLayout === 'undefined') throw new Error('Shared chart page layout is unavailable');
    const plan = ChartPageLayout.plan(song);
    this.pageWidth = plan.spec.pageWidth; this.pageHeight = plan.spec.pageHeight; this.margin = plan.spec.margins.left;
    this.fontSize = plan.spec.fontSize;
    this.typography = plan.spec.typography;
    this.lineHeight = plan.spec.lineHeight;
    const renderRows = async (rows, x, y) => {
      for (const plannedRow of rows) {
        const row = { ...plannedRow, structured: true };
        if (row.type === 'chords') {
          row.content = this.buildChordRow(row.chords || [], song.transposition, new MusicTheory(), song);
          row.chords = (row.chords || []).map(chord => ({ ...chord, displaySymbol: this.displayChord(chord.symbol, song, new MusicTheory(), chord) }));
        }
        await this.renderLine(pdf, row, x, y); y += plan.spec.lineHeight;
      }
    };
    for (let pageIndex = 0; pageIndex < plan.pages.length; pageIndex += 1) {
      if (pageIndex > 0) pdf.addPage([plan.spec.pageWidth, plan.spec.pageHeight], plan.spec.pageWidth > plan.spec.pageHeight ? 'landscape' : 'portrait');
      const top = this.renderPlannedSongHeader(pdf, song, plan.spec, pageIndex > 0);
      const page = plan.pages[pageIndex];
      const regions = page.regions || (page.spanRows ? [{ kind: 'span', rows: page.spanRows }] : [{ kind: 'columns', columns: page.columns }]);
      let rowOffset = 0;
      for (const region of regions) {
        const y = top + rowOffset * plan.spec.lineHeight;
        if (region.kind === 'span') await renderRows(region.rows, plan.spec.margins.left, y);
        else for (let columnIndex = 0; columnIndex < plan.spec.columns; columnIndex += 1) {
          await renderRows(region.columns[columnIndex], plan.spec.columnOffsets[columnIndex], y);
        }
        rowOffset += region.heightRows ?? (region.kind === 'span' ? region.rows.length : Math.max(...region.columns.map(rows => rows.length), 0));
      }
      if (song.layout?.pageNumbers) {
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(70, 70, 70);
        pdf.text(`${pageIndex + 1} / ${plan.pages.length}`, plan.spec.pageWidth - plan.spec.margins.right, plan.spec.pageHeight - Math.max(10, plan.spec.margins.bottom / 2), { align: 'right' });
      }
      if (pageIndex === plan.pages.length - 1 && plan.metadata.length) {
        let footerY = plan.spec.pageHeight - plan.spec.margins.bottom - (plan.metadataRows - 1) * plan.spec.lineHeight;
        for (const item of plan.metadata) {
          const labels = { writer: 'Written by: ', arranger: 'Arrangement by: ', arrangement: 'Arrangement: ' };
          pdf.setFontSize(item.field === 'arrangement' ? 18 : plan.spec.fontSize);
          pdf.setFont(this.typography === 'sans' ? 'helvetica' : 'courier', item.field === 'arrangement' ? 'bold' : 'normal');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${labels[item.field] || ''}${item.value}`, plan.spec.margins.left, footerY);
          footerY += (item.field === 'arrangement' ? 4 : 1) * plan.spec.lineHeight;
        }
        this.fontSize = plan.spec.fontSize;
      }
    }
    return { pagesUsed: plan.pages.length, columns: plan.spec.columns, plan };
  }

  renderPlannedSongHeader(pdf, song, spec, continuation = false) {
    if (continuation && song.layout?.continuationHeader === 'none') return spec.margins.top + spec.headerHeight;
    const header = this.getSongHeader(song, continuation);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold'); pdf.setFontSize(20); pdf.text(header.title, spec.margins.left, spec.margins.top);
    pdf.setFont(undefined, 'normal'); pdf.setFontSize(12); pdf.text(header.keyText, spec.margins.left, spec.margins.top + 22);
    return spec.margins.top + spec.headerHeight;
  }

  /**
   * Process song content and transpose chords
   */
  processSongContent(song) {
    const usesStructuredEditor = Array.isArray(song.sections) && song.sections.length > 0 && song.source?.preserveLayout !== true;
    if (usesStructuredEditor && Array.isArray(song.sections) && song.sections.length > 0) {
      return this.processStructuredSongContent(song);
    }

    const musicTheory = new MusicTheory();
    const lines = song.songText.split('\n');
    const processedLines = [];
    
    lines.forEach(line => {
      if (this.lineContainsChords(line)) {
        // Transpose chords in this line
        const transposedLine = this.transposeChordsInLine(line, song.transposition, musicTheory, song);
        processedLines.push({
          type: 'chords',
          content: transposedLine,
          originalLine: line
        });
      } else if (line.trim().length > 0) {
        // Regular text line
        processedLines.push({
          type: 'text',
          content: line.trim(),
          originalLine: line
        });
      } else {
        // Empty line
        processedLines.push({
          type: 'empty',
          content: '',
          originalLine: line
        });
      }
    });
    
    return processedLines;
  }

  /**
   * Convert canonical section/line/chord-anchor data into printable rows.
   */
  processStructuredSongContent(song) {
    const musicTheory = new MusicTheory();
    const processedLines = [];

    song.sections.forEach((section, sectionIndex) => {
      if (section.label) {
        processedLines.push({ type: 'section', content: section.label, originalLine: section.label });
      }

      (section.lines || []).forEach(line => {
        this.wrapStructuredLine(line).forEach(segment => {
          if (segment.chords.length) {
            processedLines.push({
              type: 'chords',
              content: this.buildChordRow(segment.chords, song.transposition, musicTheory, song),
              originalLine: SongModel.buildChordRow(segment),
              structured: true
            });
          }

          processedLines.push({
            type: segment.lyrics ? 'text' : 'empty',
            content: segment.lyrics || '',
            originalLine: segment.lyrics || '',
            structured: true
          });
        });
      });

      if (sectionIndex < song.sections.length - 1) {
        processedLines.push({ type: 'empty', content: '', originalLine: '' });
      }
    });

    return processedLines;
  }

  wrapStructuredLine(line, maxCharacters = 68) {
    const lyrics = line.lyrics || '';
    const chords = (line.chords || []).map(chord => ({
      ...chord,
      characterOffset: this.resolveSemanticOffset(chord, lyrics)
    }));
    const chordExtent = chords.reduce((extent, chord) => {
      return Math.max(extent, (Number(chord.characterOffset) || 0) + String(chord.symbol || '').length);
    }, 0);
    const totalExtent = Math.max(lyrics.length, chordExtent);
    if (totalExtent <= maxCharacters) return [{ lyrics, chords }];

    const segments = [];
    let start = 0;
    while (start < totalExtent) {
      let end = Math.min(start + maxCharacters, totalExtent);
      if (end < lyrics.length) {
        const breakAt = lyrics.lastIndexOf(' ', end);
        if (breakAt > start) end = breakAt;
      }
      const rawLyrics = lyrics.slice(start, end);
      const leadingSpaces = rawLyrics.match(/^\s*/)?.[0].length || 0;
      segments.push({
        lyrics: rawLyrics.trim(),
        chords: chords
          .filter(chord => chord.characterOffset >= start && chord.characterOffset < end)
          .map(chord => ({
            ...chord,
            characterOffset: Math.max(0, chord.characterOffset - start - leadingSpaces)
          }))
      });
      start = end;
    }
    return segments;
  }

  resolveSemanticOffset(chord, lyrics) {
    const fallback = Math.max(0, Number(chord.characterOffset) || 0);
    const anchor = chord.anchor;
    if (!anchor?.version || !anchor.token || typeof LyricAnchor === 'undefined') return fallback;
    const words = LyricAnchor.words(lyrics);
    const matches = words.filter(word => word.normalized === anchor.token);
    const word = matches[Math.max(0, Number(anchor.tokenOccurrence) || 0)];
    if (!word) return fallback;
    return Math.min(word.end, word.start + Math.max(0, Number(anchor.graphemeOffset) || 0));
  }

  buildChordRow(chords, semitones, musicTheory, song = null) {
    const characters = [];
    [...chords]
      .sort((a, b) => a.characterOffset - b.characterOffset)
      .forEach(chord => {
        const offset = Math.max(0, Number(chord.characterOffset) || 0);
        while (characters.length < offset) characters.push(' ');
        const symbol = song
          ? this.displayChord(chord.symbol, song, musicTheory, chord)
          : musicTheory.transposeChord(chord.symbol, semitones);
        for (let index = 0; index < symbol.length; index += 1) {
          characters[offset + index] = symbol[index];
        }
      });
    return characters.map(character => character || ' ').join('').trimEnd();
  }

  /**
   * Check if line contains chords
   */
  lineContainsChords(line) {
    const musicTheory = new MusicTheory();
    const chords = musicTheory.extractChords(line);
    return chords.length > 0;
  }

  /**
   * Transpose chords in a text line
   */
  transposeChordsInLine(line, semitones, musicTheory, song = null) {
    const policy = song?.spellingPolicy || 'contextual';
    let result = line;
    const chords = musicTheory.extractChords(line);
    
    // Sort chords by position (reverse order to avoid index shifting)
    chords.sort((a, b) => b.position - a.position);
    
    chords.forEach(chord => {
      const transposedChord = song
        ? this.displayChord(chord.original, song, musicTheory)
        : musicTheory.transposeChord(chord.original, semitones);
      result = result.substring(0, chord.position) + 
               transposedChord + 
               result.substring(chord.position + chord.original.length);
    });
    
    return result;
  }

  displayChord(symbol, song, musicTheory = new MusicTheory(), chord = null) {
    const view = { ...(song.sessionView || {}), spellingPolicy: song.spellingPolicy };
    if (view.capo && (!view.spellingPolicy || view.spellingPolicy === 'contextual')) {
      const shapeKey = musicTheory.transposeKey(song.currentKey || song.originalKey, -Number(view.capo), 'contextual');
      view.spellingPolicy = shapeKey.includes('b') ? 'flats' : 'sharps';
    }
    return chord?.manualEntry?.provenance === 'manual'
      ? musicTheory.displayManualChord(symbol, chord.manualEntry, song, view)
      : musicTheory.displayChord(symbol, song, view);
  }

  /**
   * Render a line in the PDF
   */
  async renderLine(pdf, line, x, y) {
    switch (line.type) {
      case 'chords':
        pdf.setFontSize(line.structured ? this.fontSize : this.chordFontSize);
        pdf.setFont(line.structured ? (this.typography === 'sans' ? 'helvetica' : 'courier') : undefined, 'bold');
        pdf.setTextColor(0, 0, 200); // Blue for chords
        if (line.structured && this.typography === 'sans' && Array.isArray(line.chords)) {
          const Metrics = typeof ChartTextMetrics !== 'undefined' ? ChartTextMetrics : null;
          if (!Metrics) throw new Error('Chart text metrics are unavailable');
          line.chords.forEach(chord => pdf.text(String(chord.displaySymbol || chord.symbol || ''),
            x + Metrics.positionAtOffset(line.lyrics || '', Number(chord.characterOffset) || 0, this.fontSize, 'sans'), y));
        } else pdf.text(line.content, x, y);
        pdf.setTextColor(0, 0, 0); // Reset to black
        break;
        
      case 'text':
        pdf.setFontSize(this.fontSize);
        pdf.setFont(line.structured ? (this.typography === 'sans' ? 'helvetica' : 'courier') : undefined, 'normal');
        pdf.text(line.content, x, y);
        break;

      case 'section':
        pdf.setFontSize(this.fontSize);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text(line.content, x, y);
        pdf.setTextColor(0, 0, 0);
        break;
        
      case 'empty':
        // Just space, no rendering needed
        break;
    }
  }

  /**
   * Save PDF to file
   */
  savePDF(pdf, filename) {
    try {
      const safeFilename = this.sanitizeFilename(filename);
      pdf.save(`${safeFilename}.pdf`);
      logger.status(`PDF saved as "${safeFilename}.pdf"`, 'success');
      return true;
    } catch (error) {
      logger.error('Failed to save PDF', { error: error.message });
      throw error;
    }
  }

  /**
   * Sanitize filename for file system
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
      .replace(/\s+/g, ' ')         // Normalize spaces
      .trim()                       // Remove leading/trailing spaces
      .substring(0, 100)            // Limit length
      || 'Untitled';                // Fallback
  }

  /**
   * Get PDF as blob for further processing
   */
  getPDFBlob(pdf) {
    try {
      return pdf.output('blob');
    } catch (error) {
      logger.error('Failed to generate PDF blob', { error: error.message });
      throw error;
    }
  }

  /**
   * Get PDF as data URL
   */
  getPDFDataURL(pdf) {
    try {
      return pdf.output('datauristring');
    } catch (error) {
      logger.error('Failed to generate PDF data URL', { error: error.message });
      throw error;
    }
  }

  /**
   * Preview PDF in new window
   */
  previewPDF(pdf) {
    try {
      const blob = this.getPDFBlob(pdf);
      const url = URL.createObjectURL(blob);
      const preview = window.open(url, '_blank');
      
      // Clean up URL after a delay
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      
      return preview;
    } catch (error) {
      logger.error('Failed to preview PDF', { error: error.message });
      throw error;
    }
  }

  /**
   * Calculate optimal font sizes based on content
   */
  calculateFontSizes(songs) {
    let maxChordLength = 0;
    let maxLineLength = 0;
    
    songs.forEach(song => {
      const lines = song.songText.split('\n');
      lines.forEach(line => {
        maxLineLength = Math.max(maxLineLength, line.length);
        
        if (this.lineContainsChords(line)) {
          const musicTheory = new MusicTheory();
          const chords = musicTheory.extractChords(line);
          chords.forEach(chord => {
            maxChordLength = Math.max(maxChordLength, chord.original.length);
          });
        }
      });
    });
    
    // Adjust font sizes based on content complexity
    const baseFontSize = this.fontSize;
    const adjustmentFactor = Math.min(1.0, 80 / maxLineLength);
    
    return {
      fontSize: Math.max(8, baseFontSize * adjustmentFactor),
      chordFontSize: Math.max(7, this.chordFontSize * adjustmentFactor),
      titleFontSize: Math.max(12, this.titleFontSize * adjustmentFactor)
    };
  }

  /**
   * Validate PDF generation capability
   */
  validatePDFGeneration() {
    try {
      const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
      
      if (!jsPDFClass) {
        throw new Error('jsPDF library not available');
      }
      
      // Test basic PDF creation
      const testPdf = new jsPDFClass();
      testPdf.text('Test', 10, 10);
      
      // Test blob generation
      const blob = testPdf.output('blob');
      
      if (!blob || blob.size === 0) {
        throw new Error('PDF generation test failed');
      }
      
      return {
        available: true,
        version: jsPDFClass.version || 'unknown',
        testSize: blob.size
      };
      
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Estimate PDF file size
   */
  estimatePDFSize(songs) {
    let totalChars = 0;
    
    songs.forEach(song => {
      totalChars += song.songText.length;
      totalChars += song.title.length;
    });
    
    // Rough estimation: 1 byte per character + PDF overhead
    const estimatedSize = Math.ceil((totalChars * 1.5 + 50000) / 1024); // KB
    
    return {
      estimatedSizeKB: estimatedSize,
      estimatedSizeMB: Math.ceil(estimatedSize / 1024),
      songCount: songs.length,
      totalCharacters: totalChars
    };
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PDFGenerator = PDFGenerator;
}
