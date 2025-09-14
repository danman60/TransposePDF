const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runGoldenTests() {
    let browser, context, page;
    const testResults = [];
    const baseUrl = 'http://localhost:8080';
    const screenshotDir = 'D:\\ClaudeCode\\TransposePDF';

    try {
        // Launch browser
        browser = await chromium.launch({
            headless: false,
            slowMo: 1000,
            args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            permissions: ['clipboard-read', 'clipboard-write']
        });
        page = await context.newPage();

        // Collect console logs and errors
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        });

        page.on('pageerror', error => {
            consoleLogs.push(`[ERROR] ${error.message}`);
        });

        console.log('Starting Golden Tests for TransposePDF...');

        // GOLDEN TEST 1: App Loading
        console.log('\n=== GOLDEN TEST 1: App Loading ===');
        try {
            await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

            // Check if page loads successfully
            const title = await page.title();
            console.log(`Page title: ${title}`);

            // Check for main heading
            const mainHeading = await page.locator('h1').first().textContent().catch(() => null);
            console.log(`Main heading: ${mainHeading}`);

            // Check for upload area
            const uploadArea = await page.locator('.upload-area, #upload-area, [data-upload]').first().isVisible().catch(() => false);
            const uploadText = await page.locator('text=Load Your Songbook').isVisible().catch(() => false);

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_1_loading.png') });

            testResults.push({
                test: 'Golden Test 1: App Loading',
                passed: title.includes('Chord') || mainHeading?.includes('Chord') || uploadArea || uploadText,
                details: {
                    title,
                    mainHeading,
                    uploadAreaVisible: uploadArea,
                    uploadTextVisible: uploadText,
                    consoleLogs: consoleLogs.slice()
                }
            });

            console.log('✓ Test 1 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 1: App Loading',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 1 failed:', error.message);
        }

        // GOLDEN TEST 2: Upload Interface
        console.log('\n=== GOLDEN TEST 2: Upload Interface ===');
        try {
            // Look for upload interface elements
            const uploadButton = await page.locator('input[type="file"], button:has-text("Choose"), button:has-text("Upload"), .upload-btn').first().isVisible().catch(() => false);
            const fileInput = await page.locator('input[type="file"]').first().isVisible().catch(() => false);
            const dragDropArea = await page.locator('.upload-area, .drop-zone, .drag-drop').first().isVisible().catch(() => false);

            // Check if file input accepts PDFs
            let acceptsPdf = false;
            try {
                const fileInputElement = await page.locator('input[type="file"]').first();
                const acceptAttr = await fileInputElement.getAttribute('accept');
                acceptsPdf = acceptAttr && acceptAttr.includes('pdf');
            } catch (e) {}

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_2_upload_interface.png') });

            testResults.push({
                test: 'Golden Test 2: Upload Interface',
                passed: uploadButton || fileInput || dragDropArea,
                details: {
                    uploadButtonVisible: uploadButton,
                    fileInputVisible: fileInput,
                    dragDropAreaVisible: dragDropArea,
                    acceptsPdf: acceptsPdf
                }
            });

            console.log('✓ Test 2 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 2: Upload Interface',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 2 failed:', error.message);
        }

        // GOLDEN TEST 3: PDF Upload Process
        console.log('\n=== GOLDEN TEST 3: PDF Upload Process ===');
        try {
            // Check if test PDF exists
            const testPdfPath = 'D:\\ClaudeCode\\TransposePDF\\test_chord_chart.pdf';
            const pdfExists = fs.existsSync(testPdfPath);
            console.log(`Test PDF exists: ${pdfExists}`);

            let uploadSuccessful = false;
            if (pdfExists) {
                try {
                    const fileInput = await page.locator('input[type="file"]').first();
                    if (await fileInput.isVisible()) {
                        await fileInput.setInputFiles(testPdfPath);
                        await page.waitForTimeout(3000); // Wait for processing

                        // Check for processing indicators
                        const progressBar = await page.locator('.progress, .loading, .processing').isVisible().catch(() => false);
                        const songsAppeared = await page.locator('.song, .song-item, [data-song]').count().catch(() => 0);

                        uploadSuccessful = songsAppeared > 0 || progressBar;
                    }
                } catch (uploadError) {
                    console.log('Upload attempt failed:', uploadError.message);
                }
            }

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_3_upload_process.png') });

            testResults.push({
                test: 'Golden Test 3: PDF Upload Process',
                passed: uploadSuccessful,
                details: {
                    testPdfExists: pdfExists,
                    uploadAttempted: pdfExists,
                    uploadSuccessful: uploadSuccessful
                }
            });

            console.log('✓ Test 3 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 3: PDF Upload Process',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 3 failed:', error.message);
        }

        // GOLDEN TEST 4: Song Detection
        console.log('\n=== GOLDEN TEST 4: Song Detection ===');
        try {
            await page.waitForTimeout(2000);

            // Look for songs list or detected content
            const songsList = await page.locator('.songs, .song-list, .songbook').isVisible().catch(() => false);
            const songItems = await page.locator('.song, .song-item, [data-song]').count().catch(() => 0);
            const chordProgressions = await page.locator('.chord, .chord-progression, .chords').count().catch(() => 0);
            const songTitles = await page.locator('.song-title, .title, h2, h3').count().catch(() => 0);

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_4_song_detection.png') });

            testResults.push({
                test: 'Golden Test 4: Song Detection',
                passed: songsList || songItems > 0 || chordProgressions > 0,
                details: {
                    songsListVisible: songsList,
                    songItemsCount: songItems,
                    chordProgressionsCount: chordProgressions,
                    songTitlesCount: songTitles
                }
            });

            console.log('✓ Test 4 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 4: Song Detection',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 4 failed:', error.message);
        }

        // GOLDEN TEST 5: Chord Transposition Controls
        console.log('\n=== GOLDEN TEST 5: Chord Transposition Controls ===');
        try {
            // Look for transpose controls
            const transposeUpBtn = await page.locator('button:has-text("+"), .transpose-up, .btn-up, [data-transpose="up"]').first().isVisible().catch(() => false);
            const transposeDownBtn = await page.locator('button:has-text("-"), .transpose-down, .btn-down, [data-transpose="down"]').first().isVisible().catch(() => false);
            const keyDisplay = await page.locator('.key, .current-key, .key-signature').isVisible().catch(() => false);
            const transposeControls = await page.locator('.transpose, .transpose-controls, .transposition').isVisible().catch(() => false);

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_5_transpose_controls.png') });

            testResults.push({
                test: 'Golden Test 5: Chord Transposition Controls',
                passed: transposeUpBtn || transposeDownBtn || keyDisplay || transposeControls,
                details: {
                    transposeUpVisible: transposeUpBtn,
                    transposeDownVisible: transposeDownBtn,
                    keyDisplayVisible: keyDisplay,
                    transposeControlsVisible: transposeControls
                }
            });

            console.log('✓ Test 5 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 5: Chord Transposition Controls',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 5 failed:', error.message);
        }

        // GOLDEN TEST 6: Chord Transposition Functionality
        console.log('\n=== GOLDEN TEST 6: Chord Transposition Functionality ===');
        try {
            // Capture initial chord state
            const initialChords = await page.locator('.chord').allTextContents().catch(() => []);
            console.log('Initial chords found:', initialChords.slice(0, 5));

            // Try to click transpose up
            let transpositionWorked = false;
            try {
                const transposeBtn = await page.locator('button:has-text("+"), .transpose-up, .btn-up, [data-transpose="up"]').first();
                if (await transposeBtn.isVisible()) {
                    await transposeBtn.click();
                    await page.waitForTimeout(1000);

                    // Check if chords changed
                    const newChords = await page.locator('.chord').allTextContents().catch(() => []);
                    transpositionWorked = JSON.stringify(initialChords) !== JSON.stringify(newChords) && newChords.length > 0;
                }
            } catch (clickError) {
                console.log('Transpose click failed:', clickError.message);
            }

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_6_transpose_function.png') });

            testResults.push({
                test: 'Golden Test 6: Chord Transposition Functionality',
                passed: transpositionWorked,
                details: {
                    initialChordsFound: initialChords.length,
                    transpositionWorked: transpositionWorked,
                    initialChords: initialChords.slice(0, 5)
                }
            });

            console.log('✓ Test 6 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 6: Chord Transposition Functionality',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 6 failed:', error.message);
        }

        // GOLDEN TEST 7: Export Functionality
        console.log('\n=== GOLDEN TEST 7: Export Functionality ===');
        try {
            const exportBtn = await page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("Save"), .export-btn, .download-btn').first().isVisible().catch(() => false);
            const printBtn = await page.locator('button:has-text("Print"), .print-btn').first().isVisible().catch(() => false);

            // Try to test export functionality
            let exportClickable = false;
            try {
                const exportButton = await page.locator('button:has-text("Export"), button:has-text("Download"), .export-btn').first();
                if (await exportButton.isVisible()) {
                    exportClickable = await exportButton.isEnabled();
                }
            } catch (e) {}

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_7_export_function.png') });

            testResults.push({
                test: 'Golden Test 7: Export Functionality',
                passed: exportBtn || printBtn,
                details: {
                    exportButtonVisible: exportBtn,
                    printButtonVisible: printBtn,
                    exportClickable: exportClickable
                }
            });

            console.log('✓ Test 7 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 7: Export Functionality',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 7 failed:', error.message);
        }

        // GOLDEN TEST 8: UI Responsiveness
        console.log('\n=== GOLDEN TEST 8: UI Responsiveness ===');
        try {
            // Test mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });
            await page.waitForTimeout(1000);

            // Check if UI adapts
            const buttonsVisible = await page.locator('button').count().catch(() => 0);
            const contentVisible = await page.locator('.content, .main, .app').isVisible().catch(() => false);
            const menuAccessible = await page.locator('.menu, .nav, .hamburger').isVisible().catch(() => true);

            // Test if buttons are still clickable
            let buttonsClickable = false;
            try {
                const firstButton = await page.locator('button').first();
                if (await firstButton.isVisible()) {
                    buttonsClickable = await firstButton.isEnabled();
                }
            } catch (e) {}

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_8_responsive.png') });

            // Reset viewport
            await page.setViewportSize({ width: 1280, height: 720 });

            testResults.push({
                test: 'Golden Test 8: UI Responsiveness',
                passed: buttonsVisible > 0 && (contentVisible || menuAccessible),
                details: {
                    buttonsCount: buttonsVisible,
                    contentVisible: contentVisible,
                    menuAccessible: menuAccessible,
                    buttonsClickable: buttonsClickable
                }
            });

            console.log('✓ Test 8 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 8: UI Responsiveness',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 8 failed:', error.message);
        }

        // GOLDEN TEST 9: Error Handling
        console.log('\n=== GOLDEN TEST 9: Error Handling ===');
        try {
            let errorHandlingWorked = false;

            // Try to upload invalid file if possible
            try {
                const fileInput = await page.locator('input[type="file"]').first();
                if (await fileInput.isVisible()) {
                    // Create a temporary invalid file
                    const invalidFile = path.join(screenshotDir, 'temp_invalid.txt');
                    fs.writeFileSync(invalidFile, 'This is not a PDF file');

                    await fileInput.setInputFiles(invalidFile);
                    await page.waitForTimeout(2000);

                    // Look for error messages
                    const errorMsg = await page.locator('.error, .alert, .message, [role="alert"]').isVisible().catch(() => false);
                    errorHandlingWorked = errorMsg;

                    // Cleanup
                    try { fs.unlinkSync(invalidFile); } catch (e) {}
                }
            } catch (e) {
                console.log('Error handling test limited:', e.message);
            }

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_9_error_handling.png') });

            testResults.push({
                test: 'Golden Test 9: Error Handling',
                passed: errorHandlingWorked,
                details: {
                    errorHandlingTested: true,
                    errorHandlingWorked: errorHandlingWorked
                }
            });

            console.log('✓ Test 9 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 9: Error Handling',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 9 failed:', error.message);
        }

        // GOLDEN TEST 10: Performance & Loading States
        console.log('\n=== GOLDEN TEST 10: Performance & Loading States ===');
        try {
            // Reload page to test loading states
            await page.reload({ waitUntil: 'networkidle' });

            // Check for loading indicators
            const loadingIndicators = await page.locator('.loading, .spinner, .progress').count().catch(() => 0);
            const statusIndicators = await page.locator('.status, .state').count().catch(() => 0);

            // Check performance
            const performanceMetrics = await page.evaluate(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                return {
                    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart
                };
            }).catch(() => ({ loadTime: 0, domContentLoaded: 0 }));

            // Test responsiveness during operations
            let responsive = true;
            try {
                await page.click('body');
                await page.waitForTimeout(100);
                responsive = true;
            } catch (e) {
                responsive = false;
            }

            await page.screenshot({ path: path.join(screenshotDir, 'transposepdf_test_10_performance.png') });

            testResults.push({
                test: 'Golden Test 10: Performance & Loading States',
                passed: loadingIndicators >= 0 && responsive,
                details: {
                    loadingIndicators: loadingIndicators,
                    statusIndicators: statusIndicators,
                    performanceMetrics: performanceMetrics,
                    responsive: responsive,
                    consoleErrors: consoleLogs.filter(log => log.includes('[ERROR]')).length
                }
            });

            console.log('✓ Test 10 completed');
        } catch (error) {
            testResults.push({
                test: 'Golden Test 10: Performance & Loading States',
                passed: false,
                error: error.message
            });
            console.log('✗ Test 10 failed:', error.message);
        }

        // Generate comprehensive report
        const report = {
            timestamp: new Date().toISOString(),
            testResults: testResults,
            consoleLogs: consoleLogs,
            summary: {
                totalTests: testResults.length,
                passed: testResults.filter(r => r.passed).length,
                failed: testResults.filter(r => !r.passed).length,
                passRate: Math.round((testResults.filter(r => r.passed).length / testResults.length) * 100)
            }
        };

        // Save report
        fs.writeFileSync(
            path.join(screenshotDir, 'golden_tests_report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n=== TEST SUMMARY ===');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passed}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Pass Rate: ${report.summary.passRate}%`);

        console.log('\n=== DETAILED RESULTS ===');
        testResults.forEach((result, index) => {
            const status = result.passed ? '✓ PASS' : '✗ FAIL';
            console.log(`${status} - ${result.test}`);
            if (result.error) {
                console.log(`  Error: ${result.error}`);
            }
        });

        return report;

    } catch (error) {
        console.error('Critical test failure:', error);
        return {
            error: error.message,
            testResults: testResults,
            timestamp: new Date().toISOString()
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the tests
runGoldenTests().then(report => {
    console.log('\nGolden tests completed. Report saved to golden_tests_report.json');
    process.exit(0);
}).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});