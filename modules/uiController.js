/**
 * UI Controller Module
 * Manages user interface state, interactions, and updates
 */

class UIController {
  constructor() {
    this.currentSongs = [];
    this.isProcessing = false;
    this.currentFile = null;
    this.exportFilename = 'Transposed Songbook';
    
    // Initialize UI elements
    this.initializeElements();
    this.attachEventListeners();
    this.initializeDragAndDrop();
  }

  /**
   * Initialize UI element references
   */
  initializeElements() {
    this.elements = {
      // File upload
      uploadArea: document.getElementById('uploadArea'),
      fileInput: document.getElementById('fileInput'),
      uploadProgress: document.getElementById('uploadProgress'),
      progressFill: document.getElementById('progressFill'),
      progressText: document.getElementById('progressText'),
      
      // Sections
      uploadSection: document.getElementById('uploadSection'),
      songsSection: document.getElementById('songsSection'),
      exportSection: document.getElementById('exportSection'),
      
      // Songs
      songCount: document.getElementById('songCount'),
      songsContainer: document.getElementById('songsContainer'),
      
      // Export
      exportButton: document.getElementById('exportButton'),
      exportFilename: document.getElementById('exportFilename'),
      exportFinalButton: document.getElementById('exportFinalButton'),
      exportProgress: document.getElementById('exportProgress'),
      exportProgressFill: document.getElementById('exportProgressFill'),
      exportProgressText: document.getElementById('exportProgressText'),
      
      // Status and errors
      statusIndicator: document.getElementById('statusIndicator'),
      errorPanel: document.getElementById('errorPanel'),
      errorMessage: document.getElementById('errorMessage'),
      errorRetry: document.getElementById('errorRetry'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingText: document.getElementById('loadingText'),
      
      // Health check (development)
      healthCheck: document.getElementById('healthCheck'),
      healthResults: document.getElementById('healthResults')
    };
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // File input
    this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    
    // Upload area click
    this.elements.uploadArea.addEventListener('click', () => {
      this.elements.fileInput.click();
    });
    
    // Export buttons
    this.elements.exportButton.addEventListener('click', this.showExportSection.bind(this));
    this.elements.exportFinalButton.addEventListener('click', this.handleExport.bind(this));
    
    // Filename input
    this.elements.exportFilename.addEventListener('input', (e) => {
      this.exportFilename = e.target.value || 'Transposed Songbook';
    });
  }

  /**
   * Initialize drag and drop functionality
   */
  initializeDragAndDrop() {
    const uploadArea = this.elements.uploadArea;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, this.preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('drag-over');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('drag-over');
      }, false);
    });
    
    uploadArea.addEventListener('drop', this.handleDrop.bind(this), false);
  }

  /**
   * Prevent default drag behaviors
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle file drop
   */
  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Handle file selection
   */
  handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      this.processFile(files[0]);
    }
  }

  /**
   * Process uploaded file
   */
  async processFile(file) {
    if (this.isProcessing) return;
    
    try {
      this.isProcessing = true;
      this.showLoading('Processing PDF file...');
      this.showUploadProgress(0);
      
      // Validate file
      if (!file || file.type !== 'application/pdf') {
        throw new Error('Please select a valid PDF file');
      }
      
      this.currentFile = file;
      this.updateStatus('Loading PDF...', 'info');
      
      // Process PDF
      const pdfProcessor = new PDFProcessor();
      const pdfData = await pdfProcessor.loadPDF(file);
      
      this.showUploadProgress(30);
      this.updateStatus('Separating songs...', 'info');
      
      // Separate songs
      const songSeparator = new SongSeparator();
      const songs = songSeparator.separateSongs(pdfData.textItems);
      
      this.showUploadProgress(70);
      this.updateStatus('Analyzing chords...', 'info');
      
      // Process each song
      this.currentSongs = songs.map(song => ({
        ...song,
        transposition: 0,
        currentKey: song.originalKey
      }));
      
      this.showUploadProgress(100);
      this.updateStatus(`Successfully loaded ${songs.length} songs`, 'success');
      
      // Show results
      this.hideLoading();
      this.hideUploadProgress();
      this.displaySongs();
      
    } catch (error) {
      this.hideLoading();
      this.hideUploadProgress();
      this.showError(error.message);
      this.updateStatus('Error processing file', 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Display songs as full lead sheets with transpose controls
   */
  displaySongs() {
    if (!this.currentSongs || this.currentSongs.length === 0) {
      this.elements.songsSection.style.display = 'none';
      return;
    }
    
    // Update song count
    this.elements.songCount.textContent = this.currentSongs.length;
    
    // Clear container
    this.elements.songsContainer.innerHTML = '';
    
    // Create full lead sheet view for each song
    this.currentSongs.forEach((song, index) => {
      const songSheet = this.createLeadSheetView(song, index);
      this.elements.songsContainer.appendChild(songSheet);
    });
    
    // Show sections
    this.elements.uploadSection.style.display = 'none';
    this.elements.songsSection.style.display = 'block';
    this.elements.exportButton.disabled = false;
  }

  /**
   * Create full lead sheet view with transpose controls
   */
  createLeadSheetView(song, index) {
    const sheet = document.createElement('div');
    sheet.className = 'lead-sheet';
    sheet.setAttribute('data-song-id', song.id);
    
    // Create transpose controls bar
    const controlsBar = `
      <div class="song-controls">
        <div class="song-header">
          <h2 class="song-title">${this.escapeHtml(song.title)}</h2>
          <div class="song-info">
            <span class="key-indicator" id="keyIndicator-${song.id}">${song.currentKey}</span>
            <span class="original-key">Original: ${song.originalKey}</span>
          </div>
        </div>
        
        <div class="transpose-controls">
          <button class="transpose-button" onclick="window.transposeApp.transposeSong(${song.id}, -1)" title="Transpose down">-</button>
          <div class="transpose-display">
            <div class="transpose-value" id="transposeValue-${song.id}">0</div>
            <div class="transpose-label">semitones</div>
          </div>
          <button class="transpose-button" onclick="window.transposeApp.transposeSong(${song.id}, 1)" title="Transpose up">+</button>
          <button class="reset-button" onclick="window.transposeApp.resetSong(${song.id})" title="Reset to original key">↺</button>
        </div>
      </div>
    `;
    
    // Create the lead sheet content area
    const leadSheetContent = this.renderLeadSheetContent(song);
    
    sheet.innerHTML = `
      ${controlsBar}
      <div class="lead-sheet-content" id="leadSheet-${song.id}">
        ${leadSheetContent}
      </div>
    `;
    
    return sheet;
  }
  
  /**
   * Render the actual lead sheet content exactly like the PDF layout
   */
  renderLeadSheetContent(song) {
    const musicTheory = new MusicTheory();
    let html = '<div class="pdf-layout-container">';
    
    // Group text items by page and position to preserve PDF layout
    const pageGroups = this.groupTextItemsByPage(song.textItems);
    
    Object.keys(pageGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach(pageNum => {
      html += `<div class="pdf-page" data-page="${pageNum}" style="position: relative; min-height: 600px;">`;
      
      // Process items with absolute positioning to match PDF exactly
      const pageItems = pageGroups[pageNum];
      
      // Use absolute positioning for each text item to match PDF exactly
      pageItems.forEach(item => {
        const isChordLine = this.containsChords(item.text);
        const className = this.getPDFItemClass(item, isChordLine);
        
        // Transpose chords if this item contains them
        let displayText = item.text;
        if (isChordLine && song.transposition !== 0) {
          displayText = this.transposeTextItem(item.text, song.transposition, musicTheory);
        }
        
        // Calculate position with scaling factor to fit display
        const scaleFactor = 0.6; // Reduced scale to better fit screen
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
                   ${this.escapeHtml(displayText)}
                 </div>`;
      });
      
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }
  
  /**
   * Group text items by page number
   */
  groupTextItemsByPage(textItems) {
    const pageGroups = {};
    textItems.forEach(item => {
      if (!pageGroups[item.pageNum]) {
        pageGroups[item.pageNum] = [];
      }
      pageGroups[item.pageNum].push(item);
    });
    return pageGroups;
  }
  
  /**
   * Group items by lines based on Y position
   */
  groupItemsByLines(pageItems, tolerance = 10) {
    const lines = [];
    const processed = new Set();
    
    pageItems.forEach(item => {
      if (processed.has(item.id)) return;
      
      const line = [item];
      processed.add(item.id);
      
      // Find other items on the same line
      pageItems.forEach(otherItem => {
        if (processed.has(otherItem.id)) return;
        
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
   * Get CSS class for PDF text item
   */
  getPDFItemClass(item, isChordLine) {
    let className = 'pdf-text-item';
    
    if (isChordLine) {
      className += ' chord-text';
    } else if (this.isSectionHeader(item.text)) {
      className += ' section-header-text';
    } else if (item.bold || (item.fontSize || 12) > 14) {
      className += ' title-text';
    } else {
      className += ' lyric-text';
    }
    
    return className;
  }
  
  /**
   * Check if text is a section header
   */
  isSectionHeader(text) {
    const sectionPatterns = [
      /^VERSE\s*\d*/i, /^CHORUS\s*\d*/i, /^BRIDGE\s*/i, 
      /^PRE-CHORUS/i, /^INTRO/i, /^OUTRO/i, /^INSTRUMENTAL/i
    ];
    return sectionPatterns.some(pattern => pattern.test(text.trim()));
  }
  
  /**
   * Transpose chords within a text item
   */
  transposeTextItem(text, transposition, musicTheory) {
    if (transposition === 0) return text;
    
    const chords = musicTheory.extractChords(text);
    if (chords.length === 0) return text;
    
    let result = text;
    
    // Process chords in reverse order to avoid position shifting
    chords.sort((a, b) => b.position - a.position);
    
    chords.forEach(chord => {
      const transposedChord = musicTheory.transposeChord(chord.original, transposition);
      result = result.substring(0, chord.position) + 
               transposedChord + 
               result.substring(chord.position + chord.original.length);
    });
    
    return result;
  }
  
  /**
   * Check if text contains musical chords
   */
  containsChords(text) {
    if (!text) return false;
    
    const musicTheory = new MusicTheory();
    const chords = musicTheory.extractChords(text);
    return chords.length > 0;
  }
  
  /**
   * Render chords within a line with proper spacing
   */
  renderChordsInLine(line, chords, transposition, musicTheory) {
    if (chords.length === 0) {
      return this.escapeHtml(line);
    }
    
    let html = '';
    let lastPos = 0;
    
    // Sort chords by position
    chords.sort((a, b) => a.position - b.position);
    
    chords.forEach(chord => {
      // Add text before chord
      if (chord.position > lastPos) {
        html += this.escapeHtml(line.substring(lastPos, chord.position));
      }
      
      // Add transposed chord
      const transposedChord = transposition === 0 ? 
        chord.original : 
        musicTheory.transposeChord(chord.original, transposition);
      
      html += `<span class="chord" data-original="${chord.original}" data-transposed="${transposedChord}">${transposedChord}</span>`;
      
      lastPos = chord.position + chord.original.length;
    });
    
    // Add remaining text
    if (lastPos < line.length) {
      html += this.escapeHtml(line.substring(lastPos));
    }
    
    return html;
  }
  
  /**
   * Determine the type of text line for styling
   */
  getLineType(line) {
    const upperLine = line.toUpperCase();
    
    if (upperLine.includes('VERSE') || upperLine.includes('CHORUS') || 
        upperLine.includes('BRIDGE') || upperLine.includes('INTRO') ||
        upperLine.includes('OUTRO') || upperLine.includes('PRE-CHORUS')) {
      return 'section-header';
    }
    
    if (/^[A-Z\s]+$/.test(line) && line.length > 3) {
      return 'section-title';  
    }
    
    return 'lyric-line';
  }

  /**
   * Transpose individual song with real-time lead sheet updates
   */
  transposeSong(songId, semitones) {
    const song = this.currentSongs.find(s => s.id === songId);
    if (!song) return;
    
    try {
      // Update transposition
      song.transposition += semitones;
      
      // Calculate new key
      const musicTheory = new MusicTheory();
      song.currentKey = musicTheory.transposeChord(song.originalKey, song.transposition);
      
      // Update the lead sheet display in real-time
      this.updateLeadSheetDisplay(song);
      
      // Update transpose display
      this.updateTransposeDisplay(song);
      
      // Log the change
      logger.status(`${song.title}: ${song.originalKey} → ${song.currentKey} (${song.transposition > 0 ? '+' : ''}${song.transposition})`, 'info');
      
    } catch (error) {
      this.showError(`Failed to transpose "${song.title}": ${error.message}`);
    }
  }

  /**
   * Reset individual song to original key
   */
  resetSong(songId) {
    const song = this.currentSongs.find(s => s.id === songId);
    if (!song) return;
    
    try {
      // Reset to original state
      song.transposition = 0;
      song.currentKey = song.originalKey;
      
      // Update the lead sheet display
      this.updateLeadSheetDisplay(song);
      
      // Update transpose display
      this.updateTransposeDisplay(song);
      
      // Log the reset
      logger.status(`${song.title}: Reset to original key (${song.originalKey})`, 'info');
      
    } catch (error) {
      this.showError(`Failed to reset "${song.title}": ${error.message}`);
    }
  }
  
  /**
   * Update transpose display values
   */
  updateTransposeDisplay(song) {
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      transposeValue.textContent = song.transposition > 0 ? `+${song.transposition}` : song.transposition.toString();
    }
  }

  /**
   * Update lead sheet display with new transposition in real-time
   */
  updateLeadSheetDisplay(song) {
    // Update key indicator
    const keyIndicator = document.getElementById(`keyIndicator-${song.id}`);
    if (keyIndicator) {
      keyIndicator.textContent = song.currentKey;
      keyIndicator.style.backgroundColor = song.transposition !== 0 ? '#ff9800' : '#1976d2';
    }
    
    // Update transpose value display
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      const displayValue = song.transposition === 0 ? '0' : 
                          (song.transposition > 0 ? `+${song.transposition}` : `${song.transposition}`);
      transposeValue.textContent = displayValue;
      transposeValue.style.color = song.transposition !== 0 ? '#ff9800' : '#666';
    }
    
    // Re-render the entire lead sheet content with new chords
    const leadSheetContent = document.getElementById(`leadSheet-${song.id}`);
    if (leadSheetContent) {
      leadSheetContent.innerHTML = this.renderLeadSheetContent(song);
      
      // Add transition effect for smooth chord changes
      leadSheetContent.style.opacity = '0.7';
      setTimeout(() => {
        leadSheetContent.style.opacity = '1';
      }, 150);
    }
  }

  /**
   * Update song card display
   */
  updateSongCard(song) {
    // Update key indicator
    const keyIndicator = document.getElementById(`keyIndicator-${song.id}`);
    if (keyIndicator) {
      keyIndicator.textContent = song.currentKey;
      keyIndicator.style.backgroundColor = song.transposition !== 0 ? '#ff9800' : '#1976d2';
    }
    
    // Update transpose value
    const transposeValue = document.getElementById(`transposeValue-${song.id}`);
    if (transposeValue) {
      const displayValue = song.transposition === 0 ? '0' : 
                          (song.transposition > 0 ? `+${song.transposition}` : `${song.transposition}`);
      transposeValue.textContent = displayValue;
      transposeValue.style.color = song.transposition !== 0 ? '#ff9800' : '#757575';
    }
    
    // Update chord preview
    const chordPreview = document.getElementById(`chordPreview-${song.id}`);
    if (chordPreview && song.transposition !== 0) {
      const musicTheory = new MusicTheory();
      const transposedChords = song.chords.slice(0, 10).map(chord => 
        musicTheory.transposeChord(chord.original, song.transposition)
      );
      chordPreview.textContent = transposedChords.join(' ');
    } else if (chordPreview) {
      chordPreview.textContent = song.chordsPreview;
    }
  }

  /**
   * Show export section
   */
  showExportSection() {
    this.elements.exportSection.style.display = 'block';
    this.elements.exportSection.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Handle PDF export
   */
  async handleExport() {
    if (this.isProcessing || !this.currentSongs || this.currentSongs.length === 0) return;
    
    try {
      this.isProcessing = true;
      this.showExportProgress(0);
      this.updateStatus('Generating PDF...', 'info');
      
      // Generate PDF
      const pdfGenerator = new PDFGenerator();
      this.showExportProgress(30);
      
      const pdf = await pdfGenerator.generatePDF(this.currentSongs, this.exportFilename);
      this.showExportProgress(80);
      
      // Save PDF
      pdfGenerator.savePDF(pdf, this.exportFilename);
      this.showExportProgress(100);
      
      this.updateStatus('PDF exported successfully', 'success');
      
      // Hide progress after delay
      setTimeout(() => {
        this.hideExportProgress();
      }, 2000);
      
    } catch (error) {
      this.hideExportProgress();
      this.showError(`Export failed: ${error.message}`);
      this.updateStatus('Export failed', 'error');
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Show/hide loading overlay
   */
  showLoading(message = 'Processing...') {
    this.elements.loadingText.textContent = message;
    this.elements.loadingOverlay.style.display = 'flex';
  }

  hideLoading() {
    this.elements.loadingOverlay.style.display = 'none';
  }

  /**
   * Show/hide upload progress
   */
  showUploadProgress(percentage) {
    this.elements.uploadProgress.style.display = 'block';
    this.elements.progressFill.style.width = `${percentage}%`;
    this.elements.progressText.textContent = `Processing... ${percentage}%`;
  }

  hideUploadProgress() {
    this.elements.uploadProgress.style.display = 'none';
  }

  /**
   * Show/hide export progress
   */
  showExportProgress(percentage) {
    this.elements.exportProgress.style.display = 'block';
    this.elements.exportProgressFill.style.width = `${percentage}%`;
    this.elements.exportProgressText.textContent = `Generating PDF... ${percentage}%`;
  }

  hideExportProgress() {
    this.elements.exportProgress.style.display = 'none';
  }

  /**
   * Update status indicator
   */
  updateStatus(message, type = 'info') {
    this.elements.statusIndicator.textContent = message;
    this.elements.statusIndicator.className = `status-indicator ${type}`;
  }

  /**
   * Show error dialog
   */
  showError(message, allowRetry = false) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorRetry.style.display = allowRetry ? 'inline-block' : 'none';
    this.elements.errorPanel.style.display = 'flex';
  }

  /**
   * Hide error dialog
   */
  hideError() {
    this.elements.errorPanel.style.display = 'none';
  }

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Reset application state
   */
  reset() {
    this.currentSongs = [];
    this.currentFile = null;
    this.isProcessing = false;
    
    // Reset UI
    this.elements.uploadSection.style.display = 'flex';
    this.elements.songsSection.style.display = 'none';
    this.elements.exportSection.style.display = 'none';
    this.elements.fileInput.value = '';
    this.elements.songsContainer.innerHTML = '';
    
    this.hideLoading();
    this.hideUploadProgress();
    this.hideExportProgress();
    this.hideError();
    
    this.updateStatus('Ready', 'info');
  }

  /**
   * Show health check (development mode)
   */
  async showHealthCheck() {
    try {
      const results = await healthCheck();
      let html = '';
      
      results.forEach(result => {
        const statusClass = result.status === 'PASS' ? 'pass' : 
                           result.status === 'FAIL' ? 'fail' : 'error';
        html += `
          <div class="health-item">
            <span>${result.name}</span>
            <span class="health-status ${statusClass}">${result.status}</span>
          </div>
        `;
      });
      
      this.elements.healthResults.innerHTML = html;
      this.elements.healthCheck.style.display = 'block';
      
      // Hide after 10 seconds
      setTimeout(() => {
        this.elements.healthCheck.style.display = 'none';
      }, 10000);
      
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + O: Open file
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      this.elements.fileInput.click();
    }
    
    // Ctrl/Cmd + E: Export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      if (!this.elements.exportButton.disabled) {
        this.handleExport();
      }
    }
    
    // Escape: Close error dialog
    if (e.key === 'Escape') {
      this.hideError();
    }
  }

  /**
   * Initialize keyboard shortcuts
   */
  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  /**
   * Get current application state
   */
  getState() {
    return {
      songCount: this.currentSongs.length,
      isProcessing: this.isProcessing,
      currentFile: this.currentFile?.name || null,
      exportFilename: this.exportFilename,
      songs: this.currentSongs.map(song => ({
        id: song.id,
        title: song.title,
        originalKey: song.originalKey,
        currentKey: song.currentKey,
        transposition: song.transposition,
        chordCount: song.chords.length
      }))
    };
  }
}

// Global functions for onclick handlers
window.transposeApp = null;

window.closeError = function() {
  if (window.transposeApp) {
    window.transposeApp.hideError();
  }
};

window.retryOperation = function() {
  if (window.transposeApp && window.transposeApp.currentFile) {
    window.transposeApp.hideError();
    window.transposeApp.processFile(window.transposeApp.currentFile);
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.UIController = UIController;
}