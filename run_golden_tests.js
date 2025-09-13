/**
 * Golden Test Suite Runner for TransposePDF
 * 
 * This script runs all 5 golden test files in sequence and provides
 * a comprehensive summary of all test results.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class GoldenTestRunner {
  constructor() {
    this.testFiles = [
      'golden_test_1_pdf_loading.js',
      'golden_test_2_transposition.js', 
      'golden_test_3_export.js',
      'golden_test_4_visibility.js',
      'golden_test_5_layout.js'
    ];
    
    this.results = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 Starting TransposePDF Golden Test Suite');
    console.log('=' * 60);
    console.log(`📅 Test Run: ${new Date().toISOString()}`);
    console.log(`🧪 Tests to run: ${this.testFiles.length}`);
    console.log('');

    // Ensure test results directory exists
    const resultsDir = 'test_results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Run each test file
    for (let i = 0; i < this.testFiles.length; i++) {
      const testFile = this.testFiles[i];
      console.log(`\n🧪 Running Test ${i + 1}/${this.testFiles.length}: ${testFile}`);
      console.log('-' * 50);
      
      const result = await this.runSingleTest(testFile, i + 1);
      this.results.push(result);
      
      if (result.success) {
        console.log(`✅ Test ${i + 1} completed successfully`);
      } else {
        console.log(`❌ Test ${i + 1} failed with errors`);
      }
      
      // Wait between tests to allow cleanup
      if (i < this.testFiles.length - 1) {
        console.log('⏳ Waiting 5 seconds before next test...');
        await this.sleep(5000);
      }
    }

    await this.generateSummaryReport();
  }

  async runSingleTest(testFile, testNumber) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const child = spawn('node', [testFile], {
        cwd: __dirname,
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const result = {
          testNumber,
          testFile,
          startTime,
          endTime,
          duration,
          exitCode: code,
          success: code === 0
        };

        // Try to read the test report if it exists
        try {
          const reportPath = `test_results/golden_test_${testNumber}_report.json`;
          if (fs.existsSync(reportPath)) {
            const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            result.report = reportData;
          }
        } catch (error) {
          console.log(`⚠️  Could not read report for ${testFile}: ${error.message}`);
        }

        resolve(result);
      });

      child.on('error', (error) => {
        console.error(`❌ Failed to start test ${testFile}:`, error.message);
        resolve({
          testNumber,
          testFile,
          error: error.message,
          success: false,
          duration: 0
        });
      });
    });
  }

  async generateSummaryReport() {
    const endTime = Date.now();
    const totalTime = endTime - this.startTime;

    console.log('\n' + '=' * 60);
    console.log('📊 GOLDEN TEST SUITE SUMMARY');
    console.log('=' * 60);

    // Overall statistics
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = this.results.length - successfulTests;
    const successRate = (successfulTests / this.results.length) * 100;

    console.log(`🧪 Total Tests: ${this.results.length}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`⏱️  Total Time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);

    // Individual test results
    console.log('\n📋 INDIVIDUAL TEST RESULTS:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : 'N/A';
      
      console.log(`${status} Test ${result.testNumber}: ${result.testFile} (${duration})`);
      
      if (result.report) {
        const summary = result.report.summary;
        if (summary) {
          console.log(`    Passed: ${summary.passed}, Failed: ${summary.failed}, Success Rate: ${summary.successRate}%`);
        }
      }
      
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });

    // Detailed analysis if reports are available
    const reportsWithData = this.results.filter(r => r.report && r.report.summary);
    
    if (reportsWithData.length > 0) {
      console.log('\n📈 DETAILED ANALYSIS:');
      
      const totalTestCases = reportsWithData.reduce((sum, r) => sum + r.report.summary.total, 0);
      const totalPassed = reportsWithData.reduce((sum, r) => sum + r.report.summary.passed, 0);
      const totalFailed = reportsWithData.reduce((sum, r) => sum + r.report.summary.failed, 0);
      
      console.log(`Total Test Cases: ${totalTestCases}`);
      console.log(`Total Passed: ${totalPassed}`);
      console.log(`Total Failed: ${totalFailed}`);
      console.log(`Overall Test Case Success Rate: ${((totalPassed / totalTestCases) * 100).toFixed(1)}%`);

      // Test-specific insights
      console.log('\n🔍 TEST-SPECIFIC INSIGHTS:');
      
      reportsWithData.forEach(result => {
        const report = result.report;
        console.log(`\n${result.testFile}:`);
        
        if (report.transpositionAnalysis) {
          console.log(`  🎼 Chord Tests: ${report.transpositionAnalysis.totalChordTests} (${report.transpositionAnalysis.correctTranspositions} correct)`);
        }
        
        if (report.exportAnalysis) {
          console.log(`  📤 Export Tests: ${report.exportAnalysis.totalExportTests}`);
          if (report.exportAnalysis.averageExportTime) {
            console.log(`  ⏱️  Avg Export Time: ${report.exportAnalysis.averageExportTime.toFixed(0)}ms`);
          }
        }
        
        if (report.visibilityAnalysis) {
          console.log(`  👁️  Visibility Tests: ${report.visibilityAnalysis.totalVisibilityTests}`);
          console.log(`  ♿ Accessibility Tests: ${report.visibilityAnalysis.accessibilityTests}`);
        }
        
        if (report.layoutAnalysis) {
          console.log(`  🎨 Layout Score: ${report.layoutAnalysis.averageLayoutScore}/100`);
          console.log(`  📱 Responsive Tests: ${report.layoutAnalysis.responsiveTests}`);
        }
      });
    }

    // Screenshots summary
    const allScreenshots = this.results
      .filter(r => r.report && r.report.results && r.report.results.screenshots)
      .reduce((acc, r) => acc.concat(r.report.results.screenshots), []);
    
    if (allScreenshots.length > 0) {
      console.log(`\n📸 SCREENSHOTS CAPTURED: ${allScreenshots.length}`);
      console.log('Screenshots saved in test_results/ directory');
    }

    // Error summary
    const allErrors = this.results
      .filter(r => r.report && r.report.results && r.report.results.errors)
      .reduce((acc, r) => acc.concat(r.report.results.errors.map(e => ({ test: r.testFile, error: e }))), []);
    
    if (allErrors.length > 0) {
      console.log('\n🚨 ERRORS ENCOUNTERED:');
      allErrors.forEach(({ test, error }) => {
        console.log(`  ${test}: ${error}`);
      });
    }

    // Save summary report
    const summaryReport = {
      testSuite: 'TransposePDF Golden Test Suite',
      timestamp: new Date().toISOString(),
      duration: totalTime,
      summary: {
        totalTests: this.results.length,
        successful: successfulTests,
        failed: failedTests,
        successRate: successRate
      },
      results: this.results,
      screenshots: allScreenshots,
      errors: allErrors
    };

    const summaryPath = 'test_results/golden_test_suite_summary.json';
    fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
    
    console.log(`\n📄 Summary report saved: ${summaryPath}`);

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (successRate === 100) {
      console.log('🎉 All tests passed! The TransposePDF app is working excellently.');
    } else if (successRate >= 80) {
      console.log('👍 Most tests passed. Review failed tests and address any critical issues.');
    } else if (successRate >= 60) {
      console.log('⚠️  Several tests failed. Significant issues need attention before production use.');
    } else {
      console.log('🚨 Many tests failed. Critical review and fixes needed before deployment.');
    }

    if (allErrors.length > 0) {
      console.log(`📝 Review the ${allErrors.length} errors encountered during testing.`);
    }

    console.log('📸 Check screenshots in test_results/ for visual verification.');
    console.log('📊 Use individual test reports for detailed analysis.');

    console.log('\n🏁 Golden Test Suite Complete!');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
(async () => {
  const runner = new GoldenTestRunner();
  
  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('Fatal error in test runner:', error);
    process.exit(1);
  }
})();