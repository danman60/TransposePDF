const { chromium } = require('playwright');
const path = require('path');

async function screenshotWithPDF() {
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
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'app_before_pdf.png', 
      fullPage: true 
    });
    console.log('Screenshot before PDF load: app_before_pdf.png');
    
    // Find and upload the PDF file
    const fileInput = await page.locator('input[type="file"]').first();
    const pdfPath = path.join(__dirname, 'test_chord_chart.pdf');
    
    console.log('Uploading PDF file:', pdfPath);
    await fileInput.setInputFiles(pdfPath);
    
    // Wait for PDF to process
    console.log('Waiting for PDF to load and process...');
    await page.waitForTimeout(3000);
    
    // Try to wait for content to appear
    try {
      await page.waitForSelector('.chord-line, .pdf-content, canvas, .page', { timeout: 10000 });
    } catch (e) {
      console.log('No specific content selector found, continuing...');
    }
    
    // Take screenshot after PDF loads
    await page.screenshot({ 
      path: 'app_with_pdf_loaded.png', 
      fullPage: true 
    });
    console.log('Screenshot with PDF loaded: app_with_pdf_loaded.png');
    
    // Zoom in for detailed view of chord alignment
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ 
      path: 'app_chord_alignment_zoomed.png', 
      fullPage: true 
    });
    console.log('Zoomed screenshot for chord alignment: app_chord_alignment_zoomed.png');
    
    // Try to find any transposition controls and test them
    const transposeUp = await page.locator('button').filter({ hasText: '+' }).or(
      page.locator('button').filter({ hasText: 'up' })
    ).first();
    
    if (await transposeUp.isVisible()) {
      console.log('Found transpose button, testing transposition...');
      await transposeUp.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'app_after_transpose.png', 
        fullPage: true 
      });
      console.log('Screenshot after transposition: app_after_transpose.png');
    }
    
    console.log('\n=== Screenshots captured ===');
    console.log('1. app_before_pdf.png - Initial state');
    console.log('2. app_with_pdf_loaded.png - PDF loaded');
    console.log('3. app_chord_alignment_zoomed.png - Detailed chord alignment');
    console.log('4. app_after_transpose.png - After transposition (if available)');
    
    console.log('\nBrowser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when done.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

screenshotWithPDF();