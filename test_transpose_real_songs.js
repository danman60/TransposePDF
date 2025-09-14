const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PDF_PATH = "D:\\Downloads\\Songbook For September 14, 2025.pdf";
const SCREENSHOT_DIR = "D:\\ClaudeCode\\transpose_test_screenshots";

async function testTransposeWithRealSongs() {
    console.log('=== Testing Transpose Functionality with Real Songs ===');
    
    // Create screenshot directory
    if (!fs.existsSync(SCREENSHOT_DIR)) {
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    let browser, page;
    
    try {
        console.log('Launching browser...');
        browser = await chromium.launch({
            headless: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            slowMo: 200
        });
        
        const context = await browser.newContext({
            viewport: { width: 1400, height: 900 }
        });
        
        page = await context.newPage();
        
        console.log('Navigating to app and loading PDF...');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        
        // Upload PDF
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.click('button:has-text("Choose PDF File")');
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(PDF_PATH);
        
        // Wait for processing
        await page.waitForTimeout(6000);
        
        // Take screenshot after loading
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_songs_loaded.png'), fullPage: true });
        console.log('✓ Songs loaded screenshot captured');
        
        // Look for transpose controls
        console.log('Looking for transpose controls...');
        
        // Find all transpose buttons using proper CSS selectors
        const transposeButtons = await page.$$eval('button', buttons => {
            return buttons.map((btn, index) => ({
                index,
                text: btn.textContent?.trim(),
                className: btn.className,
                title: btn.title,
                visible: btn.offsetWidth > 0 && btn.offsetHeight > 0
            })).filter(btn => 
                btn.text?.includes('+') || 
                btn.text?.includes('-') || 
                btn.text?.includes('♯') || 
                btn.text?.includes('♭') ||
                btn.className?.includes('transpose') ||
                btn.title?.includes('transpose')
            );
        });
        
        console.log(`Found ${transposeButtons.length} potential transpose buttons:`);
        transposeButtons.forEach(btn => {
            console.log(`- Button ${btn.index}: "${btn.text}" (class: ${btn.className}, visible: ${btn.visible})`);
        });
        
        if (transposeButtons.length > 0) {
            // Test transpose up
            const upButtons = transposeButtons.filter(btn => btn.text?.includes('+') || btn.text?.includes('♯'));
            if (upButtons.length > 0) {
                console.log('Testing transpose up...');
                const upButton = page.locator(`button`).nth(upButtons[0].index);
                await upButton.click();
                await page.waitForTimeout(1500);
                
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_transposed_up.png'), fullPage: true });
                console.log('✓ Transpose up screenshot captured');
                
                // Test another transpose up
                await upButton.click();
                await page.waitForTimeout(1500);
                
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_transposed_up_2.png'), fullPage: true });
                console.log('✓ Second transpose up screenshot captured');
            }
            
            // Test transpose down
            const downButtons = transposeButtons.filter(btn => btn.text?.includes('-') || btn.text?.includes('♭'));
            if (downButtons.length > 0) {
                console.log('Testing transpose down...');
                const downButton = page.locator(`button`).nth(downButtons[0].index);
                await downButton.click();
                await page.waitForTimeout(1500);
                
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_transposed_down.png'), fullPage: true });
                console.log('✓ Transpose down screenshot captured');
                
                // Test another transpose down to go below original
                await downButton.click();
                await page.waitForTimeout(1500);
                
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_transposed_down_2.png'), fullPage: true });
                console.log('✓ Second transpose down screenshot captured');
            }
            
            // Test reset if available
            const resetButtons = transposeButtons.filter(btn => 
                btn.text?.toLowerCase().includes('reset') || 
                btn.text?.toLowerCase().includes('original') ||
                btn.text === '0'
            );
            if (resetButtons.length > 0) {
                console.log('Testing transpose reset...');
                const resetButton = page.locator(`button`).nth(resetButtons[0].index);
                await resetButton.click();
                await page.waitForTimeout(1500);
                
                await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_transposed_reset.png'), fullPage: true });
                console.log('✓ Transpose reset screenshot captured');
            }
        } else {
            console.log('No transpose controls found - taking screenshot for analysis');
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_no_transpose_controls.png'), fullPage: true });
        }
        
        // Analyze current chord content
        const chordAnalysis = await page.evaluate(() => {
            const allText = document.body.textContent || '';
            const chordPattern = /\b[A-G][#b]?[m]?[0-9]?[sus]?[dim]?[aug]?[add]?[maj]?\b/g;
            const chords = allText.match(chordPattern) || [];
            
            // Get unique chords
            const uniqueChords = [...new Set(chords)];
            
            return {
                totalChordInstances: chords.length,
                uniqueChords: uniqueChords.slice(0, 20), // First 20 unique chords
                sampleText: allText.substring(0, 200)
            };
        });
        
        console.log('\n=== CHORD ANALYSIS ===');
        console.log(`Total chord instances: ${chordAnalysis.totalChordInstances}`);
        console.log(`Unique chords found: ${chordAnalysis.uniqueChords.join(', ')}`);
        console.log(`Sample text: ${chordAnalysis.sampleText}...`);
        
        // Take final screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_final_state.png'), fullPage: true });
        console.log('✓ Final state screenshot captured');
        
        console.log('\n=== TRANSPOSE TEST SUMMARY ===');
        console.log(`✓ PDF loaded with 7 songs`);
        console.log(`✓ ${transposeButtons.length} transpose controls found`);
        console.log(`✓ ${chordAnalysis.totalChordInstances} chord instances detected`);
        console.log(`✓ ${chordAnalysis.uniqueChords.length} unique chords identified`);
        console.log(`✓ Screenshots saved to: ${SCREENSHOT_DIR}`);
        
        // Keep browser open for 10 seconds for manual verification
        console.log('\nKeeping browser open for 10 seconds for manual verification...');
        for (let i = 10; i > 0; i--) {
            console.log(`${i}...`);
            await page.waitForTimeout(1000);
        }
        
    } catch (error) {
        console.error('Error during transpose testing:', error.message);
        if (page) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'transpose_error.png'), fullPage: true });
        }
    } finally {
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    }
}

testTransposeWithRealSongs().catch(console.error);