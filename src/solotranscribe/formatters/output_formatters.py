"""
Output formatters for different transcript formats
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..models import TranscriptionJob, VideoMetadata


logger = logging.getLogger(__name__)


class OutputFormatter:
    """Base class for output formatters"""

    def format_transcript(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Format and save transcript. Should be implemented by subclasses."""
        raise NotImplementedError


class TextFormatter(OutputFormatter):
    """Plain text formatter"""

    def format_transcript(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Save transcript as plain text"""
        try:
            if not job.transcript_text:
                logger.error(f"No transcript text available for job {job.id}")
                return False

            # Create job-specific directory
            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            # Save transcript text
            txt_file = job_dir / "transcript.txt"
            with open(txt_file, 'w', encoding='utf-8') as f:
                # Add header with metadata
                f.write(f"Transcript for: {job.url}\n")
                if job.video_metadata and job.video_metadata.title:
                    f.write(f"Title: {job.video_metadata.title}\n")
                if job.video_metadata and job.video_metadata.platform:
                    f.write(f"Platform: {job.video_metadata.platform}\n")
                if job.video_metadata and job.video_metadata.duration:
                    f.write(f"Duration: {job.video_metadata.duration:.1f} seconds\n")
                f.write(f"Generated: {datetime.utcnow().isoformat()}\n")
                f.write("\n" + "=" * 50 + "\n\n")

                # Add transcript text
                f.write(job.transcript_text)

            logger.info(f"Saved text transcript: {txt_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to save text transcript for job {job.id}: {e}")
            return False


class JSONFormatter(OutputFormatter):
    """JSON formatter with full metadata and timestamps"""

    def format_transcript(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Save transcript as structured JSON"""
        try:
            if not job.transcript_data and not job.transcript_text:
                logger.error(f"No transcript data available for job {job.id}")
                return False

            # Create job-specific directory
            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            # Prepare JSON data
            json_data = {
                "job_id": job.id,
                "url": job.url,
                "status": job.status.value,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "metadata": {
                    "title": job.video_metadata.title if job.video_metadata else None,
                    "platform": job.video_metadata.platform if job.video_metadata else None,
                    "duration": job.video_metadata.duration if job.video_metadata else None,
                    "upload_date": job.video_metadata.upload_date if job.video_metadata else None,
                    "uploader": job.video_metadata.uploader if job.video_metadata else None,
                    "view_count": job.video_metadata.view_count if job.video_metadata else None
                },
                "transcript": {
                    "text": job.transcript_text,
                    "confidence": None,
                    "audio_duration": None,
                    "words": []
                },
                "processing_info": {
                    "assemblyai_transcript_id": job.assemblyai_transcript_id,
                    "freeconvert_job_id": job.freeconvert_job_id,
                    "estimated_cost": job.estimated_cost,
                    "actual_cost": job.actual_cost
                },
                "generated_at": datetime.utcnow().isoformat()
            }

            # Add detailed transcript data if available
            if job.transcript_data:
                json_data["transcript"].update({
                    "confidence": job.transcript_data.get('confidence'),
                    "audio_duration": job.transcript_data.get('audio_duration'),
                    "words": job.transcript_data.get('words', [])
                })

                # Add summary if available
                if 'summary' in job.transcript_data:
                    json_data["transcript"]["summary"] = job.transcript_data['summary']

            # Save JSON file
            json_file = job_dir / "transcript.json"
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)

            logger.info(f"Saved JSON transcript: {json_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to save JSON transcript for job {job.id}: {e}")
            return False


class SRTFormatter(OutputFormatter):
    """SubRip (SRT) subtitle formatter"""

    def format_transcript(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Save transcript as SRT subtitles"""
        try:
            if not job.transcript_data or not job.transcript_data.get('words'):
                logger.warning(f"No word-level timestamps available for SRT format (job {job.id})")
                # Fallback: create single subtitle with full text
                return self._create_fallback_srt(job, output_dir)

            # Create job-specific directory
            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            # Group words into subtitle segments (approximately 5-8 seconds each)
            segments = self._group_words_into_segments(job.transcript_data['words'])

            # Write SRT file
            srt_file = job_dir / "captions.srt"
            with open(srt_file, 'w', encoding='utf-8') as f:
                for i, segment in enumerate(segments, 1):
                    start_time = self._format_srt_time(segment['start'])
                    end_time = self._format_srt_time(segment['end'])

                    f.write(f"{i}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{segment['text']}\n\n")

            logger.info(f"Saved SRT captions: {srt_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to save SRT captions for job {job.id}: {e}")
            return False

    def _create_fallback_srt(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Create basic SRT with single subtitle when timestamps unavailable"""
        try:
            if not job.transcript_text:
                return False

            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            # Estimate duration or use default
            duration = 60  # Default 1 minute
            if job.video_metadata and job.video_metadata.duration:
                duration = int(job.video_metadata.duration)

            srt_file = job_dir / "captions.srt"
            with open(srt_file, 'w', encoding='utf-8') as f:
                f.write("1\n")
                f.write("00:00:00,000 --> ")
                f.write(self._format_srt_time(duration))
                f.write("\n")
                f.write(job.transcript_text[:100] + "..." if len(job.transcript_text) > 100 else job.transcript_text)
                f.write("\n\n")

            return True
        except Exception:
            return False

    def _group_words_into_segments(self, words: List[Dict], max_duration: float = 8.0, max_words: int = 10) -> List[Dict]:
        """Group words into subtitle segments"""
        segments = []
        current_segment = []
        current_start = None

        for word in words:
            if not word.get('start') or not word.get('end'):
                continue

            # Start new segment
            if not current_segment:
                current_start = word['start']
                current_segment = [word]
                continue

            # Check if we should break into new segment
            duration = word['end'] - current_start
            if duration > max_duration or len(current_segment) >= max_words:
                # Finish current segment
                if current_segment:
                    segments.append({
                        'start': current_start,
                        'end': current_segment[-1]['end'],
                        'text': ' '.join(w['text'] for w in current_segment)
                    })

                # Start new segment
                current_start = word['start']
                current_segment = [word]
            else:
                current_segment.append(word)

        # Add final segment
        if current_segment:
            segments.append({
                'start': current_start,
                'end': current_segment[-1]['end'],
                'text': ' '.join(w['text'] for w in current_segment)
            })

        return segments

    def _format_srt_time(self, seconds: float) -> str:
        """Format time in SRT format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


class VTTFormatter(OutputFormatter):
    """WebVTT formatter"""

    def format_transcript(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Save transcript as WebVTT"""
        try:
            if not job.transcript_data or not job.transcript_data.get('words'):
                logger.warning(f"No word-level timestamps available for VTT format (job {job.id})")
                return self._create_fallback_vtt(job, output_dir)

            # Create job-specific directory
            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            # Group words into segments
            segments = self._group_words_into_segments(job.transcript_data['words'])

            # Write VTT file
            vtt_file = job_dir / "captions.vtt"
            with open(vtt_file, 'w', encoding='utf-8') as f:
                f.write("WEBVTT\n\n")

                for segment in segments:
                    start_time = self._format_vtt_time(segment['start'])
                    end_time = self._format_vtt_time(segment['end'])

                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{segment['text']}\n\n")

            logger.info(f"Saved VTT captions: {vtt_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to save VTT captions for job {job.id}: {e}")
            return False

    def _create_fallback_vtt(self, job: TranscriptionJob, output_dir: Path) -> bool:
        """Create basic VTT when timestamps unavailable"""
        try:
            if not job.transcript_text:
                return False

            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            duration = 60
            if job.video_metadata and job.video_metadata.duration:
                duration = int(job.video_metadata.duration)

            vtt_file = job_dir / "captions.vtt"
            with open(vtt_file, 'w', encoding='utf-8') as f:
                f.write("WEBVTT\n\n")
                f.write("00:00:00.000 --> ")
                f.write(self._format_vtt_time(duration))
                f.write("\n")
                f.write(job.transcript_text[:100] + "..." if len(job.transcript_text) > 100 else job.transcript_text)
                f.write("\n\n")

            return True
        except Exception:
            return False

    def _group_words_into_segments(self, words: List[Dict], max_duration: float = 8.0) -> List[Dict]:
        """Group words into VTT segments (similar to SRT but different timing)"""
        segments = []
        current_segment = []
        current_start = None

        for word in words:
            if not word.get('start') or not word.get('end'):
                continue

            if not current_segment:
                current_start = word['start']
                current_segment = [word]
                continue

            duration = word['end'] - current_start
            if duration > max_duration:
                if current_segment:
                    segments.append({
                        'start': current_start,
                        'end': current_segment[-1]['end'],
                        'text': ' '.join(w['text'] for w in current_segment)
                    })

                current_start = word['start']
                current_segment = [word]
            else:
                current_segment.append(word)

        if current_segment:
            segments.append({
                'start': current_start,
                'end': current_segment[-1]['end'],
                'text': ' '.join(w['text'] for w in current_segment)
            })

        return segments

    def _format_vtt_time(self, seconds: float) -> str:
        """Format time in VTT format (HH:MM:SS.mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


class MetadataFormatter:
    """Formatter for job metadata"""

    @staticmethod
    def create_meta_file(job: TranscriptionJob, output_dir: Path) -> bool:
        """Create metadata JSON file for the job"""
        try:
            job_dir = output_dir / job.id
            job_dir.mkdir(parents=True, exist_ok=True)

            meta_data = {
                "job_id": job.id,
                "url": job.url,
                "status": job.status.value,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
                "video_metadata": {
                    "title": job.video_metadata.title if job.video_metadata else None,
                    "platform": job.video_metadata.platform if job.video_metadata else None,
                    "duration": job.video_metadata.duration if job.video_metadata else None,
                    "upload_date": job.video_metadata.upload_date if job.video_metadata else None,
                    "uploader": job.video_metadata.uploader if job.video_metadata else None,
                    "description": job.video_metadata.description if job.video_metadata else None,
                    "view_count": job.video_metadata.view_count if job.video_metadata else None
                },
                "processing": {
                    "freeconvert_job_id": job.freeconvert_job_id,
                    "assemblyai_transcript_id": job.assemblyai_transcript_id,
                    "retry_count": job.retry_count,
                    "estimated_cost": job.estimated_cost,
                    "actual_cost": job.actual_cost
                },
                "error_info": {
                    "failure_reason": job.failure_reason.value if job.failure_reason else None,
                    "error_message": job.error_message
                } if job.failure_reason else None
            }

            meta_file = job_dir / "meta.json"
            with open(meta_file, 'w', encoding='utf-8') as f:
                json.dump(meta_data, f, indent=2, ensure_ascii=False)

            return True

        except Exception as e:
            logger.error(f"Failed to create meta file for job {job.id}: {e}")
            return False