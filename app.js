/**
 * Main Application Entry Point
 * Initializes and coordinates all modules
 */

// Logging system
class TransposeLogger {
  constructor() {
    this.logs = [];
    this.metrics = {};
  }
  
  status(message, type = 'info') {
    const entry = { timestamp: Date.now(), message, type };
    this.logs.push(entry);
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  startTimer(operation) {
    this.metrics[operation] = { start: performance.now() };
  }
  
  endTimer(operation) {
    if (this.metrics[operation]) {
      this.metrics[operation].duration = performance.now() - this.metrics[operation].start;
      this.status(`${operation} completed in ${this.metrics[operation].duration.toFixed(0)}ms`);
    }
  }
  
  error(message, context = {}) {
    const error = { 
      timestamp: Date.now(), 
      message, 
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    this.logs.push(error);
    console.error('TransposeApp Error:', error);
  }
  
  exportLogs() {
    return {
      logs: this.logs,
      metrics: this.metrics,
      performance: this.getPerformanceSnapshot()
    };
  }
  
  getPerformanceSnapshot() {
    return {
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null,
      timing: performance.timing ? {
        loadEventEnd: performance.timing.loadEventEnd,
        domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
      } : null
    };
  }
}

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
  constructor() {
    this.logger = new TransposeLogger();
    this.uiController = null;
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
      this.uiController = new UIController();
      window.transposeApp = this.uiController;
      
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
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.search.includes('debug=true');
  }

  /**
   * Show initialization error
   */
  showInitError(message) {
    const errorHtml = `
      <div style="
        position: fixed; 
        top: 50%; 
        left: 50%; 
        transform: translate(-50%, -50%);
        background: white; 
        border: 2px solid #f44336; 
        border-radius: 8px; 
        padding: 2rem; 
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 500px;
        text-align: center;
        z-index: 10000;
      ">
        <h3 style="color: #f44336; margin-bottom: 1rem;">Initialization Failed</h3>
        <p style="margin-bottom: 1.5rem; color: #666;">${message}</p>
        <button onclick="location.reload()" style="
          background: #1976d2; 
          color: white; 
          border: none; 
          padding: 12px 24px; 
          border-radius: 6px; 
          cursor: pointer;
        ">Reload Page</button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', errorHtml);
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
const logger = new TransposeLogger();
let transposeApp = null;

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', async () => {
  try {
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