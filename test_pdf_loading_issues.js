const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testPDFLoadingIssues() {
    const browser = await chromium.launch({ headless: false, slowMo: 2000 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    console.log('Starting comprehensive PDF loading and issues test...');
    
    const testPdfPath = path.resolve('D:\\ClaudeCode\\TransposePDF\\test_files\\test_chord_chart.pdf');
    
    try {
        // Navigate to the app
        console.log('1. Navigating to TransposePDF app...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_01_initial.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_01_initial.png');
        
        // Test Issue: PDF Loading Reliability - Test multiple attempts
        console.log('\n2. Testing PDF Loading Reliability (Multiple Attempts)...');
        
        const fileInput = page.locator('input[type="file"]');
        
        // Attempt 1: First PDF load
        console.log('Attempt 1: Loading PDF for the first time...');
        await fileInput.setInputFiles(testPdfPath);
        await page.waitForTimeout(5000); // Wait longer for processing
        
        // Check what's displayed after first attempt
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_02_first_load.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_02_first_load.png');
        
        // Analyze the display after first load
        const firstLoadAnalysis = await page.evaluate(() => {
            const displayArea = document.querySelector('#pdfDisplay, .pdf-display, canvas, .content-display');
            const hasContent = displayArea && displayArea.innerHTML.length > 50;
            const isVisible = displayArea && window.getComputedStyle(displayArea).display !== 'none';
            
            // Check for chord and lyric elements
            const chordElements = document.querySelectorAll('[class*="chord"], .chord').length;
            const lyricsElements = document.querySelectorAll('[class*="lyrics"], .lyrics, [class*="text"]').length;
            const canvasElements = document.querySelectorAll('canvas').length;
            
            // Check for blank/white background issue
            const body = document.body;
            const bodyBg = window.getComputedStyle(body).backgroundColor;
            
            return {
                hasDisplayArea: !!displayArea,
                hasContent,
                isVisible,
                chordElements,
                lyricsElements,
                canvasElements,
                bodyBackground: bodyBg,
                displayAreaHTML: displayArea ? displayArea.innerHTML.substring(0, 300) : 'No display area found'
            };
        });
        
        console.log('First Load Analysis:');
        console.log(`  Display area found: ${firstLoadAnalysis.hasDisplayArea}`);
        console.log(`  Has content: ${firstLoadAnalysis.hasContent}`);
        console.log(`  Is visible: ${firstLoadAnalysis.isVisible}`);
        console.log(`  Chord elements: ${firstLoadAnalysis.chordElements}`);
        console.log(`  Lyrics elements: ${firstLoadAnalysis.lyricsElements}`);
        console.log(`  Canvas elements: ${firstLoadAnalysis.canvasElements}`);
        console.log(`  Body background: ${firstLoadAnalysis.bodyBackground}`);
        console.log(`  Display HTML preview: ${firstLoadAnalysis.displayAreaHTML}`);
        
        // Wait a bit more to see if content appears delayed
        console.log('Waiting additional 3 seconds for delayed content loading...');
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_03_first_load_delayed.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_03_first_load_delayed.png');
        
        // Attempt 2: Second PDF load (reload same file)
        console.log('\\nAttempt 2: Reloading the same PDF...');
        await fileInput.setInputFiles(testPdfPath);
        await page.waitForTimeout(5000);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_04_second_load.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_04_second_load.png');
        
        // Analyze the display after second load
        const secondLoadAnalysis = await page.evaluate(() => {
            const displayArea = document.querySelector('#pdfDisplay, .pdf-display, canvas, .content-display');
            const hasContent = displayArea && displayArea.innerHTML.length > 50;
            const isVisible = displayArea && window.getComputedStyle(displayArea).display !== 'none';
            
            const chordElements = document.querySelectorAll('[class*="chord"], .chord').length;
            const lyricsElements = document.querySelectorAll('[class*="lyrics"], .lyrics, [class*="text"]').length;
            const canvasElements = document.querySelectorAll('canvas').length;
            
            return {
                hasDisplayArea: !!displayArea,
                hasContent,
                isVisible,
                chordElements,
                lyricsElements,
                canvasElements,
                displayAreaHTML: displayArea ? displayArea.innerHTML.substring(0, 300) : 'No display area found'
            };
        });
        
        console.log('Second Load Analysis:');
        console.log(`  Display area found: ${secondLoadAnalysis.hasDisplayArea}`);
        console.log(`  Has content: ${secondLoadAnalysis.hasContent}`);
        console.log(`  Is visible: ${secondLoadAnalysis.isVisible}`);
        console.log(`  Chord elements: ${secondLoadAnalysis.chordElements}`);
        console.log(`  Lyrics elements: ${secondLoadAnalysis.lyricsElements}`);
        console.log(`  Canvas elements: ${secondLoadAnalysis.canvasElements}`);
        console.log(`  Display HTML preview: ${secondLoadAnalysis.displayAreaHTML}`);
        
        // Compare first vs second load
        const loadingReliabilityIssue = !firstLoadAnalysis.hasContent && secondLoadAnalysis.hasContent;
        console.log(`\\nLoading Reliability Issue Detected: ${loadingReliabilityIssue}`);
        
        // Test Issue: Lyrics Display vs Chords Only
        console.log('\\n3. Testing Lyrics Display Issue...');
        
        // Look for specific patterns that indicate "chords only on blank background"
        const lyricsDisplayIssue = await page.evaluate(() => {
            // Check if we have chords but no lyrics
            const chordElements = document.querySelectorAll('[class*="chord"], .chord');
            const lyricsElements = document.querySelectorAll('[class*="lyrics"], .lyrics, p, div[class*="text"]');
            
            // Filter out chord elements from lyrics count
            const actualLyricsElements = Array.from(lyricsElements).filter(el => {
                const text = el.textContent.toLowerCase();
                const classes = el.className.toLowerCase();
                return !classes.includes('chord') && text.length > 10; // Actual lyric lines should be longer
            });
            
            // Check if display area has minimal content (indicating blank/sparse display)
            const displayArea = document.querySelector('#pdfDisplay, .pdf-display, canvas, .content-display');
            const displayContent = displayArea ? displayArea.textContent : '';
            
            // Check background color for "blank white background" issue
            const body = document.body;
            const bodyStyles = window.getComputedStyle(body);
            const isWhiteBackground = bodyStyles.backgroundColor === 'rgb(255, 255, 255)' || 
                                    bodyStyles.backgroundColor === 'white' ||
                                    bodyStyles.backgroundColor === 'rgb(250, 250, 250)';
            
            return {
                chordCount: chordElements.length,
                lyricsCount: actualLyricsElements.length,
                hasDisplayContent: displayContent.length > 50,
                displayContentPreview: displayContent.substring(0, 200),
                isWhiteBackground,
                backgroundColor: bodyStyles.backgroundColor
            };
        });
        
        console.log('Lyrics Display Analysis:');
        console.log(`  Chord elements found: ${lyricsDisplayIssue.chordCount}`);
        console.log(`  Actual lyrics elements: ${lyricsDisplayIssue.lyricsCount}`);
        console.log(`  Has display content: ${lyricsDisplayIssue.hasDisplayContent}`);
        console.log(`  Content preview: "${lyricsDisplayIssue.displayContentPreview}"`);
        console.log(`  White background: ${lyricsDisplayIssue.isWhiteBackground}`);
        console.log(`  Background color: ${lyricsDisplayIssue.backgroundColor}`);
        
        const chordsOnlyIssue = lyricsDisplayIssue.chordCount > 0 && 
                               lyricsDisplayIssue.lyricsCount === 0 && 
                               lyricsDisplayIssue.isWhiteBackground;
        console.log(`\\nChords-Only Display Issue Detected: ${chordsOnlyIssue}`);
        
        // Test Issue: Export Functionality
        console.log('\\n4. Testing Export Functionality...');
        
        // Look for export buttons after PDF is loaded
        const exportAnalysis = await page.evaluate(() => {
            const exportButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const text = btn.textContent.toLowerCase();
                return text.includes('export') || text.includes('download') || text.includes('generate');
            });
            
            return exportButtons.map(btn => ({
                text: btn.textContent.trim(),
                visible: window.getComputedStyle(btn).display !== 'none' && 
                        window.getComputedStyle(btn).visibility !== 'hidden',
                enabled: !btn.disabled,
                className: btn.className
            }));
        });
        
        console.log('Export Buttons Analysis:');
        exportAnalysis.forEach((btn, index) => {
            console.log(`  Button ${index + 1}: "${btn.text}" - Visible: ${btn.visible}, Enabled: ${btn.enabled}`);
        });
        
        // Try to click an export button if available
        let exportWorking = false;
        for (const btnInfo of exportAnalysis) {
            if (btnInfo.visible && btnInfo.enabled) {
                console.log(`Attempting to click export button: "${btnInfo.text}"`);
                
                const exportButton = page.locator(`button:has-text("${btnInfo.text}")`);
                
                // Set up download handling
                const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
                
                await exportButton.click();
                await page.waitForTimeout(3000);
                
                const download = await downloadPromise;
                if (download) {
                    console.log(`✓ Export successful: ${download.suggestedFilename()}`);
                    exportWorking = true;
                } else {
                    console.log('✗ Export button clicked but no download initiated');
                }
                break;
            }
        }
        
        const exportIssue = exportAnalysis.length === 0 || !exportAnalysis.some(btn => btn.visible && btn.enabled) || !exportWorking;
        console.log(`\\nExport Functionality Issue Detected: ${exportIssue}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_05_export_test.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_05_export_test.png');
        
        // Final comprehensive analysis
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_06_final_state.png', fullPage: true });
        console.log('Screenshot saved: pdf_test_06_final_state.png');
        
        console.log('\\n' + '='.repeat(60));
        console.log('COMPREHENSIVE TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        console.log('\\n1. PDF LOADING RELIABILITY:');
        if (loadingReliabilityIssue) {
            console.log('  ❌ ISSUE CONFIRMED: PDF requires 2 attempts to load properly');
            console.log('  - First load: No content displayed');
            console.log('  - Second load: Content appears');
        } else if (!firstLoadAnalysis.hasContent && !secondLoadAnalysis.hasContent) {
            console.log('  ❌ SEVERE ISSUE: PDF not loading at all after multiple attempts');
        } else if (firstLoadAnalysis.hasContent) {
            console.log('  ✅ PDF loads correctly on first attempt');
        }
        
        console.log('\\n2. LYRICS DISPLAY ISSUE:');
        if (chordsOnlyIssue) {
            console.log('  ❌ ISSUE CONFIRMED: Only chords showing on blank white background');
            console.log('  - Chords present but lyrics missing');
            console.log('  - White/blank background detected');
        } else if (!lyricsDisplayIssue.hasDisplayContent) {
            console.log('  ❌ ISSUE: No content displayed at all');
        } else {
            console.log('  ✅ Content appears to be displaying properly');
            console.log(`  - Found ${lyricsDisplayIssue.lyricsCount} lyric elements`);
            console.log(`  - Found ${lyricsDisplayIssue.chordCount} chord elements`);
        }
        
        console.log('\\n3. EXPORT FUNCTIONALITY:');
        if (exportIssue) {
            console.log('  ❌ ISSUE CONFIRMED: Export functionality not working');
            if (exportAnalysis.length === 0) {
                console.log('  - No export buttons found');
            } else if (!exportAnalysis.some(btn => btn.visible)) {
                console.log('  - Export buttons exist but not visible');
            } else if (!exportAnalysis.some(btn => btn.enabled)) {
                console.log('  - Export buttons visible but disabled');
            } else {
                console.log('  - Export button clicked but no download occurred');
            }
        } else {
            console.log('  ✅ Export functionality working correctly');
        }
        
        console.log('\\n4. OVERALL USER EXPERIENCE:');
        const overallIssues = [loadingReliabilityIssue, chordsOnlyIssue, exportIssue].filter(Boolean).length;
        console.log(`  Issues detected: ${overallIssues}/3`);
        
        if (overallIssues === 0) {
            console.log('  ✅ App appears to be working correctly');
        } else if (overallIssues === 1) {
            console.log('  ⚠️  Minor issues detected - app partially functional');
        } else {
            console.log('  ❌ Major issues detected - app significantly impaired');
        }
        
        console.log('\\nAll test screenshots saved to: D:\\ClaudeCode\\TransposePDF\\screenshots\\');
        
    } catch (error) {
        console.error('Test failed with error:', error);
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\pdf_test_error.png', fullPage: true });
    } finally {
        await browser.close();
    }
}

// Run the comprehensive test
testPDFLoadingIssues().catch(console.error);