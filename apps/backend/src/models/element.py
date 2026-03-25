"""Parsed element and validation result models."""

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    String, Text, Float, DateTime, JSON,
    ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.session import Base

if TYPE_CHECKING:
    from .pipeline import PipelineRun


class ValidationStatus(str, Enum):
    """Validation result status."""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    SKIPPED = "skipped"


class ParsedElement(Base):
    """Parsed BIM element from IFC file."""

    __tablename__ = "elements"
    __table_args__ = (
        Index("idx_elements_run", "pipeline_run_id"),
        Index("idx_elements_class", "ifc_class"),
        Index("idx_elements_global_id", "global_id"),
        {"schema": "pipeline"},
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

    # IFC identification
    global_id: Mapped[str] = mapped_column(String(36), nullable=False)
    ifc_class: Mapped[str] = mapped_column(String(100), nullable=False)
    predefined_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    object_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Spatial context
    storey_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    storey_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    space_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    space_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Properties (stored as JSON)
    property_sets: Mapped[dict] = mapped_column(JSON, default=dict)
    quantities: Mapped[dict] = mapped_column(JSON, default=dict)

    # Material info
    materials: Mapped[list] = mapped_column(JSON, default=list)

    # Classifications
    classifications: Mapped[list] = mapped_column(JSON, default=list)

    # Geometry summary (not full geometry)
    bounding_box: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    centroid: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    pipeline_run: Mapped["PipelineRun"] = relationship(
        "PipelineRun",
        back_populates="elements"
    )
    validation_results: Mapped[list["ValidationResult"]] = relationship(
        "ValidationResult",
        back_populates="element",
        cascade="all, delete-orphan"
    )
    enrichment_mappings: Mapped[list["EnrichmentMapping"]] = relationship(
        "EnrichmentMapping",
        back_populates="element",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<ParsedElement(global_id={self.global_id}, class={self.ifc_class})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "pipelineRunId": str(self.pipeline_run_id),
            "globalId": self.global_id,
            "ifcClass": self.ifc_class,
            "predefinedType": self.predefined_type,
            "name": self.name,
            "description": self.description,
            "objectType": self.object_type,
            "storeyId": self.storey_id,
            "storeyName": self.storey_name,
            "spaceId": self.space_id,
            "spaceName": self.space_name,
            "propertySets": self.property_sets,
            "quantities": self.quantities,
            "materials": self.materials,
            "classifications": self.classifications,
            "boundingBox": self.bounding_box,
            "centroid": self.centroid,
        }


class ValidationResult(Base):
    """Validation result for a single element."""

    __tablename__ = "validation_results"
    __table_args__ = (
        Index("idx_validation_run", "pipeline_run_id"),
        Index("idx_validation_element", "element_id"),
        Index("idx_validation_status", "status"),
        {"schema": "pipeline"},
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
    element_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline.elements.id", ondelete="CASCADE"),
        nullable=False
    )

    # Validation source
    validation_source: Mapped[str] = mapped_column(String(50))
    # Values: "ids", "loin", "bsdd", "custom"
    rule_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    requirement_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Result
    status: Mapped[ValidationStatus] = mapped_column(SQLEnum(ValidationStatus))
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Facet details (for IDS validation)
    facet_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Values: "entity", "attribute", "property", "material", "classification", "partOf"

    # Expected vs actual values
    expected_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actual_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Additional details
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    pipeline_run: Mapped["PipelineRun"] = relationship(
        "PipelineRun",
        back_populates="validation_results"
    )
    element: Mapped["ParsedElement"] = relationship(
        "ParsedElement",
        back_populates="validation_results"
    )

    def __repr__(self) -> str:
        return f"<ValidationResult(element_id={self.element_id}, status={self.status})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "pipelineRunId": str(self.pipeline_run_id),
            "elementId": str(self.element_id),
            "validationSource": self.validation_source,
            "ruleId": self.rule_id,
            "requirementName": self.requirement_name,
            "status": self.status.value,
            "message": self.message,
            "facetType": self.facet_type,
            "expectedValue": self.expected_value,
            "actualValue": self.actual_value,
            "details": self.details,
        }


class EnrichmentMapping(Base):
    """bSDD enrichment mapping for element properties."""

    __tablename__ = "enrichment_mappings"
    __table_args__ = (
        Index("idx_enrichment_element", "element_id"),
        {"schema": "pipeline"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    element_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("pipeline.elements.id", ondelete="CASCADE"),
        nullable=False
    )

    # Local property
    local_property_set: Mapped[str] = mapped_column(String(255))
    local_property_name: Mapped[str] = mapped_column(String(255))
    local_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # bSDD mapping
    bsdd_property_uri: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    bsdd_property_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bsdd_class_uri: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    bsdd_class_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Mapping quality
    mapping_type: Mapped[str] = mapped_column(String(50))
    # Values: "exact", "similar", "suggested", "manual"
    confidence: Mapped[float] = mapped_column(Float, default=1.0)

    # Validation
    is_valid: Mapped[Optional[bool]] = mapped_column(nullable=True)
    validation_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    element: Mapped["ParsedElement"] = relationship(
        "ParsedElement",
        back_populates="enrichment_mappings"
    )

    def __repr__(self) -> str:
        return f"<EnrichmentMapping(element={self.element_id}, property={self.local_property_name})>"

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "elementId": str(self.element_id),
            "localPropertySet": self.local_property_set,
            "localPropertyName": self.local_property_name,
            "localValue": self.local_value,
            "bsddPropertyUri": self.bsdd_property_uri,
            "bsddPropertyName": self.bsdd_property_name,
            "bsddClassUri": self.bsdd_class_uri,
            "bsddClassName": self.bsdd_class_name,
            "mappingType": self.mapping_type,
            "confidence": self.confidence,
            "isValid": self.is_valid,
            "validationError": self.validation_error,
        }
