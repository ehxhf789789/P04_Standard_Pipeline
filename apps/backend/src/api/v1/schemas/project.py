"""Project schemas."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    """Schema for creating a project."""

    pass


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectResponse(ProjectBase):
    """Schema for project response."""

    id: UUID
    status: str  # created, processing, completed, failed
    created_at: datetime
    updated_at: datetime
    ifc_file_count: int = 0
    latest_run_status: Optional[str] = None

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    """Schema for project list response."""

    items: list[ProjectResponse]
    total: int
    page: int
    page_size: int
