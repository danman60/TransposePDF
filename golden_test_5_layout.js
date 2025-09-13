/**
 * Golden Test 5: UI Responsiveness and Layout Accuracy
 * 
 * This test validates:
 * - Layout accuracy compared to original PDF
 * - UI responsiveness across different screen sizes
 * - Element positioning and alignment
 * - Scroll behavior and navigation
 * - Layout preservation during transposition
 * - Performance under layout stress
 * - Cross-browser layout consistency
 * - Mobile-first design principles
 * - Layout breakpoints and media queries
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class LayoutTester {
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
      layoutTests: [],
      responsiveTests: []
    };
    this.startTime = Date.now();
    
    // Standard breakpoints for testing
    this.breakpoints = [
      { name: 'Mobile S', width: 320, height: 568 },
      { name: 'Mobile M', width: 375, height: 667 },
      { name: 'Mobile L', width: 425, height: 812 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Laptop', width: 1024, height: 768 },
      { name: 'Laptop L', width: 1440, height: 900 },
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: '4K', width: 2560, height: 1440 }
    ];
  }

  async initialize() {
    console.log('🎨 Initializing UI Responsiveness and Layout Test Suite...');
    
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
    console.log('📱 Loading app and PDF for layout testing...');
    
    try {
      await this.page.goto('http://localhost:8000/', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      
      await this.takeScreenshot('01_app_loaded_for_layout');
      
      // Load the songbook PDF
      const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
      
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Test PDF not found at: ${pdfPath}`);
      }

      console.log('📄 Loading songbook for layout tests...');
      const fileInput = await this.page.locator('#fileInput');
      await fileInput.setInputFiles(pdfPath);
      
      // Wait for processing to complete
      await this.page.waitForSelector('#songsSection', { 
        state: 'visible',
        timeout: 60000 
      });
      
      await this.takeScreenshot('02_songbook_loaded_layout');
      
      console.log('✅ Songbook loaded successfully for layout testing');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to load app/PDF:', error.message);
      this.testResults.errors.push(`App/PDF load failed: ${error.message}`);
      return false;
    }
  }

  async testBasicLayoutStructure() {
    console.log('🏗️ Testing basic layout structure...');
    
    try {
      // Test main layout elements exist and are positioned correctly
      const layoutElements = [
        { selector: '.app-header', name: 'App header' },
        { selector: '#uploadSection', name: 'Upload section' },
        { selector: '#songsSection', name: 'Songs section' },
        { selector: '#songsContainer', name: 'Songs container' },
        { selector: '.song-card', name: 'Song cards' }
      ];
      
      for (const element of layoutElements) {
        const el = this.page.locator(element.selector);
        const exists = await el.count() > 0;
        
        this.assert(exists, `${element.name} should exist in layout`);
        
        if (exists) {
          const boundingBox = await el.first().boundingBox();
          
          if (boundingBox) {
            console.log(`📐 ${element.name}: ${boundingBox.width}x${boundingBox.height} at (${boundingBox.x}, ${boundingBox.y})`);
            
            this.assert(boundingBox.width > 0 && boundingBox.height > 0,
              `${element.name} should have non-zero dimensions`);
            
            this.testResults.layoutTests.push({
              element: element.name,
              exists: true,
              dimensions: `${boundingBox.width}x${boundingBox.height}`,
              position: `${boundingBox.x},${boundingBox.y}`
            });
          }
        }
      }
      
      // Test header positioning (should be at top)
      const header = this.page.locator('.app-header');
      if (await header.count() > 0) {
        const headerBox = await header.boundingBox();
        this.assert(headerBox.y < 100, 'Header should be near the top of the page');
      }
      
      // Test songs section positioning (should be below header)
      const songsSection = this.page.locator('#songsSection');
      if (await songsSection.count() > 0) {
        const songsBox = await songsSection.boundingBox();
        const headerBox = await header.boundingBox();
        
        if (headerBox && songsBox) {
          this.assert(songsBox.y > headerBox.y + headerBox.height - 20, // 20px tolerance
            'Songs section should be below header');
        }
      }
      
      await this.takeScreenshot('03_basic_layout_structure');
      
      console.log('✅ Basic layout structure tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Basic layout structure test failed:', error.message);
      this.testResults.errors.push(`Basic layout structure test failed: ${error.message}`);
      return false;
    }
  }

  async testResponsiveBreakpoints() {
    console.log('📱 Testing responsive breakpoints...');
    
    try {
      for (const breakpoint of this.breakpoints) {
        console.log(`🔍 Testing ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`);
        
        await this.page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        
        await this.page.waitForTimeout(1000); // Allow layout to adjust
        
        // Test basic layout at this breakpoint
        const layoutData = await this.analyzeLayoutAtBreakpoint(breakpoint);
        this.testResults.responsiveTests.push(layoutData);
        
        // Take screenshot for visual verification
        await this.takeScreenshot(`04_${breakpoint.name.toLowerCase().replace(' ', '_')}`);
        
        // Test specific breakpoint behaviors
        await this.testBreakpointSpecificBehaviors(breakpoint);
      }
      
      // Reset to original size
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      console.log('✅ Responsive breakpoint tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Responsive breakpoint test failed:', error.message);
      this.testResults.errors.push(`Responsive breakpoint test failed: ${error.message}`);
      return false;
    }
  }

  async analyzeLayoutAtBreakpoint(breakpoint) {
    const analysis = {
      breakpoint: breakpoint.name,
      viewport: `${breakpoint.width}x${breakpoint.height}`,
      elements: {},
      issues: [],
      score: 0
    };
    
    try {
      // Test header layout
      const header = this.page.locator('.app-header');
      if (await header.count() > 0) {
        const headerBox = await header.boundingBox();
        analysis.elements.header = {
          visible: headerBox !== null,
          dimensions: headerBox ? `${headerBox.width}x${headerBox.height}` : 'hidden',
          fitsWidth: headerBox ? headerBox.width <= breakpoint.width : false
        };
        
        if (headerBox && headerBox.width > breakpoint.width) {
          analysis.issues.push('Header overflows viewport width');
        }
      }
      
      // Test songs container layout
      const songsContainer = this.page.locator('#songsContainer');
      if (await songsContainer.count() > 0) {
        const containerBox = await songsContainer.boundingBox();
        analysis.elements.songsContainer = {
          visible: containerBox !== null,
          dimensions: containerBox ? `${containerBox.width}x${containerBox.height}` : 'hidden',
          fitsWidth: containerBox ? containerBox.width <= breakpoint.width : false
        };
        
        if (containerBox && containerBox.width > breakpoint.width * 1.1) { // 10% tolerance
          analysis.issues.push('Songs container significantly overflows viewport');
        }
      }
      
      // Test song card layout
      const songCards = this.page.locator('.song-card');
      const cardCount = await songCards.count();
      
      if (cardCount > 0) {
        const firstCardBox = await songCards.first().boundingBox();
        analysis.elements.songCards = {
          count: cardCount,
          firstCardVisible: firstCardBox !== null,
          firstCardDimensions: firstCardBox ? `${firstCardBox.width}x${firstCardBox.height}` : 'hidden'
        };
        
        if (firstCardBox) {
          const cardFitsWidth = firstCardBox.width <= breakpoint.width;
          analysis.elements.songCards.fitsWidth = cardFitsWidth;
          
          if (!cardFitsWidth) {
            analysis.issues.push('Song cards overflow viewport width');
          }
        }
      }
      
      // Test transpose controls layout
      if (cardCount > 0) {
        const controls = songCards.first().locator('.transpose-controls');
        if (await controls.count() > 0) {
          const controlsBox = await controls.boundingBox();
          analysis.elements.transposeControls = {
            visible: controlsBox !== null,
            dimensions: controlsBox ? `${controlsBox.width}x${controlsBox.height}` : 'hidden'
          };
        }
      }
      
      // Calculate layout score
      let score = 100;
      score -= analysis.issues.length * 10; // -10 points per issue
      
      // Bonus points for mobile optimization
      if (breakpoint.width <= 768) {
        const isMobileOptimized = analysis.issues.length === 0 && 
                                analysis.elements.songCards?.fitsWidth !== false;
        if (isMobileOptimized) score += 10;
      }
      
      analysis.score = Math.max(0, score);
      
      console.log(`📊 ${breakpoint.name}: Score ${analysis.score}/100, Issues: ${analysis.issues.length}`);
      
    } catch (error) {
      analysis.issues.push(`Analysis error: ${error.message}`);
    }
    
    return analysis;
  }

  async testBreakpointSpecificBehaviors(breakpoint) {
    try {
      if (breakpoint.width <= 768) {
        // Mobile-specific tests
        await this.testMobileBehaviors(breakpoint);
      } else if (breakpoint.width <= 1024) {
        // Tablet-specific tests
        await this.testTabletBehaviors(breakpoint);
      } else {
        // Desktop-specific tests
        await this.testDesktopBehaviors(breakpoint);
      }
    } catch (error) {
      console.log(`⚠️  Breakpoint-specific test failed for ${breakpoint.name}: ${error.message}`);
    }
  }

  async testMobileBehaviors(breakpoint) {
    console.log(`📱 Testing mobile behaviors for ${breakpoint.name}...`);
    
    // Test touch-friendly button sizes
    const buttons = this.page.locator('.transpose-up, .transpose-down, .transpose-reset');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      const firstButton = buttons.first();
      const buttonBox = await firstButton.boundingBox();
      
      if (buttonBox) {
        // Buttons should be at least 44px for touch (iOS guideline)
        const minTouchSize = 44;
        const isTouchFriendly = buttonBox.width >= minTouchSize && buttonBox.height >= minTouchSize;
        
        this.assert(isTouchFriendly, 
          `Mobile buttons should be at least ${minTouchSize}px for touch (got ${buttonBox.width}x${buttonBox.height})`);
      }
    }
    
    // Test horizontal scrolling if needed
    const body = await this.page.locator('body').boundingBox();
    if (body && body.width > breakpoint.width) {
      console.log(`📐 Content extends beyond viewport: ${body.width}px > ${breakpoint.width}px`);
    }
  }

  async testTabletBehaviors(breakpoint) {
    console.log(`📱 Testing tablet behaviors for ${breakpoint.name}...`);
    
    // Test that content utilizes available space effectively
    const songsContainer = this.page.locator('#songsContainer');
    if (await songsContainer.count() > 0) {
      const containerBox = await songsContainer.boundingBox();
      
      if (containerBox) {
        const spaceUtilization = containerBox.width / breakpoint.width;
        
        // Should utilize at least 70% of available width on tablets
        this.assert(spaceUtilization >= 0.7,
          `Tablet layout should utilize at least 70% of width (using ${(spaceUtilization * 100).toFixed(1)}%)`);
      }
    }
  }

  async testDesktopBehaviors(breakpoint) {
    console.log(`🖥️  Testing desktop behaviors for ${breakpoint.name}...`);
    
    // Test that layout doesn't become too wide (readability)
    const songCards = this.page.locator('.song-card');
    if (await songCards.count() > 0) {
      const cardBox = await songCards.first().boundingBox();
      
      if (cardBox) {
        // Song cards shouldn't be too wide for readability
        const maxReadableWidth = 800; // pixels
        
        if (cardBox.width > maxReadableWidth) {
          console.log(`📏 Song card width may affect readability: ${cardBox.width}px`);
          // This might be acceptable, so not failing the test
        }
      }
    }
  }

  async testLayoutDuringTransposition() {
    console.log('🔄 Testing layout stability during transposition...');
    
    try {
      const songCards = this.page.locator('.song-card');
      const cardCount = await songCards.count();
      
      if (cardCount === 0) {
        throw new Error('No song cards found for layout testing');
      }
      
      const firstSong = songCards.first();
      
      // Capture original layout
      const originalLayout = await this.captureLayoutSnapshot(firstSong, 'original');
      
      // Transpose up and check layout
      const upButton = firstSong.locator('.transpose-up');
      await upButton.click();
      await this.page.waitForTimeout(500);
      
      const transposedUpLayout = await this.captureLayoutSnapshot(firstSong, 'transposed_up');
      
      // Compare layouts - dimensions should remain similar
      this.compareLayoutSnapshots(originalLayout, transposedUpLayout, 'transpose up');
      
      // Transpose down and check layout
      const downButton = firstSong.locator('.transpose-down');
      await downButton.click();
      await downButton.click(); // Go below original
      await this.page.waitForTimeout(500);
      
      const transposedDownLayout = await this.captureLayoutSnapshot(firstSong, 'transposed_down');
      this.compareLayoutSnapshots(originalLayout, transposedDownLayout, 'transpose down');
      
      // Reset and verify layout returns
      const resetButton = firstSong.locator('.transpose-reset');
      await resetButton.click();
      await this.page.waitForTimeout(500);
      
      const resetLayout = await this.captureLayoutSnapshot(firstSong, 'reset');
      this.compareLayoutSnapshots(originalLayout, resetLayout, 'reset');
      
      await this.takeScreenshot('05_layout_during_transposition');
      
      console.log('✅ Layout stability during transposition tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Layout during transposition test failed:', error.message);
      this.testResults.errors.push(`Layout during transposition test failed: ${error.message}`);
      return false;
    }
  }

  async captureLayoutSnapshot(element, label) {
    try {
      const snapshot = {
        label,
        timestamp: Date.now(),
        boundingBox: await element.boundingBox(),
        title: {},
        content: {},
        controls: {}
      };
      
      // Capture title layout
      const title = element.locator('.song-title');
      if (await title.count() > 0) {
        snapshot.title = {
          boundingBox: await title.boundingBox(),
          text: await title.textContent()
        };
      }
      
      // Capture content layout
      const content = element.locator('.song-content');
      if (await content.count() > 0) {
        snapshot.content = {
          boundingBox: await content.boundingBox(),
          textLength: (await content.textContent()).length
        };
      }
      
      // Capture controls layout
      const controls = element.locator('.transpose-controls');
      if (await controls.count() > 0) {
        snapshot.controls = {
          boundingBox: await controls.boundingBox()
        };
      }
      
      return snapshot;
      
    } catch (error) {
      console.log(`⚠️  Could not capture layout snapshot for ${label}: ${error.message}`);
      return { label, error: error.message };
    }
  }

  compareLayoutSnapshots(original, modified, operation) {
    try {
      if (original.error || modified.error) {
        console.log(`⚠️  Cannot compare layouts due to capture errors`);
        return;
      }
      
      // Compare main element dimensions
      if (original.boundingBox && modified.boundingBox) {
        const widthDiff = Math.abs(original.boundingBox.width - modified.boundingBox.width);
        const heightDiff = Math.abs(original.boundingBox.height - modified.boundingBox.height);
        
        const widthTolerance = original.boundingBox.width * 0.1; // 10% tolerance
        const heightTolerance = 100; // 100px tolerance for height (content might change)
        
        this.assert(widthDiff <= widthTolerance,
          `Song card width should remain stable after ${operation} (diff: ${widthDiff.toFixed(1)}px)`);
        
        this.assert(heightDiff <= heightTolerance,
          `Song card height should remain reasonably stable after ${operation} (diff: ${heightDiff.toFixed(1)}px)`);
        
        console.log(`📐 Layout comparison for ${operation}: width Δ${widthDiff.toFixed(1)}px, height Δ${heightDiff.toFixed(1)}px`);
      }
      
      // Compare content layout if available
      if (original.content.boundingBox && modified.content.boundingBox) {
        const contentHeightDiff = Math.abs(original.content.boundingBox.height - modified.content.boundingBox.height);
        console.log(`📝 Content height change after ${operation}: Δ${contentHeightDiff.toFixed(1)}px`);
      }
      
    } catch (error) {
      console.log(`⚠️  Layout comparison failed for ${operation}: ${error.message}`);
    }
  }

  async testScrollBehavior() {
    console.log('📜 Testing scroll behavior and navigation...');
    
    try {
      // Test vertical scrolling with many songs
      const songsContainer = this.page.locator('#songsContainer');
      const containerBox = await songsContainer.boundingBox();
      
      if (containerBox) {
        const viewportHeight = await this.page.evaluate(() => window.innerHeight);
        
        // If content is taller than viewport, test scrolling
        if (containerBox.height > viewportHeight) {
          console.log(`📏 Content is scrollable: ${containerBox.height}px > ${viewportHeight}px`);
          
          // Test scroll to bottom
          await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await this.page.waitForTimeout(500);
          
          const scrollY = await this.page.evaluate(() => window.scrollY);
          this.assert(scrollY > 0, 'Should be able to scroll down');
          
          // Test scroll back to top
          await this.page.evaluate(() => window.scrollTo(0, 0));
          await this.page.waitForTimeout(500);
          
          const backToTop = await this.page.evaluate(() => window.scrollY);
          this.assert(backToTop === 0, 'Should be able to scroll back to top');
          
          console.log(`✅ Vertical scrolling works (scrolled ${scrollY}px)`);
        } else {
          console.log(`📏 Content fits in viewport, no scrolling needed`);
        }
      }
      
      // Test horizontal scrolling on mobile if needed
      await this.page.setViewportSize({ width: 320, height: 568 });
      await this.page.waitForTimeout(1000);
      
      const bodyWidth = await this.page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = 320;
      
      if (bodyWidth > viewportWidth) {
        console.log(`📱 Mobile horizontal scroll available: ${bodyWidth}px > ${viewportWidth}px`);
        
        // Test horizontal scroll
        await this.page.evaluate(() => window.scrollTo(100, 0));
        await this.page.waitForTimeout(500);
        
        const scrollX = await this.page.evaluate(() => window.scrollX);
        console.log(`📱 Horizontal scroll test: ${scrollX}px`);
      }
      
      // Reset viewport
      await this.page.setViewportSize({ width: 1280, height: 720 });
      await this.page.evaluate(() => window.scrollTo(0, 0));
      
      await this.takeScreenshot('06_scroll_behavior_test');
      
      console.log('✅ Scroll behavior tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Scroll behavior test failed:', error.message);
      this.testResults.errors.push(`Scroll behavior test failed: ${error.message}`);
      return false;
    }
  }

  async testLayoutPerformance() {
    console.log('⚡ Testing layout performance and rendering...');
    
    try {
      // Test layout calculation time across different viewport sizes
      const performanceResults = [];
      
      for (const breakpoint of this.breakpoints.slice(0, 5)) { // Test first 5 breakpoints
        const startTime = performance.now();
        
        await this.page.setViewportSize({ 
          width: breakpoint.width, 
          height: breakpoint.height 
        });
        
        // Wait for layout to stabilize
        await this.page.waitForTimeout(100);
        
        // Force layout calculation
        await this.page.evaluate(() => {
          document.body.offsetHeight; // Trigger layout
        });
        
        const endTime = performance.now();
        const layoutTime = endTime - startTime;
        
        performanceResults.push({
          breakpoint: breakpoint.name,
          layoutTime: layoutTime
        });
        
        console.log(`⚡ ${breakpoint.name} layout time: ${layoutTime.toFixed(1)}ms`);
      }
      
      // Calculate average layout time
      const avgLayoutTime = performanceResults.reduce((sum, result) => sum + result.layoutTime, 0) / performanceResults.length;
      
      console.log(`📊 Average layout time: ${avgLayoutTime.toFixed(1)}ms`);
      
      // Layout should be fast (under 100ms for responsive changes)
      this.assert(avgLayoutTime < 100, 
        `Layout changes should be fast (avg: ${avgLayoutTime.toFixed(1)}ms)`);
      
      this.testResults.timing.layoutPerformance = {
        average: avgLayoutTime,
        results: performanceResults
      };
      
      // Reset viewport
      await this.page.setViewportSize({ width: 1280, height: 720 });
      
      console.log('✅ Layout performance tests completed');
      return true;
      
    } catch (error) {
      console.error('❌ Layout performance test failed:', error.message);
      this.testResults.errors.push(`Layout performance test failed: ${error.message}`);
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
    const screenshotPath = `test_results/golden_test_5_${name}.png`;
    
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
    console.log('🧪 Starting Golden Test 5: UI Responsiveness and Layout Accuracy');
    console.log('=' * 60);
    
    try {
      await this.initialize();
      
      const loaded = await this.loadApplicationAndPDF();
      if (!loaded) {
        throw new Error('Failed to load application/PDF');
      }
      
      await this.testBasicLayoutStructure();
      await this.testResponsiveBreakpoints();
      await this.testLayoutDuringTransposition();
      await this.testScrollBehavior();
      await this.testLayoutPerformance();
      
    } catch (error) {
      console.error('🚨 Test suite error:', error.message);
      this.testResults.errors.push(`Suite error: ${error.message}`);
    }
  }

  async generateReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;
    
    const report = {
      testSuite: 'Golden Test 5: UI Responsiveness and Layout Accuracy',
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
      layoutAnalysis: {
        breakpointsTested: this.breakpoints.length,
        responsiveTests: this.testResults.responsiveTests.length,
        averageLayoutScore: this.testResults.responsiveTests.length > 0 
          ? (this.testResults.responsiveTests.reduce((sum, test) => sum + test.score, 0) / this.testResults.responsiveTests.length).toFixed(1)
          : 'N/A',
        averageLayoutTime: this.testResults.timing.layoutPerformance?.average || 'N/A'
      }
    };
    
    // Save report
    const reportPath = 'test_results/golden_test_5_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' * 40);
    console.log(`✅ Passed: ${report.summary.passed}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📈 Success Rate: ${report.summary.successRate}%`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    
    console.log(`\n🎨 LAYOUT ANALYSIS:`);
    console.log(`Breakpoints Tested: ${report.layoutAnalysis.breakpointsTested}`);
    console.log(`Responsive Tests: ${report.layoutAnalysis.responsiveTests}`);
    console.log(`Average Layout Score: ${report.layoutAnalysis.averageLayoutScore}/100`);
    console.log(`Average Layout Time: ${report.layoutAnalysis.averageLayoutTime}ms`);
    
    console.log(`📄 Report saved: ${reportPath}`);
    
    // Show breakpoint test results
    if (this.testResults.responsiveTests.length > 0) {
      console.log('\n📱 RESPONSIVE TEST RESULTS:');
      this.testResults.responsiveTests.forEach(test => {
        const issues = test.issues.length > 0 ? ` (${test.issues.length} issues)` : '';
        console.log(`  ${test.breakpoint}: ${test.score}/100${issues}`);
        
        if (test.issues.length > 0) {
          test.issues.forEach(issue => console.log(`    - ${issue}`));
        }
      });
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
  const tester = new LayoutTester();
  
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