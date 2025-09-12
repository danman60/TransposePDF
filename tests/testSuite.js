/**
 * Comprehensive Test Suite for Chord Transposer Pro
 * Tests all core functionality with real-world examples
 */

class TransposeAppTests {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: {}
    };
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting comprehensive test suite...');
    
    const testSections = [
      { name: 'PDF Processing', fn: () => this.testPDFProcessing() },
      { name: 'Song Separation', fn: () => this.testSongSeparation() },
      { name: 'Chord Detection', fn: () => this.testChordDetection() },
      { name: 'Transposition', fn: () => this.testTransposition() },
      { name: 'Key Detection', fn: () => this.testKeyDetection() },
      { name: 'PDF Export', fn: () => this.testPDFExport() },
      { name: 'UI Interactions', fn: () => this.testUIInteractions() }
    ];

    for (const section of testSections) {
      try {
        console.log(`\n📋 Testing ${section.name}...`);
        const result = await section.fn();
        this.testResults.details[section.name] = result;
        
        if (result.passed) {
          this.testResults.passed++;
          console.log(`✅ ${section.name}: PASSED (${result.tests || 0} tests)`);
        } else {
          this.testResults.failed++;
          console.log(`❌ ${section.name}: FAILED`);
          if (result.errors) {
            result.errors.forEach(error => console.log(`   - ${error}`));
          }
        }
      } catch (error) {
        this.testResults.failed++;
        this.testResults.errors.push(`${section.name}: ${error.message}`);
        console.error(`💥 ${section.name}: ERROR -`, error);
      }
    }

    return this.generateTestReport();
  }

  /**
   * Test PDF processing functionality
   */
  async testPDFProcessing() {
    const results = { passed: true, tests: 0, errors: [] };
    
    // Test 1: PDF.js availability
    if (typeof pdfjsLib === 'undefined') {
      results.passed = false;
      results.errors.push('PDF.js library not available');
    } else {
      results.tests++;
    }
    
    // Test 2: PDFProcessor class
    if (typeof PDFProcessor === 'undefined') {
      results.passed = false;
      results.errors.push('PDFProcessor class not available');
    } else {
      results.tests++;
      
      // Test 3: PDFProcessor instantiation
      try {
        const processor = new PDFProcessor();
        results.tests++;
      } catch (error) {
        results.passed = false;
        results.errors.push(`PDFProcessor instantiation failed: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Test song separation functionality
   */
  async testSongSeparation() {
    const results = { passed: true, tests: 0, errors: [] };
    
    if (typeof SongSeparator === 'undefined') {
      results.passed = false;
      results.errors.push('SongSeparator class not available');
      return results;
    }
    
    try {
      const separator = new SongSeparator();
      results.tests++;
      
      // Create mock text items for testing
      const mockTextItems = this.createMockTextItems();
      
      // Test song separation
      const songs = separator.separateSongs(mockTextItems);
      results.tests++;
      
      if (!Array.isArray(songs)) {
        results.passed = false;
        results.errors.push('separateSongs should return an array');
      } else if (songs.length === 0) {
        results.passed = false;
        results.errors.push('No songs detected in mock data');
      } else {
        results.tests++;
        
        // Validate song structure
        const firstSong = songs[0];
        const requiredFields = ['id', 'title', 'originalKey', 'chords', 'textItems'];
        
        for (const field of requiredFields) {
          if (!(field in firstSong)) {
            results.passed = false;
            results.errors.push(`Song missing required field: ${field}`);
          } else {
            results.tests++;
          }
        }
      }
      
    } catch (error) {
      results.passed = false;
      results.errors.push(`Song separation test failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Test chord detection with comprehensive examples
   */
  async testChordDetection() {
    const results = { passed: true, tests: 0, errors: [] };
    
    if (typeof MusicTheory === 'undefined') {
      results.passed = false;
      results.errors.push('MusicTheory class not available');
      return results;
    }
    
    const musicTheory = new MusicTheory();
    
    // Test cases covering all chord types
    const testCases = [
      // Basic chords
      { input: 'C G Am F', expected: ['C', 'G', 'Am', 'F'] },
      { input: 'D Em A7 Bm', expected: ['D', 'Em', 'A7', 'Bm'] },
      
      // Extensions and variations
      { input: 'Cmaj7 Gsus4 Am7 Fsus2', expected: ['Cmaj7', 'Gsus4', 'Am7', 'Fsus2'] },
      { input: 'D/F# G/B Am/C F/A', expected: ['D/F#', 'G/B', 'Am/C', 'F/A'] },
      
      // Complex worship chords
      { input: 'Cmaj9 G7sus4 Am7b5 Fmaj7#11', expected: ['Cmaj9', 'G7sus4', 'Am7b5', 'Fmaj7#11'] },
      
      // Challenging cases
      { input: 'C#m7b5 F#dim Bbmaj7#11 Db/F', expected: ['C#m7b5', 'F#dim', 'Bbmaj7#11', 'Db/F'] }
    ];
    
    for (const testCase of testCases) {
      try {
        const detected = musicTheory.extractChords(testCase.input);
        const detectedNames = detected.map(chord => chord.original);
        
        results.tests++;
        
        if (!this.arraysEqual(detectedNames, testCase.expected)) {
          results.passed = false;
          results.errors.push(
            `Chord detection failed: "${testCase.input}" - got [${detectedNames.join(', ')}], expected [${testCase.expected.join(', ')}]`
          );
        }
      } catch (error) {
        results.passed = false;
        results.errors.push(`Chord detection error for "${testCase.input}": ${error.message}`);
      }
    }
    
    // Test individual chord validation
    const validChords = ['C', 'Gmaj7', 'Am/C', 'F#m7b5', 'Bbsus4'];
    const invalidChords = ['H', 'C##', 'Ammmm', 'X/Y'];
    
    validChords.forEach(chord => {
      results.tests++;
      if (!musicTheory.isValidChord(chord)) {
        results.passed = false;
        results.errors.push(`Valid chord "${chord}" was marked as invalid`);
      }
    });
    
    invalidChords.forEach(chord => {
      results.tests++;
      if (musicTheory.isValidChord(chord)) {
        results.passed = false;
        results.errors.push(`Invalid chord "${chord}" was marked as valid`);
      }
    });
    
    return results;
  }

  /**
   * Test chord transposition with comprehensive examples
   */
  async testTransposition() {
    const results = { passed: true, tests: 0, errors: [] };
    
    if (typeof MusicTheory === 'undefined') {
      results.passed = false;
      results.errors.push('MusicTheory class not available');
      return results;
    }
    
    const musicTheory = new MusicTheory();
    
    // Comprehensive transposition test cases
    const testCases = [
      // Basic transpositions
      { chord: 'C', semitones: 1, expected: 'C#' },
      { chord: 'C', semitones: 2, expected: 'D' },
      { chord: 'C', semitones: -1, expected: 'B' },
      { chord: 'C', semitones: 12, expected: 'C' }, // Full octave
      
      // Minor chords
      { chord: 'Am', semitones: 1, expected: 'A#m' },
      { chord: 'Am', semitones: 2, expected: 'Bm' },
      { chord: 'Am', semitones: 3, expected: 'Cm' },
      
      // Extensions
      { chord: 'Am7', semitones: 2, expected: 'Bm7' },
      { chord: 'Cmaj7', semitones: 1, expected: 'C#maj7' },
      { chord: 'Gsus4', semitones: 5, expected: 'Csus4' },
      { chord: 'Fmaj7', semitones: 6, expected: 'Bmaj7' },
      
      // Slash chords
      { chord: 'D/F#', semitones: -1, expected: 'C#/F' },
      { chord: 'G/B', semitones: 2, expected: 'A/C#' },
      { chord: 'C/E', semitones: 1, expected: 'C#/F' },
      
      // Complex chords
      { chord: 'C#m7b5', semitones: 1, expected: 'Dm7b5' },
      { chord: 'Bbmaj9', semitones: 2, expected: 'Cmaj9' },
      { chord: 'F#dim/A', semitones: -2, expected: 'Edim/G' },
      
      // Enharmonic preferences (always prefer sharps)
      { chord: 'Bb', semitones: 1, expected: 'B' },
      { chord: 'Eb', semitones: 1, expected: 'E' },
      { chord: 'Ab', semitones: 1, expected: 'A' },
      
      // Edge cases
      { chord: 'B', semitones: 1, expected: 'C' },
      { chord: 'E', semitones: 1, expected: 'F' },
      { chord: 'F', semitones: -1, expected: 'E' }
    ];
    
    for (const test of testCases) {
      try {
        const result = musicTheory.transposeChord(test.chord, test.semitones);
        results.tests++;
        
        if (result !== test.expected) {
          results.passed = false;
          results.errors.push(
            `Transposition failed: ${test.chord} + ${test.semitones} = ${result}, expected ${test.expected}`
          );
        }
      } catch (error) {
        results.passed = false;
        results.errors.push(`Transposition error for ${test.chord}: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Test key detection accuracy
   */
  async testKeyDetection() {
    const results = { passed: true, tests: 0, errors: [] };
    
    if (typeof MusicTheory === 'undefined') {
      results.passed = false;
      results.errors.push('MusicTheory class not available');
      return results;
    }
    
    const musicTheory = new MusicTheory();
    
    // Test key detection with known progressions
    const testCases = [
      { chords: ['C', 'G', 'Am', 'F'], expectedKey: 'C', description: 'C major progression' },
      { chords: ['Am', 'F', 'C', 'G'], expectedKey: 'Am', description: 'A minor progression' },
      { chords: ['D', 'A', 'Bm', 'G'], expectedKey: 'D', description: 'D major progression' },
      { chords: ['Em', 'C', 'G', 'D'], expectedKey: 'Em', description: 'E minor progression' },
      { chords: ['F', 'C', 'Dm', 'Bb'], expectedKey: 'F', description: 'F major progression' }
    ];
    
    for (const test of testCases) {
      try {
        const detection = musicTheory.detectKey(test.chords);
        results.tests++;
        
        if (detection.key !== test.expectedKey) {
          results.passed = false;
          results.errors.push(
            `Key detection failed for ${test.description}: got ${detection.key}, expected ${test.expectedKey} (confidence: ${Math.round(detection.confidence * 100)}%)`
          );
        } else if (detection.confidence < 0.7) {
          // Warning for low confidence, but not a failure
          console.warn(`Low confidence key detection for ${test.description}: ${Math.round(detection.confidence * 100)}%`);
        }
      } catch (error) {
        results.passed = false;
        results.errors.push(`Key detection error for ${test.description}: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * Test PDF export functionality
   */
  async testPDFExport() {
    const results = { passed: true, tests: 0, errors: [] };
    
    // Check jsPDF availability
    if (typeof jsPDF === 'undefined') {
      results.passed = false;
      results.errors.push('jsPDF library not available');
      return results;
    }
    
    if (typeof PDFGenerator === 'undefined') {
      results.passed = false;
      results.errors.push('PDFGenerator class not available');
      return results;
    }
    
    try {
      const pdfGenerator = new PDFGenerator();
      results.tests++;
      
      // Test PDF generation validation
      const validation = pdfGenerator.validatePDFGeneration();
      results.tests++;
      
      if (!validation.available) {
        results.passed = false;
        results.errors.push(`PDF generation not available: ${validation.error}`);
        return results;
      }
      
      // Create mock songs for testing
      const mockSongs = this.createMockSongs();
      
      // Test PDF generation (without actual file creation)
      const pdf = await pdfGenerator.generatePDF(mockSongs, 'Test Songbook');
      results.tests++;
      
      if (!pdf) {
        results.passed = false;
        results.errors.push('PDF generation returned null');
      } else {
        // Test blob generation
        const blob = pdfGenerator.getPDFBlob(pdf);
        results.tests++;
        
        if (!blob || blob.size === 0) {
          results.passed = false;
          results.errors.push('Generated PDF blob is empty');
        }
      }
      
    } catch (error) {
      results.passed = false;
      results.errors.push(`PDF export test failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Test UI interactions
   */
  async testUIInteractions() {
    const results = { passed: true, tests: 0, errors: [] };
    
    if (typeof UIController === 'undefined') {
      results.passed = false;
      results.errors.push('UIController class not available');
      return results;
    }
    
    try {
      // Test UI element presence
      const requiredElements = [
        'uploadArea', 'fileInput', 'songsSection', 'exportButton'
      ];
      
      for (const elementId of requiredElements) {
        const element = document.getElementById(elementId);
        results.tests++;
        
        if (!element) {
          results.passed = false;
          results.errors.push(`Required UI element missing: ${elementId}`);
        }
      }
      
      // Test UIController instantiation
      const uiController = new UIController();
      results.tests++;
      
      // Test state management
      const initialState = uiController.getState();
      results.tests++;
      
      if (typeof initialState !== 'object') {
        results.passed = false;
        results.errors.push('UIController getState() should return an object');
      }
      
    } catch (error) {
      results.passed = false;
      results.errors.push(`UI interaction test failed: ${error.message}`);
    }
    
    return results;
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport() {
    const totalTests = this.testResults.passed + this.testResults.failed;
    const successRate = totalTests > 0 ? (this.testResults.passed / totalTests) * 100 : 0;
    
    const report = {
      summary: {
        total: totalTests,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: Math.round(successRate * 100) / 100,
        overallPassed: successRate >= 95
      },
      details: this.testResults.details,
      errors: this.testResults.errors,
      timestamp: new Date().toISOString()
    };
    
    // Log summary
    console.log('\n📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Success Rate: ${report.summary.successRate}%`);
    console.log(`Overall: ${report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      this.testResults.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    return report;
  }

  /**
   * Helper: Create mock text items for testing
   */
  createMockTextItems() {
    return [
      { id: 'p1_1', pageNum: 1, text: 'Amazing Grace', x: 50, y: 100, fontSize: 16, bold: true },
      { id: 'p1_2', pageNum: 1, text: 'C G Am F', x: 50, y: 130, fontSize: 12 },
      { id: 'p1_3', pageNum: 1, text: 'Amazing grace how sweet the sound', x: 50, y: 150, fontSize: 12 },
      { id: 'p1_4', pageNum: 1, text: '', x: 50, y: 200, fontSize: 12 },
      { id: 'p1_5', pageNum: 1, text: 'How Great Thou Art', x: 50, y: 250, fontSize: 16, bold: true },
      { id: 'p1_6', pageNum: 1, text: 'G C D G', x: 50, y: 280, fontSize: 12 },
      { id: 'p1_7', pageNum: 1, text: 'O Lord my God when I in awesome wonder', x: 50, y: 300, fontSize: 12 }
    ];
  }

  /**
   * Helper: Create mock songs for testing
   */
  createMockSongs() {
    return [
      {
        id: 1,
        title: 'Amazing Grace',
        originalKey: 'C',
        currentKey: 'C',
        transposition: 0,
        chords: [
          { original: 'C', root: 'C' },
          { original: 'G', root: 'G' },
          { original: 'Am', root: 'Am' },
          { original: 'F', root: 'F' }
        ],
        songText: 'C      G      Am     F\nAmazing grace how sweet the sound\nC      G      Am     F\nThat saved a wretch like me'
      }
    ];
  }

  /**
   * Helper: Compare arrays for equality
   */
  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, i) => val === arr2[i]);
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.TransposeAppTests = TransposeAppTests;
}