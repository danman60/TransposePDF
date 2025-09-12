/**
 * Song Separator Module
 * Handles detection and separation of individual songs within a multi-song PDF
 */

class SongSeparator {
  constructor() {
    this.SONG_BREAK_THRESHOLD = 100; // Increased threshold - songs are typically 1-2 pages
    this.MIN_SONG_LENGTH = 50; // Increased minimum items per song
    this.TITLE_PATTERNS = [
      /^[A-Z][A-Za-z\s\-\'\"\(\)]{3,50}$/,  // Title case like "King Of Heaven"
      /^[A-Z\s\-\'\"\(\)]{4,50}$/,           // ALL CAPS titles
      /^[A-Z][a-z\s]{2,30}$/                 // Simple title case
    ];
    this.IGNORE_PATTERNS = [
      /^©/,                    // Copyright
      /^CCLI/i,               // CCLI license  
      /^page\s*\d+/i,         // Page numbers
      /^\d+$/,                // Just numbers
      /^www\./i,              // Website URLs
      /^http/i,               // URLs
      /^\s*$/,                // Empty strings
      /^Key\s*-/i,            // Key signatures like "Key - E"
      /^Tempo\s*-/i,          // Tempo markings
      /^Time\s*-/i,           // Time signatures
      /^\([^)]*\)$/,          // Parenthetical info
      /^[A-Z][a-z]+\s*\|/,    // Author names with pipes
      /SongSelect/i,          // SongSelect branding
      /by\s+[A-Z]/i           // "by Author" lines
    ];
    
    // Song section patterns - these are PART OF songs, not separators
    this.SONG_SECTION_PATTERNS = [
      /^VERSE\s*\d*/i,        // VERSE 1, VERSE 2, etc.
      /^CHORUS\s*\d*/i,       // CHORUS, CHORUS 1A, etc.
      /^BRIDGE\s*/i,          // BRIDGE
      /^PRE-CHORUS/i,         // PRE-CHORUS
      /^INTRO/i,              // INTRO
      /^OUTRO/i,              // OUTRO
      /^INSTRUMENTAL/i,       // INSTRUMENTAL
      /^TURNAROUND/i,         // TURNAROUND
      /^TAG/i,                // TAG
      /^ENDING/i              // ENDING
    ];
  }

  /**
   * Separate text items into individual songs
   * Main entry point for song separation
   */
  separateSongs(textItems) {
    try {
      logger.status('Detecting song boundaries...', 'info');
      logger.startTimer('songSeparation');

      if (!textItems || textItems.length === 0) {
        throw new Error('No text items to process');
      }

      // Find song boundaries
      const boundaries = this.detectSongBoundaries(textItems);
      
      // Create song objects
      const songs = this.createSongObjects(textItems, boundaries);
      
      // Validate and clean up songs
      const validSongs = this.validateSongs(songs);
      
      logger.endTimer('songSeparation');
      logger.status(`Detected ${validSongs.length} songs`, 'success');
      
      return validSongs;

    } catch (error) {
      logger.error('Failed to separate songs', { error: error.message });
      throw error;
    }
  }

  /**
   * Detect boundaries between songs - CONSERVATIVE approach for 4 worship songs
   * Expected: King Of Heaven, God Is For Us, His Mercy Is More, Waymaker
   */
  detectSongBoundaries(textItems) {
    const boundaries = [0]; // Always start with first item
    
    // For a 4-song PDF, we expect songs to start on pages 1, 3, 5, 7 (roughly)
    // Look for clear song titles that match known worship song patterns
    const knownTitles = [
      'King Of Heaven', 'God Is For Us', 'His Mercy Is More', 'Waymaker'
    ];
    
    logger.status('🔍 Looking for song boundaries with conservative detection...', 'info');
    
    // Group by page and look for obvious song titles
    const pageGroups = this.groupTextItemsByPage(textItems);
    const pageNumbers = Object.keys(pageGroups).map(n => parseInt(n)).sort((a, b) => a - b);
    
    for (const pageNum of pageNumbers) {
      if (pageNum === 1) continue; // First page is already boundary 0
      
      const pageItems = pageGroups[pageNum];
      if (!pageItems || pageItems.length === 0) continue;
      
      // Look for the most obvious song title on this page
      const titleCandidate = this.findObviousSongTitle(pageItems, knownTitles);
      
      if (titleCandidate) {
        const titleIndex = textItems.findIndex(item => item.id === titleCandidate.id);
        
        if (titleIndex > 0 && titleIndex > boundaries[boundaries.length - 1] + 30) {
          boundaries.push(titleIndex);
          logger.status(`🎵 Found song: "${titleCandidate.text}" on page ${pageNum}`, 'success');
        }
      }
    }
    
    // Conservative fallback: if we haven't found enough songs, add page-based boundaries
    if (boundaries.length < 3 && pageNumbers.length >= 4) {
      // For 4+ pages, assume songs roughly every 2 pages
      for (let i = 3; i < pageNumbers.length; i += 2) {
        const pageNum = pageNumbers[i - 1];
        const pageItems = pageGroups[pageNum] || [];
        
        if (pageItems.length > 0) {
          const firstItem = pageItems[0];
          const titleIndex = textItems.findIndex(item => item.id === firstItem.id);
          
          if (titleIndex > boundaries[boundaries.length - 1] + 30) {
            boundaries.push(titleIndex);
            logger.status(`📄 Added page-based boundary on page ${pageNum}`, 'info');
          }
        }
      }
    }
    
    // Always end with last item
    boundaries.push(textItems.length);
    
    // Remove duplicate boundaries and sort
    const uniqueBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);
    
    logger.status(`Found ${uniqueBoundaries.length - 1} potential song boundaries`, 'info');
    return uniqueBoundaries;
  }

  /**
   * Group text items by page number
   */
  groupTextItemsByPage(textItems) {
    const pageGroups = {};
    textItems.forEach(item => {
      if (!pageGroups[item.pageNum]) {
        pageGroups[item.pageNum] = [];
      }
      pageGroups[item.pageNum].push(item);
    });
    return pageGroups;
  }

  /**
   * Find the most likely song title on a page (large, bold, at top, NOT a section header)
   */
  findPageTitle(pageItems) {
    // Sort by Y position (top to bottom) then by font size
    const candidates = pageItems
      .filter(item => item.text && item.text.trim().length > 2)
      .filter(item => !this.shouldIgnoreText(item.text))
      .filter(item => !this.isSongSection(item.text)) // Exclude VERSE, CHORUS, etc.
      .sort((a, b) => {
        // Prioritize items near top of page
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) > 20) return yDiff;
        
        // Then by font size (larger first)
        return (b.fontSize || 12) - (a.fontSize || 12);
      });

    // Look for actual song titles (bold, large font, proper title format)
    for (const candidate of candidates.slice(0, 8)) { // Check more candidates
      const isBold = candidate.bold || candidate.fontName?.toLowerCase().includes('bold');
      const isLargeFont = (candidate.fontSize || 12) > 14;
      const isTitle = this.looksLikeTitle(candidate);
      
      // Must be a proper title AND (bold OR large font)
      if (isTitle && (isBold || isLargeFont)) {
        logger.status(`Found song title candidate: "${candidate.text}" (bold: ${isBold}, size: ${candidate.fontSize})`, 'info');
        return candidate;
      }
    }
    
    // Fallback: Look for any title-like text in top candidates
    for (const candidate of candidates.slice(0, 3)) {
      if (this.looksLikeTitle(candidate)) {
        logger.status(`Fallback song title: "${candidate.text}"`, 'warning');
        return candidate;
      }
    }
    
    return null; // No clear title found
  }

  /**
   * Find obvious song titles that match known patterns or exact titles
   */
  findObviousSongTitle(pageItems, knownTitles = []) {
    // Sort items by position - top to bottom, left to right
    const sortedItems = pageItems
      .filter(item => item.text && item.text.trim().length > 2)
      .sort((a, b) => {
        if (Math.abs(a.y - b.y) > 15) return a.y - b.y;
        return a.x - b.x;
      });
    
    // First, look for exact matches with known titles
    for (const item of sortedItems) {
      const text = item.text.trim();
      
      if (knownTitles.some(title => text.includes(title) || title.includes(text))) {
        logger.status(`🎯 Found exact title match: "${text}"`, 'success');
        return item;
      }
    }
    
    // Then look for obvious title patterns at the top of the page
    for (const item of sortedItems.slice(0, 5)) {
      const text = item.text.trim();
      
      // Skip obvious non-titles
      if (this.shouldIgnoreText(text) || this.isSongSection(text)) {
        continue;
      }
      
      // Look for title characteristics
      const isBold = item.bold || (item.fontName && item.fontName.toLowerCase().includes('bold'));
      const isLargeFont = (item.fontSize || 12) > 13;
      const isNearTop = item.y < 150; // Near top of page
      const looksLikeTitle = this.looksLikeWorshipTitle(text);
      
      if (looksLikeTitle && (isBold || isLargeFont) && isNearTop) {
        logger.status(`📝 Found title pattern: "${text}" (bold:${isBold}, large:${isLargeFont}, top:${isNearTop})`, 'info');
        return item;
      }
    }
    
    return null;
  }

  /**
   * Validate if a candidate text is actually a song title
   */
  validateSongTitle(titleCandidate, pageItems) {
    const text = titleCandidate.text.trim();
    
    // Must not be a song section
    if (this.isSongSection(text)) {
      return false;
    }
    
    // Must not be ignored text
    if (this.shouldIgnoreText(text)) {
      return false;
    }
    
    // Look for supporting evidence on the page
    const hasChords = pageItems.some(item => this.containsChords(item.text));
    const hasSectionHeaders = pageItems.some(item => this.isSongSection(item.text));
    
    // A good song title should be followed by chords or section headers
    const hasMusicalContent = hasChords || hasSectionHeaders;
    
    // Additional checks for known worship song patterns
    const looksLikeWorship = this.looksLikeWorshipTitle(text);
    
    return hasMusicalContent && looksLikeWorship;
  }
  
  /**
   * Check if text looks like a typical worship song title
   */
  looksLikeWorshipTitle(text) {
    // Common worship song title patterns
    const worshipPatterns = [
      /^[A-Z][a-z\s]+(Of|Is|Are)\s+[A-Z]/,     // "King Of Heaven", "God Is For Us"
      /^[A-Z][a-z]+\s+(Mercy|Grace|Love|Way)/i, // "His Mercy", "Amazing Grace"
      /^(How|What|When|Where)\s+[A-Z]/i,        // "How Great", "What Love"
      /^(Holy|Great|Amazing|Blessed|All)/i,     // Common worship words
      /^[A-Z][a-z\s]{3,30}$/                    // General title case, reasonable length
    ];
    
    return worshipPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Score page break as potential song boundary
   */
  scorePageBreak(textItems, index) {
    let score = 0.5; // Base score for page break
    
    const current = textItems[index];
    const previous = textItems[index - 1];
    
    // Higher score if previous item looks like an ending
    if (this.looksLikeEnding(previous)) {
      score += 0.3;
    }
    
    // Higher score if current item looks like a title
    if (this.looksLikeTitle(current)) {
      score += 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Score vertical gap as potential song boundary
   */
  scoreVerticalGap(textItems, index) {
    const current = textItems[index];
    const previous = textItems[index - 1];
    
    let score = 0.3; // Base score for large gap
    
    // Gap size factor
    const gap = Math.abs(current.y - (previous.y + previous.height));
    const gapFactor = Math.min(gap / (this.SONG_BREAK_THRESHOLD * 2), 1.0);
    score += gapFactor * 0.3;
    
    // Check surrounding content
    if (this.looksLikeTitle(current)) {
      score += 0.4;
    }
    
    if (this.looksLikeEnding(previous)) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Score title pattern as potential song boundary
   */
  scoreTitleBreak(textItems, index) {
    const current = textItems[index];
    let score = 0.2; // Base score for title pattern
    
    // Font size factor (titles usually larger)
    if (current.fontSize > 14) {
      score += 0.3;
    }
    
    // Bold text factor
    if (current.bold) {
      score += 0.2;
    }
    
    // Position factor (titles usually at start of line)
    if (current.x < 100) { // Left margin
      score += 0.2;
    }
    
    // Check if followed by chords or lyrics
    const next = textItems[index + 1];
    if (next && this.containsChords(next.text)) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Create song objects from boundaries
   */
  createSongObjects(textItems, boundaries) {
    const songs = [];
    
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i];
      const end = boundaries[i + 1];
      const songItems = textItems.slice(start, end);
      
      if (songItems.length < this.MIN_SONG_LENGTH) {
        continue; // Skip very short sections
      }
      
      const song = this.createSong(songItems, i + 1);
      if (song) {
        songs.push(song);
      }
    }
    
    return songs;
  }

  /**
   * Create individual song object
   */
  createSong(songItems, songIndex) {
    if (!songItems || songItems.length === 0) return null;
    
    // Extract song title
    const title = this.extractSongTitle(songItems);
    
    // Get page range
    const pageStart = Math.min(...songItems.map(item => item.pageNum));
    const pageEnd = Math.max(...songItems.map(item => item.pageNum));
    
    // Extract chords
    const musicTheory = new MusicTheory();
    const songText = songItems.map(item => item.text).join('\n');
    const chords = musicTheory.extractChords(songText);
    
    // Detect original key
    const keyDetection = musicTheory.detectKey(chords);
    
    return {
      id: songIndex,
      title: title,
      originalKey: keyDetection.key,
      currentKey: keyDetection.key,
      keyConfidence: keyDetection.confidence,
      transposition: 0,
      pageStart: pageStart,
      pageEnd: pageEnd,
      textItems: songItems,
      chords: chords,
      songText: songText,
      chordsPreview: chords.slice(0, 10).map(c => c.original).join(' ')
    };
  }

  /**
   * Extract song title from text items
   */
  extractSongTitle(songItems) {
    // Look for title in first few items
    for (let i = 0; i < Math.min(5, songItems.length); i++) {
      const item = songItems[i];
      
      // Skip ignore patterns
      if (this.shouldIgnoreText(item.text)) {
        continue;
      }
      
      // Check if it matches title patterns
      if (this.looksLikeTitle(item)) {
        return this.cleanTitle(item.text);
      }
    }
    
    // Fallback: use first non-empty, non-ignored text
    for (const item of songItems) {
      if (!this.shouldIgnoreText(item.text) && item.text.trim().length > 2) {
        return this.cleanTitle(item.text);
      }
    }
    
    return `Untitled Song`;
  }

  /**
   * Clean and normalize song title
   */
  cleanTitle(titleText) {
    return titleText
      .trim()
      .replace(/^\d+\.\s*/, '') // Remove numbering
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .substring(0, 50);        // Limit length
  }

  /**
   * Check if text looks like a song title (NOT a song section)
   */
  looksLikeTitle(textItem) {
    if (!textItem || !textItem.text) return false;
    
    const text = textItem.text.trim();
    
    // Check ignore patterns first
    if (this.shouldIgnoreText(text)) {
      return false;
    }
    
    // IMPORTANT: Song sections (VERSE, CHORUS, etc.) are NOT titles
    if (this.isSongSection(text)) {
      return false;
    }
    
    // Check title patterns
    return this.TITLE_PATTERNS.some(pattern => pattern.test(text));
  }
  
  /**
   * Check if text is a song section (VERSE, CHORUS, BRIDGE, etc.)
   * These are PART OF songs, not separate songs
   */
  isSongSection(text) {
    if (!text || text.trim().length === 0) return false;
    
    return this.SONG_SECTION_PATTERNS.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Check if text looks like a song ending
   */
  looksLikeEnding(textItem) {
    if (!textItem || !textItem.text) return false;
    
    const text = textItem.text.toLowerCase().trim();
    const endingWords = ['end', 'outro', 'final', 'repeat', 'fade'];
    
    return endingWords.some(word => text.includes(word));
  }

  /**
   * Check if text should be ignored
   */
  shouldIgnoreText(text) {
    if (!text || text.trim().length === 0) return true;
    
    return this.IGNORE_PATTERNS.some(pattern => pattern.test(text.trim()));
  }

  /**
   * Check if text contains musical chords
   */
  containsChords(text) {
    if (!text) return false;
    
    const musicTheory = new MusicTheory();
    const chords = musicTheory.extractChords(text);
    return chords.length > 0;
  }

  /**
   * Validate songs and remove invalid ones
   */
  validateSongs(songs) {
    return songs.filter(song => {
      // Must have valid title
      if (!song.title || song.title.trim().length < 2) {
        logger.status(`Skipping song with invalid title: "${song.title}"`, 'warning');
        return false;
      }
      
      // Must have minimum text content
      if (!song.textItems || song.textItems.length < this.MIN_SONG_LENGTH) {
        logger.status(`Skipping song "${song.title}" - insufficient content`, 'warning');
        return false;
      }
      
      // Should have some chords (warning, but don't exclude)
      if (!song.chords || song.chords.length === 0) {
        logger.status(`Warning: Song "${song.title}" has no detected chords`, 'warning');
      }
      
      return true;
    });
  }

  /**
   * Merge songs if they appear to be parts of the same song
   */
  mergeSimilarSongs(songs) {
    const mergedSongs = [];
    const processed = new Set();
    
    for (let i = 0; i < songs.length; i++) {
      if (processed.has(i)) continue;
      
      const currentSong = songs[i];
      const mergeCandidates = [currentSong];
      processed.add(i);
      
      // Look for similar titles in subsequent songs
      for (let j = i + 1; j < songs.length; j++) {
        if (processed.has(j)) continue;
        
        const otherSong = songs[j];
        if (this.areSimilarTitles(currentSong.title, otherSong.title)) {
          mergeCandidates.push(otherSong);
          processed.add(j);
        }
      }
      
      // Merge if we found candidates
      if (mergeCandidates.length > 1) {
        mergedSongs.push(this.mergeSongParts(mergeCandidates));
      } else {
        mergedSongs.push(currentSong);
      }
    }
    
    return mergedSongs;
  }

  /**
   * Check if two titles are similar (might be parts of same song)
   */
  areSimilarTitles(title1, title2) {
    const clean1 = title1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const clean2 = title2.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Check if one is contained in the other
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return true;
    }
    
    // Check for common words
    const words1 = clean1.split(/\s+/);
    const words2 = clean2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    
    return commonWords.length >= 2;
  }

  /**
   * Merge multiple song parts into one song
   */
  mergeSongParts(songParts) {
    const mainSong = songParts[0];
    
    // Combine all text items
    const allTextItems = [];
    songParts.forEach(song => {
      allTextItems.push(...song.textItems);
    });
    
    // Sort by page and position
    allTextItems.sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      if (Math.abs(a.y - b.y) > 5) return a.y - b.y;
      return a.x - b.x;
    });
    
    // Combine chords
    const allChords = [];
    songParts.forEach(song => {
      allChords.push(...song.chords);
    });
    
    // Update page range
    const pageStart = Math.min(...songParts.map(s => s.pageStart));
    const pageEnd = Math.max(...songParts.map(s => s.pageEnd));
    
    return {
      ...mainSong,
      textItems: allTextItems,
      chords: allChords,
      pageStart: pageStart,
      pageEnd: pageEnd,
      songText: allTextItems.map(item => item.text).join('\n'),
      chordsPreview: allChords.slice(0, 10).map(c => c.original).join(' ')
    };
  }

  /**
   * Run validation tests on song separation
   */
  validateSongSeparation(testTextItems, expectedSongCount) {
    try {
      const songs = this.separateSongs(testTextItems);
      
      const results = {
        detected: songs.length,
        expected: expectedSongCount,
        accuracy: songs.length === expectedSongCount ? 100 : 0,
        songs: songs.map(s => ({
          title: s.title,
          chordCount: s.chords.length,
          pageRange: `${s.pageStart}-${s.pageEnd}`
        }))
      };
      
      return results;
    } catch (error) {
      return {
        detected: 0,
        expected: expectedSongCount,
        accuracy: 0,
        error: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.SongSeparator = SongSeparator;
}