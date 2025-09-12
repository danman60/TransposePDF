/**
 * Song Separator Module
 * Handles detection and separation of individual songs within a multi-song PDF
 */

class SongSeparator {
  constructor() {
    this.SONG_BREAK_THRESHOLD = 50; // pixels between songs
    this.MIN_SONG_LENGTH = 10; // minimum items per song
    this.TITLE_PATTERNS = [
      /^[A-Z][A-Za-z\s\-\'\"\(\)]{3,50}$/,  // Title case
      /^[A-Z\s\-\'\"\(\)]{4,50}$/,           // ALL CAPS
      /^\d+\.\s*[A-Z][A-Za-z\s\-\'\"]{2,45}$/ // Numbered titles
    ];
    this.IGNORE_PATTERNS = [
      /^©/,                    // Copyright
      /^CCLI/i,               // CCLI license
      /^page\s*\d+/i,         // Page numbers
      /^\d+$/, 	              // Just numbers
      /^www\./i,              // Website URLs
      /^http/i,               // URLs
      /^\s*$/                 // Empty strings
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
   * Detect boundaries between songs using various heuristics
   */
  detectSongBoundaries(textItems) {
    const boundaries = [0]; // Always start with first item
    
    for (let i = 1; i < textItems.length; i++) {
      const current = textItems[i];
      const previous = textItems[i - 1];
      
      // Check for page breaks
      if (current.pageNum !== previous.pageNum) {
        const pageBreakScore = this.scorePageBreak(textItems, i);
        if (pageBreakScore > 0.7) {
          boundaries.push(i);
          continue;
        }
      }
      
      // Check for large vertical gaps (within same page)
      if (current.pageNum === previous.pageNum) {
        const verticalGap = Math.abs(current.y - (previous.y + previous.height));
        if (verticalGap > this.SONG_BREAK_THRESHOLD) {
          const gapScore = this.scoreVerticalGap(textItems, i);
          if (gapScore > 0.6) {
            boundaries.push(i);
            continue;
          }
        }
      }
      
      // Check for title patterns
      if (this.looksLikeTitle(current)) {
        const titleScore = this.scoreTitleBreak(textItems, i);
        if (titleScore > 0.5) {
          boundaries.push(i);
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
   * Check if text looks like a song title
   */
  looksLikeTitle(textItem) {
    if (!textItem || !textItem.text) return false;
    
    const text = textItem.text.trim();
    
    // Check ignore patterns first
    if (this.shouldIgnoreText(text)) {
      return false;
    }
    
    // Check title patterns
    return this.TITLE_PATTERNS.some(pattern => pattern.test(text));
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