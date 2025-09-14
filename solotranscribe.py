#!/usr/bin/env python3
"""
SoloTranscribeCLI - Command line entry point
"""

import sys
from pathlib import Path

# Add src to path so we can import our modules
src_path = Path(__file__).parent / 'src'
sys.path.insert(0, str(src_path))

from solotranscribe.cli import cli

if __name__ == '__main__':
    cli()