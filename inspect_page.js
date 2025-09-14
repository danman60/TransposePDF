const { chromium } = require('playwright');

async function inspectPage() {
    console.log('🔍 Inspecting page structure...');
    
    const browser = await chromium.launch({ 
        headless: false, 
        slowMo: 500
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Give it time to fully load
        
        // Take a screenshot first
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\page_inspection.png', fullPage: true });
        console.log('📸 Screenshot taken');
        
        // Get page title and basic info
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);
        
        // Find all elements that might contain songs
        const allElements = await page.evaluate(() => {
            const elements = [];
            
            // Look for various selectors that might contain songs
            const selectors = [
                '.song', '.song-item', '[class*="song"]',
                '.chord', '[class*="chord"]', 
                '#songsSection', '.songs-section',
                'div[id*="song"]', 'section[id*="song"]'
            ];
            
            selectors.forEach(selector => {
                const found = document.querySelectorAll(selector);
                if (found.length > 0) {
                    elements.push({
                        selector: selector,
                        count: found.length,
                        firstElementText: found[0].textContent.substring(0, 200),
                        innerHTML: found[0].innerHTML.substring(0, 300)
                    });
                }
            });
            
            return elements;
        });
        
        console.log('🎵 Found elements:');
        allElements.forEach(el => {
            console.log(`  - ${el.selector}: ${el.count} elements`);
            console.log(`    First text: ${el.firstElementText.trim()}`);
            console.log(`    HTML: ${el.innerHTML.trim()}`);
            console.log('');
        });
        
        // Look specifically for transpose buttons
        const buttons = await page.evaluate(() => {
            const buttons = [];
            const buttonElements = document.querySelectorAll('button');
            
            buttonElements.forEach((btn, index) => {
                buttons.push({
                    index,
                    text: btn.textContent.trim(),
                    title: btn.title || '',
                    onclick: btn.onclick ? btn.onclick.toString() : '',
                    classes: btn.className
                });
            });
            
            return buttons;
        });
        
        console.log('🔘 Found buttons:');
        buttons.forEach(btn => {
            console.log(`  Button ${btn.index}: "${btn.text}" (title: "${btn.title}", classes: "${btn.classes}")`);
            if (btn.onclick) {
                console.log(`    onclick: ${btn.onclick.substring(0, 100)}...`);
            }
        });
        
        console.log('\n✅ Page inspection complete');
        
    } catch (error) {
        console.error('❌ Inspection failed:', error);
    }
    
    await browser.close();
}

inspectPage().catch(console.error);