"""
AssemblyAI integration for audio transcription
"""

import time
import logging
import assemblyai as aai
from pathlib import Path
from typing import Optional, Dict, Any

from ..models import FailureReason
from ..config import config


logger = logging.getLogger(__name__)


class AssemblyAIAPI:
    """AssemblyAI client for audio transcription"""

    def __init__(self):
        # Set API key
        aai.settings.api_key = config.assemblyai_api_key
        self.client = aai.Transcriber()

    def upload_audio_file(self, audio_path: Path) -> Optional[str]:
        """Upload audio file to AssemblyAI and return upload URL"""
        try:
            logger.info(f"Uploading audio file: {audio_path}")
            upload_url = aai.upload_file(str(audio_path))
            logger.info(f"Audio uploaded successfully: {upload_url}")
            return upload_url

        except Exception as e:
            logger.error(f"Failed to upload audio file: {e}")
            return None

    def create_transcription_job(self, audio_url: str, enable_summary: bool = False) -> Optional[str]:
        """Create transcription job and return transcript ID"""
        try:
            # Configure transcription options
            config_options = aai.TranscriptionConfig(
                audio_url=audio_url,
                punctuation_and_casing=True,
                format_text=True,
                dual_channel=False,
                speaker_labels=False,  # Could be enabled if needed
                auto_chapters=False,
                entity_detection=False,
                sentiment_analysis=False,
                auto_highlights=False,
                summarization=enable_summary,
                summary_model=aai.SummarizationModel.informative if enable_summary else None,
                summary_type=aai.SummarizationType.bullets if enable_summary else None
            )

            # Submit transcription
            logger.info(f"Submitting transcription job for: {audio_url}")
            transcript = self.client.submit(config_options)

            if transcript and transcript.id:
                logger.info(f"Transcription job created: {transcript.id}")
                return transcript.id
            else:
                logger.error("Failed to create transcription job - no ID returned")
                return None

        except Exception as e:
            logger.error(f"Failed to create transcription job: {e}")
            return None

    def wait_for_transcription(self, transcript_id: str, max_wait_time: int = 1800) -> tuple[bool, Optional[Dict[str, Any]]]:
        """
        Wait for transcription to complete

        Returns:
            tuple: (success, transcript_data)
        """
        start_time = time.time()

        while time.time() - start_time < max_wait_time:
            try:
                # Get transcript status
                transcript = self.client.get_transcript(transcript_id)

                if transcript.status == aai.TranscriptStatus.completed:
                    logger.info(f"Transcription completed: {transcript_id}")

                    # Convert to dictionary for easier handling
                    transcript_data = {
                        'id': transcript.id,
                        'text': transcript.text,
                        'status': transcript.status.value,
                        'audio_url': transcript.audio_url,
                        'confidence': getattr(transcript, 'confidence', None),
                        'audio_duration': getattr(transcript, 'audio_duration', None),
                        'punctuation_and_casing': True,
                        'words': []
                    }

                    # Add word-level timestamps if available
                    if hasattr(transcript, 'words') and transcript.words:
                        transcript_data['words'] = [
                            {
                                'text': word.text,
                                'start': word.start,
                                'end': word.end,
                                'confidence': word.confidence
                            }
                            for word in transcript.words
                        ]

                    # Add summary if available
                    if hasattr(transcript, 'summary') and transcript.summary:
                        transcript_data['summary'] = transcript.summary

                    return True, transcript_data

                elif transcript.status == aai.TranscriptStatus.error:
                    error_msg = getattr(transcript, 'error', 'Unknown transcription error')
                    logger.error(f"Transcription failed: {transcript_id} - {error_msg}")
                    return False, None

                elif transcript.status in [aai.TranscriptStatus.queued, aai.TranscriptStatus.processing]:
                    logger.debug(f"Transcription in progress: {transcript_id} - {transcript.status.value}")
                    time.sleep(15)  # Wait 15 seconds before checking again

                else:
                    logger.warning(f"Unknown transcription status: {transcript.status.value}")
                    time.sleep(15)

            except Exception as e:
                logger.error(f"Error checking transcription status: {e}")
                time.sleep(20)

        logger.error(f"Transcription timed out after {max_wait_time} seconds: {transcript_id}")
        return False, None

    def transcribe_audio(self, audio_path: Path, enable_summary: bool = False) -> tuple[bool, Optional[Dict[str, Any]], Optional[FailureReason], Optional[str]]:
        """
        Transcribe audio file

        Returns:
            tuple: (success, transcript_data, failure_reason, error_message)
        """
        transcript_id = None

        try:
            logger.info(f"Starting transcription: {audio_path.name}")

            # Step 1: Upload audio file
            audio_url = self.upload_audio_file(audio_path)
            if not audio_url:
                return False, None, FailureReason.TRANSCRIPTION_FAILED, "Failed to upload audio file"

            # Step 2: Create transcription job
            transcript_id = self.create_transcription_job(audio_url, enable_summary)
            if not transcript_id:
                return False, None, FailureReason.TRANSCRIPTION_FAILED, "Failed to create transcription job"

            # Step 3: Wait for transcription
            success, transcript_data = self.wait_for_transcription(transcript_id)
            if not success:
                return False, None, FailureReason.TRANSCRIPTION_FAILED, f"Transcription failed (ID: {transcript_id})"

            logger.info(f"Successfully transcribed audio: {audio_path.name}")
            return True, transcript_data, None, None

        except Exception as e:
            error_msg = f"Unexpected error during transcription: {e}"
            if transcript_id:
                error_msg += f" (ID: {transcript_id})"
            logger.error(error_msg)
            return False, None, FailureReason.TRANSCRIPTION_FAILED, error_msg

    def estimate_transcription_cost(self, duration_seconds: float) -> float:
        """Estimate transcription cost based on audio duration"""
        # AssemblyAI pricing is typically $0.00037 per second (as of 2024)
        cost_per_second = 0.00037
        return duration_seconds * cost_per_second

    def estimate_transcription_time(self, duration_seconds: float) -> float:
        """Estimate transcription time based on audio duration"""
        # AssemblyAI typically processes at 2-5x real-time speed
        # We'll use 3x as average, plus some buffer time
        processing_speed_multiplier = 0.33  # 1/3 of real-time
        buffer_time = 30  # 30 seconds buffer
        return (duration_seconds * processing_speed_multiplier) + buffer_time

    def check_api_status(self) -> bool:
        """Check if AssemblyAI API is accessible"""
        try:
            # Try to get account info as a simple test
            import requests
            response = requests.get(
                "https://api.assemblyai.com/v2/account",
                headers={"authorization": config.assemblyai_api_key},
                timeout=10
            )
            return response.status_code == 200
        except Exception:
            return False

    def get_transcript_by_id(self, transcript_id: str) -> Optional[Dict[str, Any]]:
        """Get transcript data by ID"""
        try:
            transcript = self.client.get_transcript(transcript_id)
            if transcript and transcript.status == aai.TranscriptStatus.completed:
                return {
                    'id': transcript.id,
                    'text': transcript.text,
                    'status': transcript.status.value,
                    'confidence': getattr(transcript, 'confidence', None),
                    'audio_duration': getattr(transcript, 'audio_duration', None),
                    'words': [
                        {
                            'text': word.text,
                            'start': word.start,
                            'end': word.end,
                            'confidence': word.confidence
                        }
                        for word in (transcript.words or [])
                    ] if hasattr(transcript, 'words') else []
                }
            return None
        except Exception as e:
            logger.error(f"Failed to get transcript {transcript_id}: {e}")
            return None