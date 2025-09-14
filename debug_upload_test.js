const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugUploadProcess() {
    let browser, context, page;
    const baseUrl = 'http://localhost:8080';
    const testPdfPath = 'D:\\ClaudeCode\\TransposePDF\\test_chord_chart.pdf';

    try {
        // Launch browser with console logs
        browser = await chromium.launch({
            headless: false,
            slowMo: 2000
        });
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        page = await context.newPage();

        // Collect console logs and errors
        const consoleLogs = [];
        page.on('console', msg => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
            console.log(`Browser Console [${msg.type()}]: ${msg.text()}`);
        });

        page.on('pageerror', error => {
            consoleLogs.push(`[PAGE ERROR] ${error.message}`);
            console.log(`Browser Error: ${error.message}`);
        });

        page.on('requestfailed', request => {
            consoleLogs.push(`[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`);
            console.log(`Request Failed: ${request.url()} - ${request.failure().errorText}`);
        });

        // Navigate to the app
        console.log('Navigating to application...');
        await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

        // Wait for app to initialize
        console.log('Waiting for app initialization...');
        await page.waitForTimeout(3000);

        // Take initial screenshot
        await page.screenshot({ path: 'debug_initial.png' });

        // Check if modules are loaded by checking for the classes
        console.log('Checking if modules are loaded...');
        const moduleCheck = await page.evaluate(() => {
            return {
                PDFProcessor: typeof PDFProcessor !== 'undefined',
                SongSeparator: typeof SongSeparator !== 'undefined',
                MusicTheory: typeof MusicTheory !== 'undefined',
                PDFGenerator: typeof PDFGenerator !== 'undefined',
                UIController: typeof UIController !== 'undefined',
                transposeApp: typeof window.transposeApp !== 'undefined'
            };
        });
        console.log('Module check results:', moduleCheck);

        // Check if file input exists and is properly configured
        console.log('Checking file input...');
        const fileInputExists = await page.locator('input[type="file"]').isVisible();
        console.log(`File input visible: ${fileInputExists}`);

        if (fileInputExists) {
            // Check file input attributes
            const fileInputInfo = await page.evaluate(() => {
                const input = document.querySelector('input[type="file"]');
                return {
                    accept: input.accept,
                    id: input.id,
                    hidden: input.hidden
                };
            });
            console.log('File input info:', fileInputInfo);

            // Try to upload the test PDF
            if (fs.existsSync(testPdfPath)) {
                console.log('Uploading test PDF...');

                // Set file input
                await page.locator('input[type="file"]').setInputFiles(testPdfPath);

                // Wait for processing
                console.log('Waiting for PDF processing...');
                await page.waitForTimeout(5000);

                // Check for progress indicators
                const progressVisible = await page.locator('#uploadProgress').isVisible().catch(() => false);
                console.log(`Upload progress visible: ${progressVisible}`);

                // Check for songs section
                const songsVisible = await page.locator('#songsSection').isVisible().catch(() => false);
                console.log(`Songs section visible: ${songsVisible}`);

                // Check for any error messages
                const errorVisible = await page.locator('#errorPanel').isVisible().catch(() => false);
                console.log(`Error panel visible: ${errorVisible}`);

                if (errorVisible) {
                    const errorText = await page.locator('#errorMessage').textContent().catch(() => 'No error text');
                    console.log(`Error message: ${errorText}`);
                }

                // Take screenshot after upload attempt
                await page.screenshot({ path: 'debug_after_upload.png' });

                // Get current app state
                const appState = await page.evaluate(() => {
                    if (window.transposeApp) {
                        return window.transposeApp.getState();
                    }
                    return { error: 'transposeApp not available' };
                });
                console.log('App state:', appState);

            } else {
                console.log(`Test PDF not found at: ${testPdfPath}`);
            }
        }

        // Get final console logs
        console.log('\n=== CONSOLE LOGS ===');
        consoleLogs.forEach(log => console.log(log));

        // Generate report
        const report = {
            timestamp: new Date().toISOString(),
            moduleCheck,
            fileInputExists,
            consoleLogs,
            testPdfExists: fs.existsSync(testPdfPath)
        };

        fs.writeFileSync('debug_upload_report.json', JSON.stringify(report, null, 2));
        console.log('\nDebug report saved to debug_upload_report.json');

        // Keep browser open for manual inspection
        console.log('Press Enter to close browser...');
        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

    } catch (error) {
        console.error('Debug test failed:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run the debug test
debugUploadProcess();