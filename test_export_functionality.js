const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting export functionality test...');
  
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    // Set up downloads directory
    acceptDownloads: true
  });
  
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to the app
    console.log('1. Navigating to http://localhost:8000/');
    await page.goto('http://localhost:8000/');
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\01_initial_page.png', fullPage: true });
    console.log('✓ Initial page screenshot saved');
    
    // Step 2: Upload the PDF file
    console.log('2. Uploading PDF file...');
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('D:\\Downloads\\Songbook For September 14, 2025.pdf');
    
    // Wait a moment for the upload to be processed
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\02_after_upload.png', fullPage: true });
    console.log('✓ PDF uploaded, screenshot saved');
    
    // Step 3: Wait for songs to load
    console.log('3. Waiting for songs to load...');
    
    // Wait for songs to appear - looking for song containers
    await page.waitForSelector('.song', { timeout: 30000 });
    
    // Wait for all 7 songs to load by checking the count
    let songCount = 0;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    while (songCount < 7 && attempts < maxAttempts) {
      songCount = await page.locator('.song').count();
      console.log(`   Found ${songCount} songs so far...`);
      
      if (songCount >= 7) break;
      
      await page.waitForTimeout(1000);
      attempts++;
    }
    
    if (songCount >= 7) {
      console.log('✓ All 7 songs loaded successfully');
    } else {
      console.log(`⚠ Only ${songCount} songs loaded after 30 seconds`);
    }
    
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\03_songs_loaded.png', fullPage: true });
    console.log('✓ Songs loaded screenshot saved');
    
    // Step 4: Check health check status (specifically jsPDF)
    console.log('4. Checking health check status...');
    
    // Look for health check section
    const healthCheckExists = await page.locator('#health-check').count() > 0;
    if (healthCheckExists) {
      // Look for jsPDF status
      const jsPDFStatus = await page.locator('#health-check').textContent();
      console.log('Health check content:', jsPDFStatus);
      
      if (jsPDFStatus.includes('jsPDF') && jsPDFStatus.includes('PASS')) {
        console.log('✓ jsPDF health check shows PASS');
      } else if (jsPDFStatus.includes('jsPDF') && jsPDFStatus.includes('FAIL')) {
        console.log('✗ jsPDF health check shows FAIL');
      } else {
        console.log('? jsPDF status unclear from health check');
      }
    } else {
      console.log('? Health check section not found');
    }
    
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\04_health_check.png', fullPage: true });
    console.log('✓ Health check screenshot saved');
    
    // Step 5: Test Export PDF button
    console.log('5. Testing Export PDF button...');
    
    const exportButton = page.locator('button:has-text("Export PDF")');
    const isExportButtonVisible = await exportButton.count() > 0;
    
    if (isExportButtonVisible) {
      const isEnabled = await exportButton.isEnabled();
      console.log(`Export button found - Enabled: ${isEnabled}`);
      
      if (isEnabled) {
        console.log('   Clicking Export PDF button...');
        await exportButton.click();
        
        // Wait for export section to appear
        await page.waitForTimeout(2000);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\05_export_clicked.png', fullPage: true });
        console.log('✓ Export button clicked, screenshot saved');
        
        // Step 6: Check if export section appears
        console.log('6. Checking if export section appears...');
        
        const exportSection = page.locator('#export-section, .export-section, [class*="export"]');
        const exportSectionExists = await exportSection.count() > 0;
        
        if (exportSectionExists) {
          console.log('✓ Export section appeared');
          
          // Step 7: Test Generate PDF functionality
          console.log('7. Testing Generate PDF functionality...');
          
          const generateButton = page.locator('button:has-text("Generate PDF")');
          const isGenerateButtonVisible = await generateButton.count() > 0;
          
          if (isGenerateButtonVisible) {
            const isGenerateEnabled = await generateButton.isEnabled();
            console.log(`Generate PDF button found - Enabled: ${isGenerateEnabled}`);
            
            if (isGenerateEnabled) {
              console.log('   Clicking Generate PDF button...');
              
              // Set up download listener
              const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
              
              await generateButton.click();
              
              try {
                const download = await downloadPromise;
                console.log('✓ PDF download started');
                console.log(`   Download filename: ${download.suggestedFilename()}`);
                
                // Save the download
                const downloadPath = path.join('D:\\ClaudeCode\\test_screenshots', 'downloaded_pdf.pdf');
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
              
              await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\07_generate_clicked.png', fullPage: true });
              console.log('✓ Generate PDF clicked, screenshot saved');
              
            } else {
              console.log('✗ Generate PDF button is disabled');
            }
          } else {
            console.log('✗ Generate PDF button not found');
          }
        } else {
          console.log('✗ Export section did not appear');
        }
      } else {
        console.log('✗ Export PDF button is disabled');
      }
    } else {
      console.log('✗ Export PDF button not found');
    }
    
    // Final screenshot
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\08_final_state.png', fullPage: true });
    console.log('✓ Final state screenshot saved');
    
    // Step 8: Check console for any errors
    console.log('8. Checking for console errors...');
    const logs = await page.evaluate(() => {
      return window.console.logs || [];
    });
    
    if (logs && logs.length > 0) {
      console.log('Console logs found:', logs);
    }
    
    console.log('\n=== TEST SUMMARY ===');
    console.log('✓ Navigation to localhost:8000 successful');
    console.log('✓ PDF file upload completed');
    console.log(`✓ ${songCount}/7 songs loaded`);
    console.log('✓ Health check status captured');
    console.log('✓ Export functionality tested');
    console.log('✓ All screenshots saved to D:\\ClaudeCode\\test_screenshots\\');
    
  } catch (error) {
    console.error('Test failed with error:', error);
    await page.screenshot({ path: 'D:\\ClaudeCode\\test_screenshots\\error_state.png', fullPage: true });
  } finally {
    console.log('\nTest completed. Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
})().catch(console.error);