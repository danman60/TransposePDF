const { chromium } = require('playwright');
const path = require('path');

async function takeAppScreenshot() {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    console.log('Navigating to http://localhost:8000/...');
    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
    
    // Take initial screenshot of the app
    console.log('Taking initial screenshot...');
    await page.screenshot({ 
      path: 'app_initial_state.png', 
      fullPage: true 
    });
    console.log('Initial screenshot saved as app_initial_state.png');
    
    // Look for file input or PDF upload area
    const fileInput = await page.locator('input[type="file"]').first();
    
    if (await fileInput.isVisible()) {
      console.log('Found file input, ready for PDF upload');
      
      // Simulate file upload if there's a sample PDF
      const samplePDFPath = path.join(__dirname, 'sample.pdf');
      try {
        await fileInput.setInputFiles(samplePDFPath);
        console.log('PDF uploaded, waiting for processing...');
        
        // Wait a bit for PDF to load and process
        await page.waitForTimeout(3000);
        
        // Take screenshot after PDF load
        await page.screenshot({ 
          path: 'app_with_pdf_loaded.png', 
          fullPage: true 
        });
        console.log('Screenshot with PDF loaded saved as app_with_pdf_loaded.png');
        
      } catch (err) {
        console.log('No sample PDF found or upload failed, taking screenshot of empty state');
      }
    }
    
    // Keep browser open for manual interaction
    console.log('\nBrowser is open for manual testing.');
    console.log('You can:');
    console.log('1. Upload a PDF file');
    console.log('2. Examine chord-to-lyric alignment');
    console.log('3. Test transposition functionality');
    console.log('\nPress Ctrl+C to close when done.');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

takeAppScreenshot();