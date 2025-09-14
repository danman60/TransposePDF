"""
Data models for SoloTranscribeCLI
"""

from enum import Enum
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from pathlib import Path


class JobStatus(str, Enum):
    """Status of a transcription job"""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    CONVERTING = "converting"
    TRANSCRIBING = "transcribing"
    FORMATTING = "formatting"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class FailureReason(str, Enum):
    """Reasons for job failure"""
    INVALID_URL = "invalid_url"
    ACCESS_DENIED = "access_denied"
    DOWNLOAD_FAILED = "download_failed"
    CONVERT_FAILED = "convert_failed"
    TRANSCRIPTION_FAILED = "transcription_failed"
    FORMAT_FAILED = "format_failed"
    BUDGET_EXCEEDED = "budget_exceeded"
    UNKNOWN_ERROR = "unknown_error"


class VideoMetadata(BaseModel):
    """Metadata about the source video"""
    title: Optional[str] = None
    platform: Optional[str] = None
    duration: Optional[float] = None  # seconds
    upload_date: Optional[str] = None
    uploader: Optional[str] = None
    description: Optional[str] = None
    view_count: Optional[int] = None


class TranscriptionJob(BaseModel):
    """A single transcription job"""
    id: str = Field(..., description="Unique job ID")
    url: str = Field(..., description="Source video URL")
    status: JobStatus = Field(default=JobStatus.PENDING)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Metadata
    video_metadata: Optional[VideoMetadata] = None

    # File paths
    temp_video_path: Optional[Path] = None
    temp_audio_path: Optional[Path] = None
    output_dir: Optional[Path] = None

    # Processing info
    freeconvert_job_id: Optional[str] = None
    assemblyai_transcript_id: Optional[str] = None

    # Results
    transcript_text: Optional[str] = None
    transcript_data: Optional[Dict[str, Any]] = None

    # Error handling
    error_message: Optional[str] = None
    failure_reason: Optional[FailureReason] = None
    retry_count: int = 0

    # Costs
    estimated_cost: Optional[float] = None
    actual_cost: Optional[float] = None

    class Config:
        arbitrary_types_allowed = True
        json_encoders = {
            Path: str,
            datetime: lambda dt: dt.isoformat()
        }


class TranscriptionManifest(BaseModel):
    """Manifest for a batch of transcription jobs"""
    id: str = Field(..., description="Batch ID")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Configuration
    input_file: str
    output_dir: str
    output_formats: List[str]

    # Jobs
    jobs: List[TranscriptionJob] = Field(default_factory=list)

    # Statistics
    total_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0

    # Costs
    total_estimated_cost: float = 0.0
    total_actual_cost: float = 0.0
    budget_cap: float = 20.0

    class Config:
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

    def update_stats(self):
        """Update manifest statistics"""
        self.total_jobs = len(self.jobs)
        self.completed_jobs = len([j for j in self.jobs if j.status == JobStatus.COMPLETED])
        self.failed_jobs = len([j for j in self.jobs if j.status == JobStatus.FAILED])
        self.total_estimated_cost = sum(j.estimated_cost or 0 for j in self.jobs)
        self.total_actual_cost = sum(j.actual_cost or 0 for j in self.jobs)
        self.updated_at = datetime.utcnow()

    def get_failed_jobs(self) -> List[TranscriptionJob]:
        """Get list of failed jobs"""
        return [job for job in self.jobs if job.status == JobStatus.FAILED]

    def get_retryable_jobs(self) -> List[TranscriptionJob]:
        """Get list of jobs that can be retried"""
        from .config import config
        return [
            job for job in self.jobs
            if job.status == JobStatus.FAILED and job.retry_count < config.retry_limit
        ]


class OutputFormats(str, Enum):
    """Supported output formats"""
    TXT = "txt"
    JSON = "json"
    SRT = "srt"
    VTT = "vtt"


class ProcessingOptions(BaseModel):
    """Options for processing jobs"""
    input_file: Path
    output_dir: Path
    formats: List[OutputFormats]
    enable_summary: bool = False
    delete_temp: bool = True
    dry_run: bool = False
    budget_cap: Optional[float] = None