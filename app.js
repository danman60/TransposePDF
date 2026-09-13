/**
 * Main Application Entry Point
 * Initializes and coordinates all modules
 */

// Health check system
const healthCheck = async () => {
  const checks = [
    { name: 'PDF.js loaded', test: () => typeof pdfjsLib !== 'undefined' },
    { name: 'Tonal.js loaded', test: () => typeof Tonal !== 'undefined' },
    { name: 'jsPDF loaded', test: () => typeof jsPDF !== 'undefined' || (typeof window.jspdf !== 'undefined' && typeof window.jspdf.jsPDF !== 'undefined') },
    { name: 'Service Worker active', test: () => 'serviceWorker' in navigator },
    { name: 'Local storage available', test: () => typeof Storage !== 'undefined' },
    { name: 'File API supported', test: () => 'FileReader' in window },
    { name: 'PDF Processing', test: () => typeof PDFProcessor !== 'undefined' },
    { name: 'Music Theory', test: () => typeof MusicTheory !== 'undefined' },
    { name: 'Song Separator', test: () => typeof SongSeparator !== 'undefined' },
    { name: 'PDF Generator', test: () => typeof PDFGenerator !== 'undefined' },
    { name: 'UI Controller', test: () => typeof UIController !== 'undefined' }
  ];
  
  const results = [];
  for (const check of checks) {
    try {
      const passed = await check.test();
      results.push({ name: check.name, status: passed ? 'PASS' : 'FAIL' });
    } catch (error) {
      results.push({ name: check.name, status: 'ERROR', error: error.message });
    }
  }
  
  return results;
};

// Main Application Class
class TransposeApp {
  constructor(observability = logger) {
    this.logger = observability;
    this.uiController = null;
    this.serviceWorkerController = null;
    this.initialized = false;
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      this.logger.status('Initializing Transpose App...', 'info');
      this.logger.startTimer('appInit');
      
      // Run health checks
      await this.runHealthChecks();
      
      // Initialize UI Controller
      this.uiController = new UIController(this.logger);
      window.transposeApp = this.uiController;
      this.teamSyncController = new TeamSyncController({
        library: this.uiController.libraryStore,
        elements: {
          open: document.getElementById('teamSyncButton'), drawer: document.getElementById('teamSyncDrawer'), close: document.getElementById('closeTeamSyncButton'),
          status: document.getElementById('teamSyncStatus'), localPanel: document.getElementById('syncLocalPanel'), authPanel: document.getElementById('syncAuthPanel'), teamPanel: document.getElementById('syncTeamPanel'),
          url: document.getElementById('syncProjectUrl'), key: document.getElementById('syncPublishableKey'), save: document.getElementById('saveSyncConfigButton'), disconnect: document.getElementById('disconnectSyncButton'),
          email: document.getElementById('syncEmail'), emailSignIn: document.getElementById('syncEmailSignIn'), googleSignIn: document.getElementById('syncGoogleSignIn'), signOut: document.getElementById('syncSignOut'),
          user: document.getElementById('syncUser'), team: document.getElementById('syncTeamSelect'), syncNow: document.getElementById('syncNowButton'), outbox: document.getElementById('syncOutboxCount'), conflictCount: document.getElementById('syncConflictCountLabel'), conflicts: document.getElementById('syncConflictList'),
          share: document.getElementById('shareTeamButton'), shareOutput: document.getElementById('shareTeamOutput')
        }
      }).attach();
      this.serviceWorkerController = new ServiceWorkerController({
        banner: document.getElementById('updateBanner'),
        message: document.getElementById('updateMessage'),
        reloadButton: document.getElementById('reloadUpdateButton'),
        laterButton: document.getElementById('laterUpdateButton'),
        offlineBadge: document.getElementById('offlineBadge'),
        isDraftDirty: () => this.isEditorDraftDirty()
      });
      this.serviceWorkerController.start().then(registration => {
        if (registration) this.logger.status('Service worker registered', 'success', { scope: registration.scope });
      }).catch(error => this.logger.error('Service worker registration failed', { code: 'SW_REGISTER', error: error.message }));
      
      // Initialize keyboard shortcuts
      this.uiController.initializeKeyboardShortcuts();
      
      // Run initial validation tests
      await this.runValidationTests();
      
      this.logger.endTimer('appInit');
      this.logger.status('Transpose App initialized successfully', 'success');
      this.initialized = true;
      
      // Show health check in development mode
      if (this.isDevelopmentMode()) {
        this.uiController.showHealthCheck();
      }
      
    } catch (error) {
      this.logger.error('Failed to initialize app', { error: error.message });
      this.showInitError(error.message);
    }
  }

  isEditorDraftDirty() {
    const ui = this.uiController;
    if (!ui || ui.elements.authorSection?.style.display === 'none') return false;
    const title = ui.elements.authorTitle.value;
    const key = ui.elements.authorKey.value;
    const content = ui.elements.authorContent.value;
    if (!ui.editingSongId) return Boolean(title.trim() || content.trim());
    return content !== ui.authorLastSerializedText
      || title !== (ui.authorDraft?.title || '')
      || key !== (ui.authorDraft?.originalKey || 'C');
  }

  /**
   * Run comprehensive health checks
   */
  async runHealthChecks() {
    this.logger.status('Running health checks...', 'info');
    
    const results = await healthCheck();
    const failed = results.filter(r => r.status !== 'PASS');
    
    if (failed.length > 0) {
      const failedNames = failed.map(f => f.name).join(', ');
      this.logger.status(`Health check warnings: ${failedNames}`, 'warning');
    } else {
      this.logger.status('All health checks passed', 'success');
    }
    
    return results;
  }

  /**
   * Run validation tests
   */
  async runValidationTests() {
    this.logger.status('Running validation tests...', 'info');
    
    try {
      // Test music theory system
      const musicTheory = new MusicTheory();
      const musicTests = musicTheory.validateChordSystem();
      
      this.logger.status(`Music theory validation: ${musicTests.accuracy.toFixed(1)}% accuracy`, 
        musicTests.passed ? 'success' : 'warning');
      
      // Test PDF generation capability
      const pdfGenerator = new PDFGenerator();
      const pdfTests = pdfGenerator.validatePDFGeneration();
      
      this.logger.status(`PDF generation: ${pdfTests.available ? 'Available' : 'Unavailable'}`, 
        pdfTests.available ? 'success' : 'error');
      
      return {
        musicTheory: musicTests,
        pdfGeneration: pdfTests
      };
      
    } catch (error) {
      this.logger.error('Validation tests failed', { error: error.message });
      return null;
    }
  }

  /**
   * Check if running in development mode
   */
  isDevelopmentMode() {
    return new URLSearchParams(window.location.search).get('debug') === 'true';
  }

  /**
   * Show initialization error
   */
  showInitError(message) {
    const panel = document.createElement('div');
    panel.className = 'init-error-panel';
    const heading = document.createElement('h3');
    heading.textContent = 'Initialization Failed';
    const detail = document.createElement('p');
    detail.textContent = String(message || 'Unknown initialization error');
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload Page';
    reload.addEventListener('click', () => window.location.reload());
    panel.append(heading, detail, reload);
    document.body.append(panel);
  }

  /**
   * Get application info
   */
  getAppInfo() {
    return {
      version: '1.0.0',
      initialized: this.initialized,
      userAgent: navigator.userAgent,
      libraries: {
        pdfjs: typeof pdfjsLib !== 'undefined' ? 'loaded' : 'missing',
        tonal: typeof Tonal !== 'undefined' ? 'loaded' : 'missing',
        jspdf: typeof jsPDF !== 'undefined' ? 'loaded' : 'missing'
      },
      features: {
        serviceWorker: 'serviceWorker' in navigator,
        localStorage: typeof Storage !== 'undefined',
        fileApi: 'FileReader' in window
      },
      performance: this.logger.exportLogs()
    };
  }

  /**
   * Export debug information
   */
  exportDebugInfo() {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      appInfo: this.getAppInfo(),
      healthCheck: null,
      validationTests: null
    };
    
    // Run health checks and validation
    healthCheck().then(health => {
      debugInfo.healthCheck = health;
      return this.runValidationTests();
    }).then(validation => {
      debugInfo.validationTests = validation;
      
      // Download debug info
      const blob = new Blob([JSON.stringify(debugInfo, null, 2)], 
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transpose-debug-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}

// Global instances
const logger = new Observability();
let transposeApp = null;

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/3.11.174/pdf.worker.min.js';
    }
    document.getElementById('choosePdfButton')?.addEventListener('click', () => document.getElementById('fileInput')?.click());
    document.getElementById('errorClose')?.addEventListener('click', () => window.closeError());
    document.getElementById('errorRetry')?.addEventListener('click', () => window.retryOperation());
    // Initialize main app
    transposeApp = new TransposeApp();
    await transposeApp.init();
    
    // Make transposeApp globally available
    window.transposeApp = transposeApp.uiController;
    window.logger = logger;
    window.exportDebugInfo = () => transposeApp.exportDebugInfo();
    
    // Add debug key combination (Ctrl+Shift+D)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        transposeApp.exportDebugInfo();
      }
    });
    
  } catch (error) {
    logger.error('Critical initialization error', { error: error.message });
    console.error('Critical Error:', error);
  }
});

// Window error handling
window.addEventListener('error', (e) => {
  logger.error('Uncaught error', { 
    message: e.message, 
    filename: e.filename, 
    line: e.lineno, 
    column: e.colno,
    stack: e.error?.stack
  });
});

window.addEventListener('unhandledrejection', (e) => {
  logger.error('Unhandled promise rejection', { 
    reason: e.reason?.message || e.reason,
    stack: e.reason?.stack
  });
});

// Performance monitoring
window.addEventListener('load', () => {
  // Log performance metrics after page load
  setTimeout(() => {
    if (performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
      
      logger.status(`Page loaded in ${loadTime}ms (DOM ready in ${domReady}ms)`, 'info');
    }
  }, 100);
});

// Export for global access
window.TransposeApp = TransposeApp;
window.healthCheck = healthCheck;
