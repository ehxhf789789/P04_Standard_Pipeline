"""Pipeline schemas."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class PipelineRunCreate(BaseModel):
    """Schema for starting a pipeline run."""

    ifc_file_id: Optional[UUID] = None  # Optional - uses first uploaded file if not specified
    loin_config_id: Optional[UUID] = None
    options: dict[str, Any] = Field(default_factory=dict)


class StageProgress(BaseModel):
    """Schema for stage progress."""

    stage: str  # parse, validate, enrich, transform, package
    status: str  # pending, running, completed, failed
    progress_percent: int = 0
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    summary: dict[str, Any] = Field(default_factory=dict)


class PipelineStatusResponse(BaseModel):
    """Schema for pipeline status response."""

    run_id: UUID
    project_id: UUID
    status: str  # pending, running, completed, failed, cancelled
    current_stage: Optional[str] = None
    progress_percent: int = 0
    stages: list[StageProgress] = Field(default_factory=list)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class PipelineRunResponse(BaseModel):
    """Schema for pipeline run response."""

    id: UUID
    project_id: UUID
    ifc_file_id: Optional[UUID] = None
    status: str
    current_stage: Optional[str] = None
    progress_percent: int = 0
    configuration: dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PipelineHistoryResponse(BaseModel):
    """Schema for pipeline history response."""

    items: list[PipelineRunResponse]
    total: int
