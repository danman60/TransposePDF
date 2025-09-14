const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testAllFixes() {
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 }
    });
    
    const page = await context.newPage();
    
    console.log('🚀 Starting comprehensive test of all three fixes...\n');
    
    try {
        // 1. Navigate to the app
        console.log('1. Navigating to http://localhost:8000/');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        
        // Take initial screenshot
        await page.screenshot({ path: 'test_initial_app.png', fullPage: true });
        console.log('✓ Initial screenshot saved as test_initial_app.png');
        
        // 2. Upload the PDF file
        console.log('\n2. Uploading PDF file...');
        const pdfPath = 'D:\\Downloads\\Songbook For September 14, 2025.pdf';
        
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF file not found at: ${pdfPath}`);
        }
        
        const fileInput = await page.locator('input[type="file"]');
        await fileInput.setInputFiles(pdfPath);
        console.log('✓ PDF file uploaded');
        
        // Wait for PDF to be processed and songs to load
        console.log('📖 Waiting for songs to load...');
        
        // Wait for the loading state to appear and then disappear
        try {
            await page.waitForSelector('#loading', { timeout: 5000 });
            console.log('✓ Loading indicator appeared');
            await page.waitForSelector('#loading', { state: 'hidden', timeout: 60000 });
            console.log('✓ Loading indicator disappeared');
        } catch (e) {
            console.log('ℹ Loading indicator behavior:', e.message);
        }
        
        // Wait for songs to appear with longer timeout
        try {
            await page.waitForSelector('.song', { timeout: 45000 });
            console.log('✓ Songs loaded successfully');
        } catch (e) {
            console.log('⚠ Songs may not have loaded yet, continuing with current state...');
        }
        
        // Take screenshot after loading
        await page.screenshot({ path: 'test_after_loading.png', fullPage: true });
        console.log('✓ Screenshot after loading saved as test_after_loading.png');
        
        // Check what's actually on the page
        const pageContent = await page.content();
        console.log('\\n📄 Current page content preview:');
        console.log(pageContent.substring(0, 500) + '...');
        
        // Look for songs or any content
        const songElements = await page.locator('.song').count();
        console.log(`\\n🎵 Found ${songElements} song elements`);
        
        // Look for transpose buttons specifically
        const transposeButtons = await page.locator('button').count();
        console.log(`🔘 Found ${transposeButtons} button elements total`);
        
        // ============================================
        // TEST 1: Button Symbols Fix (+ and - instead of ♯ and ♭)
        // ============================================
        console.log('\\n=== TEST 1: Button Symbols Fix ===');
        
        // Look for transpose buttons with new symbols
        const plusButtons = await page.locator('button:has-text("+")').count();
        const minusButtons = await page.locator('button:has-text("-")').count();
        const sharpButtons = await page.locator('button:has-text("♯")').count();
        const flatButtons = await page.locator('button:has-text("♭")').count();
        
        console.log(`✓ Found ${plusButtons} buttons with "+" symbol`);
        console.log(`✓ Found ${minusButtons} buttons with "-" symbol`);
        console.log(`${sharpButtons > 0 ? '⚠' : '✓'} Found ${sharpButtons} buttons with "♯" symbol`);
        console.log(`${flatButtons > 0 ? '⚠' : '✓'} Found ${flatButtons} buttons with "♭" symbol`);
        
        if (plusButtons > 0 && minusButtons > 0 && sharpButtons === 0 && flatButtons === 0) {
            console.log('✅ TEST 1 PASSED: Button symbols correctly show + and - instead of ♯ and ♭');
        } else {
            console.log('❌ TEST 1 FAILED: Button symbols not fully updated');
        }
        
        // ============================================
        // TEST 2: Export Functionality
        // ============================================
        console.log('\\n=== TEST 2: Export Functionality ===');
        
        // Set up download handling
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
        
        try {
            // Look for Export PDF button
            const exportButton = page.locator('button:has-text("Export PDF")');
            const exportButtonCount = await exportButton.count();
            console.log(`Found ${exportButtonCount} Export PDF buttons`);
            
            if (exportButtonCount > 0) {
                console.log('🖱️ Clicking Export PDF button...');
                await exportButton.first().click();
                
                // Wait for Generate PDF button to appear
                await page.waitForSelector('button:has-text("Generate PDF")', { timeout: 5000 });
                console.log('✓ Generate PDF button appeared');
                
                const generateButton = page.locator('button:has-text("Generate PDF")');
                console.log('🖱️ Clicking Generate PDF button...');
                await generateButton.click();
                
                // Check for console errors
                const errors = [];
                page.on('console', msg => {
                    if (msg.type() === 'error') {
                        errors.push(msg.text());
                    }
                });
                
                // Wait a moment for potential errors
                await page.waitForTimeout(3000);
                
                // Check if "songs is not defined" error occurred
                const songsNotDefinedError = errors.some(error => error.includes('songs is not defined'));
                
                if (songsNotDefinedError) {
                    console.log('❌ TEST 2 FAILED: "songs is not defined" error still occurs');
                } else {
                    console.log('✅ TEST 2 PASSED: No "songs is not defined" error detected');
                }
                
                // Log all errors for debugging
                if (errors.length > 0) {
                    console.log('⚠ Console errors detected:');
                    errors.forEach(error => console.log(`  - ${error}`));
                } else {
                    console.log('✓ No console errors detected');
                }
                
            } else {
                console.log('❌ TEST 2 FAILED: Export PDF button not found');
            }
        } catch (e) {
            console.log(`❌ TEST 2 FAILED: Export functionality error: ${e.message}`);
        }
        
        // ============================================
        // TEST 3: Chord Positioning (Absolute Positioning)
        // ============================================
        console.log('\\n=== TEST 3: Chord Positioning ===');
        
        // Look for chord elements and check their positioning
        const chordElements = await page.locator('.chord').count();
        console.log(`🎵 Found ${chordElements} chord elements`);
        
        if (chordElements > 0) {
            // Get styles of first few chord elements
            const firstChord = page.locator('.chord').first();
            const chordStyle = await firstChord.evaluate(el => {
                const style = window.getComputedStyle(el);
                return {
                    position: style.position,
                    left: style.left,
                    top: style.top,
                    transform: style.transform
                };
            });
            
            console.log('📊 First chord element styles:', chordStyle);
            
            if (chordStyle.position === 'absolute') {
                console.log('✅ TEST 3 PASSED: Chords use absolute positioning');
            } else {
                console.log(`❌ TEST 3 FAILED: Chords use ${chordStyle.position} positioning instead of absolute`);
            }
        } else {
            console.log('⚠ TEST 3 INCOMPLETE: No chord elements found to test positioning');
        }
        
        // ============================================
        // Final Screenshots
        // ============================================
        console.log('\\n📸 Taking final comprehensive screenshots...');
        
        // Full page screenshot
        await page.screenshot({ path: 'test_final_full_page.png', fullPage: true });
        console.log('✓ Final full page screenshot saved');
        
        // Screenshot of just the content area if it exists
        try {
            const contentArea = page.locator('#content, .content, .songs-container').first();
            if (await contentArea.count() > 0) {
                await contentArea.screenshot({ path: 'test_final_content_area.png' });
                console.log('✓ Content area screenshot saved');
            }
        } catch (e) {
            console.log('ℹ Could not capture content area screenshot');
        }
        
        // Test transpose functionality if buttons are available
        if (plusButtons > 0) {
            console.log('\\n🎵 Testing transpose functionality...');
            try {
                const firstPlusButton = page.locator('button:has-text("+")').first();
                await firstPlusButton.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: 'test_after_transpose_up.png', fullPage: true });
                console.log('✓ Transpose up test completed, screenshot saved');
                
                const firstMinusButton = page.locator('button:has-text("-")').first();
                await firstMinusButton.click();
                await page.waitForTimeout(1000);
                await page.screenshot({ path: 'test_after_transpose_down.png', fullPage: true });
                console.log('✓ Transpose down test completed, screenshot saved');
            } catch (e) {
                console.log(`⚠ Transpose functionality test failed: ${e.message}`);
            }
        }
        
        // ============================================
        // Summary Report
        // ============================================
        console.log('\\n' + '='.repeat(50));
        console.log('📋 COMPREHENSIVE TEST SUMMARY');
        console.log('='.repeat(50));
        
        console.log(`\\n🔘 Button Symbols: ${plusButtons > 0 && minusButtons > 0 && sharpButtons === 0 && flatButtons === 0 ? '✅ FIXED' : '❌ NEEDS ATTENTION'}`);
        console.log(`📤 Export Functionality: ${errors.some(e => e.includes('songs is not defined')) ? '❌ NEEDS ATTENTION' : '✅ APPEARS FIXED'}`);
        console.log(`📍 Chord Positioning: ${chordElements > 0 && chordStyle?.position === 'absolute' ? '✅ FIXED' : '⚠ NEEDS VERIFICATION'}`);
        
        console.log('\\n📁 Screenshots saved:');
        console.log('  - test_initial_app.png');
        console.log('  - test_after_loading.png');
        console.log('  - test_final_full_page.png');
        console.log('  - test_final_content_area.png (if available)');
        console.log('  - test_after_transpose_up.png (if available)');
        console.log('  - test_after_transpose_down.png (if available)');
        
        console.log('\\n⏱️ Test will complete in 10 seconds...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        await page.screenshot({ path: 'test_error_screenshot.png', fullPage: true });
        console.log('Error screenshot saved as test_error_screenshot.png');
    } finally {
        await browser.close();
        console.log('\\n🏁 Test completed!');
    }
}

testAllFixes().catch(console.error);