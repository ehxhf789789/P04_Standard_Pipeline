"""Validation schemas."""

from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class ValidationCheck(BaseModel):
    """Schema for a single validation check."""

    rule_name: str
    facet_type: str  # Entity, Property, Classification, Material, Attribute, PartOf
    result: str  # PASS, FAIL, WARNING, N/A
    message: str
    expected: Optional[str] = None
    actual: Optional[str] = None
    property_set: Optional[str] = None
    property_name: Optional[str] = None
    bsdd_uri: Optional[str] = None
    rationale: Optional[str] = None


class ElementValidationResponse(BaseModel):
    """Schema for element validation response."""

    global_id: str
    name: str
    ifc_class: str
    status: str  # PASS, FAIL, WARNING
    pass_count: int = 0
    fail_count: int = 0
    warning_count: int = 0
    checks: list[ValidationCheck] = Field(default_factory=list)


class FailuresByType(BaseModel):
    """Schema for failures grouped by type."""

    failure_type: str
    count: int


class ValidationSummary(BaseModel):
    """Schema for validation summary."""

    total_elements: int
    elements_passed: int
    elements_failed: int
    elements_warning: int
    element_pass_rate: float
    total_checks: int
    checks_passed: int
    checks_failed: int
    checks_warning: int
    check_pass_rate: float
    failures_by_type: dict[str, int] = Field(default_factory=dict)
    bcf_issues_count: int = 0


class ValidationResultsResponse(BaseModel):
    """Schema for validation results response."""

    summary: ValidationSummary
    elements: list[ElementValidationResponse] = Field(default_factory=list)


class BCFIssue(BaseModel):
    """Schema for BCF issue."""

    guid: str
    topic_type: str
    topic_status: str
    title: str
    description: str
    related_element_id: str
    ifc_class: str
