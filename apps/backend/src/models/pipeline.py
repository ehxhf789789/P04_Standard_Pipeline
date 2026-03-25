"""Pipeline run and stage tracking models."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    String, Text, Integer, Float, DateTime, JSON,
    ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base

if TYPE_CHECKING:
    from .project import Project
    from .document import Document
    from .element import ParsedElement, ValidationResult
    from .output import AIOutput


class PipelineStatus(str, Enum):
    """Pipeline execution status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageType(str, Enum):
    """Pipeline stage types."""
    INGEST = "ingest"
    PARSE = "parse"
    VALIDATE = "validate"
    ENRICH = "enrich"
    TRANSFORM = "transform"
    PACKAGE = "package"


class PipelineRun(Base):
    """Single pipeline execution run."""

    __tablename__ = "runs"
    __table_args__ = (
        Index("idx_runs_project", "project_id"),
        Index("idx_runs_document", "document_id"),
        Index("idx_runs_status", "status"),
        {"schema": "pipeline"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.projects.id", ondelete="CASCADE"),
        nullable=False
    )
    document_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.documents.id", ondelete="SET NULL"),
        nullable=True
    )

    # Execution info
    status: Mapped[PipelineStatus] = mapped_column(
        SQLEnum(PipelineStatus),
        default=PipelineStatus.QUEUED
    )
    current_stage: Mapped[Optional[StageType]] = mapped_column(
        SQLEnum(StageType),
        nullable=True
    )
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)

    # Trigger info
    triggered_by: Mapped[str] = mapped_column(String(50), default="manual")
    # Values: "manual", "cde_publish", "webhook", "scheduled"

    # Configuration
    configuration: Mapped[dict] = mapped_column(JSON, default=dict)
    # Contains: loin_id, ids_path, output_formats, etc.

    # Results summary
    element_count: Mapped[int] = mapped_column(Integer, default=0)
    pass_count: Mapped[int] = mapped_column(Integer, default=0)
    fail_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)

    # Error handling
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Timestamps
    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="pipeline_runs")
    document: Mapped[Optional["Document"]] = relationship("Document", back_populates="pipeline_runs")
    stages: Mapped[list["PipelineStage"]] = relationship(
        "PipelineStage",
        back_populates="run",
        cascade="all, delete-orphan"
    )
    elements: Mapped[list["ParsedElement"]] = relationship(
        "ParsedElement",
        back_populates="pipeline_run",
        cascade="all, delete-orphan"
    )
    validation_results: Mapped[list["ValidationResult"]] = relationship(
        "ValidationResult",
        back_populates="pipeline_run",
        cascade="all, delete-orphan"
    )
    outputs: Mapped[list["AIOutput"]] = relationship(
        "AIOutput",
        back_populates="pipeline_run",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PipelineRun(id={self.id}, status={self.status})>"

    @property
    def duration_seconds(self) -> Optional[float]:
        """Calculate run duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "projectId": str(self.project_id),
            "documentId": str(self.document_id) if self.document_id else None,
            "status": self.status.value,
            "currentStage": self.current_stage.value if self.current_stage else None,
            "progressPercent": self.progress_percent,
            "triggeredBy": self.triggered_by,
            "configuration": self.configuration,
            "elementCount": self.element_count,
            "passCount": self.pass_count,
            "failCount": self.fail_count,
            "warningCount": self.warning_count,
            "errorMessage": self.error_message,
            "queuedAt": self.queued_at.isoformat() if self.queued_at else None,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "durationSeconds": self.duration_seconds,
        }


class PipelineStage(Base):
    """Individual stage execution within a pipeline run."""

    __tablename__ = "stages"
    __table_args__ = (
        Index("idx_stages_run", "run_id"),
        {"schema": "pipeline"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline.runs.id", ondelete="CASCADE"),
        nullable=False
    )

    # Stage info
    stage_type: Mapped[StageType] = mapped_column(SQLEnum(StageType))
    stage_order: Mapped[int] = mapped_column(Integer)
    status: Mapped[PipelineStatus] = mapped_column(
        SQLEnum(PipelineStatus),
        default=PipelineStatus.QUEUED
    )

    # Progress
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    total_items: Mapped[int] = mapped_column(Integer, default=0)
    processed_items: Mapped[int] = mapped_column(Integer, default=0)

    # Results
    result_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamps
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    run: Mapped["PipelineRun"] = relationship("PipelineRun", back_populates="stages")

    def __repr__(self) -> str:
        return f"<PipelineStage(id={self.id}, type={self.stage_type}, status={self.status})>"

    @property
    def duration_ms(self) -> Optional[float]:
        """Calculate stage duration in milliseconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds() * 1000
        return None

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "runId": str(self.run_id),
            "stageType": self.stage_type.value,
            "stageOrder": self.stage_order,
            "status": self.status.value,
            "progressPercent": self.progress_percent,
            "currentStep": self.current_step,
            "totalItems": self.total_items,
            "processedItems": self.processed_items,
            "resultSummary": self.result_summary,
            "errorMessage": self.error_message,
            "startedAt": self.started_at.isoformat() if self.started_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "durationMs": self.duration_ms,
        }
