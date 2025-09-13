const { chromium } = require('playwright');

async function testTransposePDFUIIssues() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => console.log(`BROWSER CONSOLE: ${msg.text()}`));
    page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    
    console.log('Starting TransposePDF UI interaction tests...');
    
    try {
        // Navigate to the app
        console.log('1. Navigating to TransposePDF app...');
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_01_initial_load.png', fullPage: true });
        console.log('Screenshot saved: ui_01_initial_load.png');
        
        // Analyze initial state
        console.log('\n2. Analyzing initial application state...');
        
        // Check system health indicators
        const healthChecks = await page.evaluate(() => {
            const healthItems = document.querySelectorAll('.health-item, [class*="health"]');
            return Array.from(healthItems).map(item => ({
                text: item.textContent?.trim(),
                classes: item.className,
                status: item.textContent?.includes('PASS') ? 'PASS' : 
                        item.textContent?.includes('FAIL') ? 'FAIL' : 'UNKNOWN'
            }));
        });
        
        console.log('System Health Status:');
        healthChecks.forEach(check => {
            console.log(`  ${check.text} - ${check.status}`);
        });
        
        // Test Issue 1: PDF Loading Process (without actual file)
        console.log('\n3. Testing PDF Loading UI Process...');
        
        // Look for the visible "Choose PDF File" button
        const chooseFileBtn = page.locator('button:has-text("Choose PDF File")');
        const isBtnVisible = await chooseFileBtn.isVisible();
        const isBtnEnabled = await chooseFileBtn.isEnabled();
        
        console.log(`Choose PDF File button - Visible: ${isBtnVisible}, Enabled: ${isBtnEnabled}`);
        
        if (isBtnVisible && isBtnEnabled) {
            console.log('Clicking Choose PDF File button...');
            
            // Click the button (this will open file dialog, but we'll cancel it)
            await chooseFileBtn.click();
            await page.waitForTimeout(1000);
            
            // Press Escape to cancel file dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1000);
            
            await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_02_file_dialog_test.png', fullPage: true });
            console.log('Screenshot saved: ui_02_file_dialog_test.png');
        }
        
        // Test Issue 2: Examine current display area for lyrics/chords
        console.log('\n4. Analyzing display area for lyrics/chord issues...');
        
        // Look for main content display areas
        const displaySelectors = [
            '#pdfDisplay', 
            '.pdf-display', 
            '.chord-display', 
            '.main-content',
            'main',
            '.content-area',
            '.lyrics-display',
            '.song-display'
        ];
        
        for (const selector of displaySelectors) {
            const element = page.locator(selector);
            const count = await element.count();
            
            if (count > 0) {
                const isVisible = await element.first().isVisible();
                const textContent = await element.first().textContent();
                const innerHTML = await element.first().innerHTML();
                
                console.log(`\nFound display element: ${selector}`);
                console.log(`  Visible: ${isVisible}`);
                console.log(`  Text content: "${textContent?.substring(0, 100)}..."`);
                console.log(`  HTML preview: "${innerHTML?.substring(0, 200)}..."`);
                
                if (isVisible) {
                    // Check background and styling
                    const styles = await element.first().evaluate(el => {
                        const computed = window.getComputedStyle(el);
                        return {
                            backgroundColor: computed.backgroundColor,
                            color: computed.color,
                            width: computed.width,
                            height: computed.height,
                            display: computed.display
                        };
                    });
                    console.log(`  Styles:`, styles);
                }
            }
        }
        
        // Check for any existing chord or lyric content (might be test data)
        const chordElements = await page.locator('[class*="chord"], .chord').count();
        const lyricsElements = await page.locator('[class*="lyrics"], [class*="text"], .lyrics').count();
        
        console.log(`\nContent analysis:`);
        console.log(`  Chord-related elements: ${chordElements}`);
        console.log(`  Lyrics/text elements: ${lyricsElements}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_03_display_analysis.png', fullPage: true });
        console.log('Screenshot saved: ui_03_display_analysis.png');
        
        // Test Issue 3: Export functionality availability
        console.log('\n5. Testing Export Functionality Availability...');
        
        const exportSelectors = [
            'button:has-text("Export")',
            'button:has-text("Download")', 
            'button:has-text("Generate PDF")',
            'button:has-text("Save")',
            '.export-btn',
            '#export',
            '[data-action="export"]'
        ];
        
        let exportButtonFound = false;
        
        for (const selector of exportSelectors) {
            const element = page.locator(selector);
            const count = await element.count();
            
            if (count > 0) {
                const isVisible = await element.first().isVisible();
                const isEnabled = await element.first().isEnabled();
                const text = await element.first().textContent();
                
                console.log(`\nFound export element: ${selector}`);
                console.log(`  Text: "${text}"`);
                console.log(`  Visible: ${isVisible}`);
                console.log(`  Enabled: ${isEnabled}`);
                
                exportButtonFound = true;
                
                if (!isVisible) {
                    console.log('  Export button is not visible - this might be the issue!');
                }
                if (!isEnabled) {
                    console.log('  Export button is disabled - might need PDF loaded first');
                }
            }
        }
        
        if (!exportButtonFound) {
            console.log('No export buttons found in the UI');
        }
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_04_export_analysis.png', fullPage: true });
        console.log('Screenshot saved: ui_04_export_analysis.png');
        
        // Test Issue 4: Overall User Experience Documentation
        console.log('\n6. Documenting Overall User Experience...');
        
        // Get complete page structure for analysis
        const pageAnalysis = await page.evaluate(() => {
            // Check for empty or sparse content
            const mainContent = document.querySelector('main, .main-content, .content-area');
            const hasLoadingState = !!document.querySelector('.loading, .spinner, [class*="loading"]');
            const hasErrorState = !!document.querySelector('.error, [class*="error"]');
            
            // Count functional elements
            const buttons = document.querySelectorAll('button').length;
            const inputs = document.querySelectorAll('input').length;
            const canvases = document.querySelectorAll('canvas').length;
            
            // Check for specific UI patterns
            const hasDropZone = !!document.querySelector('[class*="drop"], .dropzone, .drag');
            const hasFileInput = !!document.querySelector('input[type="file"]');
            
            // Analyze layout
            const bodyStyle = window.getComputedStyle(document.body);
            
            return {
                hasMainContent: !!mainContent,
                mainContentVisible: mainContent ? window.getComputedStyle(mainContent).display !== 'none' : false,
                hasLoadingState,
                hasErrorState,
                elementCounts: { buttons, inputs, canvases },
                uiFeatures: { hasDropZone, hasFileInput },
                bodyBackground: bodyStyle.backgroundColor,
                bodyColor: bodyStyle.color,
                pageTitle: document.title,
                url: window.location.href
            };
        });
        
        console.log('\nPage Analysis Results:');
        console.log(JSON.stringify(pageAnalysis, null, 2));
        
        // Take a final comprehensive screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_05_final_comprehensive.png', fullPage: true });
        console.log('Screenshot saved: ui_05_final_comprehensive.png');
        
        // Test actual UI interaction flow
        console.log('\n7. Testing Complete UI Interaction Flow...');
        
        // Try to interact with drag and drop area if it exists
        const dropArea = page.locator('.drop-zone, [class*="drop"], .file-drop-area');
        if (await dropArea.count() > 0) {
            console.log('Found drop area, testing drag and drop UI feedback...');
            
            // Simulate hover over drop area
            await dropArea.first().hover();
            await page.waitForTimeout(1000);
            
            await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_06_drop_area_hover.png', fullPage: true });
            console.log('Screenshot saved: ui_06_drop_area_hover.png');
        }
        
        console.log('\n8. SUMMARY OF FINDINGS:');
        console.log('================================');
        
        // Summarize the issues found
        const issues = [];
        
        // Check jsPDF loading issue
        const jsPDFFail = healthChecks.some(check => 
            check.text?.includes('jsPDF') && check.status === 'FAIL'
        );
        if (jsPDFFail) {
            issues.push('jsPDF library is failing to load properly - this affects PDF generation');
        }
        
        // Check if export functionality is available
        if (!exportButtonFound) {
            issues.push('No export/download buttons found in the UI');
        }
        
        // Report findings
        if (issues.length > 0) {
            console.log('ISSUES IDENTIFIED:');
            issues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
        } else {
            console.log('No major UI issues identified in current state');
        }
        
        console.log('\nAll screenshots saved to: D:\\ClaudeCode\\TransposePDF\\screenshots\\');
        
    } catch (error) {
        console.error('Test error:', error);
        await page.screenshot({ path: 'D:\\ClaudeCode\\TransposePDF\\screenshots\\ui_error_state.png', fullPage: true });
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
testTransposePDFUIIssues().catch(console.error);