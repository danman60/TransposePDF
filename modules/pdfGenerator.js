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
      
      const pdf = new jsPDFClass({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      // Add title page
      this.addTitlePage(pdf, filename, songs);

      // Add each song
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        logger.status(`Processing song ${i + 1}/${songs.length}: ${song.title}`, 'info');
        
        pdf.addPage();
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

  /**
   * Process song content and transpose chords
   */
  processSongContent(song) {
    const musicTheory = new MusicTheory();
    const lines = song.songText.split('\n');
    const processedLines = [];
    
    lines.forEach(line => {
      if (this.lineContainsChords(line)) {
        // Transpose chords in this line
        const transposedLine = this.transposeChordsInLine(line, song.transposition, musicTheory);
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
  transposeChordsInLine(line, semitones, musicTheory) {
    if (semitones === 0) return line;
    
    let result = line;
    const chords = musicTheory.extractChords(line);
    
    // Sort chords by position (reverse order to avoid index shifting)
    chords.sort((a, b) => b.position - a.position);
    
    chords.forEach(chord => {
      const transposedChord = musicTheory.transposeChord(chord.original, semitones);
      result = result.substring(0, chord.position) + 
               transposedChord + 
               result.substring(chord.position + chord.original.length);
    });
    
    return result;
  }

  /**
   * Render a line in the PDF
   */
  async renderLine(pdf, line, x, y) {
    switch (line.type) {
      case 'chords':
        pdf.setFontSize(this.chordFontSize);
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 0, 200); // Blue for chords
        pdf.text(line.content, x, y);
        pdf.setTextColor(0, 0, 0); // Reset to black
        break;
        
      case 'text':
        pdf.setFontSize(this.fontSize);
        pdf.setFont(undefined, 'normal');
        pdf.text(line.content, x, y);
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