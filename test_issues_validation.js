const { chromium } = require('playwright');

async function testTransposePDFIssues() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    console.log('Starting TransposePDF issue validation tests...');
    
    try {
        // Navigate to the app
        console.log('1. Navigating to TransposePDF app...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\01_initial_load.png', fullPage: true });
        console.log('Screenshot saved: 01_initial_load.png');
        
        // Test Issue 1: PDF Loading Reliability
        console.log('\n2. Testing PDF Loading Reliability...');
        
        // Look for file input
        const fileInput = await page.locator('input[type="file"]');
        
        if (await fileInput.count() > 0) {
            console.log('Found file input element');
            
            // Check if there's a sample PDF to test with
            const fs = require('fs');
            const testPdfPath = 'D:\\ClaudeCode\\TransposePDF\\test_files';
            
            if (fs.existsSync(testPdfPath)) {
                const files = fs.readdirSync(testPdfPath).filter(f => f.endsWith('.pdf'));
                if (files.length > 0) {
                    const testPdf = `${testPdfPath}\\${files[0]}`;
                    console.log(`Using test PDF: ${testPdf}`);
                    
                    // Test first attempt
                    console.log('Testing first PDF load attempt...');
                    await fileInput.setInputFiles(testPdf);
                    await page.waitForTimeout(3000);
                    
                    // Take screenshot after first attempt
                    await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\02_first_load_attempt.png', fullPage: true });
                    console.log('Screenshot saved: 02_first_load_attempt.png');
                    
                    // Check what's displayed
                    const displayArea = await page.locator('#pdfDisplay, .pdf-display, .chord-display, canvas').first();
                    const isDisplayed = await displayArea.isVisible();
                    console.log(`PDF display visible after first attempt: ${isDisplayed}`);
                    
                    if (isDisplayed) {
                        const displayContent = await displayArea.innerHTML();
                        console.log(`Display content preview: ${displayContent.substring(0, 200)}...`);
                    }
                    
                    // Test second attempt (reload the same file)
                    console.log('Testing second PDF load attempt...');
                    await fileInput.setInputFiles(testPdf);
                    await page.waitForTimeout(3000);
                    
                    // Take screenshot after second attempt
                    await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\03_second_load_attempt.png', fullPage: true });
                    console.log('Screenshot saved: 03_second_load_attempt.png');
                    
                    // Check what's displayed after second attempt
                    const isDisplayed2 = await displayArea.isVisible();
                    console.log(`PDF display visible after second attempt: ${isDisplayed2}`);
                }
            } else {
                console.log('No test_files directory found, creating sample test scenario...');
                // Trigger file input without actual file to see error handling
                await fileInput.click();
                await page.waitForTimeout(1000);
                await page.keyboard.press('Escape'); // Cancel file dialog
                
                await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\02_no_file_selected.png', fullPage: true });
            }
        } else {
            console.log('ERROR: No file input found on the page');
        }
        
        // Test Issue 2: Lyrics Display Issue
        console.log('\n3. Testing Lyrics Display Issue...');
        
        // Look for display elements
        const chordElements = await page.locator('.chord, .chord-symbol, [class*="chord"]').count();
        const lyricsElements = await page.locator('.lyrics, .text, [class*="lyrics"], [class*="text"]').count();
        
        console.log(`Found ${chordElements} chord-related elements`);
        console.log(`Found ${lyricsElements} lyrics/text-related elements`);
        
        // Check background and content
        const bodyBg = await page.evaluate(() => {
            const body = document.body;
            const style = window.getComputedStyle(body);
            return {
                backgroundColor: style.backgroundColor,
                color: style.color
            };
        });
        
        console.log(`Body background: ${bodyBg.backgroundColor}, text color: ${bodyBg.color}`);
        
        // Look for main display area
        const displayElements = await page.locator('#pdfDisplay, .pdf-display, .chord-display, .main-content, main').all();
        
        for (let i = 0; i < displayElements.length; i++) {
            const element = displayElements[i];
            const isVisible = await element.isVisible();
            const textContent = (await element.textContent()).substring(0, 200);
            const tagName = await element.evaluate(el => el.tagName);
            const className = await element.evaluate(el => el.className);
            
            console.log(`Display element ${i + 1}: ${tagName}.${className} - Visible: ${isVisible} - Content: "${textContent}..."`);
        }
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\04_lyrics_display_analysis.png', fullPage: true });
        console.log('Screenshot saved: 04_lyrics_display_analysis.png');
        
        // Test Issue 3: Export Functionality
        console.log('\n4. Testing Export Functionality...');
        
        const exportButtons = await page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("PDF"), .export-btn, #export').all();
        
        console.log(`Found ${exportButtons.length} potential export buttons`);
        
        for (let i = 0; i < exportButtons.length; i++) {
            const button = exportButtons[i];
            const isVisible = await button.isVisible();
            const isEnabled = await button.isEnabled();
            const text = await button.textContent();
            
            console.log(`Export button ${i + 1}: "${text}" - Visible: ${isVisible} - Enabled: ${isEnabled}`);
            
            if (isVisible && isEnabled) {
                console.log(`Clicking export button: "${text}"`);
                
                // Set up download handling
                const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
                
                await button.click();
                await page.waitForTimeout(2000);
                
                const download = await downloadPromise;
                if (download) {
                    console.log(`Download initiated: ${download.suggestedFilename()}`);
                } else {
                    console.log('No download was triggered');
                }
                
                break; // Test only the first working export button
            }
        }
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\05_export_functionality.png', fullPage: true });
        console.log('Screenshot saved: 05_export_functionality.png');
        
        // Test Issue 4: Overall User Experience Analysis
        console.log('\n5. Overall User Experience Analysis...');
        
        // Get page structure
        const pageStructure = await page.evaluate(() => {
            const getElementInfo = (element, depth = 0) => {
                if (depth > 3) return null; // Limit depth
                
                return {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    textPreview: element.textContent ? element.textContent.substring(0, 100) : '',
                    children: Array.from(element.children).map(child => getElementInfo(child, depth + 1)).filter(Boolean)
                };
            };
            
            return getElementInfo(document.body);
        });
        
        console.log('Page structure analysis:');
        console.log(JSON.stringify(pageStructure, null, 2));
        
        // Check for common UI elements
        const commonElements = {
            'File Input': await page.locator('input[type="file"]').count(),
            'Buttons': await page.locator('button').count(),
            'Canvas Elements': await page.locator('canvas').count(),
            'PDF Display': await page.locator('#pdfDisplay, .pdf-display').count(),
            'Chord Elements': await page.locator('[class*="chord"]').count(),
            'Text Elements': await page.locator('p, div, span').count()
        };
        
        console.log('Common UI elements count:');
        Object.entries(commonElements).forEach(([name, count]) => {
            console.log(`  ${name}: ${count}`);
        });
        
        // Final comprehensive screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\06_final_state.png', fullPage: true });
        console.log('Screenshot saved: 06_final_state.png');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\error_state.png', fullPage: true });
    } finally {
        await browser.close();
    }
}

// Create screenshots directory if it doesn't exist
const fs = require('fs');
const screenshotsDir = 'D:\\ClaudeCode\\TransposePDF\\screenshots';
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run the tests
testTransposePDFIssues().catch(console.error);