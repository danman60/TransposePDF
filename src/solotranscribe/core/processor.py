"""
Main transcription processor that orchestrates the complete pipeline
"""

import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from ..models import (
    TranscriptionJob, TranscriptionManifest, JobStatus, FailureReason,
    OutputFormats, ProcessingOptions
)
from ..config import config
from ..adapters.video_downloader import VideoDownloader
from ..adapters.freeconvert_api import FreeConvertAPI
from ..adapters.assemblyai_api import AssemblyAIAPI
from ..formatters.output_formatters import (
    TextFormatter, JSONFormatter, SRTFormatter, VTTFormatter, MetadataFormatter
)
from .manifest import ManifestManager


logger = logging.getLogger(__name__)


class TranscriptionProcessor:
    """Main processor for handling transcription jobs"""

    def __init__(self):
        self.downloader = VideoDownloader()
        self.converter = FreeConvertAPI()
        self.transcriber = AssemblyAIAPI()
        self.manifest_manager = ManifestManager()

        # Initialize formatters
        self.formatters = {
            OutputFormats.TXT: TextFormatter(),
            OutputFormats.JSON: JSONFormatter(),
            OutputFormats.SRT: SRTFormatter(),
            OutputFormats.VTT: VTTFormatter()
        }

    def process_batch(self, options: ProcessingOptions) -> TranscriptionManifest:
        """Process a batch of URLs"""
        logger.info(f"Starting batch processing: {options.input_file}")

        # Load URLs and create manifest
        urls = self.manifest_manager.load_urls_from_file(options.input_file)
        if not urls:
            raise ValueError("No valid URLs found in input file")

        manifest = self.manifest_manager.create_manifest(
            options.input_file,
            options.output_dir,
            [fmt.value for fmt in options.formats],
            options.budget_cap
        )

        # Populate jobs
        self.manifest_manager.populate_jobs(manifest, urls)

        # Create output directory
        options.output_dir.mkdir(parents=True, exist_ok=True)

        # Save initial manifest
        self.manifest_manager.save_manifest(manifest, options.output_dir)

        if options.dry_run:
            return self._perform_dry_run(manifest, options)

        # Process each job
        for job in manifest.jobs:
            if manifest.total_actual_cost >= options.budget_cap:
                logger.warning(f"Budget cap reached: ${manifest.total_actual_cost:.2f} >= ${options.budget_cap:.2f}")
                self._mark_remaining_jobs_skipped(manifest, job)
                break

            self._process_single_job(job, options, manifest)

        # Final manifest update
        manifest.update_stats()
        self.manifest_manager.save_manifest(manifest, options.output_dir)

        logger.info(f"Batch processing completed. Success: {manifest.completed_jobs}/{manifest.total_jobs}")
        return manifest

    def _process_single_job(self, job: TranscriptionJob, options: ProcessingOptions,
                           manifest: TranscriptionManifest) -> None:
        """Process a single transcription job"""
        logger.info(f"Processing job {job.id}: {job.url}")

        try:
            # Step 1: Get video metadata
            job.status = JobStatus.DOWNLOADING
            job.started_at = datetime.utcnow()

            metadata = self.downloader.get_video_metadata(job.url)
            if metadata:
                job.video_metadata = metadata
                # Estimate costs early
                duration = metadata.duration or 120  # Default 2 minutes if unknown
                job.estimated_cost = self._estimate_job_cost(duration)

            # Step 2: Download video
            video_path, failure_reason, error_msg = self.downloader.download_video(job.url, job.id)
            if not video_path:
                self._handle_job_failure(job, failure_reason, error_msg, options.output_dir)
                return

            job.temp_video_path = video_path

            # Step 3: Convert to MP3
            job.status = JobStatus.CONVERTING
            audio_path = options.output_dir / "temp" / f"{job.id}.mp3"
            audio_path.parent.mkdir(parents=True, exist_ok=True)

            success, failure_reason, error_msg = self.converter.convert_mp4_to_mp3(video_path, audio_path)
            if not success:
                self._handle_job_failure(job, failure_reason, error_msg, options.output_dir)
                self._cleanup_temp_files(job, options.delete_temp)
                return

            job.temp_audio_path = audio_path

            # Step 4: Transcribe audio
            job.status = JobStatus.TRANSCRIBING
            success, transcript_data, failure_reason, error_msg = self.transcriber.transcribe_audio(
                audio_path, options.enable_summary
            )

            if not success:
                self._handle_job_failure(job, failure_reason, error_msg, options.output_dir)
                self._cleanup_temp_files(job, options.delete_temp)
                return

            job.transcript_data = transcript_data
            job.transcript_text = transcript_data.get('text', '') if transcript_data else ''
            job.assemblyai_transcript_id = transcript_data.get('id') if transcript_data else None

            # Calculate actual cost
            if job.video_metadata and job.video_metadata.duration:
                job.actual_cost = self._calculate_actual_cost(job.video_metadata.duration)
            else:
                job.actual_cost = job.estimated_cost

            # Step 5: Format outputs
            job.status = JobStatus.FORMATTING
            success = self._format_job_outputs(job, options)
            if not success:
                self._handle_job_failure(job, FailureReason.FORMAT_FAILED, "Failed to format outputs", options.output_dir)
                self._cleanup_temp_files(job, options.delete_temp)
                return

            # Job completed successfully
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            logger.info(f"Job {job.id} completed successfully")

            # Cleanup temp files if requested
            if options.delete_temp:
                self._cleanup_temp_files(job, True)

            # Update manifest
            manifest.update_stats()
            self.manifest_manager.save_manifest(manifest, options.output_dir)

        except Exception as e:
            logger.error(f"Unexpected error processing job {job.id}: {e}")
            self._handle_job_failure(job, FailureReason.UNKNOWN_ERROR, str(e), options.output_dir)
            self._cleanup_temp_files(job, options.delete_temp)

    def _format_job_outputs(self, job: TranscriptionJob, options: ProcessingOptions) -> bool:
        """Format job outputs in requested formats"""
        try:
            success = True

            # Create metadata file
            MetadataFormatter.create_meta_file(job, options.output_dir)

            # Format in requested formats
            for format_type in options.formats:
                formatter = self.formatters.get(format_type)
                if formatter:
                    if not formatter.format_transcript(job, options.output_dir):
                        logger.error(f"Failed to format {format_type.value} for job {job.id}")
                        success = False
                else:
                    logger.warning(f"No formatter available for {format_type.value}")
                    success = False

            return success

        except Exception as e:
            logger.error(f"Error formatting outputs for job {job.id}: {e}")
            return False

    def _handle_job_failure(self, job: TranscriptionJob, failure_reason: FailureReason,
                           error_msg: str, output_dir: Path) -> None:
        """Handle job failure"""
        job.status = JobStatus.FAILED
        job.failure_reason = failure_reason
        job.error_message = error_msg
        job.completed_at = datetime.utcnow()

        logger.error(f"Job {job.id} failed: {failure_reason.value} - {error_msg}")

        # Create metadata file even for failed jobs
        try:
            MetadataFormatter.create_meta_file(job, output_dir)
        except Exception as e:
            logger.warning(f"Failed to create meta file for failed job {job.id}: {e}")

    def _cleanup_temp_files(self, job: TranscriptionJob, delete_temp: bool) -> None:
        """Clean up temporary files"""
        if not delete_temp:
            return

        try:
            if job.temp_video_path and job.temp_video_path.exists():
                job.temp_video_path.unlink()
                logger.debug(f"Cleaned up video file: {job.temp_video_path}")

            if job.temp_audio_path and job.temp_audio_path.exists():
                job.temp_audio_path.unlink()
                logger.debug(f"Cleaned up audio file: {job.temp_audio_path}")

        except Exception as e:
            logger.warning(f"Failed to cleanup temp files for job {job.id}: {e}")

    def _mark_remaining_jobs_skipped(self, manifest: TranscriptionManifest, current_job: TranscriptionJob) -> None:
        """Mark remaining jobs as skipped due to budget"""
        current_index = manifest.jobs.index(current_job)
        for job in manifest.jobs[current_index:]:
            if job.status == JobStatus.PENDING:
                job.status = JobStatus.SKIPPED
                job.failure_reason = FailureReason.BUDGET_EXCEEDED
                job.error_message = "Skipped due to budget cap"

    def retry_failed_jobs(self, manifest: TranscriptionManifest, budget_cap: Optional[float] = None) -> TranscriptionManifest:
        """Retry failed jobs from a manifest"""
        retryable_jobs = manifest.get_retryable_jobs()

        if not retryable_jobs:
            logger.info("No jobs to retry")
            return manifest

        budget = budget_cap or config.cap_budget_usd
        logger.info(f"Retrying {len(retryable_jobs)} failed jobs with budget ${budget:.2f}")

        # Create processing options from manifest
        output_dir = Path(manifest.output_dir)
        options = ProcessingOptions(
            input_file=Path(manifest.input_file),
            output_dir=output_dir,
            formats=[OutputFormats(fmt) for fmt in manifest.output_formats],
            budget_cap=budget
        )

        # Process retryable jobs
        for job in retryable_jobs:
            if manifest.total_actual_cost >= budget:
                logger.warning(f"Budget exhausted during retry: ${manifest.total_actual_cost:.2f}")
                break

            job.retry_count += 1
            job.status = JobStatus.PENDING
            job.error_message = None
            job.failure_reason = None

            logger.info(f"Retrying job {job.id} (attempt {job.retry_count})")
            self._process_single_job(job, options, manifest)

        # Update manifest
        manifest.update_stats()
        self.manifest_manager.save_manifest(manifest, output_dir)

        return manifest

    def estimate_batch(self, options: ProcessingOptions) -> Dict:
        """Estimate cost and time for a batch"""
        urls = self.manifest_manager.load_urls_from_file(options.input_file)

        if not urls:
            return {
                'total_urls': 0,
                'estimated_cost': 0.0,
                'estimated_duration': 0.0
            }

        total_cost = 0.0
        total_duration = 0.0

        # Sample a few URLs for better estimates
        sample_urls = urls[:min(5, len(urls))]

        for url in sample_urls:
            try:
                metadata = self.downloader.get_video_metadata(url)
                if metadata and metadata.duration:
                    duration = metadata.duration
                else:
                    duration = 120  # Default 2 minutes

                cost = self._estimate_job_cost(duration)
                time_est = self._estimate_job_time(duration)

                total_cost += cost
                total_duration += time_est

            except Exception as e:
                logger.warning(f"Failed to estimate for {url}: {e}")
                # Use defaults
                total_cost += self._estimate_job_cost(120)
                total_duration += self._estimate_job_time(120)

        # Scale up for all URLs
        avg_cost = total_cost / len(sample_urls) if sample_urls else 0
        avg_duration = total_duration / len(sample_urls) if sample_urls else 0

        return {
            'total_urls': len(urls),
            'estimated_cost': avg_cost * len(urls),
            'estimated_duration': avg_duration * len(urls) / 60,  # Convert to minutes
            'sample_size': len(sample_urls)
        }

    def estimate_retry(self, jobs: List[TranscriptionJob]) -> Dict:
        """Estimate cost and time for retry"""
        total_cost = 0.0
        total_duration = 0.0

        for job in jobs:
            if job.video_metadata and job.video_metadata.duration:
                duration = job.video_metadata.duration
            else:
                duration = 120

            total_cost += self._estimate_job_cost(duration)
            total_duration += self._estimate_job_time(duration)

        return {
            'total_jobs': len(jobs),
            'estimated_cost': total_cost,
            'estimated_duration': total_duration / 60  # Minutes
        }

    def _perform_dry_run(self, manifest: TranscriptionManifest, options: ProcessingOptions) -> TranscriptionManifest:
        """Perform dry run estimation"""
        logger.info("Performing dry run analysis")

        for job in manifest.jobs:
            try:
                # Get metadata for better estimates
                metadata = self.downloader.get_video_metadata(job.url)
                if metadata:
                    job.video_metadata = metadata
                    duration = metadata.duration or 120
                else:
                    duration = 120  # Default estimate

                job.estimated_cost = self._estimate_job_cost(duration)
                job.status = JobStatus.PENDING  # Keep as pending for dry run

            except Exception as e:
                logger.warning(f"Failed to get metadata for {job.url}: {e}")
                job.estimated_cost = self._estimate_job_cost(120)

        manifest.update_stats()
        return manifest

    def _estimate_job_cost(self, duration_seconds: float) -> float:
        """Estimate cost for a single job"""
        # AssemblyAI cost
        transcription_cost = self.transcriber.estimate_transcription_cost(duration_seconds)

        # FreeConvert cost (rough estimate)
        conversion_cost = self.converter.estimate_conversion_cost(duration_seconds)

        return transcription_cost + conversion_cost

    def _calculate_actual_cost(self, duration_seconds: float) -> float:
        """Calculate actual cost (similar to estimate for now)"""
        return self._estimate_job_cost(duration_seconds)

    def _estimate_job_time(self, duration_seconds: float) -> float:
        """Estimate processing time for a single job (in seconds)"""
        # Download time estimate
        download_time = self.downloader.estimate_download_time("") or 60

        # Conversion time estimate
        file_size_mb = duration_seconds * 0.5  # Rough estimate: 0.5MB per second
        conversion_time = self.converter.estimate_conversion_time(file_size_mb)

        # Transcription time estimate
        transcription_time = self.transcriber.estimate_transcription_time(duration_seconds)

        # Add some buffer time
        buffer_time = 30

        return download_time + conversion_time + transcription_time + buffer_time