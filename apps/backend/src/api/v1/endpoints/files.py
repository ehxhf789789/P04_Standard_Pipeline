"""File upload endpoints."""

import json
import os
from pathlib import Path as FilePath
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, UploadFile, File, Path
from fastapi.responses import Response
from pydantic import BaseModel

from src.api.v1.endpoints.projects import _projects

router = APIRouter()

# File storage directory
UPLOAD_DIR = FilePath(__file__).parent.parent.parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Metadata persistence file
METADATA_FILE = UPLOAD_DIR / "_files_metadata.json"


def _load_files_metadata() -> dict:
    """Load file metadata from disk."""
    if METADATA_FILE.exists():
        try:
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                # Convert string keys back to UUID
                return {UUID(k): v for k, v in data.items()}
        except Exception as e:
            print(f"Error loading file metadata: {e}")
    return {}


def _save_files_metadata():
    """Save file metadata to disk."""
    try:
        # Convert UUID keys to strings for JSON serialization
        data = {}
        for k, v in _files.items():
            v_copy = dict(v)
            # Convert UUID fields to strings
            v_copy["id"] = str(v_copy["id"])
            v_copy["project_id"] = str(v_copy["project_id"])
            data[str(k)] = v_copy
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving file metadata: {e}")


class FileResponse(BaseModel):
    """File response schema."""

    id: UUID
    filename: str
    original_filename: str
    size_kb: float
    schema_version: Optional[str] = None
    uploaded_at: str


class FileListResponse(BaseModel):
    """File list response schema."""

    files: list[FileResponse]
    total: int


# In-memory storage for demo (with persistence)
_files: dict[UUID, dict] = _load_files_metadata()


@router.get("", response_model=FileListResponse)
async def list_files(project_id: UUID = Path(...)):
    """List all files for a project."""
    # Compare as strings to handle both UUID and string project_ids
    pid_str = str(project_id)
    project_files = [f for f in _files.values() if str(f.get("project_id")) == pid_str]
    return FileListResponse(
        files=[FileResponse(**f) for f in project_files],
        total=len(project_files),
    )


@router.post("/upload", response_model=FileResponse, status_code=201)
async def upload_file(
    project_id: UUID = Path(...),
    file: UploadFile = File(...),
):
    """Upload an IFC file."""
    from datetime import datetime

    # Check project exists
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file type
    if not file.filename.lower().endswith(".ifc"):
        raise HTTPException(
            status_code=400,
            detail="Only IFC files are allowed",
        )

    # Read file content
    content = await file.read()
    size_kb = len(content) / 1024

    # Detect schema version from content
    schema_version = "IFC4"
    if b"FILE_SCHEMA(('IFC2X3'))" in content:
        schema_version = "IFC2X3"
    elif b"FILE_SCHEMA(('IFC4X3'))" in content:
        schema_version = "IFC4X3"
    elif b"FILE_SCHEMA(('IFC4'))" in content:
        schema_version = "IFC4"

    file_id = uuid4()
    now = datetime.utcnow()

    # Create project directory and save file to disk
    project_dir = UPLOAD_DIR / str(project_id)
    project_dir.mkdir(exist_ok=True)
    file_path = project_dir / f"{file_id}.ifc"
    file_path.write_bytes(content)

    file_data = {
        "id": file_id,
        "project_id": project_id,
        "filename": f"{file_id}.ifc",
        "original_filename": file.filename,
        "size_kb": round(size_kb, 2),
        "schema_version": schema_version,
        "uploaded_at": now.isoformat(),
        "file_path": str(file_path),  # Store path instead of content
    }

    _files[file_id] = file_data

    # Save metadata to disk
    _save_files_metadata()

    # Update project's ifc_file_count
    _projects[project_id]["ifc_file_count"] = len(
        [f for f in _files.values() if str(f.get("project_id")) == str(project_id)]
    )
    _projects[project_id]["updated_at"] = now

    return FileResponse(
        id=file_id,
        filename=file_data["filename"],
        original_filename=file_data["original_filename"],
        size_kb=file_data["size_kb"],
        schema_version=schema_version,
        uploaded_at=file_data["uploaded_at"],
    )


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    project_id: UUID = Path(...),
    file_id: UUID = Path(...),
):
    """Delete a file."""
    from datetime import datetime

    if file_id not in _files:
        raise HTTPException(status_code=404, detail="File not found")

    if str(_files[file_id].get("project_id")) != str(project_id):
        raise HTTPException(status_code=404, detail="File not found in this project")

    # Delete file from disk
    file_path = _files[file_id].get("file_path")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    del _files[file_id]

    # Save metadata to disk
    _save_files_metadata()

    # Update project's ifc_file_count
    if project_id in _projects:
        _projects[project_id]["ifc_file_count"] = len(
            [f for f in _files.values() if str(f.get("project_id")) == str(project_id)]
        )
        _projects[project_id]["updated_at"] = datetime.utcnow()


@router.get("/{file_id}/download")
async def download_file(
    project_id: UUID = Path(...),
    file_id: UUID = Path(...),
):
    """Download an IFC file."""
    if file_id not in _files:
        raise HTTPException(status_code=404, detail="File not found")

    file_data = _files[file_id]
    if str(file_data.get("project_id")) != str(project_id):
        raise HTTPException(status_code=404, detail="File not found in this project")

    file_path = file_data.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File content not found")

    content = FilePath(file_path).read_bytes()
    original_filename = file_data.get("original_filename", f"{file_id}.ifc")

    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{original_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def get_file_content(file_id: UUID) -> bytes:
    """Get file content by ID."""
    if file_id not in _files:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _files[file_id].get("file_path")
    if file_path and os.path.exists(file_path):
        return FilePath(file_path).read_bytes()

    raise HTTPException(status_code=404, detail="File content not found")


def get_files_for_project(project_id: UUID) -> list[dict]:
    """Get all files for a project."""
    return [f for f in _files.values() if str(f.get("project_id")) == str(project_id)]
