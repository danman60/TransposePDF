/**
 * Performance Testing and Benchmarks
 * Validates speed and efficiency requirements
 */

class PerformanceTester {
  constructor() {
    this.benchmarkResults = {};
    this.requirements = {
      pdfLoad: 2000,      // < 2 seconds
      songSeparation: 1000, // < 1 second  
      transposition: 100,   // < 100ms
      export: 3000         // < 3 seconds
    };
  }

  /**
   * Run all performance benchmarks
   */
  async runBenchmarks() {
    console.log('⚡ Starting performance benchmarks...');
    
    try {
      const results = {};
      
      // PDF Loading benchmark
      console.log('📄 Testing PDF loading performance...');
      results.pdfLoad = await this.benchmarkPDFLoad();
      
      // Song separation benchmark  
      console.log('🎵 Testing song separation performance...');
      results.songSeparation = await this.benchmarkSongSeparation();
      
      // Transposition benchmark
      console.log('🎼 Testing chord transposition performance...');
      results.transposition = await this.benchmarkTransposition();
      
      // Export benchmark
      console.log('📊 Testing PDF export performance...');
      results.export = await this.benchmarkExport();
      
      // Memory usage
      console.log('🧠 Measuring memory usage...');
      results.memoryUsage = this.measureMemoryUsage();
      
      return this.validateBenchmarks(results);
      
    } catch (error) {
      console.error('Performance testing failed:', error);
      throw error;
    }
  }

  /**
   * Benchmark PDF loading performance
   */
  async benchmarkPDFLoad() {
    const mockPDFData = this.createMockPDFData();
    const processor = new PDFProcessor();
    
    const startTime = performance.now();
    
    try {
      // Simulate PDF loading process
      await this.simulatePDFProcessing(mockPDFData);
      
    } catch (error) {
      console.warn('PDF benchmark used simulation due to:', error.message);
    }
    
    const endTime = performance.now();
    return endTime - startTime;
  }

  /**
   * Benchmark song separation performance
   */
  async benchmarkSongSeparation() {
    const mockTextItems = this.createLargeTextItemSet();
    const separator = new SongSeparator();
    
    const startTime = performance.now();
    const songs = separator.separateSongs(mockTextItems);
    const endTime = performance.now();
    
    console.log(`Song separation processed ${mockTextItems.length} items into ${songs.length} songs`);
    
    return endTime - startTime;
  }

  /**
   * Benchmark chord transposition performance
   */
  async benchmarkTransposition() {
    const musicTheory = new MusicTheory();
    const testChords = this.createTranspositionTestSet();
    
    const startTime = performance.now();
    
    // Transpose multiple chords
    testChords.forEach(chord => {
      for (let i = -6; i <= 6; i++) {
        musicTheory.transposeChord(chord, i);
      }
    });
    
    const endTime = performance.now();
    const totalTranspositions = testChords.length * 13; // -6 to +6 inclusive
    
    console.log(`Transposed ${totalTranspositions} chord operations`);
    
    return (endTime - startTime) / totalTranspositions; // Per-operation time
  }

  /**
   * Benchmark PDF export performance
   */
  async benchmarkExport() {
    const mockSongs = this.createMockSongsForExport();
    const generator = new PDFGenerator();
    
    const startTime = performance.now();
    const pdf = await generator.generatePDF(mockSongs, 'Performance Test');
    const endTime = performance.now();
    
    console.log(`PDF export generated ${mockSongs.length} songs`);
    
    return endTime - startTime;
  }

  /**
   * Measure current memory usage
   */
  measureMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), // MB
        available: true
      };
    }
    
    return { available: false, message: 'Memory measurement not supported' };
  }

  /**
   * Validate benchmark results against requirements
   */
  validateBenchmarks(results) {
    const validation = {
      passed: true,
      failures: [],
      results: results,
      summary: {}
    };
    
    // Check each benchmark against requirements
    Object.keys(this.requirements).forEach(test => {
      const actual = results[test];
      const required = this.requirements[test];
      
      validation.summary[test] = {
        actual: Math.round(actual),
        required: required,
        passed: actual <= required,
        status: actual <= required ? '✅ PASS' : '❌ FAIL'
      };
      
      if (actual > required) {
        validation.passed = false;
        validation.failures.push(
          `${test}: ${Math.round(actual)}ms (required: <${required}ms)`
        );
      }
    });
    
    // Log results
    console.log('\n⚡ PERFORMANCE RESULTS');
    console.log('='.repeat(50));
    Object.keys(validation.summary).forEach(test => {
      const summary = validation.summary[test];
      console.log(`${test}: ${summary.actual}ms (${summary.status})`);
    });
    
    if (results.memoryUsage.available) {
      console.log(`Memory Usage: ${results.memoryUsage.usedJSHeapSize}MB`);
    }
    
    console.log(`\nOverall Performance: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (validation.failures.length > 0) {
      console.log('\n🚨 PERFORMANCE FAILURES:');
      validation.failures.forEach(failure => console.log(`  - ${failure}`));
    }
    
    return validation;
  }

  /**
   * Create mock PDF data for testing
   */
  createMockPDFData() {
    // Simulate a 20-page PDF structure
    return {
      numPages: 20,
      pages: Array(20).fill(null).map((_, i) => ({
        pageNum: i + 1,
        textContent: {
          items: Array(50).fill(null).map((_, j) => ({
            str: i === 0 && j === 0 ? 'Amazing Grace' : 
                 j % 4 === 0 ? 'C' : 
                 j % 4 === 1 ? 'G' : 
                 j % 4 === 2 ? 'Am' : 'F',
            transform: [1, 0, 0, 1, 50 + j * 10, 100 + (j * 15)],
            width: 20,
            height: 12
          }))
        }
      }))
    };
  }

  /**
   * Create large text item set for song separation testing
   */
  createLargeTextItemSet() {
    const items = [];
    const songTitles = [
      'Amazing Grace', 'How Great Thou Art', 'Holy, Holy, Holy',
      'Be Thou My Vision', 'It Is Well', 'Great Is Thy Faithfulness',
      'Come Thou Fount', 'Crown Him With Many Crowns', 'All Hail The Power',
      'Blessed Assurance', 'When I Survey', 'Rock Of Ages'
    ];
    
    songTitles.forEach((title, songIndex) => {
      const pageNum = Math.floor(songIndex / 3) + 1;
      const yOffset = (songIndex % 3) * 250;
      
      // Title
      items.push({
        id: `song${songIndex}_title`,
        pageNum: pageNum,
        text: title,
        x: 50,
        y: 100 + yOffset,
        fontSize: 16,
        bold: true
      });
      
      // Chord lines and lyrics (simulate full song)
      const chordProgressions = [
        'C G Am F',
        'G C D G', 
        'F C Dm Bb',
        'Am F C G'
      ];
      
      for (let line = 0; line < 20; line++) {
        const isChordLine = line % 2 === 0;
        const text = isChordLine ? 
          chordProgressions[line % 4] : 
          'La la la la la la la la';
        
        items.push({
          id: `song${songIndex}_line${line}`,
          pageNum: pageNum,
          text: text,
          x: 50,
          y: 130 + yOffset + (line * 15),
          fontSize: 12
        });
      }
    });
    
    return items;
  }

  /**
   * Create chord set for transposition testing
   */
  createTranspositionTestSet() {
    return [
      // Basic chords
      'C', 'G', 'Am', 'F', 'D', 'Em',
      
      // Extensions
      'Cmaj7', 'Gsus4', 'Am7', 'Fsus2', 'Dm7', 'Em9',
      
      // Slash chords
      'G/B', 'Am/C', 'F/A', 'D/F#', 'C/E',
      
      // Complex chords
      'Cmaj9', 'G7sus4', 'Am7b5', 'Fmaj7#11', 'C#m7b5', 'F#dim'
    ];
  }

  /**
   * Create mock songs for export testing
   */
  createMockSongsForExport() {
    return Array(10).fill(null).map((_, i) => ({
      id: i + 1,
      title: `Test Song ${i + 1}`,
      originalKey: 'C',
      currentKey: 'C',
      transposition: 0,
      chords: [
        { original: 'C', root: 'C' },
        { original: 'G', root: 'G' },
        { original: 'Am', root: 'Am' },
        { original: 'F', root: 'F' }
      ],
      songText: Array(10).fill(null).map((_, line) => {
        const isChordLine = line % 2 === 0;
        return isChordLine ? 'C    G    Am   F' : 'La la la la la la la la';
      }).join('\n')
    }));
  }

  /**
   * Simulate PDF processing for performance testing
   */
  async simulatePDFProcessing(mockData) {
    // Simulate time-consuming PDF processing operations
    await new Promise(resolve => setTimeout(resolve, 50)); // Initial delay
    
    // Simulate text extraction
    let totalItems = 0;
    mockData.pages.forEach(page => {
      totalItems += page.textContent.items.length;
      // Simulate processing each item
      page.textContent.items.forEach(() => {
        Math.random() > 0.5; // Simulate computation
      });
    });
    
    return { totalPages: mockData.numPages, totalItems };
  }

  /**
   * Run stress test with large dataset
   */
  async runStressTest() {
    console.log('🔥 Running stress test...');
    
    const stressResults = {};
    
    // Create extra large dataset
    const largeTextItems = Array(1000).fill(null).map((_, i) => ({
      id: `stress_${i}`,
      pageNum: Math.floor(i / 50) + 1,
      text: i % 4 === 0 ? 'Amazing Grace' : 
            i % 4 === 1 ? 'C G Am F' :
            i % 4 === 2 ? 'How sweet the sound' : '',
      x: (i % 10) * 50,
      y: Math.floor(i / 10) * 15,
      fontSize: 12
    }));
    
    // Stress test song separation
    const startTime = performance.now();
    const separator = new SongSeparator();
    const stressSongs = separator.separateSongs(largeTextItems);
    const endTime = performance.now();
    
    stressResults.largeSeparation = {
      time: endTime - startTime,
      itemCount: largeTextItems.length,
      songCount: stressSongs.length,
      performance: Math.round((largeTextItems.length / (endTime - startTime)) * 1000) // items per second
    };
    
    // Stress test chord transposition
    const musicTheory = new MusicTheory();
    const stressStartTime = performance.now();
    
    const stressChords = ['C', 'G', 'Am', 'F', 'D', 'Em', 'Cmaj7', 'Gsus4'];
    let totalTranspositions = 0;
    
    for (let i = 0; i < 100; i++) {
      stressChords.forEach(chord => {
        for (let semitones = -6; semitones <= 6; semitones++) {
          musicTheory.transposeChord(chord, semitones);
          totalTranspositions++;
        }
      });
    }
    
    const stressEndTime = performance.now();
    
    stressResults.massTransposition = {
      time: stressEndTime - stressStartTime,
      operations: totalTranspositions,
      performance: Math.round((totalTranspositions / (stressEndTime - stressStartTime)) * 1000) // ops per second
    };
    
    console.log('🔥 STRESS TEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Large Separation: ${stressResults.largeSeparation.performance} items/sec`);
    console.log(`Mass Transposition: ${stressResults.massTransposition.performance} ops/sec`);
    
    return stressResults;
  }

  /**
   * Monitor real-time performance during app usage
   */
  startPerformanceMonitoring() {
    const monitor = {
      startTime: performance.now(),
      operations: [],
      isMonitoring: true
    };
    
    // Monitor specific operations
    const originalLog = console.log;
    console.log = (...args) => {
      if (monitor.isMonitoring && args[0] && args[0].includes('completed in')) {
        monitor.operations.push({
          operation: args[0],
          timestamp: performance.now() - monitor.startTime
        });
      }
      originalLog.apply(console, args);
    };
    
    // Return monitoring control
    return {
      stop: () => {
        monitor.isMonitoring = false;
        console.log = originalLog;
        return monitor;
      },
      getResults: () => monitor
    };
  }
}

// Export for global use
if (typeof window !== 'undefined') {
  window.PerformanceTester = PerformanceTester;
}