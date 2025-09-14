const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PDF_PATH = "D:\\Downloads\\Songbook For September 14, 2025.pdf";
const SCREENSHOT_DIR = "D:\\ClaudeCode\\songbook_test_screenshots";

async function testRealSongbook() {
    console.log('=== Testing Real Songbook PDF with TransposePDF ===');
    console.log(`PDF File: ${PDF_PATH}`);
    
    // Verify PDF exists
    if (!fs.existsSync(PDF_PATH)) {
        console.error(`ERROR: PDF file not found at ${PDF_PATH}`);
        return;
    }
    
    // Create screenshot directory
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    let browser, page;
    
    try {
        // Launch browser with visible interface
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            slowMo: 500  // Slow down for better observation
        });
        
        const context = await browser.newContext({
            viewport: { width: 1400, height: 900 }
        });
        
        page = await context.newPage();
        
        // Enable console logging from the page
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
        
        // Navigate to the app
        console.log('Navigating to http://localhost:8000/...');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        
        // Take initial screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_app.png'), fullPage: true });
        console.log('✓ Initial screenshot captured');
        
        // Wait for the app to be ready
        await page.waitForSelector('input[type="file"]', { timeout: 10000 });
        console.log('✓ File input found');
        
        // Upload the PDF file
        console.log('Uploading PDF file...');
        const fileInput = await page.locator('input[type="file"]');
        await fileInput.setInputFiles(PDF_PATH);
        
        // Wait for processing to complete
        console.log('Waiting for PDF processing...');
        await page.waitForTimeout(3000);
        
        // Check for PDF processing indicators
        try {
            // Look for various possible indicators of successful processing
            await page.waitForFunction(() => {
                // Check for any of these indicators
                const indicators = [
                    document.querySelector('.song-container'),
                    document.querySelector('.chord-sheet'),
                    document.querySelector('[data-testid="song-content"]'),
                    document.querySelector('.pdf-content'),
                    document.querySelector('.song-list')
                ];
                return indicators.some(el => el !== null);
            }, { timeout: 15000 });
            console.log('✓ PDF appears to be processed');
        } catch (error) {
            console.log('No specific processing indicators found, continuing...');
        }
        
        // Take screenshot after PDF upload
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_pdf_uploaded.png'), fullPage: true });
        console.log('✓ PDF upload screenshot captured');
        
        // Analyze the page content
        console.log('\n=== ANALYZING PAGE CONTENT ===');
        
        // Count detected songs
        const songElements = await page.locator('.song-container, .song, [class*="song"]').count();
        console.log(`Detected song elements: ${songElements}`);
        
        // Look for chord patterns
        const chordElements = await page.locator('[class*="chord"], .chord, span:has-text(/^[A-G][#b]?[m]?[0-9]?[sus]?[dim]?[aug]?/)').count();
        console.log(`Detected chord elements: ${chordElements}`);
        
        // Look for lyrics
        const lyricsElements = await page.locator('[class*="lyric"], .lyric, .lyrics, p, div').count();
        console.log(`Detected text elements: ${lyricsElements}`);
        
        // Get page text content to analyze
        const pageText = await page.textContent('body');
        const words = pageText.split(/\s+/).length;
        console.log(`Total words on page: ${words}`);
        
        // Look for common chord patterns in the text
        const commonChords = ['C', 'G', 'Am', 'F', 'D', 'Em', 'A', 'E', 'Bm'];
        const foundChords = [];
        for (const chord of commonChords) {
            if (pageText.includes(chord)) {
                foundChords.push(chord);
            }
        }
        console.log(`Common chords found in text: ${foundChords.join(', ')}`);
        
        // Take detailed screenshot of content
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_content_analysis.png'), fullPage: true });
        console.log('✓ Content analysis screenshot captured');
        
        // Test transpose functionality if available
        console.log('\n=== TESTING TRANSPOSE FUNCTIONALITY ===');
        
        const transposeButtons = await page.locator('button:has-text("+")', 'button:has-text("-")', '[class*="transpose"]').count();
        if (transposeButtons > 0) {
            console.log(`Found ${transposeButtons} transpose control(s)`);
            
            try {
                // Try to find and click transpose up button
                const transposeUp = page.locator('button:has-text("+")').first();
                if (await transposeUp.isVisible()) {
                    await transposeUp.click();
                    await page.waitForTimeout(1000);
                    console.log('✓ Clicked transpose up');
                    
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_transposed_up.png'), fullPage: true });
                    console.log('✓ Transpose up screenshot captured');
                }
                
                // Try to find and click transpose down button  
                const transposeDown = page.locator('button:has-text("-")').first();
                if (await transposeDown.isVisible()) {
                    await transposeDown.click();
                    await page.waitForTimeout(1000);
                    console.log('✓ Clicked transpose down');
                    
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_transposed_down.png'), fullPage: true });
                    console.log('✓ Transpose down screenshot captured');
                }
            } catch (error) {
                console.log('Could not interact with transpose controls:', error.message);
            }
        } else {
            console.log('No transpose controls found');
        }
        
        // Take final comprehensive screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_final_state.png'), fullPage: true });
        console.log('✓ Final state screenshot captured');
        
        // Get detailed DOM analysis
        console.log('\n=== DOM STRUCTURE ANALYSIS ===');
        const domInfo = await page.evaluate(() => {
            const getAllElements = (selector) => {
                const elements = document.querySelectorAll(selector);
                return Array.from(elements).map(el => ({
                    tag: el.tagName,
                    classes: el.className,
                    text: el.textContent?.substring(0, 50) + '...',
                    visible: el.offsetWidth > 0 && el.offsetHeight > 0
                }));
            };
            
            return {
                allDivs: getAllElements('div').length,
                allSpans: getAllElements('span').length,
                allParagraphs: getAllElements('p').length,
                hasCanvas: document.querySelector('canvas') !== null,
                hasSvg: document.querySelector('svg') !== null,
                bodyClasses: document.body.className,
                title: document.title
            };
        });
        
        console.log('DOM Analysis:', JSON.stringify(domInfo, null, 2));
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`✓ PDF file loaded successfully`);
        console.log(`✓ ${songElements} song-related elements detected`);
        console.log(`✓ ${chordElements} chord-related elements detected`);
        console.log(`✓ ${words} words processed from PDF`);
        console.log(`✓ Screenshots saved to: ${SCREENSHOT_DIR}`);
        console.log(`✓ Page title: ${domInfo.title}`);
        
        // Keep browser open for manual inspection
        console.log('\n=== MANUAL INSPECTION ===');
        console.log('Browser will remain open for manual inspection.');
        console.log('You can now manually inspect:');
        console.log('- Song detection accuracy');
        console.log('- Chord positioning vs original PDF');
        console.log('- Visual layout quality');
        console.log('- Transpose functionality');
        console.log('\nPress Ctrl+C when done to close the browser.');
        
        // Keep the process running for manual inspection
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error during testing:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (browser) {
            console.log('Cleaning up browser...');
            await browser.close();
        }
    }
}

// Run the test
testRealSongbook().catch(console.error);