"""Enrichment schemas."""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PropertyMapping(BaseModel):
    """Schema for property mapping result."""

    original_name: str
    standard_name: str
    original_value: Optional[str] = None
    normalized_value: Optional[str] = None
    property_set: str
    bsdd_uri: Optional[str] = None
    data_type: Optional[str] = None
    mapping_status: str  # MAPPED, FUZZY_MATCH, NOT_FOUND
    similarity_score: Optional[float] = None


class ClassificationLink(BaseModel):
    """Schema for classification cross-link."""

    system: str  # Uniclass2015, OmniClass, bSDD
    code: str
    name: str
    uri: Optional[str] = None


class ElementEnrichmentResponse(BaseModel):
    """Schema for element enrichment response."""

    global_id: str
    name: str
    ifc_class: str
    property_mappings: list[PropertyMapping] = Field(default_factory=list)
    classifications: list[ClassificationLink] = Field(default_factory=list)


class EnrichmentSummary(BaseModel):
    """Schema for enrichment summary."""

    total_elements: int
    total_properties: int
    properties_mapped_exact: int
    properties_mapped_fuzzy: int
    properties_not_found: int
    mapping_rate: float
    elements_with_classification: int


class EnrichmentResultsResponse(BaseModel):
    """Schema for enrichment results response."""

    summary: EnrichmentSummary
    elements: list[ElementEnrichmentResponse] = Field(default_factory=list)
