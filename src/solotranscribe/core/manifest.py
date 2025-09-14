"""
Manifest management for batch processing
"""

import json
import csv
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from ..models import TranscriptionManifest, TranscriptionJob, JobStatus
from ..config import config


logger = logging.getLogger(__name__)


class ManifestManager:
    """Manages manifests for batch transcription jobs"""

    def __init__(self):
        pass

    def create_manifest(self, input_file: Path, output_dir: Path, output_formats: List[str],
                       budget_cap: float = None) -> TranscriptionManifest:
        """Create a new manifest for batch processing"""

        # Generate unique batch ID
        batch_id = f"batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

        manifest = TranscriptionManifest(
            id=batch_id,
            input_file=str(input_file),
            output_dir=str(output_dir),
            output_formats=output_formats,
            budget_cap=budget_cap or config.cap_budget_usd
        )

        logger.info(f"Created manifest {batch_id}")
        return manifest

    def load_urls_from_file(self, file_path: Path) -> List[str]:
        """Load URLs from input file (txt or csv)"""
        urls = []

        try:
            if file_path.suffix.lower() == '.csv':
                urls = self._load_urls_from_csv(file_path)
            else:
                urls = self._load_urls_from_txt(file_path)

            logger.info(f"Loaded {len(urls)} URLs from {file_path}")
            return urls

        except Exception as e:
            logger.error(f"Failed to load URLs from {file_path}: {e}")
            return []

    def _load_urls_from_txt(self, file_path: Path) -> List[str]:
        """Load URLs from plain text file"""
        urls = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if line and not line.startswith('#'):  # Skip empty lines and comments
                    if line.startswith('http'):
                        urls.append(line)
                    else:
                        logger.warning(f"Line {line_num}: Invalid URL format: {line}")
        return urls

    def _load_urls_from_csv(self, file_path: Path) -> List[str]:
        """Load URLs from CSV file (must have 'url' column)"""
        urls = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if 'url' not in reader.fieldnames:
                raise ValueError("CSV file must contain 'url' column")

            for row_num, row in enumerate(reader, 2):  # Start from 2 (after header)
                url = row.get('url', '').strip()
                if url and url.startswith('http'):
                    urls.append(url)
                elif url:
                    logger.warning(f"Row {row_num}: Invalid URL format: {url}")

        return urls

    def populate_jobs(self, manifest: TranscriptionManifest, urls: List[str]) -> None:
        """Populate manifest with transcription jobs"""
        for i, url in enumerate(urls, 1):
            job_id = f"{manifest.id}_job_{i:03d}"

            job = TranscriptionJob(
                id=job_id,
                url=url,
                status=JobStatus.PENDING
            )

            manifest.jobs.append(job)

        manifest.update_stats()
        logger.info(f"Populated manifest with {len(urls)} jobs")

    def save_manifest(self, manifest: TranscriptionManifest, output_dir: Path) -> Path:
        """Save manifest to JSON file"""
        try:
            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)

            # Save as JSON
            manifest_file = output_dir / "manifest.json"
            with open(manifest_file, 'w', encoding='utf-8') as f:
                json.dump(manifest.dict(), f, indent=2, ensure_ascii=False, default=str)

            # Also save as CSV for easier viewing
            csv_file = output_dir / "manifest.csv"
            self._save_manifest_csv(manifest, csv_file)

            logger.info(f"Saved manifest: {manifest_file}")
            return manifest_file

        except Exception as e:
            logger.error(f"Failed to save manifest: {e}")
            raise

    def _save_manifest_csv(self, manifest: TranscriptionManifest, csv_file: Path) -> None:
        """Save manifest summary as CSV"""
        try:
            with open(csv_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)

                # Header
                writer.writerow([
                    'job_id', 'url', 'status', 'title', 'platform', 'duration',
                    'estimated_cost', 'actual_cost', 'error_reason', 'created_at', 'completed_at'
                ])

                # Jobs
                for job in manifest.jobs:
                    writer.writerow([
                        job.id,
                        job.url,
                        job.status.value,
                        job.video_metadata.title if job.video_metadata else '',
                        job.video_metadata.platform if job.video_metadata else '',
                        job.video_metadata.duration if job.video_metadata else '',
                        job.estimated_cost or '',
                        job.actual_cost or '',
                        job.failure_reason.value if job.failure_reason else '',
                        job.created_at.isoformat() if job.created_at else '',
                        job.completed_at.isoformat() if job.completed_at else ''
                    ])

        except Exception as e:
            logger.warning(f"Failed to save CSV manifest: {e}")

    def load_manifest(self, manifest_file: Path) -> TranscriptionManifest:
        """Load manifest from JSON file"""
        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Convert back to Pydantic model
            manifest = TranscriptionManifest(**data)
            manifest.update_stats()

            logger.info(f"Loaded manifest {manifest.id} with {len(manifest.jobs)} jobs")
            return manifest

        except Exception as e:
            logger.error(f"Failed to load manifest from {manifest_file}: {e}")
            raise

    def update_manifest(self, manifest: TranscriptionManifest, output_dir: Path) -> None:
        """Update and save manifest"""
        try:
            manifest.update_stats()
            self.save_manifest(manifest, output_dir)
        except Exception as e:
            logger.error(f"Failed to update manifest: {e}")

    def get_job_by_id(self, manifest: TranscriptionManifest, job_id: str) -> Optional[TranscriptionJob]:
        """Get job by ID from manifest"""
        for job in manifest.jobs:
            if job.id == job_id:
                return job
        return None

    def update_job_status(self, manifest: TranscriptionManifest, job_id: str,
                         status: JobStatus, output_dir: Path = None) -> None:
        """Update job status and save manifest"""
        job = self.get_job_by_id(manifest, job_id)
        if job:
            job.status = status
            if status == JobStatus.COMPLETED:
                job.completed_at = datetime.utcnow()
            elif status not in [JobStatus.PENDING]:
                job.started_at = datetime.utcnow()

            if output_dir:
                self.update_manifest(manifest, output_dir)

    def calculate_batch_stats(self, manifest: TranscriptionManifest) -> dict:
        """Calculate batch processing statistics"""
        total = len(manifest.jobs)
        completed = len([j for j in manifest.jobs if j.status == JobStatus.COMPLETED])
        failed = len([j for j in manifest.jobs if j.status == JobStatus.FAILED])
        pending = len([j for j in manifest.jobs if j.status == JobStatus.PENDING])
        in_progress = total - completed - failed - pending

        total_cost = sum(j.actual_cost or 0 for j in manifest.jobs)
        estimated_cost = sum(j.estimated_cost or 0 for j in manifest.jobs)

        # Calculate processing time
        processing_time = None
        if manifest.jobs:
            started_jobs = [j for j in manifest.jobs if j.started_at]
            completed_jobs = [j for j in manifest.jobs if j.completed_at]

            if started_jobs and completed_jobs:
                start_time = min(j.started_at for j in started_jobs)
                end_time = max(j.completed_at for j in completed_jobs)
                processing_time = (end_time - start_time).total_seconds()

        return {
            'total_jobs': total,
            'completed': completed,
            'failed': failed,
            'pending': pending,
            'in_progress': in_progress,
            'success_rate': (completed / total * 100) if total > 0 else 0,
            'total_cost': total_cost,
            'estimated_cost': estimated_cost,
            'processing_time_seconds': processing_time,
            'budget_remaining': manifest.budget_cap - total_cost
        }