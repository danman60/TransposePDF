# SoloTranscribeCLI

A command line tool that accepts a plain text or CSV file of social video URLs, downloads audio, converts to MP3, transcribes via AssemblyAI, and saves transcripts locally.

## Features

- **Batch Processing**: Process multiple video URLs from a single file
- **Multiple Platforms**: Supports YouTube, TikTok, Instagram, Facebook, and more (via yt-dlp)
- **Multiple Formats**: Output transcripts as TXT, JSON, SRT, or VTT
- **Cost Control**: Budget caps and cost estimation
- **Robust Error Handling**: Retry mechanisms and detailed error reporting
- **Progress Tracking**: Manifest files track job status and allow resuming

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd SoloTranscribeCLI
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up API keys**:
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

4. **Install the CLI tool**:
   ```bash
   pip install -e .
   ```

## Configuration

Create a `.env` file with your API credentials:

```env
# Required API Keys
FREECONVERT_API_KEY=your_freeconvert_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_key_here

# Optional Settings
OUT_DIR=./out
TEMP_DIR=./temp
RETRY_LIMIT=3
DELETE_TEMP_ON_SUCCESS=true
ENABLE_SUMMARY=false
CAP_BUDGET_USD=20
```

### Getting API Keys

1. **AssemblyAI**: Sign up at [AssemblyAI](https://www.assemblyai.com/) and get your API key
2. **FreeConvert**: Sign up at [FreeConvert](https://www.freeconvert.com/api) and get your API key

## Usage

### Basic Usage

```bash
# Process URLs from a text file
solotranscribe run --in urls.txt --out ./transcripts --format txt,json

# Process with custom settings
solotranscribe run --in videos.csv --out ./output --format txt,json,srt --summarize --cap-budget 50
```

### Commands

#### `run` - Process video URLs

```bash
solotranscribe run [OPTIONS]

Options:
  --in PATH          Input file with video URLs (txt or csv) [required]
  --out PATH         Output directory for transcripts [required]
  --format TEXT      Output formats (comma-separated): txt,json,srt,vtt [default: txt,json]
  --summarize        Enable transcript summarization
  --no-summarize     Disable transcript summarization
  --delete-temp      Delete temporary files after processing
  --keep-temp        Keep temporary files after processing
  --cap-budget FLOAT Budget cap in USD
  --dry-run          Show cost/time estimates without processing
```

#### `retry` - Retry failed jobs

```bash
solotranscribe retry --manifest ./out/manifest.json
```

#### `dryrun` - Estimate costs

```bash
solotranscribe dryrun --in urls.txt
```

#### `status` - Check configuration

```bash
solotranscribe status
```

### Input Formats

#### Text File (urls.txt)
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://www.tiktok.com/@user/video/1234567890
https://www.instagram.com/reel/ABC123/
# Comments start with #
https://vimeo.com/123456789
```

#### CSV File (videos.csv)
```csv
url,title_override
https://www.youtube.com/watch?v=dQw4w9WgXcQ,Rick Roll
https://www.tiktok.com/@user/video/1234567890,Funny TikTok
```

## Output Structure

For each processed video, the tool creates:

```
out/
├── manifest.json              # Batch processing metadata
├── manifest.csv               # Spreadsheet-friendly summary
├── batch_20240115_143022_a1b2c3d4_job_001/
│   ├── transcript.txt         # Plain text transcript
│   ├── transcript.json        # Structured transcript with metadata
│   ├── captions.srt          # SubRip subtitles (if requested)
│   ├── captions.vtt          # WebVTT subtitles (if requested)
│   └── meta.json             # Job metadata
└── logs/
    └── run-20240115-143022.jsonl
```

### Output Formats

- **TXT**: Plain text transcript with basic metadata header
- **JSON**: Structured format with full metadata, timestamps, and confidence scores
- **SRT**: SubRip subtitle format for video players
- **VTT**: WebVTT subtitle format for web players

## Examples

### Process YouTube playlist

```bash
# Create input file
echo "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > youtube_urls.txt
echo "https://www.youtube.com/watch?v=oHg5SJYRHA0" >> youtube_urls.txt

# Process with text and JSON output
solotranscribe run --in youtube_urls.txt --out ./youtube_transcripts --format txt,json

# Check results
ls ./youtube_transcripts/
```

### Batch process with budget control

```bash
# Estimate costs first
solotranscribe dryrun --in large_batch.txt

# Process with budget cap
solotranscribe run --in large_batch.txt --out ./batch_output --cap-budget 10.00 --format txt,json,srt
```

### Resume failed jobs

```bash
# If some jobs failed, retry them
solotranscribe retry --manifest ./batch_output/manifest.json
```

## Performance

- **Short videos (<2 min)**: ~45 seconds end-to-end per video
- **Long videos (≤60 min)**: Near real-time transcription speed
- **Batch of 50 videos**: Can complete in a single working session

## Cost Estimation

Typical costs (as of 2024):
- **AssemblyAI**: ~$0.00037 per second of audio (~$1.33 per hour)
- **FreeConvert**: ~$0.01-0.05 per conversion
- **Total**: ~$1.35-1.40 per hour of video content

## Troubleshooting

### Common Issues

1. **"API key not found"**
   - Check your `.env` file exists and contains valid API keys
   - Run `solotranscribe status` to verify configuration

2. **Download failures**
   - Some videos may be private, geo-blocked, or require authentication
   - Check the manifest.json for specific error details

3. **Budget exceeded**
   - Use `--cap-budget` to control spending
   - Run `dryrun` first to estimate costs

4. **Conversion failures**
   - FreeConvert API may have temporary issues
   - Failed jobs can be retried with the `retry` command

### Debug Mode

Set log level to DEBUG in your `.env` file:
```env
LOG_LEVEL=DEBUG
```

## Development

### Project Structure

```
SoloTranscribeCLI/
├── src/solotranscribe/
│   ├── adapters/           # Platform integrations
│   ├── core/              # Main processing logic
│   ├── formatters/        # Output formatters
│   ├── utils/             # Utility functions
│   ├── cli.py            # CLI interface
│   ├── config.py         # Configuration management
│   └── models.py         # Data models
├── tests/                # Test files
├── requirements.txt      # Dependencies
└── setup.py             # Package setup
```

### Running Tests

```bash
python -m pytest tests/
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Search existing issues
3. Create a new issue with detailed information

## Roadmap

- **Phase 1**: MVP with YouTube/TikTok support ✅
- **Phase 2**: Additional platform support, speaker identification
- **Phase 3**: Offline conversion options, cloud export hooks