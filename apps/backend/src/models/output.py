"""AI output models."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    String, Text, BigInteger, DateTime, JSON,
    ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base

if TYPE_CHECKING:
    from .pipeline import PipelineRun


class AIOutputType(str, Enum):
    """Types of AI-ready outputs."""
    KNOWLEDGE_GRAPH = "knowledge_graph"
    EMBEDDINGS = "embeddings"
    TABULAR = "tabular"
    GNN = "gnn"
    BCF = "bcf"
    SUMMARY = "summary"
    REPORT = "report"


class OutputFormat(str, Enum):
    """Output file formats."""
    # Knowledge Graph
    TTL = "ttl"
    RDF_XML = "rdf"
    JSON_LD = "jsonld"
    N_TRIPLES = "nt"

    # Embeddings
    JSONL = "jsonl"
    QDRANT = "qdrant"
    PINECONE = "pinecone"

    # Tabular
    CSV = "csv"
    PARQUET = "parquet"
    XLSX = "xlsx"

    # GNN
    PYTORCH_GEOMETRIC = "pt"
    DGL = "dgl"
    GRAPHML = "graphml"

    # Other
    JSON = "json"
    ZIP = "zip"
    PDF = "pdf"
    BCF_XML = "bcfzip"


class AIOutput(Base):
    """Generated AI-ready output file."""

    __tablename__ = "outputs"
    __table_args__ = (
        Index("idx_outputs_run", "pipeline_run_id"),
        Index("idx_outputs_type", "output_type"),
        {"schema": "ai_outputs"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    pipeline_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline.runs.id", ondelete="CASCADE"),
        nullable=False
    )

    # Output info
    output_type: Mapped[AIOutputType] = mapped_column(SQLEnum(AIOutputType))
    output_format: Mapped[OutputFormat] = mapped_column(SQLEnum(OutputFormat))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # File info
    storage_path: Mapped[str] = mapped_column(String(512))
    file_size: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(100))

    # Content metadata
    metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    # Examples:
    # - Knowledge Graph: {tripleCount, nodeCount, edgeCount, ontologies}
    # - Embeddings: {chunkCount, dimensions, model}
    # - Tabular: {rowCount, columnCount, featureSet}
    # - GNN: {nodeCount, edgeCount, nodeTypes, edgeTypes}

    # Quality metrics
    quality_metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Generation timestamp
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow
    )

    # Relationships
    pipeline_run: Mapped["PipelineRun"] = relationship(
        "PipelineRun",
        back_populates="outputs"
    )

    def __repr__(self) -> str:
        return f"<AIOutput(id={self.id}, type={self.output_type}, format={self.output_format})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "pipelineRunId": str(self.pipeline_run_id),
            "outputType": self.output_type.value,
            "outputFormat": self.output_format.value,
            "name": self.name,
            "description": self.description,
            "storagePath": self.storage_path,
            "fileSize": self.file_size,
            "mimeType": self.mime_type,
            "metadata": self.metadata,
            "qualityMetrics": self.quality_metrics,
            "generatedAt": self.generated_at.isoformat() if self.generated_at else None,
        }

    @property
    def download_filename(self) -> str:
        """Generate download filename."""
        ext = self.output_format.value
        return f"{self.name}.{ext}"
