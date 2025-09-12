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
   * Display songs in UI
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
    
    // Create song cards
    this.currentSongs.forEach(song => {
      const songCard = this.createSongCard(song);
      this.elements.songsContainer.appendChild(songCard);
    });
    
    // Show sections
    this.elements.uploadSection.style.display = 'none';
    this.elements.songsSection.style.display = 'block';
    this.elements.exportButton.disabled = false;
  }

  /**
   * Create song card HTML
   */
  createSongCard(song) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.setAttribute('data-song-id', song.id);
    
    card.innerHTML = `
      <div class="song-title">
        <span>${this.escapeHtml(song.title)}</span>
        <div class="key-indicator" id="keyIndicator-${song.id}">${song.currentKey}</div>
      </div>
      
      <div class="song-meta">
        <span>Original Key: ${song.originalKey}</span>
        <span>Confidence: ${Math.round(song.keyConfidence * 100)}%</span>
        <span>Chords: ${song.chords.length}</span>
      </div>
      
      <div class="transpose-controls">
        <button class="transpose-button" onclick="transposeApp.transposeSong(${song.id}, -1)">-</button>
        <div class="transpose-value" id="transposeValue-${song.id}">0</div>
        <button class="transpose-button" onclick="transposeApp.transposeSong(${song.id}, 1)">+</button>
      </div>
      
      <div class="chord-preview" id="chordPreview-${song.id}">
        ${this.escapeHtml(song.chordsPreview)}
      </div>
    `;
    
    return card;
  }

  /**
   * Transpose individual song
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
      
      // Update UI
      this.updateSongCard(song);
      
      // Log the change
      logger.status(`${song.title}: ${song.originalKey} → ${song.currentKey} (${song.transposition > 0 ? '+' : ''}${song.transposition})`, 'info');
      
    } catch (error) {
      this.showError(`Failed to transpose "${song.title}": ${error.message}`);
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