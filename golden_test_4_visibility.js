/**
 * Golden Test 4: Text Visibility and Readability
 * 
 * This test validates:
 * - Text rendering quality and clarity
 * - Font size and readability across devices
 * - Color contrast and accessibility
 * - Text selection and interaction
 * - Chord visibility and positioning
 * - Lyrics readability in different scenarios
 * - Zoom and scaling functionality
 * - Text preservation after transposition
 * - Accessibility features compliance
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class VisibilityTester {
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
      details: [],
      visibilityTests: [],
      accessibilityTests: []
    };
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('👁️ Initializing Text Visibility and Readability Test Suite...');
    
    this.browser = await chromium.launch({
      headless: false,
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

  async loadApplicationAndPDF() {
    console.log('📱 Loading app and PDF for visibility testing...');
    
    try {
      await this.page.goto('http://localhost:8000/', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      await this.takeScreenshot('01_app_loaded_for_visibility');
      
      // Load the songbook PDF
      const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
      
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Test PDF not found at: ${pdfPath}`);
      }

      console.log('📄 Loading songbook for visibility tests...');
      const fileInput = await this.page.locator('#fileInput');
      await fileInput.setInputFiles(pdfPath);
      
      // Wait for processing to complete
      await this.page.waitForSelector('#songsSection', { 
        state: 'visible',
        timeout: 60000 
      });
      
      await this.takeScreenshot('02_songbook_loaded_visibility');
      
      console.log('✅ Songbook loaded successfully for visibility testing');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load app/PDF:', error.message);
      this.testResults.errors.push(`App/PDF load failed: ${error.message}`);
      return false;
    }
  }

  async testBasicTextVisibility() {
    console.log('📝 Testing basic text visibility and rendering...');
    
    try {
      const songCards = await this.page.locator('.lead-sheet');
      const songCount = await songCards.count();
      
      if (songCount === 0) {
        throw new Error('No songs found for visibility testing');
      }
      
      console.log(`🎵 Testing visibility on ${Math.min(3, songCount)} songs...`);
      
      const maxSongs = Math.min(3, songCount);
      for (let i = 0; i < maxSongs; i++) {
        const song = songCards.nth(i);
        const songTitle = await song.locator('.song-title').textContent();
        
        console.log(`🎼 Testing song ${i + 1}: "${songTitle}"`);
        
        // Test song title visibility
        await this.testElementVisibility(song.locator('.song-title'), `Song ${i + 1} title`);
        
        // Test song content visibility
        const songContent = song.locator('.lead-sheet-content');
        await this.testElementVisibility(songContent, `Song ${i + 1} content`);
        
        // Test text content is not empty
        const contentText = await songContent.textContent();
        this.assert(contentText && contentText.trim().length > 50, 
          `Song ${i + 1} should have substantial content (got ${contentText ? contentText.length : 0} chars)`);
        
        // Test chord elements if they exist
        const chordElements = await song.locator('.chord').count();
        if (chordElements > 0) {
          console.log(`🎼 Testing ${chordElements} chord elements in song ${i + 1}`);
          
          // Test first few chord elements
          const testChords = Math.min(5, chordElements);
          for (let j = 0; j < testChords; j++) {
            const chord = song.locator('.chord').nth(j);
            await this.testElementVisibility(chord, `Song ${i + 1} chord ${j + 1}`);
            
            const chordText = await chord.textContent();
            this.assert(chordText && chordText.trim().length > 0, 
              `Song ${i + 1} chord ${j + 1} should have text content`);
          }
        }
        
        // Test transpose controls visibility
        await this.testElementVisibility(song.locator('.transpose-controls'), 
          `Song ${i + 1} transpose controls`);
        
        this.testResults.visibilityTests.push({
          songIndex: i + 1,
          songTitle,
          contentLength: contentText ? contentText.length : 0,
          chordCount: chordElements,
          visible: true
        });
      }
      
      await this.takeScreenshot('03_basic_visibility_tested');
      
      console.log('✅ Basic text visibility tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Basic visibility test failed:', error.message);
      this.testResults.errors.push(`Basic visibility test failed: ${error.message}`);
      return false;
    }
  }

  async testTextContrast() {
    console.log('🌓 Testing text contrast and readability...');
    
    try {
      const firstSong = await this.page.locator('.lead-sheet').first();
      
      // Test text color contrast
      const textElements = [
        { selector: '.song-title', name: 'Song title' },
        { selector: '.lead-sheet-content', name: 'Song content' },
        { selector: '.chord', name: 'Chord text' },
        { selector: '.transpose-button[title*="up"]', name: 'Transpose button' }
      ];
      
      for (const element of textElements) {
        try {
          const el = firstSong.locator(element.selector);
          if (await el.count() > 0) {
            const styles = await el.first().evaluate((node) => {
              const computed = window.getComputedStyle(node);
              return {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize,
                fontWeight: computed.fontWeight,
                opacity: computed.opacity
              };
            });
            
            console.log(`🎨 ${element.name} styles:`, styles);
            
            // Basic contrast checks
            this.assert(styles.opacity !== '0', `${element.name} should not be transparent`);
            this.assert(styles.color !== 'transparent', `${element.name} should have visible color`);
            
            // Font size checks
            const fontSize = parseFloat(styles.fontSize);
            this.assert(fontSize >= 10, `${element.name} font size should be at least 10px (got ${fontSize}px)`);
            
            this.testResults.details.push(`${element.name}: ${styles.fontSize}, color: ${styles.color}`);
          }
        } catch (error) {
          console.log(`⚠️  Could not test ${element.name}: ${error.message}`);
        }
      }
      
      await this.takeScreenshot('04_contrast_analysis');
      
      console.log('✅ Text contrast tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Text contrast test failed:', error.message);
      this.testResults.errors.push(`Text contrast test failed: ${error.message}`);
      return false;
    }
  }

  async testTextSelectionAndInteraction() {
    console.log('👆 Testing text selection and interaction...');
    
    try {
      const firstSong = await this.page.locator('.lead-sheet').first();
      const songContent = firstSong.locator('.lead-sheet-content');
      
      // Test text selection
      console.log('📝 Testing text selection...');
      
      // Try to select some text
      const contentBox = await songContent.boundingBox();
      if (contentBox) {
        // Triple-click to select text
        await this.page.mouse.click(contentBox.x + contentBox.width / 2, 
                                   contentBox.y + contentBox.height / 4, 
                                   { clickCount: 3 });
        
        await this.page.waitForTimeout(1000);
        
        // Check if text is selected
        const selectedText = await this.page.evaluate(() => window.getSelection().toString());
        
        if (selectedText && selectedText.length > 0) {
          console.log(`✅ Text selection works (selected ${selectedText.length} characters)`);
          this.testResults.details.push(`Text selection: ${selectedText.length} chars`);
        } else {
          console.log('⚠️  Text selection may be disabled or not working');
          this.testResults.details.push('Text selection: not working');
        }
        
        // Clear selection
        await this.page.mouse.click(10, 10);
      }
      
      // Test button interactions
      console.log('🔘 Testing button interactions...');
      
      const upButton = firstSong.locator('.transpose-button[title*="up"]');
      const downButton = firstSong.locator('.transpose-button[title*="down"]');
      const resetButton = firstSong.locator('.reset-button');
      
      // Test hover effects
      await upButton.hover();
      await this.page.waitForTimeout(500);
      
      const upButtonStyles = await upButton.evaluate((node) => {
        const computed = window.getComputedStyle(node);
        return {
          cursor: computed.cursor,
          opacity: computed.opacity,
          backgroundColor: computed.backgroundColor
        };
      });
      
      this.assert(upButtonStyles.cursor === 'pointer' || upButtonStyles.cursor === 'hand', 
        'Transpose up button should have pointer cursor');
      
      console.log(`🔼 Up button styles on hover:`, upButtonStyles);
      
      await this.takeScreenshot('05_interaction_testing');
      
      console.log('✅ Text interaction tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Text interaction test failed:', error.message);
      this.testResults.errors.push(`Text interaction test failed: ${error.message}`);
      return false;
    }
  }

  async testVisibilityAfterTransposition() {
    console.log('🔄 Testing visibility after transposition...');
    
    try {
      const firstSong = await this.page.locator('.lead-sheet').first();
      
      // Get original content
      const originalContent = await firstSong.locator('.lead-sheet-content').textContent();
      const originalChords = await firstSong.locator('.chord').count();
      
      console.log(`📊 Original content: ${originalContent.length} chars, ${originalChords} chords`);
      
      // Transpose up
      const upButton = firstSong.locator('.transpose-button[title*="up"]');
      await upButton.click();
      await this.page.waitForTimeout(1000);
      
      // Check visibility after transposition
      const transposedContent = await firstSong.locator('.lead-sheet-content').textContent();
      const transposedChords = await firstSong.locator('.chord').count();
      
      console.log(`📊 Transposed content: ${transposedContent.length} chars, ${transposedChords} chords`);
      
      // Verify content is still visible and properly formatted
      this.assert(transposedContent && transposedContent.length > 50, 
        'Transposed content should still be substantial');
      
      this.assert(Math.abs(transposedContent.length - originalContent.length) < originalContent.length * 0.1,
        'Transposed content length should be similar to original (within 10%)');
      
      this.assert(transposedChords === originalChords,
        'Number of chords should remain the same after transposition');
      
      // Test chord visibility after transposition
      if (transposedChords > 0) {
        const firstChord = firstSong.locator('.chord').first();
        await this.testElementVisibility(firstChord, 'First chord after transposition');
        
        const chordText = await firstChord.textContent();
        this.assert(chordText && chordText.trim().length > 0,
          'Chord text should still be visible after transposition');
        
        console.log(`🎼 First chord after transposition: "${chordText}"`);
      }
      
      // Test multiple transpositions
      console.log('🔄 Testing multiple transpositions...');
      for (let i = 0; i < 3; i++) {
        await upButton.click();
        await this.page.waitForTimeout(500);
        
        const content = await firstSong.locator('.lead-sheet-content').textContent();
        this.assert(content && content.length > 50,
          `Content should remain visible after ${i + 2} transpositions`);
      }
      
      // Reset and test down transposition
      const resetButton = firstSong.locator('.reset-button');
      await resetButton.click();
      await this.page.waitForTimeout(500);
      
      const downButton = firstSong.locator('.transpose-button[title*="down"]');
      for (let i = 0; i < 3; i++) {
        await downButton.click();
        await this.page.waitForTimeout(500);
        
        const content = await firstSong.locator('.lead-sheet-content').textContent();
        this.assert(content && content.length > 50,
          `Content should remain visible after ${i + 1} down transpositions`);
      }
      
      await this.takeScreenshot('06_visibility_after_transposition');
      
      console.log('✅ Visibility after transposition tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Visibility after transposition test failed:', error.message);
      this.testResults.errors.push(`Visibility after transposition test failed: ${error.message}`);
      return false;
    }
  }

  async testResponsiveVisibility() {
    console.log('📱 Testing responsive visibility across device sizes...');
    
    try {
      const viewports = [
        { width: 320, height: 568, name: 'Mobile Portrait' },
        { width: 568, height: 320, name: 'Mobile Landscape' },
        { width: 768, height: 1024, name: 'Tablet Portrait' },
        { width: 1024, height: 768, name: 'Tablet Landscape' },
        { width: 1920, height: 1080, name: 'Desktop' }
      ];
      
      for (const viewport of viewports) {
        console.log(`📐 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
        
        await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
        await this.page.waitForTimeout(1000); // Allow UI to adjust
        
        // Test that content is still visible
        const firstSong = await this.page.locator('.lead-sheet').first();
        
        if (await firstSong.isVisible()) {
          const songContent = firstSong.locator('.lead-sheet-content');
          const isContentVisible = await songContent.isVisible();
          
          this.assert(isContentVisible, `Song content should be visible on ${viewport.name}`);
          
          if (isContentVisible) {
            const contentBox = await songContent.boundingBox();
            
            if (contentBox) {
              // Check that content fits within viewport (allowing some overflow)
              const fitsHorizontally = contentBox.width <= viewport.width * 1.1; // 10% tolerance
              const hasReasonableHeight = contentBox.height > 20 && contentBox.height < viewport.height * 2;
              
              console.log(`📊 ${viewport.name} content box: ${contentBox.width}x${contentBox.height}`);
              
              // For mobile, we may expect horizontal scrolling, so less strict
              if (viewport.width < 600) {
                this.assert(hasReasonableHeight, 
                  `Content height should be reasonable on ${viewport.name}`);
              } else {
                this.assert(fitsHorizontally && hasReasonableHeight,
                  `Content should fit properly on ${viewport.name}`);
              }
              
              this.testResults.visibilityTests.push({
                viewport: viewport.name,
                contentVisible: isContentVisible,
                contentSize: `${contentBox.width}x${contentBox.height}`,
                fitsScreen: fitsHorizontally
              });
            }
          }
          
          // Test button visibility on different sizes
          const transposeControls = firstSong.locator('.transpose-controls');
          const controlsVisible = await transposeControls.isVisible();
          
          this.assert(controlsVisible, `Transpose controls should be visible on ${viewport.name}`);
          
        } else {
          console.log(`⚠️  Song card not visible on ${viewport.name}`);
        }
        
        await this.takeScreenshot(`07_${viewport.name.toLowerCase().replace(' ', '_')}_visibility`);
      }
      
      // Reset to original size
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      console.log('✅ Responsive visibility tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Responsive visibility test failed:', error.message);
      this.testResults.errors.push(`Responsive visibility test failed: ${error.message}`);
      return false;
    }
  }

  async testAccessibilityFeatures() {
    console.log('♿ Testing accessibility features...');
    
    try {
      // Test keyboard navigation
      console.log('⌨️  Testing keyboard navigation...');
      
      const firstSong = await this.page.locator('.lead-sheet').first();
      
      // Tab through controls
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(300);
      
      const focusedElement = await this.page.evaluate(() => {
        const activeElement = document.activeElement;
        return activeElement ? {
          tagName: activeElement.tagName,
          className: activeElement.className,
          id: activeElement.id
        } : null;
      });
      
      if (focusedElement) {
        console.log(`🎯 Focused element:`, focusedElement);
        this.testResults.accessibilityTests.push({
          test: 'keyboard_navigation',
          result: 'working',
          focusedElement
        });
      } else {
        console.log('⚠️  No element received focus');
        this.testResults.accessibilityTests.push({
          test: 'keyboard_navigation',
          result: 'no_focus',
          focusedElement: null
        });
      }
      
      // Test ARIA labels and roles
      console.log('🏷️  Testing ARIA labels and accessibility attributes...');
      
      const ariaElements = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('[aria-label], [aria-labelledby], [role]');
        return Array.from(elements).map(el => ({
          tagName: el.tagName,
          ariaLabel: el.getAttribute('aria-label'),
          ariaLabelledby: el.getAttribute('aria-labelledby'),
          role: el.getAttribute('role'),
          className: el.className
        }));
      });
      
      console.log(`🏷️  Found ${ariaElements.length} elements with accessibility attributes`);
      ariaElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName}: ${JSON.stringify(el)}`);
      });
      
      this.testResults.accessibilityTests.push({
        test: 'aria_attributes',
        elementCount: ariaElements.length,
        elements: ariaElements
      });
      
      // Test heading structure
      const headings = await this.page.evaluate(() => {
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        return Array.from(headingElements).map(el => ({
          level: el.tagName,
          text: el.textContent?.substring(0, 50) || '',
          visible: el.offsetParent !== null
        }));
      });
      
      console.log(`📑 Found ${headings.length} heading elements`);
      this.assert(headings.length > 0, 'Page should have proper heading structure');
      
      this.testResults.accessibilityTests.push({
        test: 'heading_structure',
        headingCount: headings.length,
        headings
      });
      
      await this.takeScreenshot('08_accessibility_testing');
      
      console.log('✅ Accessibility tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Accessibility test failed:', error.message);
      this.testResults.errors.push(`Accessibility test failed: ${error.message}`);
      return false;
    }
  }

  async testElementVisibility(element, elementName) {
    try {
      const isVisible = await element.isVisible();
      const boundingBox = await element.boundingBox();
      
      if (isVisible && boundingBox) {
        this.assert(boundingBox.width > 0 && boundingBox.height > 0, 
          `${elementName} should have non-zero dimensions`);
        
        console.log(`✅ ${elementName}: visible (${boundingBox.width}x${boundingBox.height})`);
        return true;
      } else {
        this.assert(false, `${elementName} should be visible`);
        return false;
      }
    } catch (error) {
      console.log(`❌ Failed to test ${elementName}: ${error.message}`);
      this.testResults.errors.push(`${elementName} visibility test failed: ${error.message}`);
      return false;
    }
  }

  // Helper methods
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
    const screenshotPath = `test_results/golden_test_4_${name}.png`;
    
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
    console.log('🧪 Starting Golden Test 4: Text Visibility and Readability');
    console.log('=' * 60);
    
    try {
      await this.initialize();
      
      const loaded = await this.loadApplicationAndPDF();
      if (!loaded) {
        throw new Error('Failed to load application/PDF');
      }
      
      await this.testBasicTextVisibility();
      await this.testTextContrast();
      await this.testTextSelectionAndInteraction();
      await this.testVisibilityAfterTransposition();
      await this.testResponsiveVisibility();
      await this.testAccessibilityFeatures();
      
    } catch (error) {
      console.error('🚨 Test suite error:', error.message);
      this.testResults.errors.push(`Suite error: ${error.message}`);
    }
  }

  async generateReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    
    const report = {
      testSuite: 'Golden Test 4: Text Visibility and Readability',
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
      visibilityAnalysis: {
        totalVisibilityTests: this.testResults.visibilityTests.length,
        accessibilityTests: this.testResults.accessibilityTests.length,
        responsiveViewports: this.testResults.visibilityTests.filter(t => t.viewport).length
      }
    };
    
    // Save report
    const reportPath = 'test_results/golden_test_4_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' * 40);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    
    console.log(`\n👁️  VISIBILITY ANALYSIS:`);
    console.log(`Visibility Tests: ${report.visibilityAnalysis.totalVisibilityTests}`);
    console.log(`Accessibility Tests: ${report.visibilityAnalysis.accessibilityTests}`);
    console.log(`Responsive Viewports: ${report.visibilityAnalysis.responsiveViewports}`);
    
    console.log(`📄 Report saved: ${reportPath}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS ENCOUNTERED:');
      this.testResults.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (this.testResults.details.length > 0) {
      console.log('\n📋 TEST DETAILS:');
      this.testResults.details.forEach(detail => console.log(`  - ${detail}`));
    }
    
    // Show visibility test results
    if (this.testResults.visibilityTests.length > 0) {
      console.log('\n🔍 VISIBILITY TEST RESULTS:');
      this.testResults.visibilityTests.forEach(test => {
        if (test.songTitle) {
          console.log(`  Song: ${test.songTitle} (${test.contentLength} chars, ${test.chordCount} chords)`);
        } else if (test.viewport) {
          console.log(`  ${test.viewport}: ${test.contentVisible ? '✅' : '❌'} visible, size: ${test.contentSize}`);
        }
      });
    }
    
    // Show accessibility test results
    if (this.testResults.accessibilityTests.length > 0) {
      console.log('\n♿ ACCESSIBILITY TEST RESULTS:');
      this.testResults.accessibilityTests.forEach(test => {
        console.log(`  ${test.test}: ${test.result || 'completed'}`);
        if (test.elementCount !== undefined) {
          console.log(`    Elements found: ${test.elementCount}`);
        }
      });
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
  const tester = new VisibilityTester();
  
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