"""
Local FFmpeg-based audio conversion (replaces FreeConvert API)
"""

import os
import logging
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Tuple

from ..models import FailureReason
from ..config import config


logger = logging.getLogger(__name__)


class FFmpegConverter:
    """Local FFmpeg-based MP4 to MP3 converter"""

    def __init__(self):
        self.ffmpeg_path = self._find_ffmpeg()

    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg executable on the system"""
        # Common locations for FFmpeg
        possible_paths = [
            'ffmpeg',  # If in PATH
            'ffmpeg.exe',
            '/usr/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
            r'C:\ffmpeg\bin\ffmpeg.exe',
            r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',
        ]

        for path in possible_paths:
            if shutil.which(path) or (Path(path).exists() and Path(path).is_file()):
                logger.info(f"Found FFmpeg at: {path}")
                return path

        logger.warning("FFmpeg not found in common locations")
        return None

    def is_available(self) -> bool:
        """Check if FFmpeg is available"""
        if not self.ffmpeg_path:
            return False

        try:
            result = subprocess.run([self.ffmpeg_path, '-version'],
                                  capture_output=True, text=True, timeout=10)
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False

    def convert_mp4_to_mp3(self, input_path: Path, output_path: Path) -> Tuple[bool, Optional[FailureReason], Optional[str]]:
        """
        Convert MP4 to MP3 using local FFmpeg

        Returns:
            tuple: (success, failure_reason, error_message)
        """
        if not self.ffmpeg_path:
            return False, FailureReason.CONVERT_FAILED, "FFmpeg not found on system"

        if not input_path.exists():
            return False, FailureReason.CONVERT_FAILED, f"Input file not found: {input_path}"

        try:
            logger.info(f"Converting {input_path.name} to MP3 using FFmpeg")

            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # FFmpeg command for MP4 to MP3 conversion
            cmd = [
                self.ffmpeg_path,
                '-i', str(input_path),          # Input file
                '-vn',                          # No video
                '-acodec', 'mp3',               # Audio codec
                '-ab', '128k',                  # Audio bitrate
                '-ar', '44100',                 # Sample rate
                '-y',                           # Overwrite output file
                str(output_path)                # Output file
            ]

            # Run FFmpeg
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                if output_path.exists() and output_path.stat().st_size > 0:
                    logger.info(f"Successfully converted to MP3: {output_path}")
                    return True, None, None
                else:
                    error_msg = "Conversion completed but output file is empty or missing"
                    logger.error(error_msg)
                    return False, FailureReason.CONVERT_FAILED, error_msg
            else:
                error_msg = f"FFmpeg conversion failed: {result.stderr}"
                logger.error(error_msg)
                return False, FailureReason.CONVERT_FAILED, error_msg

        except subprocess.TimeoutExpired:
            error_msg = "FFmpeg conversion timed out after 5 minutes"
            logger.error(error_msg)
            return False, FailureReason.CONVERT_FAILED, error_msg

        except Exception as e:
            error_msg = f"Unexpected error during FFmpeg conversion: {e}"
            logger.error(error_msg)
            return False, FailureReason.CONVERT_FAILED, error_msg

    def estimate_conversion_cost(self, duration_seconds: float) -> float:
        """Estimate conversion cost (free for local FFmpeg)"""
        return 0.0  # Free local conversion

    def estimate_conversion_time(self, file_size_mb: float) -> float:
        """Estimate conversion time based on file size"""
        # FFmpeg is typically very fast for audio extraction
        # Rough estimate: ~5-10 seconds for most videos
        base_time = 10  # Base processing time
        size_factor = max(1, file_size_mb / 100)  # Scale with file size
        return base_time * size_factor

    def get_audio_info(self, file_path: Path) -> Optional[dict]:
        """Get audio information from file using FFprobe"""
        if not self.ffmpeg_path:
            return None

        # Try to find ffprobe (usually comes with FFmpeg)
        ffprobe_path = self.ffmpeg_path.replace('ffmpeg', 'ffprobe')

        try:
            cmd = [
                ffprobe_path,
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                str(file_path)
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode == 0:
                import json
                return json.loads(result.stdout)
            else:
                logger.warning(f"Could not get audio info: {result.stderr}")
                return None

        except Exception as e:
            logger.warning(f"Error getting audio info: {e}")
            return None

    def extract_audio_duration(self, file_path: Path) -> Optional[float]:
        """Extract audio duration from file"""
        info = self.get_audio_info(file_path)
        if info and 'format' in info:
            try:
                return float(info['format'].get('duration', 0))
            except (ValueError, TypeError):
                pass
        return None

    def check_system_requirements(self) -> dict:
        """Check system requirements for FFmpeg"""
        return {
            'ffmpeg_available': self.is_available(),
            'ffmpeg_path': self.ffmpeg_path,
            'system_compatible': True,  # FFmpeg works on all major OS
            'installation_required': not self.is_available()
        }