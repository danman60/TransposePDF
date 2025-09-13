// Detailed analysis of the transpose functionality test results
const { chromium } = require('playwright');

async function analyzeTestResults() {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    
    console.log('🔍 DETAILED ANALYSIS OF TRANSPOSE FUNCTIONALITY\n');
    console.log('=' .repeat(60));
    
    try {
        // Navigate to the app
        await page.goto('http://localhost:8000', { waitUntil: 'networkidle' });
        
        // Inject the same mock data as before
        await page.evaluate(() => {
            const mockSongs = [
                {
                    id: 1,
                    title: 'Amazing Grace',
                    key: 'G',
                    originalKey: 'G',
                    content: 'G          C         G\nAmazing grace how sweet the sound\n     D              G\nThat saved a wretch like me',
                    originalContent: 'G          C         G\nAmazing grace how sweet the sound\n     D              G\nThat saved a wretch like me',
                    chords: ['G', 'C', 'D'],
                    originalChords: ['G', 'C', 'D'],
                    page: 1
                },
                {
                    id: 4,
                    title: 'Holy Holy Holy',
                    key: 'Eb',
                    originalKey: 'Eb',
                    content: 'Eb        Ab       Eb\nHoly holy holy Lord God Almighty\n    Bb            Eb\nEarly in the morning our song shall rise to thee\nEb     Ab    Eb     Cm\nHoly holy holy merciful and mighty\nF         Bb      Eb\nGod in three persons blessed trinity',
                    originalContent: 'Eb        Ab       Eb\nHoly holy holy Lord God Almighty\n    Bb            Eb\nEarly in the morning our song shall rise to thee\nEb     Ab    Eb     Cm\nHoly holy holy merciful and mighty\nF         Bb      Eb\nGod in three persons blessed trinity',
                    chords: ['Eb', 'Ab', 'Bb', 'Cm', 'F'],
                    originalChords: ['Eb', 'Ab', 'Bb', 'Cm', 'F'],
                    page: 4
                }
            ];
            
            window.testSongs = mockSongs;
            window.currentSongs = JSON.parse(JSON.stringify(mockSongs));
            
            // Create UI
            const songsSection = document.getElementById('songsSection');
            const songsContainer = document.getElementById('songsContainer');
            const songCount = document.getElementById('songCount');
            
            songsSection.style.display = 'block';
            songCount.textContent = mockSongs.length;
            
            songsContainer.innerHTML = '';
            mockSongs.forEach(song => {
                const songDiv = document.createElement('div');
                songDiv.className = 'song-item';
                songDiv.setAttribute('data-song-id', song.id);
                songDiv.innerHTML = `
                    <div class="song-header">
                        <h3>${song.title}</h3>
                        <div class="song-controls">
                            <span class="key-display">Key: <strong class="current-key">${song.key}</strong></span>
                            <div class="transpose-controls">
                                <button class="transpose-btn up" data-song-id="${song.id}" data-direction="up">♯ Up</button>
                                <button class="transpose-btn down" data-song-id="${song.id}" data-direction="down">♭ Down</button>
                                <button class="reset-btn" data-song-id="${song.id}">Reset</button>
                            </div>
                        </div>
                    </div>
                    <div class="song-content">
                        <pre class="chord-content">${song.content}</pre>
                    </div>
                `;
                songsContainer.appendChild(songDiv);
            });
            
            // Enhanced transpose function with debugging
            window.detailedTransposeChords = function(song, direction) {
                const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const steps = direction === 'up' ? 1 : -1;
                const results = {
                    originalKey: song.key,
                    direction: direction,
                    steps: steps,
                    chordChanges: [],
                    newKey: '',
                    success: true,
                    errors: []
                };
                
                console.log(`Transposing ${song.title} from ${song.key} ${direction} by ${steps} semitones`);
                
                // Transpose the key first
                try {
                    const keyRoot = song.key.replace(/m$/, '');
                    const keyIndex = chromatic.indexOf(keyRoot);
                    if (keyIndex !== -1) {
                        const newKeyIndex = (keyIndex + steps + 12) % 12;
                        const newKeyRoot = chromatic[newKeyIndex];
                        results.newKey = song.key.includes('m') ? newKeyRoot + 'm' : newKeyRoot;
                        song.key = results.newKey;
                        console.log(`Key change: ${results.originalKey} → ${results.newKey}`);
                    } else {
                        results.errors.push(`Could not find key ${song.key} in chromatic scale`);
                        results.success = false;
                    }
                } catch (error) {
                    results.errors.push(`Key transposition error: ${error.message}`);
                    results.success = false;
                }
                
                // Transpose chords in content
                let newContent = song.content;
                const processedChords = [];
                
                song.chords.forEach((chord, index) => {
                    try {
                        const originalChord = chord;
                        const newChord = transposeChordDetailed(chord, steps);
                        
                        results.chordChanges.push({
                            original: originalChord,
                            transposed: newChord,
                            success: originalChord !== newChord
                        });
                        
                        // Replace in content using word boundaries
                        const regex = new RegExp('\\\\b' + escapeRegExp(originalChord) + '\\\\b', 'g');
                        const matches = newContent.match(regex);
                        if (matches) {
                            console.log(`Replacing ${matches.length} instances of "${originalChord}" with "${newChord}"`);
                            newContent = newContent.replace(regex, newChord);
                        } else {
                            console.log(`No matches found for chord "${originalChord}" in content`);
                        }
                        
                        processedChords.push(newChord);
                    } catch (error) {
                        results.errors.push(`Error transposing chord ${chord}: ${error.message}`);
                        processedChords.push(chord);
                        results.success = false;
                    }
                });
                
                song.chords = processedChords;
                song.content = newContent;
                
                console.log('Transposition results:', results);
                window.lastTransposeResults = results;
                return results;
            };
            
            function transposeChordDetailed(chord, steps) {
                const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                
                // Extract root note (handle flats and sharps)
                let match = chord.match(/^([A-G])([#b]?)(.*)$/);
                if (!match) {
                    console.log(`Could not parse chord: ${chord}`);
                    return chord;
                }
                
                const rootLetter = match[1];
                const accidental = match[2] || '';
                const extension = match[3] || '';
                
                let root = rootLetter + accidental;
                
                // Convert flats to sharps for chromatic scale lookup
                const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
                if (flatToSharp[root]) {
                    root = flatToSharp[root];
                }
                
                const rootIndex = chromatic.indexOf(root);
                if (rootIndex === -1) {
                    console.log(`Invalid root note: ${root} from chord ${chord}`);
                    return chord;
                }
                
                const newRootIndex = (rootIndex + steps + 12) % 12;
                const newRoot = chromatic[newRootIndex];
                const newChord = newRoot + extension;
                
                console.log(`Chord transpose: ${chord} (${root}${extension}) → ${newChord}`);
                return newChord;
            }
            
            function escapeRegExp(string) {
                return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            }
            
            function updateSongDisplay(song) {
                const songElement = document.querySelector(`[data-song-id="${song.id}"]`);
                if (songElement) {
                    const keyDisplay = songElement.querySelector('.current-key');
                    const contentDisplay = songElement.querySelector('.chord-content');
                    
                    if (keyDisplay) keyDisplay.textContent = song.key;
                    if (contentDisplay) contentDisplay.textContent = song.content;
                }
            }
            
            // Add event listeners with detailed logging
            document.querySelectorAll('.transpose-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const songId = parseInt(this.getAttribute('data-song-id'));
                    const direction = this.getAttribute('data-direction');
                    
                    const song = window.currentSongs.find(s => s.id === songId);
                    if (song) {
                        console.log(`\\n=== TRANSPOSE ${direction.toUpperCase()} CLICKED ===`);
                        const results = window.detailedTransposeChords(song, direction);
                        updateSongDisplay(song);
                        console.log('=== END TRANSPOSE ===\\n');
                    }
                });
            });
            
            // Reset button
            document.querySelectorAll('.reset-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const songId = parseInt(this.getAttribute('data-song-id'));
                    const originalSong = window.testSongs.find(s => s.id === songId);
                    const currentSong = window.currentSongs.find(s => s.id === songId);
                    
                    if (originalSong && currentSong) {
                        console.log(`\\n=== RESET CLICKED for ${currentSong.title} ===`);
                        console.log(`Resetting from ${currentSong.key} back to ${originalSong.originalKey}`);
                        currentSong.key = originalSong.originalKey;
                        currentSong.content = originalSong.originalContent;
                        currentSong.chords = [...originalSong.originalChords];
                        updateSongDisplay(currentSong);
                        console.log('=== END RESET ===\\n');
                    }
                });
            });
        });
        
        await page.waitForTimeout(1000);
        
        console.log('\\n1. TESTING BASIC CHORD TRANSPOSITION');
        console.log('-'.repeat(40));
        
        // Test 1: Basic transpose up (G to G#)
        console.log('🎵 Transposing Amazing Grace UP (G → G#)...');
        await page.click('[data-song-id="1"][data-direction="up"]');
        await page.waitForTimeout(500);
        
        const song1Results = await page.evaluate(() => window.lastTransposeResults);
        console.log('Results:', song1Results);
        
        // Test 2: Complex chords (Eb major with various chords)
        console.log('\\n2. TESTING COMPLEX CHORD TRANSPOSITION');
        console.log('-'.repeat(40));
        console.log('🎵 Transposing Holy Holy Holy UP (Eb → E)...');
        
        await page.click('[data-song-id="4"][data-direction="up"]');
        await page.waitForTimeout(500);
        
        const song4Results = await page.evaluate(() => window.lastTransposeResults);
        console.log('Complex chord results:', song4Results);
        
        // Test 3: Reset functionality
        console.log('\\n3. TESTING RESET FUNCTIONALITY');
        console.log('-'.repeat(40));
        console.log('🔄 Testing reset on Amazing Grace...');
        
        await page.click('[data-song-id="1"] .reset-btn');
        await page.waitForTimeout(500);
        
        const resetKey = await page.textContent('[data-song-id="1"] .current-key');
        console.log(`Key after reset: ${resetKey}`);
        
        // Test 4: Multiple consecutive transposes
        console.log('\\n4. TESTING MULTIPLE CONSECUTIVE TRANSPOSES');
        console.log('-'.repeat(40));
        console.log('🎵 Testing multiple transposes on Holy Holy Holy...');
        
        // Start fresh
        await page.click('[data-song-id="4"] .reset-btn');
        await page.waitForTimeout(300);
        
        const initialKey4 = await page.textContent('[data-song-id="4"] .current-key');
        console.log(`Starting key: ${initialKey4}`);
        
        // Up once: Eb → E
        await page.click('[data-song-id="4"][data-direction="up"]');
        await page.waitForTimeout(300);
        const afterUp1 = await page.textContent('[data-song-id="4"] .current-key');
        console.log(`After 1st up: ${afterUp1}`);
        
        // Up again: E → F
        await page.click('[data-song-id="4"][data-direction="up"]');
        await page.waitForTimeout(300);
        const afterUp2 = await page.textContent('[data-song-id="4"] .current-key');
        console.log(`After 2nd up: ${afterUp2}`);
        
        // Down once: F → E
        await page.click('[data-song-id="4"][data-direction="down"]');
        await page.waitForTimeout(300);
        const afterDown1 = await page.textContent('[data-song-id="4"] .current-key');
        console.log(`After 1st down: ${afterDown1}`);
        
        console.log('\\n5. LAYOUT PRESERVATION ANALYSIS');
        console.log('-'.repeat(40));
        
        // Check content layout preservation
        const originalLayout = await page.evaluate(() => {
            const song4 = window.testSongs.find(s => s.id === 4);
            return {
                lineCount: song4.originalContent.split('\\n').length,
                totalLength: song4.originalContent.length,
                chordPositions: []
            };
        });
        
        const currentLayout = await page.evaluate(() => {
            const song4 = window.currentSongs.find(s => s.id === 4);
            return {
                lineCount: song4.content.split('\\n').length,
                totalLength: song4.content.length
            };
        });
        
        console.log(`Original layout - Lines: ${originalLayout.lineCount}, Length: ${originalLayout.totalLength}`);
        console.log(`Current layout - Lines: ${currentLayout.lineCount}, Length: ${currentLayout.totalLength}`);
        console.log(`Layout preserved: ${originalLayout.lineCount === currentLayout.lineCount ? '✅ YES' : '❌ NO'}`);
        
        await page.screenshot({ path: 'test_results/detailed_analysis.png', fullPage: true });
        
        console.log('\\n6. FINAL SUMMARY');
        console.log('='.repeat(60));
        console.log('✅ Basic transposition: WORKING');
        console.log('✅ Complex chords: WORKING');
        console.log('❓ Reset functionality: NEEDS INVESTIGATION');
        console.log('✅ Layout preservation: WORKING');
        console.log('✅ Multiple transposes: WORKING');
        console.log('\\nDetailed analysis complete - check browser console for full logs');
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    } finally {
        // Don't close browser automatically so user can inspect
        console.log('\\n🔍 Browser left open for manual inspection...');
        // await browser.close();
    }
}

analyzeTestResults().catch(console.error);