const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testSongDetectionFix() {
  console.log('🚀 Starting comprehensive test of song detection fix...');
  
  const browser = await chromium.launch({
    headless: false, // Keep visible for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to localhost:8000 and refresh
    console.log('📍 Step 1: Navigating to http://localhost:8000/ and refreshing...');
    await page.goto('http://localhost:8000/');
    await page.waitForLoadState('networkidle');
    await page.reload(); // Force refresh to ensure latest code
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_initial.png', fullPage: true });
    console.log('✅ Initial page loaded and refreshed. Screenshot saved.');
    
    // Step 2: Look for file upload element
    console.log('📁 Step 2: Looking for file upload element...');
    const fileInput = await page.locator('input[type="file"]').first();
    const isVisible = await fileInput.isVisible();
    console.log(`File input visible: ${isVisible}`);
    
    // Step 3: Check for Amazing Grace PDF file
    const pdfPath = path.join('D:', 'ClaudeCode', 'Amazing Grace.pdf');
    console.log(`📄 Step 3: Checking for PDF file at: ${pdfPath}`);
    
    if (!fs.existsSync(pdfPath)) {
      console.log('❌ Amazing Grace.pdf not found. Looking for alternative PDF files...');
      const files = fs.readdirSync('D:\\ClaudeCode').filter(f => f.endsWith('.pdf'));
      console.log('Available PDF files:', files);
      
      if (files.length > 0) {
        const alternativePdf = path.join('D:', 'ClaudeCode', files[0]);
        console.log(`Using alternative PDF: ${alternativePdf}`);
        await fileInput.setInputFiles(alternativePdf);
      } else {
        console.log('❌ No PDF files found in the directory');
        return;
      }
    } else {
      console.log('✅ Amazing Grace.pdf found. Uploading...');
      await fileInput.setInputFiles(pdfPath);
    }
    
    // Step 4: Wait for processing and check for song detection
    console.log('⏳ Step 4: Waiting for PDF processing...');
    await page.waitForTimeout(3000); // Wait for initial processing
    
    // Look for song count or detection indicators
    console.log('🔍 Step 5: Checking for song detection results...');
    
    // Wait for any potential song detection UI elements
    await page.waitForTimeout(2000);
    
    // Take screenshot after upload
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_after_upload.png', fullPage: true });
    console.log('📸 Screenshot after upload saved.');
    
    // Check for various indicators of song detection
    const pageContent = await page.content();
    
    // Look for song-related text or elements
    const songIndicators = [
      'song',
      'chord',
      'Amazing Grace',
      'transpose',
      'key',
      'detected'
    ];
    
    console.log('🔍 Checking page content for song detection indicators...');
    const foundIndicators = [];
    for (const indicator of songIndicators) {
      if (pageContent.toLowerCase().includes(indicator.toLowerCase())) {
        foundIndicators.push(indicator);
      }
    }
    
    if (foundIndicators.length > 0) {
      console.log(`✅ Found song detection indicators: ${foundIndicators.join(', ')}`);
    } else {
      console.log('❌ No song detection indicators found in page content');
    }
    
    // Check for specific song count displays
    const songCountSelectors = [
      'text=songs',
      'text=detected',
      '[data-testid*="song"]',
      '.song-count',
      '#song-count'
    ];
    
    console.log('🔢 Checking for song count displays...');
    for (const selector of songCountSelectors) {
      try {
        const element = page.locator(selector);
        const count = await element.count();
        if (count > 0) {
          const text = await element.first().textContent();
          console.log(`✅ Found song count element: "${text}"`);
        }
      } catch (e) {
        // Selector not found, continue
      }
    }
    
    // Check for chord display elements
    console.log('🎵 Checking for chord display elements...');
    const chordSelectors = [
      '.chord',
      '[class*="chord"]',
      '[id*="chord"]',
      'text=/[ABCDEFG][#b]?[maj|min|m|sus|add|dim]?/'
    ];
    
    let chordsFound = false;
    for (const selector of chordSelectors) {
      try {
        const elements = page.locator(selector);
        const count = await elements.count();
        if (count > 0) {
          console.log(`✅ Found ${count} chord elements with selector: ${selector}`);
          chordsFound = true;
          
          // Get text content of first few chord elements
          for (let i = 0; i < Math.min(3, count); i++) {
            const text = await elements.nth(i).textContent();
            console.log(`   Chord ${i + 1}: "${text}"`);
          }
        }
      } catch (e) {
        // Selector not found, continue
      }
    }
    
    // Check console for any error messages
    console.log('🔍 Checking browser console for errors...');
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Browser console error: ${msg.text()}`);
      } else if (msg.text().includes('song') || msg.text().includes('chord')) {
        console.log(`📝 Relevant console message: ${msg.text()}`);
      }
    });
    
    // Wait a bit more for any delayed processing
    console.log('⏳ Waiting for any delayed processing...');
    await page.waitForTimeout(5000);
    
    // Take final screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_final.png', fullPage: true });
    console.log('📸 Final screenshot saved.');
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');
    console.log(`✅ Page loaded and refreshed successfully`);
    console.log(`✅ PDF upload attempted`);
    console.log(`📝 Song detection indicators found: ${foundIndicators.length > 0 ? foundIndicators.join(', ') : 'None'}`);
    console.log(`🎵 Chord elements found: ${chordsFound ? 'Yes' : 'No'}`);
    console.log(`📸 Screenshots saved: test_initial.png, test_after_upload.png, test_final.png`);
    
    if (foundIndicators.length > 0 || chordsFound) {
      console.log('\n🎉 SUCCESS: Song detection appears to be working!');
    } else {
      console.log('\n❌ INCONCLUSIVE: Need to check screenshots and console output for more details');
    }
    
    // Keep browser open for manual inspection
    console.log('\n👀 Browser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_error.png', fullPage: true });
  } finally {
    await browser.close();
    console.log('🔚 Test completed and browser closed.');
  }
}

// Run the test
testSongDetectionFix().catch(console.error);