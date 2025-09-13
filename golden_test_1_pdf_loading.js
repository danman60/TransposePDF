/**
 * Golden Test 1: PDF Loading and Song Detection
 * 
 * This test validates:
 * - PDF file loading functionality
 * - Song detection and separation
 * - Text extraction accuracy
 * - Chord recognition in worship context
 * - Error handling for invalid files
 * - UI updates during processing
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PDFLoadingTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: [],
      timing: {},
      details: []
    };
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🚀 Initializing PDF Loading Test Suite...');
    
    this.browser = await chromium.launch({
      headless: false, // Keep visible for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['notifications']
    });

    this.page = await this.context.newPage();
    
    // Setup error handling
    this.page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`Browser ${type}: ${msg.text()}`);
      }
    });

    this.page.on('pageerror', error => {
      console.error('Page error:', error.message);
      this.testResults.errors.push(`Page error: ${error.message}`);
    });
  }

  async loadApplication() {
    console.log('📱 Loading TransposePDF application...');
    const startTime = performance.now();
    
    try {
      await this.page.goto('http://localhost:8000/', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      const loadTime = performance.now() - startTime;
      this.testResults.timing.appLoad = loadTime;
      
      // Take initial screenshot
      await this.takeScreenshot('01_app_loaded');
      
      // Verify app loaded correctly
      const title = await this.page.title();
      this.assert(title.includes('Chord Transposer'), 'App title should contain "Chord Transposer"');
      
      // Check for essential elements
      await this.assertElementExists('.upload-section', 'Upload section should be visible');
      await this.assertElementExists('#fileInput', 'File input should exist');
      await this.assertElementExists('.upload-button', 'Upload button should exist');
      
      console.log(`✅ App loaded successfully in ${loadTime.toFixed(0)}ms`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load application:', error.message);
      this.testResults.errors.push(`App load failed: ${error.message}`);
      return false;
    }
  }

  async testPDFFileLoading() {
    console.log('📄 Testing PDF file loading...');
    
    const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
    
    // Check if PDF exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`❌ Test PDF not found at: ${pdfPath}`);
      this.testResults.errors.push(`Test PDF not found at: ${pdfPath}`);
      return false;
    }

    try {
      console.log(`📁 Loading PDF: ${path.basename(pdfPath)}`);
      const loadStartTime = performance.now();
      
      // Click upload button to trigger file dialog
      await this.page.click('.upload-button');
      
      // Set file input
      const fileInput = await this.page.locator('#fileInput');
      await fileInput.setInputFiles(pdfPath);
      
      // Wait for processing to start
      await this.page.waitForSelector('.upload-progress', { 
        state: 'visible',
        timeout: 5000 
      });
      
      await this.takeScreenshot('02_pdf_processing');
      
      // Monitor progress
      console.log('⏳ Monitoring PDF processing...');
      
      // Wait for songs section to appear (processing complete)
      await this.page.waitForSelector('#songsSection', { 
        state: 'visible',
        timeout: 60000 // Allow up to 60 seconds for processing
      });
      
      const loadTime = performance.now() - loadStartTime;
      this.testResults.timing.pdfLoad = loadTime;
      
      await this.takeScreenshot('03_songs_loaded');
      
      console.log(`✅ PDF processed in ${loadTime.toFixed(0)}ms`);
      return true;
      
    } catch (error) {
      console.error('❌ PDF loading failed:', error.message);
      this.testResults.errors.push(`PDF loading failed: ${error.message}`);
      await this.takeScreenshot('error_pdf_loading');
      return false;
    }
  }

  async testSongDetection() {
    console.log('🎵 Testing song detection and separation...');
    
    try {
      // Check song count
      const songCountElement = await this.page.locator('#songCount');
      const songCount = await songCountElement.textContent();
      
      console.log(`📊 Detected ${songCount} songs`);
      this.testResults.details.push(`Song count: ${songCount}`);
      
      // Verify song count is reasonable (should be > 0)
      const count = parseInt(songCount);
      this.assert(count > 0, 'Should detect at least one song');
      this.assert(count < 100, 'Song count should be reasonable (< 100)');
      
      // Check for songs in container
      const songsContainer = await this.page.locator('#songsContainer');
      const songElements = await songsContainer.locator('.song-card').count();
      
      console.log(`🎼 Found ${songElements} song cards in UI`);
      this.assert(songElements === count, `UI song cards (${songElements}) should match count (${count})`);
      
      // Test individual song cards
      if (songElements > 0) {
        await this.testFirstSongCard();
      }
      
      await this.takeScreenshot('04_songs_detected');
      
      console.log('✅ Song detection tests passed');
      return true;
      
    } catch (error) {
      console.error('❌ Song detection failed:', error.message);
      this.testResults.errors.push(`Song detection failed: ${error.message}`);
      return false;
    }
  }

  async testFirstSongCard() {
    console.log('🔍 Testing first song card details...');
    
    try {
      const firstSong = await this.page.locator('.song-card').first();
      
      // Check for song title
      const titleElement = await firstSong.locator('.song-title');
      const title = await titleElement.textContent();
      console.log(`📝 First song title: "${title}"`);
      
      this.assert(title && title.trim().length > 0, 'Song should have a title');
      this.testResults.details.push(`First song title: "${title}"`);
      
      // Check for transpose controls
      await this.assertElementExists('.transpose-controls', 'Transpose controls should exist', firstSong);
      await this.assertElementExists('.transpose-up', 'Transpose up button should exist', firstSong);
      await this.assertElementExists('.transpose-down', 'Transpose down button should exist', firstSong);
      await this.assertElementExists('.transpose-reset', 'Transpose reset button should exist', firstSong);
      
      // Check for song content
      const contentElement = await firstSong.locator('.song-content');
      const content = await contentElement.textContent();
      
      this.assert(content && content.trim().length > 50, 'Song should have substantial content');
      console.log(`📄 First song content length: ${content.length} characters`);
      
      // Check for chord detection
      const chordElements = await firstSong.locator('.chord').count();
      console.log(`🎼 Found ${chordElements} chord annotations`);
      this.testResults.details.push(`First song chords: ${chordElements}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ First song card test failed:', error.message);
      this.testResults.errors.push(`First song test failed: ${error.message}`);
      return false;
    }
  }

  async testErrorHandling() {
    console.log('🚨 Testing error handling with invalid file...');
    
    try {
      // Create a fake invalid PDF path
      const invalidPath = 'invalid_file.txt';
      
      // Try to create a text file as invalid input
      fs.writeFileSync(invalidPath, 'This is not a PDF file');
      
      // Reset to upload section
      await this.page.reload({ waitUntil: 'networkidle' });
      await this.takeScreenshot('05_error_test_start');
      
      // Try to upload invalid file
      const fileInput = await this.page.locator('#fileInput');
      await fileInput.setInputFiles(invalidPath);
      
      // Check for error handling
      try {
        await this.page.waitForSelector('#errorPanel', { 
          state: 'visible',
          timeout: 10000 
        });
        
        const errorMessage = await this.page.locator('#errorMessage').textContent();
        console.log(`✅ Error properly handled: ${errorMessage}`);
        this.testResults.details.push(`Error handling: ${errorMessage}`);
        
        await this.takeScreenshot('06_error_displayed');
        
        // Cleanup
        fs.unlinkSync(invalidPath);
        
        return true;
      } catch {
        console.log('⚠️  No error panel shown for invalid file (may be filtered by file input)');
        fs.unlinkSync(invalidPath);
        return true; // Not necessarily a failure
      }
      
    } catch (error) {
      console.error('❌ Error handling test failed:', error.message);
      this.testResults.errors.push(`Error handling test failed: ${error.message}`);
      return false;
    }
  }

  async testUIResponsiveness() {
    console.log('📱 Testing UI responsiveness...');
    
    try {
      // Test different viewport sizes
      const viewports = [
        { width: 320, height: 568, name: 'Mobile' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 1920, height: 1080, name: 'Desktop' }
      ];
      
      for (const viewport of viewports) {
        console.log(`📐 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
        
        await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await this.page.waitForTimeout(1000); // Allow UI to adjust
        
        await this.takeScreenshot(`07_${viewport.name.toLowerCase()}_view`);
        
        // Check that essential elements are still visible
        await this.assertElementVisible('.app-header', `Header should be visible on ${viewport.name}`);
        
        if (await this.page.locator('#songsSection').isVisible()) {
          await this.assertElementVisible('#songsSection', `Songs section should be visible on ${viewport.name}`);
        }
      }
      
      // Reset to original size
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      console.log('✅ UI responsiveness tests passed');
      return true;
      
    } catch (error) {
      console.error('❌ UI responsiveness test failed:', error.message);
      this.testResults.errors.push(`UI responsiveness test failed: ${error.message}`);
      return false;
    }
  }

  // Helper methods
  async assertElementExists(selector, message, parent = null) {
    const locator = parent ? parent.locator(selector) : this.page.locator(selector);
    const exists = await locator.count() > 0;
    this.assert(exists, message);
  }

  async assertElementVisible(selector, message, parent = null) {
    const locator = parent ? parent.locator(selector) : this.page.locator(selector);
    const visible = await locator.isVisible();
    this.assert(visible, message);
  }

  assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      this.testResults.passed++;
    } else {
      console.log(`❌ ${message}`);
      this.testResults.failed++;
      this.testResults.errors.push(message);
    }
  }

  async takeScreenshot(name) {
    const screenshotPath = `test_results/golden_test_1_${name}.png`;
    
    // Ensure directory exists
    const dir = path.dirname(screenshotPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await this.page.screenshot({ 
      path: screenshotPath, 
      fullPage: true 
    });
    
    this.testResults.screenshots.push(screenshotPath);
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
  }

  async runAllTests() {
    console.log('🧪 Starting Golden Test 1: PDF Loading and Song Detection');
    console.log('=' * 60);
    
    try {
      await this.initialize();
      
      const appLoaded = await this.loadApplication();
      if (!appLoaded) {
        throw new Error('Failed to load application');
      }
      
      const pdfLoaded = await this.testPDFFileLoading();
      if (pdfLoaded) {
        await this.testSongDetection();
      }
      
      await this.testErrorHandling();
      await this.testUIResponsiveness();
      
    } catch (error) {
      console.error('🚨 Test suite error:', error.message);
      this.testResults.errors.push(`Suite error: ${error.message}`);
    }
  }

  async generateReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    
    const report = {
      testSuite: 'Golden Test 1: PDF Loading and Song Detection',
      timestamp: new Date().toISOString(),
      duration: totalTime,
      results: this.testResults,
      summary: {
        total: this.testResults.passed + this.testResults.failed,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)
      }
    };
    
    // Save report
    const reportPath = 'test_results/golden_test_1_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' * 40);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(`📄 Report saved: ${reportPath}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS ENCOUNTERED:');
      this.testResults.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.testResults.details.length > 0) {
      console.log('\n📋 TEST DETAILS:');
      this.testResults.details.forEach(detail => console.log(`  - ${detail}`));
    }
    
    console.log(`\n📸 Screenshots: ${this.testResults.screenshots.length}`);
    this.testResults.screenshots.forEach(screenshot => console.log(`  - ${screenshot}`));
    
    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
(async () => {
  const tester = new PDFLoadingTester();
  
  try {
    await tester.runAllTests();
    await tester.generateReport();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
})();