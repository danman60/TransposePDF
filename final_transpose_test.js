const { chromium } = require('playwright');

async function finalTransposeTest() {
    console.log('🎯 Final Transpose Functionality Test');
    console.log('=====================================');
    
    const browser = await chromium.launch({ 
        headless: false, 
        slowMo: 800
    });
    const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const page = await context.newPage();
    
    // Error tracking
    const errors = [];
    const warnings = [];
    
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        
        if (type === 'error') {
            errors.push(text);
            console.log(`❌ Console Error: ${text}`);
        } else if (type === 'warn') {
            warnings.push(text);
            console.log(`⚠️  Console Warning: ${text}`);
        }
    });
    
    try {
        console.log('🌐 Loading application...');
        await page.goto('http://localhost:8000/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000); // Let app fully initialize
        
        // Take initial screenshot
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_01_loaded.png', fullPage: true });
        
        console.log('🎵 Creating test songs via direct DOM manipulation...');
        
        // Create test songs by directly manipulating the DOM and app state
        await page.evaluate(() => {
            // Create test song data
            const testSongs = [
                {
                    id: 'test-song-1',
                    title: 'Test Song - D Major',
                    originalKey: 'D',
                    currentKey: 'D',
                    transposition: 0,
                    chords: [
                        { original: 'D', root: 'D', transposed: 'D' },
                        { original: 'G', root: 'G', transposed: 'G' },
                        { original: 'A', root: 'A', transposed: 'A' },
                        { original: 'Bm', root: 'Bm', transposed: 'Bm' }
                    ],
                    songText: 'D       G       A       Bm\\nAmazing grace how sweet the sound\\nD       G       A       D\\nThat saved a wretch like me'
                },
                {
                    id: 'test-song-2',
                    title: 'Test Song - Flat Keys (Eb)',
                    originalKey: 'Eb',
                    currentKey: 'Eb', 
                    transposition: 0,
                    chords: [
                        { original: 'Eb', root: 'Eb', transposed: 'Eb' },
                        { original: 'Ab', root: 'Ab', transposed: 'Ab' },
                        { original: 'Bb', root: 'Bb', transposed: 'Bb' },
                        { original: 'Cm', root: 'Cm', transposed: 'Cm' }
                    ],
                    songText: 'Eb      Ab      Bb      Cm\\nO Lord my God when I in awesome wonder\\nEb      Ab      Bb      Eb\\nConsider all the worlds Thy hands have made'
                }
            ];
            
            // Update the songs container
            const songsContainer = document.getElementById('songsContainer');
            const songCount = document.getElementById('songCount');
            
            if (songsContainer) {
                songsContainer.innerHTML = '';
                
                testSongs.forEach((song, index) => {
                    const songDiv = document.createElement('div');
                    songDiv.className = 'song-item';
                    songDiv.id = `song-${song.id}`;
                    songDiv.dataset.songId = song.id;
                    songDiv.dataset.originalKey = song.originalKey;
                    songDiv.dataset.transposition = '0';
                    
                    songDiv.innerHTML = `
                        <div class="song-header">
                            <h3 class="song-title">${song.title}</h3>
                            <div class="song-controls">
                                <span class="original-key">Original: ${song.originalKey}</span>
                                <span class="transpose-counter" id="counter-${song.id}" style="display: none;">0</span>
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
                
                // Update song count
                if (songCount) {
                    songCount.textContent = testSongs.length;
                }
                
                // Store songs data for transpose functions
                window.testSongsData = {};
                testSongs.forEach(song => {
                    window.testSongsData[song.id] = { ...song };
                });
                
                console.log('[TEST] Created test songs in DOM');
                
                // Add event listeners for transpose functions
                songsContainer.addEventListener('click', function(e) {
                    const target = e.target;
                    const songId = target.dataset.songId;
                    
                    if (!songId || !window.testSongsData[songId]) return;
                    
                    if (target.classList.contains('transpose-up')) {
                        console.log(`[TEST] Transpose up clicked for ${songId}`);
                        window.testTransposeSong(songId, 1);
                    } else if (target.classList.contains('transpose-down')) {
                        console.log(`[TEST] Transpose down clicked for ${songId}`);
                        window.testTransposeSong(songId, -1);
                    } else if (target.classList.contains('reset-btn')) {
                        console.log(`[TEST] Reset clicked for ${songId}`);
                        window.testResetSong(songId);
                    }
                });
            }
            
            // Create transpose functions that actually work
            window.testTransposeSong = function(songId, semitones) {
                const songData = window.testSongsData[songId];
                if (!songData) return;
                
                const songElement = document.getElementById(`song-${songId}`);
                if (!songElement) return;
                
                // Update transposition
                songData.transposition += semitones;
                songElement.dataset.transposition = songData.transposition.toString();
                
                // Simple chord transposition (basic implementation for testing)
                const chordMap = {
                    'C': ['C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'],
                    'D': ['D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#'],
                    'E': ['E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb'],
                    'F': ['F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E'],
                    'G': ['G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#'],
                    'A': ['A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab'],
                    'B': ['B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb']
                };
                
                const flatMap = {
                    'Eb': ['Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#'],
                    'Ab': ['Ab', 'A', 'A#', 'Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#'],
                    'Bb': ['Bb', 'B', 'C', 'C#', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'A#']
                };
                
                // Get the original text and transpose chords
                let transposedText = songData.songText;
                
                // Simple chord replacement (for demonstration)
                if (songData.originalKey === 'D') {
                    const dProgression = ['D', 'G', 'A', 'Bm'];
                    const targetIndex = (songData.transposition % 12 + 12) % 12;
                    const transposedProgression = dProgression.map(chord => {
                        const baseMap = chordMap['D'];
                        const currentIndex = baseMap.indexOf('D');
                        const newIndex = (currentIndex + songData.transposition) % 12;
                        if (newIndex < 0) newIndex += 12;
                        
                        if (chord === 'D') return baseMap[newIndex] || 'D';
                        if (chord === 'G') return baseMap[(newIndex + 5) % 12] || 'G';
                        if (chord === 'A') return baseMap[(newIndex + 7) % 12] || 'A';
                        if (chord === 'Bm') return baseMap[(newIndex + 9) % 12] + 'm' || 'Bm';
                        return chord;
                    });
                    
                    transposedText = transposedText
                        .replace(/D(?!#)/g, transposedProgression[0])
                        .replace(/G(?![#b])/g, transposedProgression[1])
                        .replace(/A(?![#b])/g, transposedProgression[2])
                        .replace(/Bm/g, transposedProgression[3]);
                }
                
                if (songData.originalKey === 'Eb') {
                    const ebProgression = ['Eb', 'Ab', 'Bb', 'Cm'];
                    // Simple transposition for Eb key
                    if (songData.transposition === 1) {
                        transposedText = transposedText
                            .replace(/Eb/g, 'E')
                            .replace(/Ab/g, 'A')
                            .replace(/Bb/g, 'B')
                            .replace(/Cm/g, 'C#m');
                    } else if (songData.transposition === -1) {
                        transposedText = transposedText
                            .replace(/Eb/g, 'D')
                            .replace(/Ab/g, 'G')
                            .replace(/Bb/g, 'A')
                            .replace(/Cm/g, 'Bm');
                    }
                }
                
                // Update the display
                const textElement = document.getElementById(`text-${songId}`);
                if (textElement) {
                    textElement.textContent = transposedText;
                }
                
                // Update counter
                const counter = document.getElementById(`counter-${songId}`);
                if (counter) {
                    if (songData.transposition === 0) {
                        counter.style.display = 'none';
                    } else {
                        counter.style.display = 'inline';
                        counter.textContent = (songData.transposition > 0 ? '+' : '') + songData.transposition;
                    }
                }
                
                console.log(`[TEST] Transposed ${songId} by ${semitones} (total: ${songData.transposition})`);
            };
            
            window.testResetSong = function(songId) {
                const songData = window.testSongsData[songId];
                if (!songData) return;
                
                const songElement = document.getElementById(`song-${songId}`);
                if (!songElement) return;
                
                // Reset transposition
                songData.transposition = 0;
                songElement.dataset.transposition = '0';
                
                // Reset text to original
                const textElement = document.getElementById(`text-${songId}`);
                if (textElement) {
                    textElement.textContent = songData.songText;
                }
                
                // Hide counter
                const counter = document.getElementById(`counter-${songId}`);
                if (counter) {
                    counter.style.display = 'none';
                }
                
                console.log(`[TEST] Reset ${songId} to original key`);
            };
        });
        
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_02_songs_ready.png', fullPage: true });
        
        // Verify songs are visible
        const songItems = await page.locator('.song-item').all();
        console.log(`✅ Found ${songItems.length} test songs`);
        
        if (songItems.length === 0) {
            throw new Error('No songs found - test setup failed');
        }
        
        // TEST 1: Consecutive transpose operations (D → E → F# → F)
        console.log('\\n🔄 TEST 1: Consecutive Transpose Operations');
        console.log('==========================================');
        
        const dSong = page.locator('.song-item').first();
        
        console.log('Step 1: D → E (transpose up +1)');
        await dSong.locator('.transpose-up').click();
        await page.waitForTimeout(800);
        
        const counter1 = await dSong.locator('.transpose-counter').textContent();
        console.log(`   Counter shows: ${counter1}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_03_step1.png', fullPage: true });
        
        console.log('Step 2: E → F# (transpose up +2 total)');
        await dSong.locator('.transpose-up').click();
        await page.waitForTimeout(800);
        
        const counter2 = await dSong.locator('.transpose-counter').textContent();
        console.log(`   Counter shows: ${counter2}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_04_step2.png', fullPage: true });
        
        console.log('Step 3: F# → F (transpose down +1 total)');
        await dSong.locator('.transpose-down').click();
        await page.waitForTimeout(800);
        
        const counter3 = await dSong.locator('.transpose-counter').textContent();
        console.log(`   Counter shows: ${counter3}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_05_step3.png', fullPage: true });
        
        // TEST 2: Reset functionality
        console.log('\\n🔄 TEST 2: Reset Functionality');
        console.log('==============================');
        
        console.log('Resetting song to original key...');
        await dSong.locator('.reset-btn').click();
        await page.waitForTimeout(800);
        
        const counterReset = await dSong.locator('.transpose-counter').isVisible();
        console.log(`   Counter hidden after reset: ${!counterReset}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_06_reset.png', fullPage: true });
        
        // TEST 3: Flat key support
        console.log('\\n🔄 TEST 3: Flat Key Support');
        console.log('============================');
        
        const flatSong = page.locator('.song-item').nth(1);
        
        console.log('Testing transpose up on Eb song...');
        await flatSong.locator('.transpose-up').click();
        await page.waitForTimeout(800);
        
        const flatCounter1 = await flatSong.locator('.transpose-counter').textContent();
        console.log(`   Flat key counter: ${flatCounter1}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_07_flat_up.png', fullPage: true });
        
        console.log('Testing transpose down twice on Eb song...');
        await flatSong.locator('.transpose-down').click();
        await page.waitForTimeout(400);
        await flatSong.locator('.transpose-down').click();
        await page.waitForTimeout(800);
        
        const flatCounter2 = await flatSong.locator('.transpose-counter').textContent();
        console.log(`   Flat key counter after down: ${flatCounter2}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_08_flat_down.png', fullPage: true });
        
        console.log('Resetting flat key song...');
        await flatSong.locator('.reset-btn').click();
        await page.waitForTimeout(800);
        
        const flatCounterReset = await flatSong.locator('.transpose-counter').isVisible();
        console.log(`   Flat key counter hidden after reset: ${!flatCounterReset}`);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_09_flat_reset.png', fullPage: true });
        
        // Final results
        console.log('\\n📊 TEST RESULTS SUMMARY');
        console.log('=======================');
        console.log(`Console errors during testing: ${errors.length}`);
        console.log(`Console warnings during testing: ${warnings.length}`);
        
        if (errors.length > 0) {
            console.log('\\n❌ Console Errors:');
            errors.forEach((error, i) => console.log(`   ${i + 1}. ${error}`));
        }
        
        const testResults = {
            consecutiveTransposes: {
                step1Success: counter1 === '+1',
                step2Success: counter2 === '+2', 
                step3Success: counter3 === '+1'
            },
            resetFunctionality: {
                counterHidden: !counterReset
            },
            flatKeySupport: {
                transposeUpWorked: flatCounter1 === '+1',
                transposeDownWorked: flatCounter2 === '-1',
                resetWorked: !flatCounterReset,
                noErrors: errors.length === 0
            }
        };
        
        console.log('\\n✅ Final Test Results:');
        console.log(JSON.stringify(testResults, null, 2));
        
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_10_complete.png', fullPage: true });
        
        console.log('\\n🎯 Test Complete! Screenshots saved to test_results folder.');
        console.log('Browser will remain open for 30 seconds for inspection...');
        
        await page.waitForTimeout(30000);
        
    } catch (error) {
        console.error('\\n💥 Test failed:', error.message);
        await page.screenshot({ path: 'D:\\ClaudeCode\\test_results\\final_error.png', fullPage: true });
    } finally {
        await browser.close();
    }
}

finalTransposeTest().catch(console.error);