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

    this.NOTE_PITCHES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    this.NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    this.FLAT_CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    this.MAJOR_KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    this.MINOR_KEY_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
    this.KEY_SCALES = {
      C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
      Cb: ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
      Db: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
      D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
      Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
      E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
      F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
      'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
      Gb: ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
      G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      Ab: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
      A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
      B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
      Cm: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'],
      'C#m': ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'],
      Dm: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'],
      'D#m': ['D#', 'E#', 'F#', 'G#', 'A#', 'B', 'C#'],
      Ebm: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'],
      Em: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
      Fm: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'],
      'F#m': ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'],
      Gm: ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'],
      'G#m': ['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F#'],
      Abm: ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb'],
      Am: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      'A#m': ['A#', 'B#', 'C#', 'D#', 'E#', 'F#', 'G#'],
      Bbm: ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'],
      Bm: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A']
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
  transposeChord(chord, semitones, context = null) {
    try {
      if (!chord || semitones === 0 || chord === 'N.C.') return chord;
      
      // Handle slash chords
      if (chord.includes('/')) {
        const parts = chord.split('/');
        const mainChord = this.transposeSimpleChord(parts[0], semitones, context);
        const bassNote = this.transposeSimpleChord(parts[1], semitones, context);
        return `${mainChord}/${bassNote}`;
      }
      
      return this.transposeSimpleChord(chord, semitones, context);
    } catch (error) {
      logger.error(`Failed to transpose chord: ${chord}`, { error: error.message });
      return chord; // Return original on error
    }
  }

  /**
   * Transpose a simple chord (no slash)
   */
  transposeSimpleChord(chord, semitones, context = null) {
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

    // Normalize theoretical spellings such as B#, Cb, E#, Fb, and double accidentals.
    if (currentIndex === -1) {
      const naturalIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[rootLetter];
      const accidentalOffset = [...accidental].reduce((total, mark) => total + (mark === '#' ? 1 : -1), 0);
      currentIndex = (naturalIndex + accidentalOffset + 24) % 12;
    }
    
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
    
    const policy = context?.policy || 'contextual';
    if (policy === 'preserve' && accidental) {
      const preservedScale = accidental.includes('b') ? this.FLAT_CHROMATIC_SCALE : this.CHROMATIC_SCALE;
      return preservedScale[newIndex] + extension;
    }
    if (context && (policy === 'contextual' || policy === 'preserve')) {
      const contextualRoot = this.transposeRootByDegree(rootWithAccidental, semitones, context);
      if (contextualRoot) {
        if (!context.allowDoubleAccidentals && /##|bb/.test(contextualRoot)) {
          const practicalScale = String(context.targetKey || '').includes('b')
            ? this.FLAT_CHROMATIC_SCALE
            : this.CHROMATIC_SCALE;
          return practicalScale[newIndex] + extension;
        }
        return contextualRoot + extension;
      }
    }

    const scale = policy === 'flats' ? this.FLAT_CHROMATIC_SCALE : this.CHROMATIC_SCALE;
    const newRoot = scale[newIndex];
    
    // Apply enharmonic preference
    const preferredRoot = policy === 'flats'
      ? newRoot
      : (this.ENHARMONIC_PREFERENCES[newRoot] || newRoot);
    
    return preferredRoot + extension;
  }

  /** Transpose a major/minor key to its canonical readable spelling. */
  transposeKey(key, semitones, policy = 'contextual') {
    if (!key || key === 'N.C.') return key;
    const parsed = this.parseKey(key);
    if (!parsed) return key;
    const pitch = (parsed.pitch + semitones % 12 + 12) % 12;
    if (policy === 'flats') return `${this.FLAT_CHROMATIC_SCALE[pitch]}${parsed.minor ? 'm' : ''}`;
    if (policy === 'sharps') return `${this.CHROMATIC_SCALE[pitch]}${parsed.minor ? 'm' : ''}`;
    if (semitones === 0) return key;
    return (parsed.minor ? this.MINOR_KEY_NAMES : this.MAJOR_KEY_NAMES)[pitch];
  }

  /** Spell a machine-analyzed chord consistently with a known key. */
  spellChordForKey(chord, key, { policy = 'contextual' } = {}) {
    if (!chord || chord === 'N.C.') return chord;
    const parts = String(chord).split('/');
    const mainChord = this.spellSimpleChordForKey(parts[0], key, policy);
    if (parts.length === 1) return mainChord;
    const bassNote = this.spellSimpleChordForKey(parts[1], key, policy);
    return `${mainChord}/${bassNote}`;
  }

  spellSimpleChordForKey(chord, key, policy) {
    const match = String(chord || '').match(/^([A-G])([#b]{0,2})(.*)$/);
    if (!match) return chord;
    const root = `${match[1]}${match[2]}`;
    const suffix = match[3] || '';
    const pitch = this.notePitch(root);
    if (pitch < 0) return chord;

    if (policy === 'flats') return this.FLAT_CHROMATIC_SCALE[pitch] + suffix;
    if (policy === 'sharps') return this.CHROMATIC_SCALE[pitch] + suffix;

    const parsedKey = this.parseKey(key);
    const scale = parsedKey && this.KEY_SCALES[parsedKey.name];
    if (!scale || (policy !== 'contextual' && policy !== 'preserve')) return chord;
    const diatonic = scale.find(note => this.notePitch(note) === pitch);
    return (diatonic || root) + suffix;
  }

  parseKey(key) {
    const match = String(key || '').trim().match(/^([A-G])([#b]{0,2})(m)?$/);
    if (!match) return null;
    return {
      name: `${match[1]}${match[2]}${match[3] || ''}`,
      root: `${match[1]}${match[2]}`,
      letter: match[1],
      minor: Boolean(match[3]),
      pitch: this.notePitch(`${match[1]}${match[2]}`)
    };
  }

  notePitch(note) {
    const match = String(note || '').match(/^([A-G])([#b]{0,2})$/);
    if (!match) return -1;
    const offset = [...match[2]].reduce((total, mark) => total + (mark === '#' ? 1 : -1), 0);
    return (this.NOTE_PITCHES[match[1]] + offset + 24) % 12;
  }

  transposeRootByDegree(root, semitones, context) {
    const sourceKey = this.parseKey(context.sourceKey);
    const targetName = context.targetKey || this.transposeKey(context.sourceKey, semitones);
    const targetKey = this.parseKey(targetName);
    const sourceScale = sourceKey && this.KEY_SCALES[sourceKey.name];
    const targetScale = targetKey && this.KEY_SCALES[targetKey.name];
    const rootMatch = String(root).match(/^([A-G])([#b]{0,2})$/);
    if (!sourceKey || !targetKey || !sourceScale || !targetScale || !rootMatch) return null;

    const degree = (this.NOTE_LETTERS.indexOf(rootMatch[1])
      - this.NOTE_LETTERS.indexOf(sourceKey.letter) + 7) % 7;
    const actualPitch = this.notePitch(root);
    const diatonicPitch = this.notePitch(sourceScale[degree]);
    let alteration = (actualPitch - diatonicPitch + 12) % 12;
    if (alteration > 6) alteration -= 12;
    if (Math.abs(alteration) > 2) return null;

    return this.applyAlteration(targetScale[degree], alteration);
  }

  applyAlteration(note, alteration) {
    const match = String(note).match(/^([A-G])([#b]{0,2})$/);
    if (!match) return null;
    const baseOffset = [...match[2]].reduce((total, mark) => total + (mark === '#' ? 1 : -1), 0);
    const finalOffset = baseOffset + alteration;
    if (Math.abs(finalOffset) > 2) return null;
    return match[1] + (finalOffset > 0 ? '#'.repeat(finalOffset) : 'b'.repeat(-finalOffset));
  }

  /** Split a canonical chord without changing its spelling. */
  parseChordParts(symbol) {
    const value = String(symbol || '').trim();
    if (value === 'N.C.') return { symbol: value, noChord: true, root: null, suffix: '', bass: null };
    const match = value.match(/^([A-G](?:#{1,2}|b{1,2})?)([^/]*?)(?:\/([A-G](?:#{1,2}|b{1,2})?))?$/);
    if (!match || !match[1]) return null;
    return { symbol: value, noChord: false, root: match[1], suffix: match[2] || '', bass: match[3] || null };
  }

  /** Sem the written-note offset for a transposing instrument. */
  concertToWrittenOffset(instrument = 'concert') {
    const normalized = String(instrument || 'concert').trim().toLowerCase().replace(/[^a-z]/g, '');
    return { concert: 0, c: 0, bb: 2, bflat: 2, eb: 9, eflat: 9, f: 7 }[normalized] ?? 0;
  }

  /** Convert a concert chord into a tonic-relative Nashville number. */
  toNashville(symbol, key, { prefer = 'contextual' } = {}) {
    const chord = this.parseChordParts(symbol);
    const tonic = this.parseKey(key);
    if (!chord || !tonic || chord.noChord) return chord?.noChord ? 'N.C.' : symbol;
    const names = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
    if (prefer === 'flats') names[6] = 'b5';
    const degree = root => names[(this.notePitch(root) - tonic.pitch + 12) % 12];
    return `${degree(chord.root)}${chord.suffix}${chord.bass ? `/${degree(chord.bass)}` : ''}`;
  }

  /** One non-mutating display path for concert, capo, instrument, and Nashville views. */
  displayChord(symbol, song = {}, view = {}) {
    if (!symbol || symbol === 'N.C.') return symbol;
    const policy = view.spellingPolicy || song.spellingPolicy || 'contextual';
    const transposition = Number(song.transposition) || 0;
    const sourceKey = song.originalKey || 'C';
    const concertKey = this.transposeKey(sourceKey, transposition, policy);
    const concertChord = this.transposeChord(symbol, transposition, {
      policy, sourceKey, targetKey: concertKey, allowDoubleAccidentals: false
    });
    if ((view.notation || song.view?.notation || 'chords') === 'nashville') {
      return this.toNashville(concertChord, concertKey, { prefer: policy });
    }
    const instrument = view.instrument || song.view?.instrument || 'concert';
    const capo = Math.max(0, Math.min(11, Number(view.capo ?? song.view?.capo) || 0));
    const displayOffset = this.concertToWrittenOffset(instrument) - capo;
    if (!displayOffset) return concertChord;
    return this.transposeChord(concertChord, displayOffset, { policy });
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
if (typeof module !== 'undefined' && module.exports) module.exports = MusicTheory;
