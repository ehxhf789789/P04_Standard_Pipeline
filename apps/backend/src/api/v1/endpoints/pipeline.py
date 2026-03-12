"""Pipeline execution endpoints."""

import json
from datetime import datetime
from pathlib import Path as FilePath
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, Path, Query

from src.api.v1.schemas.pipeline import (
    PipelineRunCreate,
    PipelineStatusResponse,
    PipelineHistoryResponse,
    PipelineRunResponse,
    StageProgress,
)
from src.services.pipeline_service import pipeline_service
from src.api.v1.endpoints.files import get_files_for_project, _files

router = APIRouter()

# Persistence for pipeline runs
DATA_DIR = FilePath(__file__).parent.parent.parent.parent.parent / "uploads"
DATA_DIR.mkdir(exist_ok=True)
RUNS_FILE = DATA_DIR / "_pipeline_runs_metadata.json"


def _load_pipeline_runs() -> dict:
    """Load pipeline runs metadata from disk."""
    if RUNS_FILE.exists():
        try:
            with open(RUNS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for k, v in data.items():
                    # Convert datetime strings
                    for field in ["started_at", "completed_at", "created_at"]:
                        if field in v and isinstance(v[field], str):
                            try:
                                v[field] = datetime.fromisoformat(v[field])
                            except:
                                pass
                return data
        except Exception as e:
            print(f"Error loading pipeline runs: {e}")
    return {}


def _save_pipeline_runs():
    """Save pipeline runs metadata to disk."""
    try:
        data = {}
        for k, v in _pipeline_runs.items():
            v_copy = dict(v)
            for field in ["started_at", "completed_at", "created_at"]:
                if field in v_copy and v_copy[field]:
                    v_copy[field] = v_copy[field].isoformat() if hasattr(v_copy[field], 'isoformat') else str(v_copy[field])
            data[k] = v_copy
        with open(RUNS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        print(f"Error saving pipeline runs: {e}")


# In-memory storage for run metadata (with persistence)
_pipeline_runs: dict[str, dict] = _load_pipeline_runs()


@router.post("/run", response_model=PipelineStatusResponse, status_code=202)
async def start_pipeline(
    project_id: UUID = Path(...),
    run_config: Optional[PipelineRunCreate] = Body(default=None),
):
    """
    Start a new pipeline run.

    This endpoint queues the pipeline for async execution via Celery.
    Use the /status endpoint or WebSocket to monitor progress.
    """
    ifc_file_path = None

    # Look up file from file storage
    if run_config and run_config.ifc_file_id:
        # Specific file requested
        if run_config.ifc_file_id in _files:
            file_data = _files[run_config.ifc_file_id]
            ifc_file_path = file_data.get("file_path")
    else:
        # Use first uploaded file for this project
        project_files = get_files_for_project(project_id)
        if project_files:
            ifc_file_path = project_files[0].get("file_path")

    # Require IFC file to be uploaded
    if not ifc_file_path:
        raise HTTPException(
            status_code=400,
            detail="IFC 파일을 먼저 업로드해주세요.",
        )

    # Start pipeline via service
    result = pipeline_service.start_pipeline(
        project_id=project_id,
        ifc_file_path=ifc_file_path,
        loin_config_id=run_config.loin_config_id if run_config else None,
    )

    run_id = result["run_id"]
    now = datetime.utcnow()

    # Store run metadata
    _pipeline_runs[run_id] = {
        "id": run_id,
        "project_id": str(project_id),
        "ifc_file_id": str(run_config.ifc_file_id) if run_config and run_config.ifc_file_id else None,
        "status": "pending",
        "current_stage": None,
        "progress_percent": 0,
        "configuration": run_config.options if run_config else {},
        "started_at": now,
        "completed_at": None,
        "created_at": now,
        "output_dir": result["output_dir"],
    }
    _save_pipeline_runs()

    # Initialize stages
    stages = [
        StageProgress(stage="parse", status="pending"),
        StageProgress(stage="validate", status="pending"),
        StageProgress(stage="enrich", status="pending"),
        StageProgress(stage="transform", status="pending"),
        StageProgress(stage="package", status="pending"),
    ]

    return PipelineStatusResponse(
        run_id=UUID(run_id),
        project_id=project_id,
        status="pending",
        current_stage=None,
        progress_percent=0,
        stages=stages,
        started_at=now,
    )


@router.get("/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID to check"),
):
    """
    Get current pipeline status.

    Returns status from Celery task if available.
    """
    # Find the run to check
    if run_id:
        if run_id not in _pipeline_runs:
            raise HTTPException(status_code=404, detail="Pipeline run not found")
        run_meta = _pipeline_runs[run_id]
    else:
        # Find latest run for project
        project_runs = [
            r for r in _pipeline_runs.values()
            if r.get("project_id") == str(project_id)
        ]
        if not project_runs:
            raise HTTPException(status_code=404, detail="No pipeline runs found")
        run_meta = max(project_runs, key=lambda r: r["created_at"])
        run_id = run_meta["id"]

    # Get status from service (handles both sync and Celery mode)
    service_status = pipeline_service.get_pipeline_status(run_id)

    # Update local metadata with latest status
    if service_status.get("status") in ("completed", "failed", "cancelled"):
        _pipeline_runs[run_id]["status"] = service_status.get("status")
        if service_status.get("status") == "completed":
            _pipeline_runs[run_id]["completed_at"] = datetime.utcnow()
        _save_pipeline_runs()

    # Build stages list
    stage_names = ["parse", "validate", "enrich", "transform", "package"]
    current_stage = service_status.get("current_stage")
    current_stage_idx = stage_names.index(current_stage) if current_stage in stage_names else -1

    stages = []
    for i, stage in enumerate(stage_names):
        if service_status.get("status") == "completed":
            stages.append(StageProgress(stage=stage, status="completed", progress_percent=100))
        elif i < current_stage_idx:
            stages.append(StageProgress(stage=stage, status="completed", progress_percent=100))
        elif i == current_stage_idx:
            stages.append(StageProgress(
                stage=stage,
                status=service_status.get("stage_status", "running"),
                progress_percent=service_status.get("stage_progress", 0),
                message=service_status.get("message"),
            ))
        else:
            stages.append(StageProgress(stage=stage, status="pending"))

    return PipelineStatusResponse(
        run_id=UUID(run_id),
        project_id=project_id,
        status=service_status.get("status", "unknown"),
        current_stage=current_stage,
        progress_percent=service_status.get("overall_progress", 0),
        stages=stages,
        started_at=run_meta.get("started_at"),
        completed_at=run_meta.get("completed_at"),
        error_message=service_status.get("error"),
    )


@router.get("/status/{run_id}")
async def get_specific_run_status(
    project_id: UUID = Path(...),
    run_id: str = Path(...),
):
    """Get status for a specific pipeline run."""
    return await get_pipeline_status(project_id=project_id, run_id=run_id)


@router.get("/history", response_model=PipelineHistoryResponse)
async def get_pipeline_history(
    project_id: UUID = Path(...),
    limit: int = Query(20, ge=1, le=100),
):
    """Get pipeline run history for a project."""
    project_runs = [
        r for r in _pipeline_runs.values()
        if r.get("project_id") == str(project_id)
    ]

    # Sort by created_at descending
    project_runs.sort(key=lambda r: r["created_at"], reverse=True)

    runs = []
    for r in project_runs[:limit]:
        # For completed/failed runs, use stored status
        # Only check service for running/pending runs
        stored_status = r.get("status", "unknown")
        if stored_status in ("completed", "failed", "cancelled"):
            status = stored_status
            current_stage = None
            progress = 100 if stored_status == "completed" else 0
        else:
            # Get latest status from service
            service_status = pipeline_service.get_pipeline_status(r["id"])
            status = service_status.get("status", stored_status)
            current_stage = service_status.get("current_stage")
            progress = service_status.get("overall_progress", 0)

        runs.append(PipelineRunResponse(
            id=UUID(r["id"]),
            project_id=UUID(r["project_id"]),
            ifc_file_id=UUID(r["ifc_file_id"]) if r.get("ifc_file_id") else None,
            status=status,
            current_stage=current_stage,
            progress_percent=progress,
            configuration=r.get("configuration", {}),
            started_at=r.get("started_at"),
            completed_at=r.get("completed_at"),
            created_at=r["created_at"],
        ))

    return PipelineHistoryResponse(items=runs, total=len(project_runs))


@router.post("/cancel", status_code=200)
async def cancel_pipeline(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID to cancel"),
):
    """Cancel a running pipeline."""
    if run_id:
        if run_id not in _pipeline_runs:
            raise HTTPException(status_code=404, detail="Pipeline run not found")
        target_run_id = run_id
    else:
        # Find running or pending pipeline for project
        active = [
            r for r in _pipeline_runs.values()
            if r.get("project_id") == str(project_id) and r["status"] in ("running", "pending")
        ]
        if not active:
            raise HTTPException(status_code=404, detail="No active pipeline found")
        target_run_id = active[0]["id"]

    # Cancel via service
    success = pipeline_service.cancel_pipeline(target_run_id)

    if success:
        _pipeline_runs[target_run_id]["status"] = "cancelled"
        _save_pipeline_runs()
        return {"message": "Pipeline cancelled", "run_id": target_run_id}
    else:
        raise HTTPException(
            status_code=400,
            detail="Could not cancel pipeline (may have already completed)",
        )


@router.get("/result/{run_id}")
async def get_pipeline_result(
    project_id: UUID = Path(...),
    run_id: str = Path(...),
):
    """Get the final result of a completed pipeline run."""
    result = pipeline_service.get_pipeline_result(run_id)

    if result is None:
        # Check if run exists
        if run_id not in _pipeline_runs:
            raise HTTPException(status_code=404, detail="Pipeline run not found")

        status = pipeline_service.get_pipeline_status(run_id)
        if status.get("status") != "completed":
            raise HTTPException(
                status_code=400,
                detail=f"Pipeline not completed. Current status: {status.get('status')}",
            )

    return result
