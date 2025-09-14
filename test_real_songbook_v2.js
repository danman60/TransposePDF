const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PDF_PATH = "D:\\Downloads\\Songbook For September 14, 2025.pdf";
const SCREENSHOT_DIR = "D:\\ClaudeCode\\songbook_test_screenshots";

async function testRealSongbookV2() {
    console.log('=== Testing Real Songbook PDF with TransposePDF (Version 2) ===');
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
            slowMo: 300  // Slow down for better observation
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
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_initial_app_v2.png'), fullPage: true });
        console.log('✓ Initial screenshot captured');
        
        // Wait for the app to be ready - look for the "Choose PDF File" button
        await page.waitForSelector('button:has-text("Choose PDF File")', { timeout: 10000 });
        console.log('✓ Choose PDF File button found');
        
        // Set up file chooser handler BEFORE clicking the button
        const fileChooserPromise = page.waitForEvent('filechooser');
        
        // Click the "Choose PDF File" button
        console.log('Clicking Choose PDF File button...');
        await page.click('button:has-text("Choose PDF File")');
        
        // Handle the file chooser
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(PDF_PATH);
        console.log('✓ PDF file selected through file chooser');
        
        // Wait for processing to complete
        console.log('Waiting for PDF processing...');
        await page.waitForTimeout(5000);
        
        // Take screenshot after PDF upload
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_pdf_uploaded_v2.png'), fullPage: true });
        console.log('✓ PDF upload screenshot captured');
        
        // Wait for content to appear - look for various possible indicators
        let contentFound = false;
        const contentSelectors = [
            '.song-container',
            '.chord-sheet', 
            '[data-testid="song-content"]',
            '.pdf-content',
            '.song-list',
            '.song',
            '[class*="song"]',
            '.content',
            'main',
            '.page-content'
        ];
        
        for (const selector of contentSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                console.log(`✓ Found content selector: ${selector}`);
                contentFound = true;
                break;
            } catch (error) {
                // Continue to next selector
            }
        }
        
        if (!contentFound) {
            console.log('No specific content selectors found, analyzing page directly...');
        }
        
        // Wait a bit more for any processing
        await page.waitForTimeout(3000);
        
        // Analyze the page content
        console.log('\n=== ANALYZING PAGE CONTENT ===');
        
        const analysis = await page.evaluate(() => {
            // Get all text content
            const bodyText = document.body.textContent || '';
            const words = bodyText.split(/\s+/).filter(w => w.length > 0);
            
            // Look for song-related elements
            const songElements = document.querySelectorAll('.song-container, .song, [class*="song"]');
            
            // Look for chord patterns in text
            const chordPattern = /\b[A-G][#b]?[m]?[0-9]?[sus]?[dim]?[aug]?[add]?[maj]?\b/g;
            const potentialChords = bodyText.match(chordPattern) || [];
            
            // Common worship chords
            const commonChords = ['C', 'G', 'Am', 'F', 'D', 'Em', 'A', 'E', 'Bm', 'Dm'];
            const foundCommonChords = commonChords.filter(chord => bodyText.includes(chord));
            
            // Look for verse/chorus indicators
            const verseMarkers = bodyText.match(/\b(verse|chorus|bridge|intro|outro)\b/gi) || [];
            
            // Count different element types
            const elementCounts = {
                divs: document.querySelectorAll('div').length,
                spans: document.querySelectorAll('span').length,
                paragraphs: document.querySelectorAll('p').length,
                buttons: document.querySelectorAll('button').length,
                canvas: document.querySelectorAll('canvas').length,
                svg: document.querySelectorAll('svg').length
            };
            
            return {
                totalWords: words.length,
                songElements: songElements.length,
                potentialChords: potentialChords.length,
                foundCommonChords,
                verseMarkers: verseMarkers.length,
                elementCounts,
                bodyText: bodyText.substring(0, 500) + '...' // First 500 chars for inspection
            };
        });
        
        console.log('Analysis results:');
        console.log(`- Total words: ${analysis.totalWords}`);
        console.log(`- Song elements: ${analysis.songElements}`);
        console.log(`- Potential chords found: ${analysis.potentialChords}`);
        console.log(`- Common chords found: ${analysis.foundCommonChords.join(', ')}`);
        console.log(`- Verse markers: ${analysis.verseMarkers}`);
        console.log(`- Element counts:`, analysis.elementCounts);
        console.log(`- Sample text: ${analysis.bodyText}`);
        
        // Take detailed content screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_content_analysis_v2.png'), fullPage: true });
        console.log('✓ Content analysis screenshot captured');
        
        // Test for transpose controls
        console.log('\n=== TESTING TRANSPOSE FUNCTIONALITY ===');
        
        const transposeControls = await page.evaluate(() => {
            const transposeSelectors = [
                'button:has-text("+")',
                'button:has-text("-")',
                '[class*="transpose"]',
                '.transpose-up',
                '.transpose-down',
                'button[title*="transpose"]',
                'button[aria-label*="transpose"]'
            ];
            
            const foundControls = [];
            transposeSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    foundControls.push({
                        selector,
                        count: elements.length,
                        text: elements[0].textContent,
                        visible: elements[0].offsetWidth > 0 && elements[0].offsetHeight > 0
                    });
                }
            });
            
            return foundControls;
        });
        
        console.log(`Found ${transposeControls.length} transpose control types:`);
        transposeControls.forEach(control => {
            console.log(`- ${control.selector}: ${control.count} elements, visible: ${control.visible}`);
        });
        
        if (transposeControls.length > 0) {
            try {
                // Try to click transpose controls
                const upButton = page.locator('button:has-text("+")').first();
                if (await upButton.isVisible()) {
                    console.log('Clicking transpose up...');
                    await upButton.click();
                    await page.waitForTimeout(1000);
                    
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_transposed_up_v2.png'), fullPage: true });
                    console.log('✓ Transpose up screenshot captured');
                }
                
                const downButton = page.locator('button:has-text("-")').first();
                if (await downButton.isVisible()) {
                    console.log('Clicking transpose down...');
                    await downButton.click();
                    await page.waitForTimeout(1000);
                    
                    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_transposed_down_v2.png'), fullPage: true });
                    console.log('✓ Transpose down screenshot captured');
                }
            } catch (error) {
                console.log('Could not interact with transpose controls:', error.message);
            }
        }
        
        // Take final screenshot
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_final_state_v2.png'), fullPage: true });
        console.log('✓ Final state screenshot captured');
        
        // Extract detailed song information if available
        console.log('\n=== DETAILED SONG EXTRACTION ===');
        const songData = await page.evaluate(() => {
            // Try to extract structured song data
            const songs = [];
            
            // Look for different possible song structures
            const songContainers = document.querySelectorAll('.song-container, .song, [data-song], .chord-sheet');
            
            songContainers.forEach((container, index) => {
                const title = container.querySelector('h1, h2, h3, .title, .song-title')?.textContent?.trim() || `Song ${index + 1}`;
                const chords = Array.from(container.querySelectorAll('.chord, [class*="chord"]')).map(el => el.textContent.trim());
                const lyrics = Array.from(container.querySelectorAll('.lyric, .lyrics, p')).map(el => el.textContent.trim()).filter(text => text.length > 0);
                
                songs.push({
                    title,
                    chords: chords.slice(0, 10), // First 10 chords
                    lyrics: lyrics.slice(0, 5)   // First 5 lyric lines
                });
            });
            
            return songs;
        });
        
        console.log(`Extracted ${songData.length} songs:`);
        songData.forEach((song, index) => {
            console.log(`\nSong ${index + 1}: ${song.title}`);
            console.log(`  Chords (${song.chords.length}): ${song.chords.join(', ')}`);
            console.log(`  Lyrics (${song.lyrics.length} lines): ${song.lyrics.join(' | ')}`);
        });
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`✓ PDF file loaded: ${PDF_PATH}`);
        console.log(`✓ App initialized successfully`);
        console.log(`✓ ${analysis.totalWords} words processed`);
        console.log(`✓ ${analysis.songElements} song elements detected`);
        console.log(`✓ ${analysis.potentialChords} potential chords found`);
        console.log(`✓ ${songData.length} structured songs extracted`);
        console.log(`✓ ${transposeControls.length} transpose control types found`);
        console.log(`✓ Screenshots saved to: ${SCREENSHOT_DIR}`);
        
        // Keep browser open for manual inspection
        console.log('\n=== MANUAL INSPECTION TIME ===');
        console.log('Browser will remain open for 30 seconds for manual inspection.');
        console.log('You can now manually verify:');
        console.log('- Song detection accuracy vs original PDF');
        console.log('- Chord positioning over lyrics');
        console.log('- Visual layout quality');
        console.log('- Transpose functionality');
        
        // Wait 30 seconds for manual inspection
        for (let i = 30; i > 0; i--) {
            console.log(`Manual inspection time remaining: ${i} seconds...`);
            await page.waitForTimeout(1000);
        }
        
    } catch (error) {
        console.error('Error during testing:', error.message);
        console.error('Stack:', error.stack);
        
        // Take error screenshot
        if (page) {
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_state.png'), fullPage: true });
            console.log('Error state screenshot saved');
        }
    } finally {
        if (browser) {
            console.log('Closing browser...');
            await browser.close();
        }
    }
}

// Run the test
testRealSongbookV2().catch(console.error);