const { chromium } = require('playwright');
const path = require('path');

async function testTransposeFunctionality() {
    console.log('🚀 Starting comprehensive transpose functionality tests...');
    
    const browser = await chromium.launch({ 
        headless: false, 
        slowMo: 800,
        args: ['--start-maximized']
    });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    
    // Track console output
    const consoleMessages = [];
    const errors = [];
    
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        consoleMessages.push({ type, text });
        
        if (type === 'error' || type === 'warn') {
            console.log(`🔴 Console ${type}: ${text}`);
            errors.push({ type, text });
        }
    });
    
    page.on('pageerror', error => {
        console.log(`🔴 Page error: ${error.message}`);
        errors.push({ type: 'pageerror', text: error.message });
    });
    
    try {
        console.log('📱 Navigating to http://localhost:8000/');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        
        // Wait for app initialization
        await page.waitForTimeout(2000);
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\01_app_loaded.png', fullPage: true });
        console.log('📸 Initial screenshot taken');
        
        console.log('🎵 Creating test songs programmatically...');
        
        // Create test songs using the app's internal functionality
        await page.evaluate(() => {
            // Create test songs directly using the app's classes
            const testSongs = [
                {
                    id: 'test1',
                    title: 'Test Song - D Key',
                    originalKey: 'D',
                    currentKey: 'D',
                    transposition: 0,
                    chords: [
                        { original: 'D', root: 'D', transposed: 'D' },
                        { original: 'G', root: 'G', transposed: 'G' },
                        { original: 'A', root: 'A', transposed: 'A' },
                        { original: 'Bm', root: 'Bm', transposed: 'Bm' }
                    ],
                    songText: 'D       G       A       Bm\\nTest song in D major\\nD       G       A       D\\nFor transpose testing'
                },
                {
                    id: 'test2',
                    title: 'Test Song - Flat Keys',
                    originalKey: 'Eb',
                    currentKey: 'Eb',
                    transposition: 0,
                    chords: [
                        { original: 'Eb', root: 'Eb', transposed: 'Eb' },
                        { original: 'Ab', root: 'Ab', transposed: 'Ab' },
                        { original: 'Bb', root: 'Bb', transposed: 'Bb' },
                        { original: 'Cm', root: 'Cm', transposed: 'Cm' }
                    ],
                    songText: 'Eb      Ab      Bb      Cm\\nTest song with flat keys\\nEb      Ab      Bb      Eb\\nFor flat key testing'
                }
            ];
            
            // Add songs to the app
            if (window.appData && window.appData.songs) {
                window.appData.songs = testSongs;
            } else {
                window.appData = { songs: testSongs };
            }
            
            // Trigger UI update if possible
            if (window.uiController && typeof window.uiController.displaySongs === 'function') {
                window.uiController.displaySongs(testSongs);
            } else if (window.displaySongs) {
                window.displaySongs(testSongs);
            } else {
                // Manual DOM creation for testing
                const songsContainer = document.getElementById('songsContainer');
                if (songsContainer) {
                    songsContainer.innerHTML = '';
                    
                    testSongs.forEach(song => {
                        const songDiv = document.createElement('div');
                        songDiv.className = 'song-item';
                        songDiv.id = `song-${song.id}`;
                        
                        songDiv.innerHTML = `
                            <div class="song-header">
                                <h3 class="song-title">${song.title}</h3>
                                <div class="song-controls">
                                    <span class="original-key">Original: ${song.originalKey}</span>
                                    <span class="transpose-counter" id="counter-${song.id}" style="display: ${song.transposition === 0 ? 'none' : 'inline'};">${song.transposition > 0 ? '+' : ''}${song.transposition}</span>
                                    <button class="transpose-btn transpose-down" data-song-id="${song.id}" title="Transpose down">↓</button>
                                    <button class="transpose-btn transpose-up" data-song-id="${song.id}" title="Transpose up">↑</button>
                                    <button class="reset-btn" data-song-id="${song.id}" title="Reset to original key">↺</button>
                                </div>
                            </div>
                            <div class="song-content">
                                <pre class="song-text" id="text-${song.id}">${song.songText}</pre>
                            </div>
                        `;
                        
                        songsContainer.appendChild(songDiv);
                    });
                    
                    // Add event listeners
                    songsContainer.addEventListener('click', function(e) {
                        if (e.target.classList.contains('transpose-up')) {
                            const songId = e.target.dataset.songId;
                            window.transposeSong(songId, 1);
                        } else if (e.target.classList.contains('transpose-down')) {
                            const songId = e.target.dataset.songId;
                            window.transposeSong(songId, -1);
                        } else if (e.target.classList.contains('reset-btn')) {
                            const songId = e.target.dataset.songId;
                            window.resetSong(songId);
                        }
                    });
                    
                    // Update song count
                    const songCount = document.getElementById('songCount');
                    if (songCount) {
                        songCount.textContent = testSongs.length;
                    }
                }
            }
            
            console.log('[TEST] Created test songs:', testSongs.length);
        });
        
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\02_songs_created.png', fullPage: true });
        console.log('📸 Test songs created');
        
        // Ensure we can find the song elements
        await page.waitForSelector('.song-item', { timeout: 5000 });
        
        const songElements = await page.locator('.song-item').all();
        console.log(`✅ Found ${songElements.length} songs on the page`);
        
        if (songElements.length === 0) {
            throw new Error('No song elements found - test setup failed');
        }
        
        console.log('\\n=== TEST 1: Consecutive Transpose Operations (D → E → F# → F) ===');
        
        // Find the D key test song
        const dKeySong = await page.locator('.song-item:has-text("Test Song - D Key")').first();
        
        // Get initial state
        const initialText = await dKeySong.locator('.song-text').textContent();
        console.log(`📝 Initial song text: ${initialText.substring(0, 100)}...`);
        
        // Step 1: D → E (transpose up)
        console.log('🔄 Step 1: Transposing D → E (up +1)');
        await dKeySong.locator('.transpose-up').click();
        await page.waitForTimeout(500);
        
        const afterStep1Text = await dKeySong.locator('.song-text').textContent();
        const counter1 = await dKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden');
        console.log(`📝 After step 1 - Counter: ${counter1}`);
        console.log(`📝 Text sample: ${afterStep1Text.substring(0, 100)}...`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\03_step1_D_to_E.png', fullPage: true });
        
        // Step 2: E → F# (transpose up again)
        console.log('🔄 Step 2: Transposing E → F# (up +2 total)');
        await dKeySong.locator('.transpose-up').click();
        await page.waitForTimeout(500);
        
        const afterStep2Text = await dKeySong.locator('.song-text').textContent();
        const counter2 = await dKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden');
        console.log(`📝 After step 2 - Counter: ${counter2}`);
        console.log(`📝 Text sample: ${afterStep2Text.substring(0, 100)}...`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\04_step2_E_to_F_sharp.png', fullPage: true });
        
        // Step 3: F# → F (transpose down)
        console.log('🔄 Step 3: Transposing F# → F (down +1 total)');
        await dKeySong.locator('.transpose-down').click();
        await page.waitForTimeout(500);
        
        const afterStep3Text = await dKeySong.locator('.song-text').textContent();
        const counter3 = await dKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden');
        console.log(`📝 After step 3 - Counter: ${counter3}`);
        console.log(`📝 Text sample: ${afterStep3Text.substring(0, 100)}...`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\05_step3_F_sharp_to_F.png', fullPage: true });
        
        console.log('\\n=== TEST 2: Reset Functionality ===');
        
        console.log('🔄 Testing reset button functionality');
        await dKeySong.locator('.reset-btn').click();
        await page.waitForTimeout(500);
        
        const afterResetText = await dKeySong.locator('.song-text').textContent();
        const counterReset = await dKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden/reset');
        console.log(`📝 After reset - Counter: ${counterReset}`);
        console.log(`📝 Text matches original: ${afterResetText === initialText ? 'YES' : 'NO'}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\06_after_reset.png', fullPage: true });
        
        console.log('\\n=== TEST 3: Flat Key Support ===');
        
        // Find the flat key test song
        const flatKeySong = await page.locator('.song-item:has-text("Flat Keys")').first();
        
        const flatInitialText = await flatKeySong.locator('.song-text').textContent();
        console.log(`📝 Flat key song initial: ${flatInitialText.substring(0, 100)}...`);
        
        // Transpose up with flat keys
        console.log('🔄 Transposing flat key song up');
        await flatKeySong.locator('.transpose-up').click();
        await page.waitForTimeout(500);
        
        const flatAfterUpText = await flatKeySong.locator('.song-text').textContent();
        const flatCounterUp = await flatKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden');
        console.log(`📝 Flat key after transpose up - Counter: ${flatCounterUp}`);
        console.log(`📝 Text sample: ${flatAfterUpText.substring(0, 100)}...`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\07_flat_key_up.png', fullPage: true });
        
        // Transpose down with flat keys
        console.log('🔄 Transposing flat key song down twice (to -1)');
        await flatKeySong.locator('.transpose-down').click();
        await page.waitForTimeout(200);
        await flatKeySong.locator('.transpose-down').click();
        await page.waitForTimeout(500);
        
        const flatAfterDownText = await flatKeySong.locator('.song-text').textContent();
        const flatCounterDown = await flatKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden');
        console.log(`📝 Flat key after transpose down - Counter: ${flatCounterDown}`);
        console.log(`📝 Text sample: ${flatAfterDownText.substring(0, 100)}...`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\08_flat_key_down.png', fullPage: true });
        
        // Reset flat key song
        console.log('🔄 Resetting flat key song');
        await flatKeySong.locator('.reset-btn').click();
        await page.waitForTimeout(500);
        
        const flatAfterResetText = await flatKeySong.locator('.song-text').textContent();
        const flatCounterReset = await flatKeySong.locator('.transpose-counter').textContent().catch(() => 'hidden/reset');
        console.log(`📝 Flat key after reset - Counter: ${flatCounterReset}`);
        console.log(`📝 Reset successful: ${flatAfterResetText === flatInitialText ? 'YES' : 'NO'}`);
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\09_flat_key_reset.png', fullPage: true });
        
        console.log('\\n=== TESTING SUMMARY ===');
        
        // Check for any console errors during testing
        const testErrors = errors.filter(e => e.type === 'error');
        const testWarnings = errors.filter(e => e.type === 'warn');
        
        console.log(`🔍 Console errors during testing: ${testErrors.length}`);
        console.log(`⚠️  Console warnings during testing: ${testWarnings.length}`);
        
        if (testErrors.length > 0) {
            console.log('\\n🚨 CONSOLE ERRORS FOUND:');
            testErrors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error.text}`);
            });
        }
        
        if (testWarnings.length > 0) {
            console.log('\\n⚠️  CONSOLE WARNINGS FOUND:');
            testWarnings.forEach((warning, index) => {
                console.log(`  ${index + 1}. ${warning.text}`);
            });
        }
        
        // Test results summary
        const testResults = {
            consecutiveTransposes: {
                step1Complete: counter1 && counter1.includes('+1'),
                step2Complete: counter2 && counter2.includes('+2'),
                step3Complete: counter3 && counter3.includes('+1'),
                textChanges: afterStep1Text !== initialText && afterStep2Text !== afterStep1Text && afterStep3Text !== afterStep2Text
            },
            resetFunctionality: {
                resetWorked: afterResetText === initialText,
                counterHidden: counterReset === 'hidden/reset' || !counterReset.includes('+') && !counterReset.includes('-')
            },
            flatKeySupport: {
                transposeUpWorked: flatCounterUp && flatCounterUp.includes('+1'),
                transposeDownWorked: flatCounterDown && (flatCounterDown.includes('-1') || flatCounterDown === 'hidden/reset'),
                resetWorked: flatAfterResetText === flatInitialText,
                noConsoleErrors: testErrors.length === 0
            }
        };
        
        console.log('\\n✅ TEST RESULTS:');
        console.log(`Consecutive Transposes: ${JSON.stringify(testResults.consecutiveTransposes, null, 2)}`);
        console.log(`Reset Functionality: ${JSON.stringify(testResults.resetFunctionality, null, 2)}`);
        console.log(`Flat Key Support: ${JSON.stringify(testResults.flatKeySupport, null, 2)}`);
        
        console.log('\\n📸 All screenshots saved to D:\\\\ClaudeCode\\\\test_results\\\\');
        
        // Final screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\10_final_state.png', fullPage: true });
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\error_screenshot.png', fullPage: true });
        throw error;
    }
    
    console.log('\\n⏳ Test completed. Browser will remain open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
}

testTransposeFunctionality().catch(console.error);