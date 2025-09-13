# TransposePDF Golden Test Suite

This comprehensive testing framework uses Playwright to validate all aspects of the TransposePDF worship tool functionality, ensuring reliable performance during live church services.

## Test Suite Overview

### 🧪 Test Files

1. **`golden_test_1_pdf_loading.js`** - PDF Loading and Song Detection
   - Tests PDF file loading functionality
   - Validates song detection and separation
   - Checks text extraction accuracy
   - Verifies chord recognition
   - Tests error handling for invalid files
   - Validates UI updates during processing

2. **`golden_test_2_transposition.js`** - Chord Transposition Functionality
   - Tests chord transposition up/down accuracy
   - Validates transpose reset functionality
   - Checks complex chord handling (7ths, sus, add, etc.)
   - Tests multiple song transposition consistency
   - Validates transposition limits and boundaries

3. **`golden_test_3_export.js`** - Export Functionality
   - Tests PDF export with original and transposed content
   - Validates export filename handling
   - Checks export progress indicators
   - Tests generated PDF quality
   - Validates file download verification
   - Tests export performance across scenarios

4. **`golden_test_4_visibility.js`** - Text Visibility and Readability
   - Tests text rendering quality and clarity
   - Validates font size and contrast
   - Checks text selection and interaction
   - Tests visibility after transposition
   - Validates responsive text across devices
   - Tests accessibility features compliance

5. **`golden_test_5_layout.js`** - UI Responsiveness and Layout Accuracy
   - Tests layout accuracy vs original PDF
   - Validates responsive design across breakpoints
   - Checks element positioning and alignment
   - Tests layout preservation during transposition
   - Validates scroll behavior and performance

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v14 or higher)
2. **Playwright** (already included in package.json)
3. **TransposePDF app running** at `http://localhost:8000/`
4. **Test songbook PDF** at `D:\Downloads\Songbook For September 14, 2025.pdf`

### Installation

```bash
# Navigate to TransposePDF directory
cd D:\ClaudeCode\TransposePDF

# Install dependencies (if not already installed)
npm install playwright
```

### Running Tests

#### Run All Tests (Recommended)
```bash
node run_golden_tests.js
```

#### Run Individual Tests
```bash
# Test 1: PDF Loading
node golden_test_1_pdf_loading.js

# Test 2: Transposition
node golden_test_2_transposition.js

# Test 3: Export Functionality
node golden_test_3_export.js

# Test 4: Visibility and Readability
node golden_test_4_visibility.js

# Test 5: Layout and Responsiveness
node golden_test_5_layout.js
```

## 📊 Test Results

### Output Locations

- **Screenshots**: `test_results/golden_test_X_*.png`
- **Individual Reports**: `test_results/golden_test_X_report.json`
- **Summary Report**: `test_results/golden_test_suite_summary.json`
- **Downloaded PDFs**: `test_downloads/` (Test 3 only)

### Report Structure

Each test generates a detailed JSON report containing:
- Pass/fail counts and success rates
- Detailed timing metrics
- Error logs and debugging information
- Test-specific analysis data
- Screenshot references for visual verification

## 🔍 What Each Test Validates

### Test 1: PDF Loading & Song Detection
- ✅ PDF file loads without errors
- ✅ Songs are properly detected and separated
- ✅ Text extraction maintains formatting
- ✅ Chord annotations are recognized
- ✅ UI shows progress and completion states
- ✅ Error handling for invalid files

### Test 2: Chord Transposition
- ✅ Transpose up/down changes chords correctly
- ✅ Reset returns to original state
- ✅ Complex chords (C7, Gsus4, etc.) transpose accurately
- ✅ Transposition limits prevent invalid states
- ✅ Multiple songs maintain independent states
- ✅ Known chord progressions follow music theory

### Test 3: Export Functionality
- ✅ Basic PDF export completes successfully
- ✅ Transposed content exports correctly
- ✅ Custom filenames are handled properly
- ✅ Export progress indicators work
- ✅ Generated PDFs are valid and downloadable
- ✅ Performance remains acceptable under load

### Test 4: Text Visibility & Readability
- ✅ All text renders clearly and is readable
- ✅ Color contrast meets accessibility standards
- ✅ Font sizes are appropriate for worship use
- ✅ Text remains visible after transposition
- ✅ Content adapts to different screen sizes
- ✅ Interactive elements are accessible

### Test 5: Layout & Responsiveness
- ✅ Layout matches original PDF structure
- ✅ Responsive design works across all devices
- ✅ Elements are properly positioned and aligned
- ✅ Layout remains stable during transposition
- ✅ Scroll behavior is smooth and intuitive
- ✅ Performance is optimal across viewports

## 🎯 Critical Success Criteria

For **mission-critical worship use**, these tests ensure:

1. **Reliability**: No crashes or errors during live service
2. **Accuracy**: Chord transpositions are musically correct
3. **Performance**: Fast loading and responsive interactions
4. **Usability**: Clear visibility under stage lighting conditions
5. **Compatibility**: Works across worship team devices
6. **Robustness**: Handles various songbook formats gracefully

## 🔧 Troubleshooting

### Common Issues

**Test fails to start:**
- Ensure TransposePDF app is running at `http://localhost:8000/`
- Check that the test songbook PDF exists at the specified path
- Verify Playwright is installed: `npm list playwright`

**PDF not found error:**
- Update the PDF path in each test file if your songbook is located elsewhere
- Ensure the PDF file is readable and not corrupted

**Browser timeout:**
- Large songbooks may take longer to process
- Increase timeout values in test files if needed
- Check system performance and available memory

**Screenshot/report errors:**
- Ensure write permissions to the test_results directory
- Check available disk space

### Customizing Tests

**Change PDF path:**
```javascript
// In each test file, update this line:
const pdfPath = 'D:\\Downloads\\Your-Songbook-Name.pdf';
```

**Adjust timeouts:**
```javascript
// Increase processing timeout for large PDFs:
await this.page.waitForSelector('#songsSection', { 
  state: 'visible',
  timeout: 120000 // 2 minutes instead of 1
});
```

**Add custom assertions:**
```javascript
// Add your own test criteria:
this.assert(condition, 'Your custom validation message');
```

## 📈 Interpreting Results

### Success Rates
- **95-100%**: Excellent - Ready for live worship use
- **85-94%**: Good - Minor issues to address
- **70-84%**: Fair - Several issues need attention
- **Below 70%**: Poor - Significant problems require fixing

### Performance Benchmarks
- **PDF Loading**: Should complete within 30 seconds for typical songbooks
- **Transposition**: Should be instantaneous (< 500ms per song)
- **Export**: Should complete within 2 minutes for full songbooks
- **Layout Changes**: Should render within 100ms

### Visual Verification
Always review the screenshots in `test_results/` to visually confirm:
- Text is clear and readable
- Layout looks professional
- Chords are properly positioned
- Responsive design works correctly

## 🎪 Live Service Readiness Checklist

Before using in worship:
- [ ] All 5 golden tests pass with 95%+ success rate
- [ ] Export functionality works with your typical songbooks
- [ ] Text is clearly visible on your worship team's devices
- [ ] Transpose controls respond quickly during practice
- [ ] Layout looks professional on stage displays
- [ ] Backup plans are in place (printed songbooks, etc.)

## 📞 Support

For issues with the testing framework:
1. Check the error logs in test reports
2. Review screenshots for visual clues
3. Verify app prerequisites are met
4. Test with a smaller/simpler PDF first

Remember: These tests are designed to ensure **mission-critical reliability** for live worship services. Take any failures seriously and address them before depending on the tool during actual church services.

---

*"Let everything that has breath praise the Lord!" - Psalm 150:6*

This testing framework helps ensure your worship technology serves the greater purpose of glorifying God through music. 🎵✨