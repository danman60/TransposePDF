const fs = require('fs');
const { chromium } = require('playwright');

async function createTestPDF() {
    console.log('Creating a test PDF with chord charts and lyrics...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Create HTML content that looks like a typical chord chart with lyrics
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Song - Amazing Grace</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
            .song-title { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 10px; }
            .song-info { text-align: center; font-size: 14px; margin-bottom: 30px; color: #666; }
            .verse { margin-bottom: 20px; }
            .chord-line { font-weight: bold; color: #0066cc; font-family: monospace; margin-bottom: 5px; }
            .lyric-line { margin-bottom: 15px; }
            .chorus { margin-left: 20px; font-style: italic; }
        </style>
    </head>
    <body>
        <div class="song-title">Amazing Grace</div>
        <div class="song-info">Traditional - Key of G</div>
        
        <div class="verse">
            <div class="chord-line">G           G7         C           G</div>
            <div class="lyric-line">Amazing grace how sweet the sound</div>
            <div class="chord-line">G           D7         G</div>
            <div class="lyric-line">That saved a wretch like me</div>
        </div>
        
        <div class="verse">
            <div class="chord-line">G           G7         C           G</div>
            <div class="lyric-line">I once was lost, but now am found</div>
            <div class="chord-line">G           D7         G</div>
            <div class="lyric-line">Was blind but now I see</div>
        </div>
        
        <div class="chorus">
            <div class="chord-line">C           G           D7          G</div>
            <div class="lyric-line">'Twas grace that taught my heart to fear</div>
            <div class="chord-line">C           G           D7          G</div>
            <div class="lyric-line">And grace my fears relieved</div>
        </div>
        
        <div class="verse">
            <div class="chord-line">G           G7         C           G</div>
            <div class="lyric-line">How precious did that grace appear</div>
            <div class="chord-line">G           D7         G</div>
            <div class="lyric-line">The hour I first believed</div>
        </div>
    </body>
    </html>
    `;
    
    await page.setContent(htmlContent);
    await page.waitForTimeout(1000);
    
    // Create test_files directory
    const testDir = 'D:\\ClaudeCode\\TransposePDF\\test_files';
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Generate PDF
    await page.pdf({ 
        path: `${testDir}\\test_chord_chart.pdf`, 
        format: 'A4',
        printBackground: true,
        margin: {
            top: '1in',
            right: '0.5in',
            bottom: '1in',
            left: '0.5in'
        }
    });
    
    console.log('Test PDF created: test_files/test_chord_chart.pdf');
    
    await browser.close();
}

createTestPDF().catch(console.error);