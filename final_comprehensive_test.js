const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function comprehensiveTest() {
    let browser, context, page;
    const baseUrl = 'http://localhost:8080';
    const testPdfPath = 'D:\\ClaudeCode\\TransposePDF\\test_chord_chart.pdf';
    const screenshotDir = 'D:\\ClaudeCode\\TransposePDF';

    const testResults = [];
    const consoleLogs = [];

    try {
        // Launch browser
        browser = await chromium.launch({
            headless: false,
            slowMo: 1000
        });
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        page = await context.newPage();

        // Collect console logs and errors
        page.on('console', msg => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        });

        page.on('pageerror', error => {
            consoleLogs.push(`[ERROR] ${error.message}`);
        });

        console.log('=== COMPREHENSIVE TRANSPOSEPDF TEST ===');
        console.log('Starting comprehensive test...');

        // TEST 1: Page Loading and Initial State
        console.log('\n1. Testing page loading and initial state...');
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        const pageTitle = await page.title();
        const mainHeading = await page.locator('h1').first().textContent();
        const uploadAreaVisible = await page.locator('.upload-area').isVisible();
        const uploadButtonVisible = await page.locator('.upload-button').isVisible();
        const fileInputExists = await page.locator('#fileInput').count() > 0;

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_1_loading.png') });

        testResults.push({
            test: 'Page Loading & Initial State',
            passed: uploadAreaVisible && uploadButtonVisible && fileInputExists,
            details: { pageTitle, mainHeading, uploadAreaVisible, uploadButtonVisible, fileInputExists }
        });

        // TEST 2: Upload Interface and Functionality
        console.log('\n2. Testing upload interface...');

        // Click upload area to trigger file selection
        const uploadButtonClickable = await page.locator('.upload-button').isEnabled();

        // Check if test PDF exists
        const testPdfExists = fs.existsSync(testPdfPath);

        let uploadProcessed = false;
        if (testPdfExists) {
            console.log('  - Uploading test PDF...');

            // Set file input directly (this is the proper way to test file uploads)
            await page.locator('#fileInput').setInputFiles(testPdfPath);

            // Wait for processing indicators
            await page.waitForTimeout(1000);

            // Look for loading or progress indicators
            const loadingVisible = await page.locator('#loadingOverlay').isVisible().catch(() => false);
            const progressVisible = await page.locator('#uploadProgress').isVisible().catch(() => false);

            console.log(`  - Loading overlay: ${loadingVisible}`);
            console.log(`  - Progress bar: ${progressVisible}`);

            // Wait for processing to complete (up to 10 seconds)
            for (let i = 0; i < 20; i++) {
                await page.waitForTimeout(500);
                const songsVisible = await page.locator('#songsSection').isVisible();
                const errorVisible = await page.locator('#errorPanel').isVisible();

                if (songsVisible || errorVisible) {
                    uploadProcessed = songsVisible;
                    break;
                }
            }
        }

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_2_upload.png') });

        testResults.push({
            test: 'Upload Interface & PDF Processing',
            passed: testPdfExists && uploadProcessed,
            details: {
                testPdfExists,
                uploadButtonClickable,
                uploadProcessed
            }
        });

        // TEST 3: Song Detection and Display
        console.log('\n3. Testing song detection...');

        const songsSection = await page.locator('#songsSection').isVisible().catch(() => false);
        const songCount = await page.locator('.song-count').textContent().catch(() => '0');
        const leadSheets = await page.locator('.lead-sheet').count().catch(() => 0);
        const exportButtonEnabled = await page.locator('#exportButton').isEnabled().catch(() => false);

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_3_songs.png') });

        testResults.push({
            test: 'Song Detection & Display',
            passed: songsSection && leadSheets > 0,
            details: { songsSection, songCount, leadSheets, exportButtonEnabled }
        });

        // TEST 4: Transpose Controls
        console.log('\n4. Testing transpose controls...');

        const transposeUpButtons = await page.locator('.transpose-button:has-text("+")').count();
        const transposeDownButtons = await page.locator('.transpose-button:has-text("-")').count();
        const keyIndicators = await page.locator('.key-indicator').count();
        const resetButtons = await page.locator('.reset-button').count();

        let transposeFunctional = false;
        if (transposeUpButtons > 0) {
            try {
                // Get initial key
                const initialKey = await page.locator('.key-indicator').first().textContent();

                // Click transpose up
                await page.locator('.transpose-button:has-text("+")').first().click();
                await page.waitForTimeout(500);

                // Get new key
                const newKey = await page.locator('.key-indicator').first().textContent();

                transposeFunctional = initialKey !== newKey;
                console.log(`  - Transpose test: ${initialKey} → ${newKey} (${transposeFunctional ? 'PASS' : 'FAIL'})`);
            } catch (e) {
                console.log(`  - Transpose test failed: ${e.message}`);
            }
        }

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_4_transpose.png') });

        testResults.push({
            test: 'Transpose Controls & Functionality',
            passed: transposeUpButtons > 0 && transposeDownButtons > 0 && transposeFunctional,
            details: {
                transposeUpButtons,
                transposeDownButtons,
                keyIndicators,
                resetButtons,
                transposeFunctional
            }
        });

        // TEST 5: Chord Display and Real-time Updates
        console.log('\n5. Testing chord display...');

        const chordElements = await page.locator('.chord-text, .chord').count();
        const pdfTextItems = await page.locator('.pdf-text-item').count();

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_5_chords.png') });

        testResults.push({
            test: 'Chord Display & Real-time Updates',
            passed: chordElements > 0 || pdfTextItems > 0,
            details: { chordElements, pdfTextItems }
        });

        // TEST 6: Export Functionality
        console.log('\n6. Testing export functionality...');

        let exportWorked = false;
        if (exportButtonEnabled) {
            try {
                await page.locator('#exportButton').click();
                await page.waitForTimeout(1000);

                const exportSectionVisible = await page.locator('#exportSection').isVisible();
                const exportFinalButton = await page.locator('#exportFinalButton').isVisible();

                exportWorked = exportSectionVisible && exportFinalButton;
            } catch (e) {
                console.log(`  - Export test failed: ${e.message}`);
            }
        }

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_6_export.png') });

        testResults.push({
            test: 'Export Functionality',
            passed: exportWorked,
            details: { exportWorked }
        });

        // TEST 7: Responsive Design
        console.log('\n7. Testing responsive design...');

        await page.setViewportSize({ width: 375, height: 667 }); // Mobile size
        await page.waitForTimeout(1000);

        const mobileUploadVisible = await page.locator('.upload-area').isVisible();
        const mobileButtonsVisible = await page.locator('button').count() > 0;

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_7_mobile.png') });

        // Reset viewport
        await page.setViewportSize({ width: 1280, height: 720 });

        testResults.push({
            test: 'Responsive Design',
            passed: mobileUploadVisible && mobileButtonsVisible,
            details: { mobileUploadVisible, mobileButtonsVisible }
        });

        // TEST 8: Error Handling
        console.log('\n8. Testing error handling...');

        let errorHandlingWorked = false;
        try {
            // Create a fake invalid file
            const invalidFile = path.join(screenshotDir, 'temp_invalid.txt');
            fs.writeFileSync(invalidFile, 'Not a PDF');

            // Try to upload invalid file
            await page.locator('#fileInput').setInputFiles(invalidFile);
            await page.waitForTimeout(2000);

            const errorPanelVisible = await page.locator('#errorPanel').isVisible();
            errorHandlingWorked = errorPanelVisible;

            // Cleanup
            fs.unlinkSync(invalidFile);

            // Close error if it appeared
            if (errorPanelVisible) {
                await page.locator('.error-close').click();
            }
        } catch (e) {
            console.log(`  - Error handling test limited: ${e.message}`);
        }

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_8_errors.png') });

        testResults.push({
            test: 'Error Handling',
            passed: errorHandlingWorked,
            details: { errorHandlingWorked }
        });

        // TEST 9: Performance and Loading States
        console.log('\n9. Testing performance...');

        const performanceMetrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            return {
                loadTime: Math.round(nav.loadEventEnd - nav.loadEventStart),
                domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart),
                memoryUsage: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : null
            };
        });

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_9_performance.png') });

        testResults.push({
            test: 'Performance & Loading States',
            passed: performanceMetrics.loadTime < 5000 && performanceMetrics.domContentLoaded < 5000,
            details: performanceMetrics
        });

        // TEST 10: Overall System Integration
        console.log('\n10. Testing overall system integration...');

        // Check module availability
        const moduleStatus = await page.evaluate(() => {
            return {
                PDFProcessor: typeof PDFProcessor !== 'undefined',
                SongSeparator: typeof SongSeparator !== 'undefined',
                MusicTheory: typeof MusicTheory !== 'undefined',
                PDFGenerator: typeof PDFGenerator !== 'undefined',
                UIController: typeof UIController !== 'undefined',
                transposeApp: window.transposeApp !== null
            };
        });

        const modulesLoaded = Object.values(moduleStatus).every(status => status);
        const criticalFeaturesWorking = testResults.filter(t =>
            ['Page Loading & Initial State', 'Upload Interface & PDF Processing', 'Transpose Controls & Functionality']
            .includes(t.test) && t.passed
        ).length === 3;

        await page.screenshot({ path: path.join(screenshotDir, 'final_test_10_integration.png') });

        testResults.push({
            test: 'Overall System Integration',
            passed: modulesLoaded && criticalFeaturesWorking,
            details: { moduleStatus, criticalFeaturesWorking }
        });

        // Generate comprehensive report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: testResults.length,
                passed: testResults.filter(t => t.passed).length,
                failed: testResults.filter(t => !t.passed).length,
                passRate: Math.round((testResults.filter(t => t.passed).length / testResults.length) * 100)
            },
            testResults,
            consoleLogs: consoleLogs.slice(-50), // Last 50 console logs
            performanceMetrics,
            moduleStatus,
            criticalIssues: testResults.filter(t => !t.passed).map(t => t.test),
            recommendations: []
        };

        // Add recommendations based on test results
        if (!testResults.find(t => t.test === 'Upload Interface & PDF Processing')?.passed) {
            report.recommendations.push('🔴 CRITICAL: PDF upload and processing is not working - check PDF.js library and file handling');
        }
        if (!testResults.find(t => t.test === 'Transpose Controls & Functionality')?.passed) {
            report.recommendations.push('🔴 CRITICAL: Chord transposition is not functional - check music theory module and transpose logic');
        }
        if (!testResults.find(t => t.test === 'Song Detection & Display')?.passed) {
            report.recommendations.push('🟡 HIGH: Song detection is not working - check song separation logic and PDF text extraction');
        }
        if (!testResults.find(t => t.test === 'Export Functionality')?.passed) {
            report.recommendations.push('🟡 HIGH: PDF export is not working - check jsPDF integration and export workflow');
        }
        if (!testResults.find(t => t.test === 'Error Handling')?.passed) {
            report.recommendations.push('🔵 MEDIUM: Error handling needs improvement for better user experience');
        }

        // Save comprehensive report
        fs.writeFileSync(
            path.join(screenshotDir, 'comprehensive_test_report.json'),
            JSON.stringify(report, null, 2)
        );

        console.log('\n=== COMPREHENSIVE TEST RESULTS ===');
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passed}`);
        console.log(`Failed: ${report.summary.failed}`);
        console.log(`Pass Rate: ${report.summary.passRate}%`);

        console.log('\n=== TEST DETAILS ===');
        testResults.forEach((result, index) => {
            const status = result.passed ? '✓ PASS' : '✗ FAIL';
            console.log(`${index + 1}. ${status} - ${result.test}`);
        });

        console.log('\n=== RECOMMENDATIONS ===');
        report.recommendations.forEach(rec => console.log(rec));

        return report;

    } catch (error) {
        console.error('Test execution failed:', error);
        return {
            error: error.message,
            testResults,
            consoleLogs,
            timestamp: new Date().toISOString()
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the comprehensive test
comprehensiveTest().then(report => {
    console.log('\n✓ Comprehensive test completed. Report saved to comprehensive_test_report.json');
    process.exit(0);
}).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});