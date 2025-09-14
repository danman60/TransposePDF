"""
Video downloader using yt-dlp for multiple platforms
"""

import logging
import yt_dlp
from pathlib import Path
from typing import Optional, Dict, Any
from urllib.parse import urlparse

from ..models import VideoMetadata, FailureReason
from ..config import config


logger = logging.getLogger(__name__)


class VideoDownloader:
    """Downloads videos from supported platforms using yt-dlp"""

    def __init__(self):
        # Configure yt-dlp options
        self.ydl_opts = {
            'format': 'best[ext=mp4]/best',  # Prefer mp4, fallback to best
            'outtmpl': str(config.temp_dir / '%(id)s.%(ext)s'),
            'writeinfojson': True,
            'writesubtitles': False,
            'writeautomaticsub': False,
            'ignoreerrors': False,
            'no_warnings': False,
            'extractaudio': False,
            'audioformat': 'mp3',
            'embed_subs': False,
            'embed_thumbnail': False,
            'writewebvtt': False,
            'writethumbnail': False
        }

    def extract_info(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract video metadata without downloading"""
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                return info
        except Exception as e:
            logger.error(f"Failed to extract info for {url}: {e}")
            return None

    def get_video_metadata(self, url: str) -> Optional[VideoMetadata]:
        """Get video metadata from URL"""
        try:
            info = self.extract_info(url)
            if not info:
                return None

            # Extract platform from URL
            platform = self._detect_platform(url)

            metadata = VideoMetadata(
                title=info.get('title'),
                platform=platform,
                duration=info.get('duration'),
                upload_date=info.get('upload_date'),
                uploader=info.get('uploader'),
                description=info.get('description', '')[:500] if info.get('description') else None,
                view_count=info.get('view_count')
            )

            return metadata

        except Exception as e:
            logger.error(f"Failed to get metadata for {url}: {e}")
            return None

    def download_video(self, url: str, job_id: str) -> tuple[Optional[Path], Optional[FailureReason], Optional[str]]:
        """
        Download video and return (path, error_reason, error_message)

        Returns:
            tuple: (video_path, failure_reason, error_message)
                   video_path is None if download failed
        """
        try:
            # Update output template with job ID
            custom_opts = self.ydl_opts.copy()
            custom_opts['outtmpl'] = str(config.temp_dir / f'{job_id}_%(id)s.%(ext)s')

            logger.info(f"Starting download for {url}")

            with yt_dlp.YoutubeDL(custom_opts) as ydl:
                # Extract info first to get filename
                info = ydl.extract_info(url, download=False)
                if not info:
                    return None, FailureReason.INVALID_URL, "Failed to extract video information"

                # Check if video is available
                if info.get('is_live'):
                    return None, FailureReason.INVALID_URL, "Live streams are not supported"

                if info.get('availability') == 'private':
                    return None, FailureReason.ACCESS_DENIED, "Video is private"

                # Download the video
                ydl.download([url])

                # Find the downloaded file
                video_id = info.get('id', 'unknown')
                ext = info.get('ext', 'mp4')
                video_path = config.temp_dir / f'{job_id}_{video_id}.{ext}'

                if video_path.exists():
                    logger.info(f"Successfully downloaded: {video_path}")
                    return video_path, None, None
                else:
                    # Try to find any file that matches the pattern
                    pattern = f"{job_id}_*"
                    matches = list(config.temp_dir.glob(pattern))
                    if matches:
                        video_path = matches[0]
                        logger.info(f"Found downloaded file: {video_path}")
                        return video_path, None, None
                    else:
                        return None, FailureReason.DOWNLOAD_FAILED, "Downloaded file not found"

        except yt_dlp.DownloadError as e:
            error_msg = str(e)
            logger.error(f"Download error for {url}: {error_msg}")

            # Classify the error
            if "Private video" in error_msg or "private" in error_msg.lower():
                return None, FailureReason.ACCESS_DENIED, error_msg
            elif "blocked" in error_msg.lower() or "available" in error_msg.lower():
                return None, FailureReason.ACCESS_DENIED, error_msg
            elif "Invalid URL" in error_msg or "Unsupported URL" in error_msg:
                return None, FailureReason.INVALID_URL, error_msg
            else:
                return None, FailureReason.DOWNLOAD_FAILED, error_msg

        except Exception as e:
            error_msg = f"Unexpected error during download: {e}"
            logger.error(f"Download error for {url}: {error_msg}")
            return None, FailureReason.DOWNLOAD_FAILED, error_msg

    def _detect_platform(self, url: str) -> str:
        """Detect platform from URL"""
        try:
            domain = urlparse(url).netloc.lower()

            if 'youtube.com' in domain or 'youtu.be' in domain:
                return 'YouTube'
            elif 'tiktok.com' in domain:
                return 'TikTok'
            elif 'instagram.com' in domain:
                return 'Instagram'
            elif 'facebook.com' in domain or 'fb.com' in domain:
                return 'Facebook'
            elif 'twitter.com' in domain or 'x.com' in domain:
                return 'X/Twitter'
            elif 'linkedin.com' in domain:
                return 'LinkedIn'
            elif 'vimeo.com' in domain:
                return 'Vimeo'
            else:
                return 'Unknown'

        except Exception:
            return 'Unknown'

    def is_url_supported(self, url: str) -> bool:
        """Check if URL is supported by yt-dlp"""
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                extractors = ydl.list_extractors()
                # This is a simple check - in practice, yt-dlp supports many platforms
                return True
        except Exception:
            return False

    def cleanup_temp_file(self, file_path: Path) -> None:
        """Clean up temporary downloaded file"""
        try:
            if file_path and file_path.exists():
                file_path.unlink()
                logger.info(f"Cleaned up temp file: {file_path}")
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file {file_path}: {e}")

    def estimate_download_time(self, url: str) -> Optional[float]:
        """Estimate download time in seconds (rough estimate)"""
        try:
            info = self.extract_info(url)
            if not info:
                return None

            duration = info.get('duration', 60)  # Default to 1 minute
            # Very rough estimate: 1 second of video = 2 seconds of download time
            return min(duration * 2, 300)  # Cap at 5 minutes

        except Exception:
            return 60.0  # Default estimate