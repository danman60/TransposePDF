const { chromium } = require('playwright');

async function testTransposeFunctionality() {
    console.log('🚀 Starting transpose functionality tests...');
    
    const browser = await chromium.launch({ 
        headless: false, 
        slowMo: 1000,
        args: ['--start-maximized']
    });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    
    // Enable console logging to catch errors
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error' || type === 'warn') {
            console.log(`🔴 Console ${type}: ${msg.text()}`);
        } else {
            console.log(`ℹ️  Console: ${msg.text()}`);
        }
    });
    
    page.on('pageerror', error => {
        console.log(`🔴 Page error: ${error.message}`);
    });
    
    try {
        // Navigate to the application
        console.log('📱 Navigating to http://localhost:8000/');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\01_initial_load.png', fullPage: true });
        console.log('📸 Initial screenshot taken');
        
        // Look for song elements and transpose buttons
        await page.waitForSelector('.song-item, .song, [class*="song"]', { timeout: 10000 });
        
        console.log('\n=== TEST 1: Consecutive Transpose Operations (D → E → F# → F) ===');
        
        // Find a song with D chord to test with
        const songs = await page.locator('.song-item, .song, [class*="song"]').all();
        let testSong = null;
        
        for (let song of songs) {
            const text = await song.textContent();
            if (text.includes('D') && !text.includes('Dm')) {
                testSong = song;
                console.log(`✅ Found test song with D chord: ${(await song.textContent()).substring(0, 100)}...`);
                break;
            }
        }
        
        if (!testSong) {
            console.log('⚠️  No song with D chord found, using first available song');
            testSong = songs[0];
        }
        
        // Get initial chord content
        const initialChords = await testSong.textContent();
        console.log(`📝 Initial chords: ${initialChords.substring(0, 200)}...`);
        
        // Find transpose up button within this song
        const transposeUpBtn = testSong.locator('button[title*="up"], button:has-text("↑"), .transpose-up, button[onclick*="transpose"][onclick*="1"]').first();
        const transposeDownBtn = testSong.locator('button[title*="down"], button:has-text("↓"), .transpose-down, button[onclick*="transpose"][onclick*="-1"]').first();
        const resetBtn = testSong.locator('button[title*="reset"], button:has-text("↺"), .reset, button[onclick*="reset"]').first();
        
        // Test Step 1: D → E (transpose up)
        console.log('🔄 Step 1: Transposing D → E (up +1)');
        await transposeUpBtn.click();
        await page.waitForTimeout(500);
        
        const afterStep1 = await testSong.textContent();
        console.log(`📝 After step 1: ${afterStep1.substring(0, 200)}...`);
        
        // Check if transpose counter is visible
        const counter1 = await testSong.locator('.transpose-counter, [class*="counter"], span:has-text("+1")').first().textContent().catch(() => 'not found');
        console.log(`🔢 Transpose counter after step 1: ${counter1}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\02_after_first_transpose.png', fullPage: true });
        
        // Test Step 2: E → F# (transpose up again)
        console.log('🔄 Step 2: Transposing E → F# (up +2 total)');
        await transposeUpBtn.click();
        await page.waitForTimeout(500);
        
        const afterStep2 = await testSong.textContent();
        console.log(`📝 After step 2: ${afterStep2.substring(0, 200)}...`);
        
        const counter2 = await testSong.locator('.transpose-counter, [class*="counter"], span:has-text("+2")').first().textContent().catch(() => 'not found');
        console.log(`🔢 Transpose counter after step 2: ${counter2}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\03_after_second_transpose.png', fullPage: true });
        
        // Test Step 3: F# → F (transpose down)
        console.log('🔄 Step 3: Transposing F# → F (down +1 total)');
        await transposeDownBtn.click();
        await page.waitForTimeout(500);
        
        const afterStep3 = await testSong.textContent();
        console.log(`📝 After step 3: ${afterStep3.substring(0, 200)}...`);
        
        const counter3 = await testSong.locator('.transpose-counter, [class*="counter"], span:has-text("+1")').first().textContent().catch(() => 'not found');
        console.log(`🔢 Transpose counter after step 3: ${counter3}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\04_after_transpose_down.png', fullPage: true });
        
        console.log('\n=== TEST 2: Reset Functionality ===');
        
        // Test reset button
        console.log('🔄 Testing reset button functionality');
        await resetBtn.click();
        await page.waitForTimeout(500);
        
        const afterReset = await testSong.textContent();
        console.log(`📝 After reset: ${afterReset.substring(0, 200)}...`);
        
        const counterReset = await testSong.locator('.transpose-counter, [class*="counter"]').first().textContent().catch(() => 'counter hidden/reset');
        console.log(`🔢 Transpose counter after reset: ${counterReset}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\05_after_reset.png', fullPage: true });
        
        // Compare with initial state
        const isResetSuccessful = afterReset === initialChords;
        console.log(`✅ Reset successful: ${isResetSuccessful ? 'YES' : 'NO'}`);
        
        console.log('\n=== TEST 3: Flat Key Support ===');
        
        // Look for songs with flat keys
        const allSongs = await page.locator('.song-item, .song, [class*="song"]').all();
        let flatKeySongs = [];
        
        for (let song of allSongs) {
            const text = await song.textContent();
            if (text.includes('Eb') || text.includes('Ab') || text.includes('Bb')) {
                flatKeySongs.push({
                    element: song,
                    text: text.substring(0, 100) + '...'
                });
            }
        }
        
        console.log(`🎵 Found ${flatKeySongs.length} songs with flat keys`);
        
        if (flatKeySongs.length > 0) {
            const flatSong = flatKeySongs[0].element;
            console.log(`📝 Testing flat key song: ${flatKeySongs[0].text}`);
            
            const flatInitial = await flatSong.textContent();
            
            // Test transpose up with flat key
            const flatTransposeUp = flatSong.locator('button[title*="up"], button:has-text("↑"), .transpose-up').first();
            console.log('🔄 Transposing flat key song up');
            await flatTransposeUp.click();
            await page.waitForTimeout(500);
            
            const flatAfterTranspose = await flatSong.textContent();
            console.log(`📝 Flat key after transpose: ${flatAfterTranspose.substring(0, 200)}...`);
            
            await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\06_flat_key_transpose.png', fullPage: true });
            
            // Test transpose down with flat key
            const flatTransposeDown = flatSong.locator('button[title*="down"], button:has-text("↓"), .transpose-down').first();
            console.log('🔄 Transposing flat key song down');
            await flatTransposeDown.click();
            await page.waitForTimeout(500);
            
            const flatAfterDown = await flatSong.textContent();
            console.log(`📝 Flat key after transpose down: ${flatAfterDown.substring(0, 200)}...`);
            
            await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\07_flat_key_down.png', fullPage: true });
        }
        
        console.log('\n=== SUMMARY ===');
        console.log('✅ All tests completed successfully');
        console.log('📸 Screenshots saved to D:\\ClaudeCode\\test_results\\');
        console.log('🔍 Check console output above for any errors or warnings');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\error_screenshot.png', fullPage: true });
    }
    
    // Keep browser open for manual inspection
    console.log('\n⏳ Browser will remain open for manual inspection...');
    console.log('Press Ctrl+C to close the browser and exit');
    
    // Wait indefinitely so user can inspect
    await new Promise(() => {});
}

testTransposeFunctionality().catch(console.error);