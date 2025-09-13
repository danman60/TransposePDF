const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('Loading app...');
    await page.goto('http://localhost:8000/');
    await page.waitForLoadState('networkidle');
    
    // Load the songbook
    console.log('Loading songbook...');
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles('D:\\Downloads\\Songbook For September 14, 2025.pdf');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Try export
    console.log('Testing export...');
    const exportButton = page.locator('#exportFinalButton');
    await exportButton.click();
    
    // Wait for any error or success
    await page.waitForTimeout(5000);
    
    // Check for errors
    const errorPanel = page.locator('.error-panel');
    const isErrorVisible = await errorPanel.isVisible().catch(() => false);
    
    if (isErrorVisible) {
      const errorText = await errorPanel.textContent();
      console.log('Export error:', errorText);
    } else {
      console.log('Export appears to have succeeded (no error panel)');
    }
    
    await page.screenshot({ path: 'quick_export_test.png', fullPage: true });
    console.log('Screenshot saved');
    
    await browser.close();
    
  } catch (error) {
    console.error('Quick export test failed:', error);
  }
})();