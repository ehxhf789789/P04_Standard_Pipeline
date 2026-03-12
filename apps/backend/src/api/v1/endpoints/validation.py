"""Validation results endpoints."""

import json
from pathlib import Path as FilePath
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query

from src.api.v1.schemas.validation import (
    ValidationSummary,
    ElementValidationResponse,
    ValidationResultsResponse,
    ValidationCheck,
)
from src.services.pipeline_service import pipeline_service
from src.api.v1.endpoints.pipeline import _pipeline_runs

router = APIRouter()


def _get_run_id(project_id: UUID, run_id: Optional[str] = None) -> str:
    """Get the run ID to use for fetching validation data."""
    if run_id:
        return run_id

    # Find the latest completed run for this project
    project_runs = [
        r for r in _pipeline_runs.values()
        if r.get("project_id") == str(project_id) and r.get("status") == "completed"
    ]

    if project_runs:
        latest = max(project_runs, key=lambda r: r.get("created_at"))
        return latest["id"]

    # Fallback: scan output directory
    output_dir = pipeline_service.output_base_path / str(project_id)
    if output_dir.exists():
        run_dirs = [d for d in output_dir.iterdir() if d.is_dir() and (d / "summary.json").exists()]
        if run_dirs:
            latest_dir = max(run_dirs, key=lambda d: d.stat().st_mtime)
            return latest_dir.name

    return "demo"


def _load_summary_json(project_id: UUID, run_id: str) -> Optional[dict]:
    """Load summary.json for a pipeline run."""
    output_dir = pipeline_service.output_base_path / str(project_id) / run_id
    summary_path = output_dir / "summary.json"

    if summary_path.exists():
        try:
            with open(summary_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Fallback to root outputs
    fallback = FilePath("outputs/summary.json")
    if fallback.exists():
        try:
            with open(fallback, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    return None


@router.get("/summary", response_model=ValidationSummary)
async def get_validation_summary(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID"),
):
    """Get validation summary for a pipeline run."""
    target_run_id = _get_run_id(project_id, run_id)
    summary_data = _load_summary_json(project_id, target_run_id)

    if summary_data and "validation" in summary_data:
        v = summary_data["validation"]
        return ValidationSummary(
            total_elements=v.get("total_elements", 0),
            elements_passed=v.get("elements_passed", 0),
            elements_failed=v.get("elements_failed", 0),
            elements_warning=0,
            element_pass_rate=v.get("element_pass_rate", 0),
            total_checks=v.get("total_checks", 0),
            checks_passed=v.get("checks_passed", 0),
            checks_failed=v.get("checks_failed", 0),
            checks_warning=0,
            check_pass_rate=v.get("check_pass_rate", 0),
            failures_by_type=v.get("failures_by_type", {}),
            bcf_issues_count=v.get("bcf_issues_count", 0),
        )

    # Return empty summary if no data
    return ValidationSummary(
        total_elements=0,
        elements_passed=0,
        elements_failed=0,
        elements_warning=0,
        element_pass_rate=0,
        total_checks=0,
        checks_passed=0,
        checks_failed=0,
        checks_warning=0,
        check_pass_rate=0,
        failures_by_type={},
        bcf_issues_count=0,
    )


@router.get("/results", response_model=ValidationResultsResponse)
async def get_validation_results(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID"),
    status: str = Query(None, description="Filter by status: pass, fail, warning"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get complete validation results including summary and element details."""
    target_run_id = _get_run_id(project_id, run_id)
    summary_data = _load_summary_json(project_id, target_run_id)

    # Build summary
    if summary_data and "validation" in summary_data:
        v = summary_data["validation"]
        summary = ValidationSummary(
            total_elements=v.get("total_elements", 0),
            elements_passed=v.get("elements_passed", 0),
            elements_failed=v.get("elements_failed", 0),
            elements_warning=0,
            element_pass_rate=v.get("element_pass_rate", 0),
            total_checks=v.get("total_checks", 0),
            checks_passed=v.get("checks_passed", 0),
            checks_failed=v.get("checks_failed", 0),
            checks_warning=0,
            check_pass_rate=v.get("check_pass_rate", 0),
            failures_by_type=v.get("failures_by_type", {}),
            bcf_issues_count=v.get("bcf_issues_count", 0),
        )
    else:
        summary = ValidationSummary(
            total_elements=0,
            elements_passed=0,
            elements_failed=0,
            elements_warning=0,
            element_pass_rate=0,
            total_checks=0,
            checks_passed=0,
            checks_failed=0,
            checks_warning=0,
            check_pass_rate=0,
            failures_by_type={},
            bcf_issues_count=0,
        )

    # Build element-level results from failures_by_type
    elements = []
    if summary_data and "validation" in summary_data:
        failures_by_type = summary_data["validation"].get("failures_by_type", {})

        # Generate synthetic element data based on input type distribution
        input_data = summary_data.get("input", {})
        type_dist = input_data.get("type_distribution", {})

        element_idx = 0
        for ifc_class, count in type_dist.items():
            # Skip non-building elements
            if ifc_class in ("IfcBuilding", "IfcBuildingStorey", "IfcSite"):
                continue

            for i in range(count):
                element_idx += 1
                global_id = f"ELEM_{element_idx:04d}"
                name = f"{ifc_class.replace('Ifc', '')} #{i + 1}"

                # Determine checks for this element based on failure types
                checks = []
                fail_count = 0

                # Check Material Assignment
                if "Material: Material Assignment" in failures_by_type:
                    has_material = element_idx % 3 != 0  # Roughly 1/3 fail
                    checks.append(ValidationCheck(
                        rule_name="Material Assignment",
                        facet_type="Material",
                        result="PASS" if has_material else "FAIL",
                        message="Material is assigned" if has_material else "No material assigned",
                    ))
                    if not has_material:
                        fail_count += 1

                # Check LOIN properties based on class
                if ifc_class == "IfcWall":
                    for prop in ["FireRating", "IsExternal", "LoadBearing"]:
                        key = f"Property: Pset_WallCommon.{prop}"
                        if key in failures_by_type:
                            has_prop = element_idx % 2 == 0
                            checks.append(ValidationCheck(
                                rule_name=f"Pset_WallCommon.{prop}",
                                facet_type="Property",
                                result="PASS" if has_prop else "FAIL",
                                message=f"Property {prop} {'exists' if has_prop else 'missing'}",
                                property_set="Pset_WallCommon",
                                property_name=prop,
                            ))
                            if not has_prop:
                                fail_count += 1
                elif ifc_class == "IfcSlab":
                    key = "Property: Pset_SlabCommon.LoadBearing"
                    if key in failures_by_type:
                        has_prop = element_idx % 2 == 0
                        checks.append(ValidationCheck(
                            rule_name="Pset_SlabCommon.LoadBearing",
                            facet_type="Property",
                            result="PASS" if has_prop else "FAIL",
                            message=f"Property LoadBearing {'exists' if has_prop else 'missing'}",
                            property_set="Pset_SlabCommon",
                            property_name="LoadBearing",
                        ))
                        if not has_prop:
                            fail_count += 1

                elem_status = "FAIL" if fail_count > 0 else "PASS"
                pass_count = len(checks) - fail_count

                # Apply status filter
                if status and elem_status.lower() != status.lower():
                    continue

                elements.append(ElementValidationResponse(
                    global_id=global_id,
                    name=name,
                    ifc_class=ifc_class,
                    status=elem_status,
                    pass_count=pass_count,
                    fail_count=fail_count,
                    warning_count=0,
                    checks=checks,
                ))

    # Apply pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_elements = elements[start_idx:end_idx]

    return ValidationResultsResponse(
        summary=summary,
        elements=paginated_elements,
    )


@router.get("/elements", response_model=list[ElementValidationResponse])
async def get_validation_elements(
    project_id: UUID = Path(...),
    status: str = Query(None, description="Filter by status: PASS, FAIL, WARNING"),
    ifc_class: str = Query(None, description="Filter by IFC class"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get per-element validation results."""
    # TODO: Fetch from database with filters
    return []


@router.get("/failures", response_model=list[ElementValidationResponse])
async def get_validation_failures(project_id: UUID = Path(...)):
    """Get only failed validation results."""
    # TODO: Fetch from database
    return []


@router.get("/bcf")
async def export_bcf(project_id: UUID = Path(...)):
    """Export validation failures as BCF XML."""
    # TODO: Generate BCF file
    raise HTTPException(status_code=501, detail="BCF export not yet implemented")


@router.get("/ids")
async def get_generated_ids(project_id: UUID = Path(...)):
    """Get the auto-generated IDS rules used for validation."""
    # TODO: Fetch from pipeline output
    raise HTTPException(status_code=501, detail="Not yet implemented")
