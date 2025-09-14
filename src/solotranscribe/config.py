"""
Configuration management for SoloTranscribeCLI
"""

import os
import logging
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration settings for SoloTranscribeCLI"""

    def __init__(self):
        # API Keys
        self.freeconvert_api_key = os.getenv('FREECONVERT_API_KEY', '')
        self.assemblyai_api_key = os.getenv('ASSEMBLYAI_API_KEY', '')

        # Directories
        self.out_dir = Path(os.getenv('OUT_DIR', './out'))
        self.temp_dir = Path(os.getenv('TEMP_DIR', './temp'))

        # Processing settings
        self.retry_limit = int(os.getenv('RETRY_LIMIT', '3'))
        self.delete_temp_on_success = os.getenv('DELETE_TEMP_ON_SUCCESS', 'true').lower() == 'true'
        self.enable_summary = os.getenv('ENABLE_SUMMARY', 'false').lower() == 'true'
        self.cap_budget_usd = float(os.getenv('CAP_BUDGET_USD', '20'))

        # Concurrency
        self.max_concurrent_downloads = int(os.getenv('MAX_CONCURRENT_DOWNLOADS', '3'))
        self.max_concurrent_transcriptions = int(os.getenv('MAX_CONCURRENT_TRANSCRIPTIONS', '2'))

        # Logging
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')

        # Validate configuration
        self._validate()

        # Create directories
        self._setup_directories()

    def _validate(self):
        """Validate configuration settings"""
        errors = []

        if not self.assemblyai_api_key:
            errors.append("ASSEMBLYAI_API_KEY is required")

        if not self.freeconvert_api_key:
            errors.append("FREECONVERT_API_KEY is required")

        if self.retry_limit < 1:
            errors.append("RETRY_LIMIT must be >= 1")

        if self.cap_budget_usd <= 0:
            errors.append("CAP_BUDGET_USD must be > 0")

        if errors:
            raise ValueError("Configuration errors:\n" + "\n".join(f"- {error}" for error in errors))

    def _setup_directories(self):
        """Create necessary directories"""
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        # Create logs directory
        logs_dir = Path('./logs')
        logs_dir.mkdir(exist_ok=True)

    def setup_logging(self):
        """Setup logging configuration"""
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

        # Setup file logging
        log_file = Path('./logs') / 'solotranscribe.log'

        logging.basicConfig(
            level=getattr(logging, self.log_level.upper()),
            format=log_format,
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )


# Global configuration instance
config = Config()