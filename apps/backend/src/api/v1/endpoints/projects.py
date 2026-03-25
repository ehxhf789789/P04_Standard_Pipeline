"""Projects endpoints."""

import json
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query

from src.api.v1.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
)

router = APIRouter()

# Data directory for persistence
DATA_DIR = Path(__file__).parent.parent.parent.parent.parent / "uploads"
DATA_DIR.mkdir(exist_ok=True)
PROJECTS_FILE = DATA_DIR / "_projects_metadata.json"


def _load_projects_metadata() -> dict:
    """Load project metadata from disk."""
    if PROJECTS_FILE.exists():
        try:
            with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                result = {}
                for k, v in data.items():
                    # Convert string dates back to datetime
                    from datetime import datetime
                    if "created_at" in v and isinstance(v["created_at"], str):
                        v["created_at"] = datetime.fromisoformat(v["created_at"])
                    if "updated_at" in v and isinstance(v["updated_at"], str):
                        v["updated_at"] = datetime.fromisoformat(v["updated_at"])
                    v["id"] = UUID(v["id"])
                    result[UUID(k)] = v
                return result
        except Exception as e:
            print(f"Error loading project metadata: {e}")
    return {}


def _save_projects_metadata():
    """Save project metadata to disk."""
    try:
        data = {}
        for k, v in _projects.items():
            v_copy = dict(v)
            v_copy["id"] = str(v_copy["id"])
            if "created_at" in v_copy:
                v_copy["created_at"] = v_copy["created_at"].isoformat() if hasattr(v_copy["created_at"], 'isoformat') else str(v_copy["created_at"])
            if "updated_at" in v_copy:
                v_copy["updated_at"] = v_copy["updated_at"].isoformat() if hasattr(v_copy["updated_at"], 'isoformat') else str(v_copy["updated_at"])
            data[str(k)] = v_copy
        with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving project metadata: {e}")


# In-memory storage for demo (with persistence)
_projects: dict[UUID, dict] = _load_projects_metadata()


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    lifecycle_phase: Optional[str] = Query(None, description="Filter by phase: design, construction, operation"),
):
    """List all projects with pagination, optionally filtered by lifecycle phase."""
    projects = list(_projects.values())
    if lifecycle_phase:
        projects = [p for p in projects if p.get("lifecycle_phase") == lifecycle_phase]
    total = len(projects)
    start = (page - 1) * page_size
    end = start + page_size

    return ProjectListResponse(
        items=[ProjectResponse(**p) for p in projects[start:end]],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(project: ProjectCreate):
    """Create a new project."""
    from datetime import datetime

    project_id = uuid4()
    now = datetime.utcnow()

    project_data = {
        "id": project_id,
        "name": project.name,
        "description": project.description,
        "lifecycle_phase": project.lifecycle_phase or "design",
        "status": "created",
        "created_at": now,
        "updated_at": now,
        "ifc_file_count": 0,
        "file_count": 0,
        "latest_run_status": None,
    }

    _projects[project_id] = project_data
    _save_projects_metadata()
    return ProjectResponse(**project_data)


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID):
    """Get a project by ID."""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectResponse(**_projects[project_id])


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: UUID, update: ProjectUpdate):
    """Update a project."""
    from datetime import datetime

    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    project = _projects[project_id]

    if update.name is not None:
        project["name"] = update.name
    if update.description is not None:
        project["description"] = update.description
    if update.lifecycle_phase is not None:
        project["lifecycle_phase"] = update.lifecycle_phase

    project["updated_at"] = datetime.utcnow()
    _save_projects_metadata()

    return ProjectResponse(**project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: UUID):
    """Delete a project."""
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    del _projects[project_id]
    _save_projects_metadata()
