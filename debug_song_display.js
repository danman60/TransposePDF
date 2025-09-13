const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    console.log('Loading app...');
    await page.goto('http://localhost:8000/');
    await page.waitForLoadState('networkidle');
    
    // Load the songbook
    console.log('Loading songbook...');
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles('D:\\Downloads\\Songbook For September 14, 2025.pdf');
    
    // Wait for processing
    await page.waitForTimeout(3000);
    
    // Check what's in the songs section
    const songsSection = page.locator('.songs-section');
    const isVisible = await songsSection.isVisible();
    console.log('Songs section visible:', isVisible);
    
    const songCount = page.locator('.song-count');
    const countText = await songCount.textContent().catch(() => 'not found');
    console.log('Song count display:', countText);
    
    const songCards = page.locator('.song-card, .lead-sheet');
    const cardCount = await songCards.count();
    console.log('Song cards found:', cardCount);
    
    const songsContainer = page.locator('.songs-container');
    const containerVisible = await songsContainer.isVisible().catch(() => false);
    console.log('Songs container visible:', containerVisible);
    
    const containerHtml = await songsContainer.innerHTML().catch(() => 'not found');
    console.log('Container HTML length:', containerHtml.length);
    
    // Check app state
    const appState = await page.evaluate(() => {
      return {
        hasTransposeApp: !!window.transposeApp,
        currentSongsLength: window.transposeApp?.currentSongs?.length || 0,
        songsData: window.transposeApp?.currentSongs?.map(s => ({
          title: s.title,
          id: s.id,
          textLength: s.songText?.length || 0
        })) || []
      };
    });
    
    console.log('App state:', appState);
    
    await page.screenshot({ path: 'debug_song_display.png', fullPage: true });
    console.log('Screenshot saved');
    
    await browser.close();
    
  } catch (error) {
    console.error('Debug test failed:', error);
  }
})();