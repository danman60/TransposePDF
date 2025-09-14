const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testTransposePDFApp() {
    const browser = await chromium.launch({ headless: false, slowMo: 1000 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Array to collect console messages
    const consoleMessages = [];
    const errors = [];
    
    // Listen for console events
    page.on('console', msg => {
        const message = {
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        };
        consoleMessages.push(message);
        console.log(`[${message.type.toUpperCase()}] ${message.text}`);
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };
        errors.push(errorInfo);
        console.error('PAGE ERROR:', error.message);
    });
    
    try {
        console.log('Navigating to http://localhost:8000/...');
        await page.goto('http://localhost:8000/', { waitUntil: 'networkidle' });
        
        // Wait a bit for dynamic content to load
        await page.waitForTimeout(3000);
        
        console.log('Taking initial screenshot...');
        await page.screenshot({ path: 'D:/ClaudeCode/initial_state.png', fullPage: true });
        
        // Get page title
        const title = await page.title();
        console.log(`Page title: ${title}`);
        
        // Check for file upload elements
        console.log('Checking for file upload functionality...');
        const fileInputs = await page.$$('input[type="file"]');
        const dropZones = await page.$$('[class*="drop"], [class*="upload"], [data-drop]');
        
        console.log(`Found ${fileInputs.length} file input elements`);
        console.log(`Found ${dropZones.length} potential drop zone elements`);
        
        // Look for song-related elements
        console.log('Analyzing song detection...');
        const songElements = await page.$$eval('*', (elements) => {
            const songRelated = [];
            elements.forEach(el => {
                const text = el.textContent || '';
                const className = el.className || '';
                const id = el.id || '';
                
                // Look for song-related content
                if (text.toLowerCase().includes('song') || 
                    className.toLowerCase().includes('song') ||
                    id.toLowerCase().includes('song') ||
                    text.match(/\b(chord|key|transpose)\b/i)) {
                    songRelated.push({
                        tag: el.tagName,
                        text: text.slice(0, 100),
                        className: className,
                        id: id
                    });
                }
            });
            return songRelated;
        });
        
        console.log(`Found ${songElements.length} song-related elements`);
        songElements.forEach((el, idx) => {
            console.log(`Song element ${idx + 1}: ${el.tag} - "${el.text}"`);
        });
        
        // Get all visible text content to analyze
        const pageContent = await page.evaluate(() => {
            return document.body.innerText;
        });
        
        // Look for specific patterns that might indicate songs
        const songTitlePatterns = [
            /song\s*\d+/gi,
            /title:\s*([^\n]+)/gi,
            /\d+\.\s*([^\n]+)/gi
        ];
        
        const detectedSongs = [];
        songTitlePatterns.forEach(pattern => {
            const matches = pageContent.match(pattern);
            if (matches) {
                detectedSongs.push(...matches);
            }
        });
        
        console.log(`Detected potential song titles: ${detectedSongs.length}`);
        detectedSongs.forEach((song, idx) => {
            console.log(`  ${idx + 1}: ${song}`);
        });
        
        // Check for specific UI elements
        const uiElements = await page.evaluate(() => {
            const elements = {
                buttons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent.trim()),
                inputs: Array.from(document.querySelectorAll('input')).map(input => ({ 
                    type: input.type, 
                    placeholder: input.placeholder,
                    id: input.id,
                    name: input.name
                })),
                headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent.trim()),
                links: Array.from(document.querySelectorAll('a')).map(a => ({ 
                    text: a.textContent.trim(), 
                    href: a.href 
                }))
            };
            return elements;
        });
        
        console.log('\n=== UI ELEMENTS ANALYSIS ===');
        console.log(`Buttons found: ${uiElements.buttons.length}`);
        uiElements.buttons.forEach((btn, idx) => {
            console.log(`  Button ${idx + 1}: "${btn}"`);
        });
        
        console.log(`\nInputs found: ${uiElements.inputs.length}`);
        uiElements.inputs.forEach((input, idx) => {
            console.log(`  Input ${idx + 1}: type="${input.type}", placeholder="${input.placeholder}", id="${input.id}"`);
        });
        
        console.log(`\nHeadings found: ${uiElements.headings.length}`);
        uiElements.headings.forEach((heading, idx) => {
            console.log(`  Heading ${idx + 1}: "${heading}"`);
        });
        
        // Wait a bit more to catch any delayed errors
        console.log('\nWaiting for potential delayed errors...');
        await page.waitForTimeout(5000);
        
        // Final screenshot after waiting
        await page.screenshot({ path: 'D:/ClaudeCode/final_state.png', fullPage: true });
        
        // Generate comprehensive report
        const report = {
            timestamp: new Date().toISOString(),
            url: 'http://localhost:8000/',
            pageTitle: title,
            consoleMessages: consoleMessages,
            errors: errors,
            songElements: songElements,
            detectedSongs: detectedSongs,
            uiElements: uiElements,
            fileUploadSupport: {
                fileInputCount: fileInputs.length,
                dropZoneCount: dropZones.length
            }
        };
        
        // Save report to file
        fs.writeFileSync('D:/ClaudeCode/test_report.json', JSON.stringify(report, null, 2));
        
        console.log('\n=== TEST SUMMARY ===');
        console.log(`Page loaded successfully: ${title}`);
        console.log(`Console messages: ${consoleMessages.length}`);
        console.log(`Errors detected: ${errors.length}`);
        console.log(`Song-related elements: ${songElements.length}`);
        console.log(`Potential song titles detected: ${detectedSongs.length}`);
        console.log(`File upload inputs: ${fileInputs.length}`);
        console.log(`Screenshots saved: initial_state.png, final_state.png`);
        console.log(`Full report saved: test_report.json`);
        
    } catch (error) {
        console.error('Test failed:', error);
        errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    } finally {
        await browser.close();
    }
}

testTransposePDFApp().catch(console.error);