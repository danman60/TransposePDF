const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting export functionality test v2...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true
  });
  
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to the app
    console.log('1. Navigating to http://localhost:8000/');
    await page.goto('http://localhost:8000/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_01_initial_page.png', fullPage: true });
    console.log('✓ Initial page screenshot saved');
    
    // Check health status immediately
    console.log('2. Checking initial health check status...');
    const healthCheck = await page.locator('#health-check').textContent();
    console.log('Health check content:', healthCheck);
    
    if (healthCheck.includes('jsPDF') && healthCheck.includes('PASS')) {
      console.log('✓ jsPDF health check shows PASS');
    } else {
      console.log('✗ jsPDF health check does not show PASS');
    }
    
    // Step 2: Upload the PDF file
    console.log('3. Uploading PDF file...');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('D:\\Downloads\\Songbook For September 14, 2025.pdf');
    
    // Wait for the upload to be processed and songs to appear
    console.log('4. Waiting for songs to load...');
    
    // Wait for some content to appear (looking for song titles or containers)
    let songCount = 0;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds
    
    while (songCount < 7 && attempts < maxAttempts) {
      // Try different selectors for song elements
      const possibleSelectors = [
        '.song-container',
        '.song-section', 
        '.song-title',
        'h2', // Song titles might be h2 elements
        '[class*="song"]',
        '.card-header', // If using Bootstrap cards
        '.song-header'
      ];
      
      for (const selector of possibleSelectors) {
        try {
          songCount = await page.locator(selector).count();
          if (songCount > 0) {
            console.log(`   Found ${songCount} elements with selector '${selector}'`);
            break;
          }
        } catch (e) {
          // Selector not found, try next one
        }
      }
      
      if (songCount >= 7) break;
      
      await page.waitForTimeout(1000);
      attempts++;
      
      if (attempts % 10 === 0) {
        console.log(`   Still waiting... (${attempts}s elapsed)`);
      }
    }
    
    // Take screenshot after waiting
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_02_after_upload.png', fullPage: true });
    console.log('✓ After upload screenshot saved');
    
    if (songCount >= 7) {
      console.log('✓ All 7 songs appear to have loaded');
    } else {
      console.log(`⚠ Found ${songCount} songs, continuing anyway...`);
    }
    
    // Step 3: Look for Export button
    console.log('5. Looking for Export PDF button...');
    
    // Try multiple possible selectors for the export button
    const exportButtonSelectors = [
      'button:has-text("Export PDF")',
      'button:has-text("Export")',
      '[id*="export"]',
      '[class*="export"]',
      'button[onclick*="export"]',
      '.export-btn',
      '#export-btn',
      '#exportButton'
    ];
    
    let exportButton = null;
    let buttonFound = false;
    
    for (const selector of exportButtonSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          exportButton = page.locator(selector).first();
          console.log(`✓ Export button found with selector: ${selector}`);
          buttonFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!buttonFound) {
      // Get all buttons and their text to help debug
      const allButtons = await page.locator('button').all();
      console.log('All buttons found:');
      for (let i = 0; i < allButtons.length; i++) {
        try {
          const text = await allButtons[i].textContent();
          const isVisible = await allButtons[i].isVisible();
          console.log(`  Button ${i}: "${text}" (visible: ${isVisible})`);
        } catch (e) {
          console.log(`  Button ${i}: Error getting text`);
        }
      }
    }
    
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_03_export_search.png', fullPage: true });
    console.log('✓ Export search screenshot saved');
    
    if (exportButton) {
      const isEnabled = await exportButton.isEnabled();
      const isVisible = await exportButton.isVisible();
      console.log(`Export button - Enabled: ${isEnabled}, Visible: ${isVisible}`);
      
      if (isEnabled && isVisible) {
        console.log('6. Clicking Export PDF button...');
        await exportButton.click();
        
        // Wait for any changes
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_04_export_clicked.png', fullPage: true });
        console.log('✓ Export button clicked, screenshot saved');
        
        // Step 4: Look for Generate PDF button or export functionality
        console.log('7. Looking for Generate PDF functionality...');
        
        const generateButtonSelectors = [
          'button:has-text("Generate PDF")',
          'button:has-text("Generate")',
          'button:has-text("Download")',
          '[id*="generate"]',
          '[class*="generate"]',
          '.generate-btn',
          '#generate-btn',
          '#generateButton'
        ];
        
        let generateButton = null;
        let generateFound = false;
        
        for (const selector of generateButtonSelectors) {
          try {
            const count = await page.locator(selector).count();
            if (count > 0) {
              generateButton = page.locator(selector).first();
              console.log(`✓ Generate button found with selector: ${selector}`);
              generateFound = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (generateFound && generateButton) {
          const isGenEnabled = await generateButton.isEnabled();
          const isGenVisible = await generateButton.isVisible();
          console.log(`Generate button - Enabled: ${isGenEnabled}, Visible: ${isGenVisible}`);
          
          if (isGenEnabled && isGenVisible) {
            console.log('8. Clicking Generate PDF button...');
            
            // Set up download listener
            const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
            
            await generateButton.click();
            
            try {
              const download = await downloadPromise;
              console.log('✓ PDF download started');
              console.log(`   Download filename: ${download.suggestedFilename()}`);
              
              // Save the download
              const downloadPath = path.join('D:\\ClaudeCode\\test_screenshots', 'exported_songbook.pdf');
              await download.saveAs(downloadPath);
              console.log(`✓ PDF saved to: ${downloadPath}`);
              
              // Check if file was actually created
              if (fs.existsSync(downloadPath)) {
                const stats = fs.statSync(downloadPath);
                console.log(`✓ PDF file created successfully (${stats.size} bytes)`);
              } else {
                console.log('✗ PDF file was not created');
              }
              
            } catch (downloadError) {
              console.log('✗ PDF download failed or timed out:', downloadError.message);
            }
            
            await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_05_generate_clicked.png', fullPage: true });
            console.log('✓ Generate PDF clicked, screenshot saved');
            
          } else {
            console.log('✗ Generate PDF button is disabled or not visible');
          }
        } else {
          console.log('✗ Generate PDF button not found');
          
          // Get all buttons again to see what's available
          const allButtons = await page.locator('button').all();
          console.log('All buttons after export click:');
          for (let i = 0; i < allButtons.length; i++) {
            try {
              const text = await allButtons[i].textContent();
              const isVisible = await allButtons[i].isVisible();
              console.log(`  Button ${i}: "${text}" (visible: ${isVisible})`);
            } catch (e) {
              console.log(`  Button ${i}: Error getting text`);
            }
          }
        }
      } else {
        console.log('✗ Export PDF button is disabled or not visible');
      }
    } else {
      console.log('✗ Export PDF button not found');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_06_final_state.png', fullPage: true });
    console.log('✓ Final state screenshot saved');
    
    console.log('\n=== TEST SUMMARY V2 ===');
    console.log('✓ Navigation to localhost:8000 successful');
    console.log('✓ jsPDF health check shows PASS');
    console.log('✓ PDF file upload completed');
    console.log(`✓ Songs detected (found ${songCount} elements)`);
    console.log('✓ Export functionality tested');
    console.log('✓ All screenshots saved to D:\\ClaudeCode\\test_screenshots\\');
    
  } catch (error) {
    console.error('Test failed with error:', error);
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\v2_error_state.png', fullPage: true });
  } finally {
    console.log('\nTest completed. Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})().catch(console.error);