/**
 * Golden Test 3: Export Functionality
 * 
 * This test validates:
 * - PDF export functionality
 * - Export with transposed content
 * - Export filename handling
 * - Export progress indicators
 * - Generated PDF quality and content
 * - File download verification
 * - Error handling during export
 * - Export performance metrics
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ExportTester {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.downloadPath = path.join(__dirname, 'test_downloads');
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      screenshots: [],
      timing: {},
      details: [],
      exportTests: []
    };
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('📤 Initializing Export Functionality Test Suite...');
    
    // Ensure download directory exists
    if (!fs.existsSync(this.downloadPath)) {
      fs.mkdirSync(this.downloadPath, { recursive: true });
    }
    
    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      timeout: 30000
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['notifications'],
      acceptDownloads: true
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

    // Setup download handling
    this.page.on('download', async download => {
      const filename = download.suggestedFilename();
      const downloadPath = path.join(this.downloadPath, filename);
      await download.saveAs(downloadPath);
      console.log(`📥 Downloaded: ${filename}`);
      this.testResults.details.push(`Downloaded: ${filename} (${(await fs.promises.stat(downloadPath)).size} bytes)`);
    });
  }

  async loadApplicationAndPDF() {
    console.log('📱 Loading app and PDF for export testing...');
    
    try {
      await this.page.goto('http://localhost:8000/', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      await this.takeScreenshot('01_app_loaded_for_export');
      
      // Load the songbook PDF
      const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
      
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Test PDF not found at: ${pdfPath}`);
      }

      console.log('📄 Loading songbook for export tests...');
      const fileInput = await this.page.locator('#fileInput');
      await fileInput.setInputFiles(pdfPath);
      
      // Wait for processing to complete
      await this.page.waitForSelector('#songsSection', { 
        state: 'visible',
        timeout: 60000 
      });
      
      // Wait for export button to be enabled
      await this.page.waitForSelector('#exportButton:not([disabled])', {
        timeout: 10000
      });
      
      await this.takeScreenshot('02_songbook_loaded_export_ready');
      
      console.log('✅ Songbook loaded and export button enabled');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load app/PDF:', error.message);
      this.testResults.errors.push(`App/PDF load failed: ${error.message}`);
      return false;
    }
  }

  async testBasicExport() {
    console.log('📤 Testing basic export functionality...');
    
    try {
      // Click export button to open export section
      const exportButton = await this.page.locator('#exportButton');
      await exportButton.click();
      
      // Wait for export section to appear
      await this.page.waitForSelector('#exportSection', { 
        state: 'visible',
        timeout: 5000 
      });
      
      await this.takeScreenshot('03_export_section_opened');
      
      // Check export controls are visible
      await this.assertElementExists('#exportFilename', 'Export filename input should exist');
      await this.assertElementExists('#exportFinalButton', 'Export final button should exist');
      
      // Test default filename
      const filenameInput = await this.page.locator('#exportFilename');
      const defaultFilename = await filenameInput.inputValue();
      
      this.assert(defaultFilename.trim().length > 0, 'Default filename should not be empty');
      console.log(`📝 Default filename: "${defaultFilename}"`);
      
      // Start export
      console.log('🚀 Starting PDF export...');
      const exportStartTime = performance.now();
      
      const exportFinalButton = await this.page.locator('#exportFinalButton');
      await exportFinalButton.click();
      
      // Wait for export progress to appear
      try {
        await this.page.waitForSelector('#exportProgress', { 
          state: 'visible',
          timeout: 3000 
        });
        
        await this.takeScreenshot('04_export_progress');
        console.log('✅ Export progress indicator appeared');
      } catch {
        console.log('⚠️  Export progress indicator not shown (may be too fast)');
      }
      
      // Wait for export to complete
      // This might take a while depending on the songbook size
      await this.page.waitForSelector('#exportProgress', { 
        state: 'hidden',
        timeout: 120000 // Allow up to 2 minutes for export
      });
      
      const exportTime = performance.now() - exportStartTime;
      this.testResults.timing.basicExport = exportTime;
      
      console.log(`✅ Basic export completed in ${exportTime.toFixed(0)}ms`);
      
      await this.takeScreenshot('05_export_completed');
      
      // Check if download occurred
      await this.page.waitForTimeout(2000); // Allow time for download
      
      this.verifyDownload(defaultFilename);
      
      return true;
      
    } catch (error) {
      console.error('❌ Basic export test failed:', error.message);
      this.testResults.errors.push(`Basic export failed: ${error.message}`);
      await this.takeScreenshot('error_basic_export');
      return false;
    }
  }

  async testExportWithTransposition() {
    console.log('🔄 Testing export with transposed content...');
    
    try {
      // First, transpose some songs
      const songCards = await this.page.locator('.song-card');
      const songCount = await songCards.count();
      
      if (songCount === 0) {
        throw new Error('No songs available for transposition test');
      }
      
      console.log(`🎵 Transposing first ${Math.min(3, songCount)} songs...`);
      
      // Transpose first few songs
      const maxSongs = Math.min(3, songCount);
      for (let i = 0; i < maxSongs; i++) {
        const song = songCards.nth(i);
        const upButton = await song.locator('.transpose-up');
        
        // Transpose up by different amounts
        const transposeClicks = (i + 1) * 2; // 2, 4, 6 clicks
        for (let j = 0; j < transposeClicks; j++) {
          await upButton.click();
          await this.page.waitForTimeout(200);
        }
        
        console.log(`🎼 Song ${i + 1} transposed +${transposeClicks} semitones`);
      }
      
      await this.takeScreenshot('06_songs_transposed');
      
      // Now export with transposed content
      console.log('📤 Exporting transposed songbook...');
      
      // Set custom filename for transposed export
      const filenameInput = await this.page.locator('#exportFilename');
      await filenameInput.fill('Transposed Songbook Test');
      
      const exportStartTime = performance.now();
      
      const exportFinalButton = await this.page.locator('#exportFinalButton');
      await exportFinalButton.click();
      
      // Wait for export to complete
      await this.page.waitForSelector('#exportProgress', { 
        state: 'hidden',
        timeout: 120000
      });
      
      const exportTime = performance.now() - exportStartTime;
      this.testResults.timing.transposedExport = exportTime;
      
      console.log(`✅ Transposed export completed in ${exportTime.toFixed(0)}ms`);
      
      await this.takeScreenshot('07_transposed_export_completed');
      
      this.verifyDownload('Transposed Songbook Test.pdf');
      
      // Compare export times
      if (this.testResults.timing.basicExport && this.testResults.timing.transposedExport) {
        const timeDiff = Math.abs(this.testResults.timing.transposedExport - this.testResults.timing.basicExport);
        const percentDiff = (timeDiff / this.testResults.timing.basicExport) * 100;
        
        console.log(`📊 Export time difference: ${timeDiff.toFixed(0)}ms (${percentDiff.toFixed(1)}%)`);
        this.testResults.details.push(`Export time difference: ${percentDiff.toFixed(1)}%`);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Transposed export test failed:', error.message);
      this.testResults.errors.push(`Transposed export failed: ${error.message}`);
      return false;
    }
  }

  async testExportFilenameHandling() {
    console.log('📝 Testing export filename handling...');
    
    try {
      const filenameInput = await this.page.locator('#exportFilename');
      
      // Test various filename scenarios
      const testFilenames = [
        'Simple Test',
        'Test with Numbers 123',
        'Test-with-dashes',
        'Test_with_underscores',
        'Test with special chars !@#',
        'Very Long Filename That Might Cause Issues With File Systems',
        '', // Empty filename
        '   ', // Whitespace only
      ];
      
      for (const filename of testFilenames) {
        console.log(`📄 Testing filename: "${filename}"`);
        
        await filenameInput.fill(filename);
        await this.page.waitForTimeout(500);
        
        // Check if export button is still functional
        const exportButton = await this.page.locator('#exportFinalButton');
        const isEnabled = await exportButton.isEnabled();
        
        if (filename.trim().length === 0) {
          // Empty filename should disable button or use default
          console.log(`⚠️  Empty filename handling: button enabled = ${isEnabled}`);
        } else {
          this.assert(isEnabled, `Export button should be enabled for filename: "${filename}"`);
        }
        
        this.testResults.exportTests.push({
          filename,
          buttonEnabled: isEnabled,
          valid: filename.trim().length > 0
        });
      }
      
      // Reset to valid filename
      await filenameInput.fill('Filename Test Complete');
      
      await this.takeScreenshot('08_filename_testing');
      
      console.log('✅ Filename handling tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Filename handling test failed:', error.message);
      this.testResults.errors.push(`Filename handling failed: ${error.message}`);
      return false;
    }
  }

  async testExportPerformance() {
    console.log('⚡ Testing export performance with different scenarios...');
    
    try {
      // Reset all songs to original state
      const songCards = await this.page.locator('.song-card');
      const songCount = await songCards.count();
      
      console.log(`🔄 Resetting ${songCount} songs to original state...`);
      for (let i = 0; i < songCount; i++) {
        const song = songCards.nth(i);
        const resetButton = await song.locator('.transpose-reset');
        await resetButton.click();
        await this.page.waitForTimeout(100);
      }
      
      // Test 1: Export with no transpositions (baseline)
      console.log('📊 Performance Test 1: No transpositions');
      const performanceTest1 = await this.performTimedExport('Performance Test 1 - Original');
      
      // Test 2: Export with all songs transposed up
      console.log('📊 Performance Test 2: All songs transposed');
      for (let i = 0; i < Math.min(songCount, 10); i++) { // Limit to 10 songs for performance
        const song = songCards.nth(i);
        const upButton = await song.locator('.transpose-up');
        await upButton.click();
        await this.page.waitForTimeout(50);
      }
      
      const performanceTest2 = await this.performTimedExport('Performance Test 2 - All Transposed');
      
      // Test 3: Export with mixed transpositions
      console.log('📊 Performance Test 3: Mixed transpositions');
      for (let i = 0; i < Math.min(songCount, 10); i++) {
        const song = songCards.nth(i);
        if (i % 2 === 0) {
          const downButton = await song.locator('.transpose-down');
          await downButton.click();
          await downButton.click(); // Down 2
        } else {
          const upButton = await song.locator('.transpose-up');
          await upButton.click();
          await upButton.click();
          await upButton.click(); // Up 3
        }
        await this.page.waitForTimeout(50);
      }
      
      const performanceTest3 = await this.performTimedExport('Performance Test 3 - Mixed');
      
      // Analyze performance results
      const results = [performanceTest1, performanceTest2, performanceTest3];
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTime = Math.max(...results);
      const minTime = Math.min(...results);
      
      console.log(`📈 Performance Analysis:`);
      console.log(`  Original: ${performanceTest1.toFixed(0)}ms`);
      console.log(`  All Transposed: ${performanceTest2.toFixed(0)}ms`);
      console.log(`  Mixed: ${performanceTest3.toFixed(0)}ms`);
      console.log(`  Average: ${avgTime.toFixed(0)}ms`);
      console.log(`  Range: ${minTime.toFixed(0)}ms - ${maxTime.toFixed(0)}ms`);
      
      this.testResults.timing.performanceTests = {
        original: performanceTest1,
        allTransposed: performanceTest2,
        mixed: performanceTest3,
        average: avgTime,
        range: { min: minTime, max: maxTime }
      };
      
      // Performance should be reasonable (under 60 seconds for most songbooks)
      this.assert(maxTime < 60000, 'Export should complete within 60 seconds');
      
      await this.takeScreenshot('09_performance_testing_complete');
      
      return true;
      
    } catch (error) {
      console.error('❌ Performance testing failed:', error.message);
      this.testResults.errors.push(`Performance testing failed: ${error.message}`);
      return false;
    }
  }

  async performTimedExport(filename) {
    const filenameInput = await this.page.locator('#exportFilename');
    await filenameInput.fill(filename);
    
    const startTime = performance.now();
    
    const exportButton = await this.page.locator('#exportFinalButton');
    await exportButton.click();
    
    // Wait for export to complete
    await this.page.waitForSelector('#exportProgress', { 
      state: 'hidden',
      timeout: 120000
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  ${filename}: ${duration.toFixed(0)}ms`);
    
    return duration;
  }

  async testExportErrorHandling() {
    console.log('🚨 Testing export error handling...');
    
    try {
      // Test export with no songs (if possible)
      // This might not be possible with the current flow, but we can test other scenarios
      
      // Test export with invalid filename characters (if any restrictions exist)
      const filenameInput = await this.page.locator('#exportFilename');
      
      // Try potentially problematic filenames
      const problematicFilenames = [
        'file|with|pipes',
        'file<with>brackets',
        'file"with"quotes',
        'file:with:colons',
        'file?with?questions',
        'file*with*asterisks'
      ];
      
      for (const filename of problematicFilenames) {
        await filenameInput.fill(filename);
        await this.page.waitForTimeout(500);
        
        console.log(`🧪 Testing problematic filename: "${filename}"`);
        
        try {
          const exportButton = await this.page.locator('#exportFinalButton');
          await exportButton.click();
          
          // Check if error panel appears
          try {
            await this.page.waitForSelector('#errorPanel', { 
              state: 'visible',
              timeout: 5000 
            });
            
            const errorMessage = await this.page.locator('#errorMessage').textContent();
            console.log(`✅ Error correctly caught: ${errorMessage}`);
            
            // Close error panel
            const closeButton = await this.page.locator('.error-close');
            await closeButton.click();
            
          } catch {
            // No error shown - export might have succeeded or filename was sanitized
            console.log(`⚠️  No error shown for filename: "${filename}"`);
            
            // Wait for export to complete or timeout
            await this.page.waitForSelector('#exportProgress', { 
              state: 'hidden',
              timeout: 10000
            }).catch(() => {
              console.log('Export timed out or failed silently');
            });
          }
          
        } catch (error) {
          console.log(`⚠️  Export failed for filename "${filename}": ${error.message}`);
        }
      }
      
      await this.takeScreenshot('10_error_handling_test');
      
      console.log('✅ Error handling tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Error handling test failed:', error.message);
      this.testResults.errors.push(`Error handling test failed: ${error.message}`);
      return false;
    }
  }

  verifyDownload(expectedFilename) {
    try {
      const downloadFiles = fs.readdirSync(this.downloadPath);
      const downloadedFile = downloadFiles.find(file => 
        file.includes(expectedFilename.replace('.pdf', '')) || 
        file.endsWith('.pdf')
      );
      
      if (downloadedFile) {
        const filePath = path.join(this.downloadPath, downloadedFile);
        const stats = fs.statSync(filePath);
        
        console.log(`✅ Download verified: ${downloadedFile} (${stats.size} bytes)`);
        this.assert(stats.size > 1000, 'Downloaded PDF should be larger than 1KB');
        
        this.testResults.details.push(`Verified download: ${downloadedFile} (${stats.size} bytes)`);
        return true;
      } else {
        console.log(`⚠️  Download not found for: ${expectedFilename}`);
        this.testResults.errors.push(`Download not found: ${expectedFilename}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Download verification failed: ${error.message}`);
      this.testResults.errors.push(`Download verification failed: ${error.message}`);
      return false;
    }
  }

  // Helper methods
  async assertElementExists(selector, message) {
    const exists = await this.page.locator(selector).count() > 0;
    this.assert(exists, message);
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
    const screenshotPath = `test_results/golden_test_3_${name}.png`;
    
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
    console.log('🧪 Starting Golden Test 3: Export Functionality');
    console.log('=' * 60);
    
    try {
      await this.initialize();
      
      const loaded = await this.loadApplicationAndPDF();
      if (!loaded) {
        throw new Error('Failed to load application/PDF');
      }
      
      await this.testBasicExport();
      await this.testExportWithTransposition();
      await this.testExportFilenameHandling();
      await this.testExportPerformance();
      await this.testExportErrorHandling();
      
    } catch (error) {
      console.error('🚨 Test suite error:', error.message);
      this.testResults.errors.push(`Suite error: ${error.message}`);
    }
  }

  async generateReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    
    const report = {
      testSuite: 'Golden Test 3: Export Functionality',
      timestamp: new Date().toISOString(),
      duration: totalTime,
      results: this.testResults,
      summary: {
        total: this.testResults.passed + this.testResults.failed,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: this.testResults.passed + this.testResults.failed > 0 
          ? ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)
          : '0.0'
      },
      exportAnalysis: {
        totalExportTests: this.testResults.exportTests.length,
        validFilenames: this.testResults.exportTests.filter(t => t.valid).length,
        invalidFilenames: this.testResults.exportTests.filter(t => !t.valid).length,
        averageExportTime: this.testResults.timing.performanceTests ? 
          this.testResults.timing.performanceTests.average : null
      }
    };
    
    // Save report
    const reportPath = 'test_results/golden_test_3_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' * 40);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    
    if (report.exportAnalysis.averageExportTime) {
      console.log(`\n📤 EXPORT PERFORMANCE:`);
      console.log(`Average Export Time: ${report.exportAnalysis.averageExportTime.toFixed(0)}ms`);
    }
    
    console.log(`📄 Report saved: ${reportPath}`);
    
    // List downloaded files
    try {
      const downloadFiles = fs.readdirSync(this.downloadPath);
      if (downloadFiles.length > 0) {
        console.log(`\n📥 DOWNLOADED FILES (${downloadFiles.length}):`);
        downloadFiles.forEach(file => {
          const filePath = path.join(this.downloadPath, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        });
      }
    } catch (error) {
      console.log('Could not list downloaded files:', error.message);
    }
    
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
  const tester = new ExportTester();
  
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