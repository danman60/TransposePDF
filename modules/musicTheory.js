/**
 * Music Theory Module
 * Handles chord detection, transposition, and key analysis
 */

class MusicTheory {
  constructor() {
    // Chord detection patterns (exactly as specified)
    this.CHORD_PATTERNS = {
      main: /([A-G])(#{1,2}|b{1,2})?([^\/\s\n]*?)(\/([A-G])(#{1,2}|b{1,2})?)?(?=\s|$|[^A-Za-z0-9#b\/])/g,
      validRoot: /^[A-G][#b]{0,2}$/,
      validChord: /^[A-G][#b]{0,2}(m|maj|dim|aug|sus|add|[0-9])*[^\/]*$/,
      slashChord: /^([A-G][#b]{0,2}[^\/]*)\/([A-G][#b]{0,2})$/
    };

    // Real worship chord examples for testing
    this.REAL_WORSHIP_CHORDS = {
      basicChords: ['C', 'G', 'Am', 'F', 'D', 'Em'],
      commonExtensions: [
        'Csus4', 'Gsus', 'Am7', 'Fmaj7', 'Dsus2', 'Em7',
        'C2', 'G/B', 'Am/C', 'F/A', 'D/F#', 'Em/G'
      ],
      complexWorship: [
        'Cmaj9', 'G/B', 'Am7', 'Fsus2', 'C/E', 'Dm7',
        'G7sus4', 'Csus2/E', 'Am7/C', 'Fmaj7#11', 'Gsus/B'
      ],
      challengingChords: [
        'C#m7b5', 'F#dim', 'Bbmaj7#11', 'Db/F', 'Ebsus4/G',
        'A/C#', 'Bm7b5', 'F#7sus4', 'Abmaj9', 'C#dim/E'
      ]
    };

    // Common worship keys
    this.COMMON_WORSHIP_KEYS = [
      'C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab',
      'Am', 'Em', 'Bm', 'F#m', 'Dm', 'Gm', 'Cm'
    ];

    // Common progressions for key detection
    this.COMMON_PROGRESSIONS = [
      ['I', 'V', 'vi', 'IV'],  // C-G-Am-F
      ['vi', 'IV', 'I', 'V'],  // Am-F-C-G
      ['I', 'vi', 'IV', 'V'],  // C-Am-F-G
      ['IV', 'I', 'V', 'vi'],  // F-C-G-Am
      ['vi', 'I', 'V', 'IV']   // Am-C-G-F
    ];

    // Chromatic scale for transposition (includes both sharps and flats for lookup)
    this.CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Flat equivalents for lookups 
    this.FLAT_TO_SHARP_MAP = {
      'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
    
    // Enharmonic preferences (always prefer sharps)
    this.ENHARMONIC_PREFERENCES = {
      'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
    };
  }

  /**
   * Extract all chords from text content
   */
  extractChords(text) {
    const chords = [];
    const lines = text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Reset regex for each line
      this.CHORD_PATTERNS.main.lastIndex = 0;
      let match;
      
      while ((match = this.CHORD_PATTERNS.main.exec(line)) !== null) {
        const fullMatch = match[0];
        const root = match[1] + (match[2] || '');
        const extension = match[3] || '';
        const slashRoot = match[5] ? match[5] + (match[6] || '') : null;
        
        // Validate chord
        if (this.isValidChord(fullMatch)) {
          chords.push({
            original: fullMatch,
            root: root,
            extension: extension,
            slashRoot: slashRoot,
            line: lineIndex,
            position: match.index,
            isSlashChord: !!slashRoot
          });
        }
      }
    });
    
    return chords;
  }

  /**
   * Validate if a string is a valid chord
   */
  isValidChord(chordStr) {
    if (!chordStr || chordStr.length === 0) return false;
    
    // Check if it's a slash chord
    const slashMatch = chordStr.match(this.CHORD_PATTERNS.slashChord);
    if (slashMatch) {
      return this.CHORD_PATTERNS.validRoot.test(slashMatch[2]);
    }
    
    // Check basic chord pattern
    return this.CHORD_PATTERNS.validChord.test(chordStr);
  }

  /**
   * Transpose a chord by semitones
   */
  transposeChord(chord, semitones) {
    try {
      if (!chord || semitones === 0) return chord;
      
      // Handle slash chords
      if (chord.includes('/')) {
        const parts = chord.split('/');
        const mainChord = this.transposeSimpleChord(parts[0], semitones);
        const bassNote = this.transposeSimpleChord(parts[1], semitones);
        return `${mainChord}/${bassNote}`;
      }
      
      return this.transposeSimpleChord(chord, semitones);
    } catch (error) {
      logger.error(`Failed to transpose chord: ${chord}`, { error: error.message });
      return chord; // Return original on error
    }
  }

  /**
   * Transpose a simple chord (no slash)
   */
  transposeSimpleChord(chord, semitones) {
    if (!chord) return chord;
    
    // Extract root note and extension
    const match = chord.match(/^([A-G])(#{1,2}|b{1,2})?(.*)$/);
    if (!match) return chord;
    
    const rootLetter = match[1];
    const accidental = match[2] || '';
    const extension = match[3] || '';
    
    // Get current position in chromatic scale
    const rootWithAccidental = rootLetter + accidental;
    let currentIndex = this.CHROMATIC_SCALE.indexOf(rootWithAccidental);
    
    // Handle enharmonic equivalents if not found
    if (currentIndex === -1) {
      // First try flat-to-sharp conversion
      const sharpEquivalent = this.FLAT_TO_SHARP_MAP[rootWithAccidental];
      if (sharpEquivalent) {
        currentIndex = this.CHROMATIC_SCALE.indexOf(sharpEquivalent);
      }
      
      // If still not found, try general enharmonic lookup
      if (currentIndex === -1) {
        const enharmonic = this.getEnharmonicEquivalent(rootWithAccidental);
        currentIndex = this.CHROMATIC_SCALE.indexOf(enharmonic);
      }
    }
    
    if (currentIndex === -1) {
      logger.error(`Invalid root note: ${rootWithAccidental}`);
      return chord;
    }
    
    // Calculate new position
    let newIndex = (currentIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    
    const newRoot = this.CHROMATIC_SCALE[newIndex];
    
    // Apply enharmonic preference
    const preferredRoot = this.ENHARMONIC_PREFERENCES[newRoot] || newRoot;
    
    return preferredRoot + extension;
  }

  /**
   * Get enharmonic equivalent
   */
  getEnharmonicEquivalent(note) {
    const enharmonicMap = {
      'Db': 'C#', 'C#': 'Db',
      'Eb': 'D#', 'D#': 'Eb', 
      'Gb': 'F#', 'F#': 'Gb',
      'Ab': 'G#', 'G#': 'Ab',
      'Bb': 'A#', 'A#': 'Bb'
    };
    return enharmonicMap[note] || note;
  }

  /**
   * Detect the most likely key from a chord progression
   */
  detectKey(chords) {
    if (!chords || chords.length === 0) return { key: 'C', confidence: 0 };
    
    const chordRoots = chords.map(chord => {
      if (typeof chord === 'string') {
        return this.extractRootNote(chord);
      }
      return chord.root || this.extractRootNote(chord.original);
    }).filter(Boolean);
    
    if (chordRoots.length === 0) return { key: 'C', confidence: 0 };
    
    // Score each possible key
    const keyScores = {};
    
    this.COMMON_WORSHIP_KEYS.forEach(key => {
      keyScores[key] = this.calculateKeyScore(chordRoots, key);
    });
    
    // Find the highest scoring key
    const bestKey = Object.keys(keyScores).reduce((a, b) => 
      keyScores[a] > keyScores[b] ? a : b
    );
    
    const confidence = keyScores[bestKey] / chordRoots.length;
    
    return {
      key: bestKey,
      confidence: Math.min(confidence, 1.0),
      scores: keyScores
    };
  }

  /**
   * Calculate score for a key given chord roots
   */
  calculateKeyScore(chordRoots, key) {
    const isMinor = key.includes('m');
    const keyRoot = key.replace('m', '');
    
    // Get scale degrees for the key
    const scaleRoots = this.getScaleRoots(keyRoot, isMinor);
    let score = 0;
    
    chordRoots.forEach(chordRoot => {
      const rootIndex = scaleRoots.indexOf(chordRoot);
      if (rootIndex !== -1) {
        // Weight common scale degrees higher
        const weights = isMinor ? [3, 1, 2, 2, 2, 2, 1] : [3, 1, 2, 2, 2, 1, 1]; // i/I, ii, iii, IV, V, vi, vii
        score += weights[rootIndex] || 1;
      }
    });
    
    return score;
  }

  /**
   * Get scale roots for a key
   */
  getScaleRoots(keyRoot, isMinor = false) {
    const keyIndex = this.CHROMATIC_SCALE.indexOf(keyRoot);
    if (keyIndex === -1) return [];
    
    // Major and natural minor scale intervals
    const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    
    return intervals.map(interval => 
      this.CHROMATIC_SCALE[(keyIndex + interval) % 12]
    );
  }

  /**
   * Extract root note from chord string
   */
  extractRootNote(chord) {
    if (!chord) return null;
    
    const match = chord.match(/^([A-G])(#{1,2}|b{1,2})?/);
    if (!match) return null;
    
    const root = match[1] + (match[2] || '');
    return this.ENHARMONIC_PREFERENCES[root] || root;
  }

  /**
   * Get chord quality (major, minor, etc.)
   */
  getChordQuality(chord) {
    if (!chord) return 'unknown';
    
    // Remove slash chord part for quality analysis
    const mainChord = chord.split('/')[0];
    
    if (/m(?!aj)/.test(mainChord)) return 'minor';
    if (/maj/.test(mainChord)) return 'major';
    if (/dim/.test(mainChord)) return 'diminished';
    if (/aug/.test(mainChord)) return 'augmented';
    if (/sus/.test(mainChord)) return 'suspended';
    
    // Default to major if no quality specified
    return 'major';
  }

  /**
   * Transpose chord progression
   */
  transposeProgression(chords, semitones) {
    return chords.map(chord => {
      if (typeof chord === 'string') {
        return this.transposeChord(chord, semitones);
      } else {
        return {
          ...chord,
          original: this.transposeChord(chord.original, semitones),
          root: this.transposeChord(chord.root, semitones),
          slashRoot: chord.slashRoot ? this.transposeChord(chord.slashRoot, semitones) : null
        };
      }
    });
  }

  /**
   * Get all test chord cases for validation
   */
  getAllTestChords() {
    return [
      ...this.REAL_WORSHIP_CHORDS.basicChords,
      ...this.REAL_WORSHIP_CHORDS.commonExtensions,
      ...this.REAL_WORSHIP_CHORDS.complexWorship,
      ...this.REAL_WORSHIP_CHORDS.challengingChords
    ];
  }

  /**
   * Run comprehensive chord validation tests
   */
  validateChordSystem() {
    const testResults = {
      detection: { passed: 0, failed: 0, errors: [] },
      transposition: { passed: 0, failed: 0, errors: [] },
      total: 0
    };
    
    const allTestChords = this.getAllTestChords();
    
    // Test chord detection
    allTestChords.forEach(chord => {
      try {
        const detected = this.isValidChord(chord);
        if (detected) {
          testResults.detection.passed++;
        } else {
          testResults.detection.failed++;
          testResults.detection.errors.push(`Detection failed: ${chord}`);
        }
      } catch (error) {
        testResults.detection.failed++;
        testResults.detection.errors.push(`Detection error: ${chord} - ${error.message}`);
      }
      testResults.total++;
    });
    
    // Test transposition
    const testTranspositions = [
      { chord: 'C', semitones: 1, expected: 'C#' },
      { chord: 'Am7', semitones: 2, expected: 'Bm7' },
      { chord: 'D/F#', semitones: -1, expected: 'C#/F' },
      { chord: 'Gsus4', semitones: 5, expected: 'Csus4' },
      { chord: 'Fmaj7', semitones: 6, expected: 'Bmaj7' }
    ];
    
    testTranspositions.forEach(test => {
      try {
        const result = this.transposeChord(test.chord, test.semitones);
        if (result === test.expected) {
          testResults.transposition.passed++;
        } else {
          testResults.transposition.failed++;
          testResults.transposition.errors.push(
            `Transposition failed: ${test.chord} +${test.semitones} = ${result}, expected ${test.expected}`
          );
        }
      } catch (error) {
        testResults.transposition.failed++;
        testResults.transposition.errors.push(`Transposition error: ${test.chord} - ${error.message}`);
      }
      testResults.total++;
    });
    
    const overallAccuracy = ((testResults.detection.passed + testResults.transposition.passed) / testResults.total) * 100;
    
    return {
      ...testResults,
      accuracy: overallAccuracy,
      passed: overallAccuracy >= 95
    };
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MusicTheory = MusicTheory;
}