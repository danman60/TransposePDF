const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testTransposePDF() {
    console.log('Starting TransposePDF application test...');
    
    // Launch browser
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Collect console messages and errors
    const consoleMessages = [];
    const errors = [];
    
    page.on('console', msg => {
        consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
        console.log(`Console: [${msg.type()}] ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
        errors.push(error.message);
        console.log(`Error: ${error.message}`);
    });
    
    try {
        // Step 1: Navigate to application and take initial screenshot
        console.log('1. Navigating to http://localhost:8000/');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'D:\\ClaudeCode\\step1_initial.png', fullPage: true });
        console.log('Initial screenshot taken');
        
        // Step 2: Upload PDF file
        console.log('2. Uploading PDF file...');
        const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
        
        // Check if PDF file exists
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF file not found at: ${pdfPath}`);
        }
        
        // Find and use file input
        const fileInput = await page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(pdfPath);
        console.log('PDF file uploaded, waiting for processing...');
        
        // Wait for processing - look for song detection completion
        await page.waitForFunction(
            () => {
                // Look for song elements or completion indicators
                const songs = document.querySelectorAll('.song, [class*="song"], [data-song]');
                return songs.length >= 4 || document.querySelector('.processing-complete') || 
                       document.querySelector('[class*="transpose"]');
            },
            { timeout: 30000 }
        );
        
        // Wait a bit more for UI to stabilize
        await page.waitForTimeout(2000);
        
        // Step 3: Take screenshot after processing
        console.log('3. Taking screenshot after processing...');
        await page.screenshot({ path: 'D:\\ClaudeCode\\step2_processed.png', fullPage: true });
        
        // Step 4: Count songs and detect titles
        console.log('4. Analyzing detected songs...');
        
        // Try multiple selectors to find songs
        const songSelectors = [
            '.song',
            '[class*="song"]',
            '[data-song]',
            'h1, h2, h3, h4',
            '.song-title',
            '[class*="title"]'
        ];
        
        let songs = [];
        let songCount = 0;
        
        for (const selector of songSelectors) {
            try {
                const elements = await page.locator(selector).all();
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} elements with selector: ${selector}`);
                    
                    for (const element of elements) {
                        const text = await element.textContent();
                        if (text && text.trim()) {
                            songs.push({
                                selector,
                                text: text.trim(),
                                element
                            });
                        }
                    }
                }
            } catch (e) {
                // Continue with next selector
            }
        }
        
        // Filter for likely song titles
        const expectedSongs = ["King Of Heaven", "God Is For Us", "His Mercy Is More", "Waymaker"];
        const detectedSongs = [];
        
        for (const song of songs) {
            for (const expected of expectedSongs) {
                if (song.text.toLowerCase().includes(expected.toLowerCase()) || 
                    expected.toLowerCase().includes(song.text.toLowerCase())) {
                    detectedSongs.push({
                        detected: song.text,
                        expected: expected,
                        selector: song.selector
                    });
                    break;
                }
            }
        }
        
        console.log(`Songs detected: ${detectedSongs.length}`);
        detectedSongs.forEach((song, i) => {
            console.log(`  ${i + 1}. "${song.detected}" (matches: ${song.expected})`);
        });
        
        // Step 5: Test transpose buttons
        console.log('5. Testing transpose buttons...');
        
        const transposeSelectors = [
            'button[class*="transpose"]',
            'button[data-transpose]',
            '.transpose-btn',
            'button:has-text("♯")',
            'button:has-text("♭")',
            'button[title*="transpose"]',
            'button[aria-label*="transpose"]'
        ];
        
        let transposeButtons = [];
        
        for (const selector of transposeSelectors) {
            try {
                const buttons = await page.locator(selector).all();
                transposeButtons = transposeButtons.concat(buttons);
            } catch (e) {
                // Continue
            }
        }
        
        console.log(`Found ${transposeButtons.length} transpose buttons`);
        
        // Test clicking some transpose buttons if found
        if (transposeButtons.length > 0) {
            try {
                await transposeButtons[0].click();
                await page.waitForTimeout(1000);
                console.log('Successfully clicked first transpose button');
            } catch (e) {
                console.log(`Error clicking transpose button: ${e.message}`);
            }
        }
        
        // Step 6: Final screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\step3_final.png', fullPage: true });
        
        // Generate report
        const report = {
            timestamp: new Date().toISOString(),
            songsDetected: detectedSongs.length,
            expectedSongs: 4,
            detectedTitles: detectedSongs.map(s => s.detected),
            expectedTitles: expectedSongs,
            transposeButtonsFound: transposeButtons.length,
            consoleMessages: consoleMessages,
            errors: errors,
            success: detectedSongs.length === 4 && errors.length === 0
        };
        
        fs.writeFileSync('D:\\ClaudeCode\\test_report.json', JSON.stringify(report, null, 2));
        
        console.log('\n=== TEST RESULTS ===');
        console.log(`Songs detected: ${report.songsDetected}/4`);
        console.log('Detected titles:', report.detectedTitles);
        console.log(`Transpose buttons: ${report.transposeButtonsFound}`);
        console.log(`Console errors: ${report.errors.length}`);
        console.log(`Test success: ${report.success}`);
        
        // Keep browser open for manual inspection
        console.log('\nBrowser will remain open for 30 seconds for manual inspection...');
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('Test failed:', error.message);
        await page.screenshot({ path: 'D:\\ClaudeCode\\error_screenshot.png', fullPage: true });
    } finally {
        await browser.close();
    }
}

testTransposePDF().catch(console.error);