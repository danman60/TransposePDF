"""
FreeConvert API integration for MP4 to MP3 conversion
"""

import time
import logging
import requests
from pathlib import Path
from typing import Optional, Dict, Any

from ..models import FailureReason
from ..config import config


logger = logging.getLogger(__name__)


class FreeConvertAPI:
    """FreeConvert API client for MP4 to MP3 conversion"""

    BASE_URL = "https://api.freeconvert.com/v1"

    def __init__(self):
        self.api_key = config.freeconvert_api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

    def upload_file(self, file_path: Path) -> Optional[str]:
        """Upload file to FreeConvert and return file ID"""
        try:
            # Get upload URL
            upload_response = requests.post(
                f"{self.BASE_URL}/process/import/upload",
                headers=self.headers,
                timeout=30
            )
            upload_response.raise_for_status()
            upload_data = upload_response.json()

            upload_url = upload_data.get('url')
            file_id = upload_data.get('id')

            if not upload_url or not file_id:
                logger.error("Failed to get upload URL from FreeConvert")
                return None

            # Upload the file
            with open(file_path, 'rb') as f:
                upload_file_response = requests.post(
                    upload_url,
                    files={'file': f},
                    timeout=300  # 5 minutes timeout for upload
                )
                upload_file_response.raise_for_status()

            logger.info(f"Successfully uploaded file: {file_id}")
            return file_id

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to upload file to FreeConvert: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error uploading file: {e}")
            return None

    def create_conversion_job(self, input_file_id: str, output_format: str = "mp3") -> Optional[str]:
        """Create conversion job and return job ID"""
        try:
            job_data = {
                "input": input_file_id,
                "inputformat": "mp4",
                "outputformat": output_format,
                "options": {
                    "audio_codec": "mp3",
                    "audio_bitrate": "128",
                    "audio_frequency": "44100"
                }
            }

            response = requests.post(
                f"{self.BASE_URL}/process/convert",
                headers=self.headers,
                json=job_data,
                timeout=30
            )
            response.raise_for_status()

            job_info = response.json()
            job_id = job_info.get('id')

            if not job_id:
                logger.error("Failed to get job ID from FreeConvert")
                return None

            logger.info(f"Created conversion job: {job_id}")
            return job_id

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create conversion job: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating conversion job: {e}")
            return None

    def wait_for_conversion(self, job_id: str, max_wait_time: int = 600) -> tuple[bool, Optional[str]]:
        """
        Wait for conversion to complete

        Returns:
            tuple: (success, download_url)
        """
        start_time = time.time()

        while time.time() - start_time < max_wait_time:
            try:
                response = requests.get(
                    f"{self.BASE_URL}/process/{job_id}",
                    headers=self.headers,
                    timeout=30
                )
                response.raise_for_status()

                job_info = response.json()
                status = job_info.get('status')

                if status == 'completed':
                    download_url = job_info.get('output', {}).get('url')
                    if download_url:
                        logger.info(f"Conversion completed: {job_id}")
                        return True, download_url
                    else:
                        logger.error(f"Conversion completed but no download URL: {job_id}")
                        return False, None

                elif status == 'failed':
                    error_msg = job_info.get('message', 'Unknown error')
                    logger.error(f"Conversion failed: {job_id} - {error_msg}")
                    return False, None

                elif status in ['queued', 'processing']:
                    logger.debug(f"Conversion in progress: {job_id} - {status}")
                    time.sleep(10)  # Wait 10 seconds before checking again

                else:
                    logger.warning(f"Unknown conversion status: {status}")
                    time.sleep(10)

            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to check conversion status: {e}")
                time.sleep(15)
            except Exception as e:
                logger.error(f"Unexpected error checking conversion: {e}")
                time.sleep(15)

        logger.error(f"Conversion timed out after {max_wait_time} seconds: {job_id}")
        return False, None

    def download_converted_file(self, download_url: str, output_path: Path) -> bool:
        """Download converted file from FreeConvert"""
        try:
            response = requests.get(download_url, timeout=300)  # 5 minutes timeout
            response.raise_for_status()

            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            with open(output_path, 'wb') as f:
                f.write(response.content)

            logger.info(f"Downloaded converted file: {output_path}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to download converted file: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error downloading file: {e}")
            return False

    def convert_mp4_to_mp3(self, input_path: Path, output_path: Path) -> tuple[bool, Optional[FailureReason], Optional[str]]:
        """
        Convert MP4 to MP3 using FreeConvert API

        Returns:
            tuple: (success, failure_reason, error_message)
        """
        job_id = None

        try:
            logger.info(f"Starting MP4 to MP3 conversion: {input_path.name}")

            # Step 1: Upload file
            file_id = self.upload_file(input_path)
            if not file_id:
                return False, FailureReason.CONVERT_FAILED, "Failed to upload file to FreeConvert"

            # Step 2: Create conversion job
            job_id = self.create_conversion_job(file_id)
            if not job_id:
                return False, FailureReason.CONVERT_FAILED, "Failed to create conversion job"

            # Step 3: Wait for conversion
            success, download_url = self.wait_for_conversion(job_id)
            if not success:
                return False, FailureReason.CONVERT_FAILED, f"Conversion failed (job: {job_id})"

            # Step 4: Download converted file
            if not self.download_converted_file(download_url, output_path):
                return False, FailureReason.CONVERT_FAILED, "Failed to download converted file"

            logger.info(f"Successfully converted to MP3: {output_path}")
            return True, None, None

        except Exception as e:
            error_msg = f"Unexpected error during conversion: {e}"
            if job_id:
                error_msg += f" (job: {job_id})"
            logger.error(error_msg)
            return False, FailureReason.CONVERT_FAILED, error_msg

    def estimate_conversion_cost(self, duration_seconds: float) -> float:
        """Estimate conversion cost based on duration"""
        # FreeConvert pricing is typically based on file size and processing time
        # This is a rough estimate - actual costs may vary
        base_cost = 0.01  # Base cost per conversion
        duration_cost = duration_seconds * 0.001  # $0.001 per second
        return base_cost + duration_cost

    def estimate_conversion_time(self, file_size_mb: float) -> float:
        """Estimate conversion time based on file size"""
        # Rough estimate: ~30 seconds + 1 second per MB
        return 30 + file_size_mb

    def check_api_status(self) -> bool:
        """Check if FreeConvert API is accessible"""
        try:
            response = requests.get(
                f"{self.BASE_URL}/process",
                headers=self.headers,
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False