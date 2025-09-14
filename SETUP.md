# SoloTranscribeCLI Setup Guide

## Quick Start

### 1. Prerequisites

- Python 3.8 or higher
- Git
- Internet connection

### 2. Installation

```bash
# Clone and navigate
git clone <repo-url>
cd SoloTranscribeCLI

# Install dependencies
pip install -r requirements.txt

# Install the tool
pip install -e .
```

### 3. Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env  # or use your preferred editor
```

**Required API Keys:**

1. **AssemblyAI** (for transcription)
   - Go to: https://www.assemblyai.com/
   - Sign up and get your API key from the dashboard
   - Add to `.env`: `ASSEMBLYAI_API_KEY=your_key_here`

2. **FreeConvert** (for MP4→MP3 conversion)
   - Go to: https://www.freeconvert.com/api
   - Sign up and get your API key
   - Add to `.env`: `FREECONVERT_API_KEY=your_key_here`

### 4. First Test

```bash
# Check configuration
solotranscribe status

# Test with a single short video
solotranscribe dryrun --in test_urls.txt

# If dry run looks good, process it
solotranscribe run --in test_urls.txt --out ./test_output --format txt,json
```

## Directory Structure After Setup

```
SoloTranscribeCLI/
├── .env                    # Your API keys (created by you)
├── logs/                   # Application logs
├── temp/                   # Temporary files during processing
├── out/                    # Default output directory
├── test_output/           # Test results (after first run)
└── [source files...]
```

## Troubleshooting Setup

### Missing Dependencies
```bash
# If you get import errors
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### API Key Issues
```bash
# Verify your configuration
solotranscribe status

# Should show:
# ✅ AssemblyAI: Set
# ✅ FreeConvert: Set
```

### Permission Issues
```bash
# On Unix systems, make the script executable
chmod +x solotranscribe.py

# Or run with python directly
python solotranscribe.py --help
```

### Windows-Specific
```cmd
# Use Python directly if command not found
python -m solotranscribe --help

# Or use the .py file
python solotranscribe.py --help
```

## Next Steps

Once setup is complete:

1. **Read the main README.md** for full usage instructions
2. **Test with sample_urls.txt** (uncomment one URL at a time)
3. **Try different output formats**: `--format txt,json,srt,vtt`
4. **Use budget controls**: `--cap-budget 5.00`

## Cost Considerations

- **Start small**: Test with 1-2 short videos first
- **Use dry-run**: Always estimate costs before large batches
- **Set budget caps**: Use `--cap-budget` to avoid overspending
- **Typical costs**: ~$1.40 per hour of video content

## Getting Help

If you encounter issues:

1. Check this troubleshooting section
2. Run `solotranscribe status` to verify configuration
3. Check logs in `./logs/` directory
4. Start with single short videos before batches