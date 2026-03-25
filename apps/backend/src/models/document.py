"""Document and file models with CDE workflow states."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    String, Text, BigInteger, Boolean, DateTime, JSON,
    ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base

if TYPE_CHECKING:
    from .project import Project
    from .pipeline import PipelineRun


class CDEState(str, Enum):
    """Common Data Environment workflow states (ISO 19650)."""
    WIP = "wip"              # Work In Progress
    SHARED = "shared"        # Shared with team
    PUBLISHED = "published"  # Published/approved
    ARCHIVED = "archived"    # Archived


class DocumentType(str, Enum):
    """Supported document types."""
    IFC = "ifc"
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    PPTX = "pptx"
    HWPX = "hwpx"
    HWP = "hwp"
    DWG = "dwg"
    RVT = "rvt"
    OTHER = "other"


class Document(Base):
    """Document/file metadata with CDE workflow."""

    __tablename__ = "documents"
    __table_args__ = (
        Index("idx_documents_project", "project_id"),
        Index("idx_documents_cde_state", "cde_state"),
        Index("idx_documents_type", "document_type"),
        {"schema": "documents"},
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

    # File info
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # SHA-256

    # Document classification
    document_type: Mapped[DocumentType] = mapped_column(
        SQLEnum(DocumentType),
        default=DocumentType.OTHER
    )

    # ISO 19650 naming convention parsing
    # Format: [Project]-[Originator]-[Volume/System]-[Level/Location]-[Type]-[Role]-[Number]
    iso_project: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_originator: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_volume: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_doc_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_role: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    iso_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # CDE Workflow (ISO 19650)
    cde_state: Mapped[CDEState] = mapped_column(
        SQLEnum(CDEState),
        default=CDEState.WIP
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # IFC specific (if applicable)
    ifc_schema: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ifc_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Metadata
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    # Timestamps
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan"
    )
    pipeline_runs: Mapped[list["PipelineRun"]] = relationship(
        "PipelineRun",
        back_populates="document"
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, filename={self.filename}, state={self.cde_state})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "projectId": str(self.project_id),
            "filename": self.filename,
            "originalFilename": self.original_filename,
            "mimeType": self.mime_type,
            "fileSize": self.file_size,
            "documentType": self.document_type.value,
            "cdeState": self.cde_state.value,
            "publishedAt": self.published_at.isoformat() if self.published_at else None,
            "ifcSchema": self.ifc_schema,
            "metadata": self.metadata,
            "uploadedAt": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }


class DocumentVersion(Base):
    """Document version history."""

    __tablename__ = "document_versions"
    __table_args__ = (
        Index("idx_doc_versions_document", "document_id"),
        {"schema": "documents"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.documents.id", ondelete="CASCADE"),
        nullable=False
    )

    # Version info
    version_number: Mapped[int] = mapped_column(default=1)
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # Change info
    change_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="versions")

    def __repr__(self) -> str:
        return f"<DocumentVersion(id={self.id}, version={self.version_number})>"
