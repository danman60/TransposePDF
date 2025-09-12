/**
 * PDF Processing Module
 * Handles PDF loading, text extraction with coordinates, and text analysis
 */

class PDFProcessor {
  constructor() {
    this.currentPDF = null;
    this.textItems = [];
  }

  /**
   * Load PDF file and extract text with coordinates
   */
  async loadPDF(file) {
    try {
      logger.status('Loading PDF file...', 'info');
      logger.startTimer('pdfLoad');

      // Validate file
      if (!file || file.type !== 'application/pdf') {
        throw new Error('Please select a valid PDF file');
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        throw new Error('File size must be under 50MB');
      }

      // Read file as array buffer
      const arrayBuffer = await this.fileToArrayBuffer(file);
      
      // Load PDF with PDF.js
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      }).promise;

      this.currentPDF = pdf;
      
      // Extract text from all pages
      const textItems = await this.extractTextWithCoordinates(pdf);
      
      if (textItems.length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      this.textItems = textItems;
      
      logger.endTimer('pdfLoad');
      logger.status(`PDF loaded successfully (${pdf.numPages} pages, ${textItems.length} text items)`, 'success');
      
      return {
        pdf,
        textItems,
        numPages: pdf.numPages,
        filename: file.name
      };

    } catch (error) {
      logger.error('Failed to load PDF', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract text with coordinates from all PDF pages
   */
  async extractTextWithCoordinates(pdf) {
    const allTextItems = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        logger.status(`Processing page ${pageNum}/${pdf.numPages}...`, 'info');
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.0 });
        const textContent = await page.getTextContent();
        
        // Process each text item
        textContent.items.forEach((item, index) => {
          const textItem = {
            id: `page${pageNum}_item${index}`,
            pageNum,
            text: item.str.trim(),
            x: item.transform[4],
            y: viewport.height - item.transform[5], // Flip Y coordinate
            width: item.width,
            height: item.height,
            fontName: item.fontName,
            fontSize: item.height,
            bold: item.fontName?.toLowerCase().includes('bold') || false,
            italic: item.fontName?.toLowerCase().includes('italic') || false
          };
          
          // Only include non-empty text items
          if (textItem.text.length > 0) {
            allTextItems.push(textItem);
          }
        });
        
      } catch (error) {
        logger.error(`Failed to process page ${pageNum}`, { error: error.message });
        // Continue processing other pages
      }
    }
    
    // Sort by page, then by Y position (top to bottom), then by X position
    allTextItems.sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y; // 5px tolerance for same line
      return a.x - b.x;
    });
    
    return allTextItems;
  }

  /**
   * Convert file to ArrayBuffer
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Get PDF metadata
   */
  async getPDFMetadata() {
    if (!this.currentPDF) return null;
    
    try {
      const metadata = await this.currentPDF.getMetadata();
      return {
        title: metadata.info.Title || 'Unknown',
        author: metadata.info.Author || 'Unknown',
        subject: metadata.info.Subject || '',
        creator: metadata.info.Creator || '',
        producer: metadata.info.Producer || '',
        creationDate: metadata.info.CreationDate || null,
        modificationDate: metadata.info.ModDate || null,
        numPages: this.currentPDF.numPages
      };
    } catch (error) {
      logger.error('Failed to get PDF metadata', { error: error.message });
      return null;
    }
  }

  /**
   * Find text items by content pattern
   */
  findTextItems(pattern, options = {}) {
    const {
      caseSensitive = false,
      wholeWord = false,
      pageNum = null
    } = options;
    
    let items = this.textItems;
    
    // Filter by page if specified
    if (pageNum !== null) {
      items = items.filter(item => item.pageNum === pageNum);
    }
    
    // Create search pattern
    let searchPattern;
    if (typeof pattern === 'string') {
      const flags = caseSensitive ? 'g' : 'gi';
      const patternStr = wholeWord ? `\\b${pattern}\\b` : pattern;
      searchPattern = new RegExp(patternStr, flags);
    } else {
      searchPattern = pattern; // Assume it's already a RegExp
    }
    
    return items.filter(item => searchPattern.test(item.text));
  }

  /**
   * Get text items in a bounding box
   */
  getTextItemsInBox(pageNum, x, y, width, height) {
    return this.textItems.filter(item => {
      if (item.pageNum !== pageNum) return false;
      
      return item.x >= x && 
             item.x <= x + width &&
             item.y >= y && 
             item.y <= y + height;
    });
  }

  /**
   * Group text items by lines (same Y coordinate within tolerance)
   */
  groupTextItemsByLines(textItems, tolerance = 5) {
    const lines = [];
    const processed = new Set();
    
    textItems.forEach(item => {
      if (processed.has(item.id)) return;
      
      const line = [item];
      processed.add(item.id);
      
      // Find other items on the same line
      textItems.forEach(otherItem => {
        if (processed.has(otherItem.id)) return;
        if (item.pageNum !== otherItem.pageNum) return;
        
        if (Math.abs(item.y - otherItem.y) <= tolerance) {
          line.push(otherItem);
          processed.add(otherItem.id);
        }
      });
      
      // Sort line items by X position
      line.sort((a, b) => a.x - b.x);
      lines.push(line);
    });
    
    return lines;
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.currentPDF = null;
    this.textItems = [];
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PDFProcessor = PDFProcessor;
}