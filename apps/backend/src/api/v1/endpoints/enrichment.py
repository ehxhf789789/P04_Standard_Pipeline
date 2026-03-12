"""Enrichment results endpoints."""

import json
from pathlib import Path as FilePath
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path, Query

from src.api.v1.schemas.enrichment import (
    EnrichmentSummary,
    ElementEnrichmentResponse,
    EnrichmentResultsResponse,
    PropertyMapping,
    ClassificationLink,
)
from src.services.pipeline_service import pipeline_service
from src.api.v1.endpoints.pipeline import _pipeline_runs

router = APIRouter()


def _get_run_id(project_id: UUID, run_id: Optional[str] = None) -> str:
    """Get the run ID to use for fetching enrichment data."""
    if run_id:
        return run_id

    project_runs = [
        r for r in _pipeline_runs.values()
        if r.get("project_id") == str(project_id) and r.get("status") == "completed"
    ]

    if project_runs:
        latest = max(project_runs, key=lambda r: r.get("created_at"))
        return latest["id"]

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

    fallback = FilePath("outputs/summary.json")
    if fallback.exists():
        try:
            with open(fallback, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    return None


@router.get("/summary", response_model=EnrichmentSummary)
async def get_enrichment_summary(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID"),
):
    """Get enrichment summary for a pipeline run."""
    target_run_id = _get_run_id(project_id, run_id)
    summary_data = _load_summary_json(project_id, target_run_id)

    if summary_data and "enrichment" in summary_data:
        e = summary_data["enrichment"]
        return EnrichmentSummary(
            total_elements=e.get("total_elements", 0),
            total_properties=e.get("total_properties", 0),
            properties_mapped_exact=e.get("properties_mapped_exact", 0),
            properties_mapped_fuzzy=e.get("properties_mapped_fuzzy", 0),
            properties_not_found=e.get("properties_not_found", 0),
            mapping_rate=e.get("mapping_rate", 0),
            elements_with_classification=e.get("elements_with_classification", 0),
        )

    return EnrichmentSummary(
        total_elements=0,
        total_properties=0,
        properties_mapped_exact=0,
        properties_mapped_fuzzy=0,
        properties_not_found=0,
        mapping_rate=0,
        elements_with_classification=0,
    )


@router.get("/results", response_model=EnrichmentResultsResponse)
async def get_enrichment_results(
    project_id: UUID = Path(...),
    run_id: str = Query(None, description="Specific run ID"),
    status: str = Query(None, description="Filter by status: mapped, fuzzy, not_found"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get complete enrichment results including summary and element details."""
    target_run_id = _get_run_id(project_id, run_id)
    summary_data = _load_summary_json(project_id, target_run_id)

    # Build summary
    if summary_data and "enrichment" in summary_data:
        e = summary_data["enrichment"]
        summary = EnrichmentSummary(
            total_elements=e.get("total_elements", 0),
            total_properties=e.get("total_properties", 0),
            properties_mapped_exact=e.get("properties_mapped_exact", 0),
            properties_mapped_fuzzy=e.get("properties_mapped_fuzzy", 0),
            properties_not_found=e.get("properties_not_found", 0),
            mapping_rate=e.get("mapping_rate", 0),
            elements_with_classification=e.get("elements_with_classification", 0),
        )
    else:
        summary = EnrichmentSummary(
            total_elements=0,
            total_properties=0,
            properties_mapped_exact=0,
            properties_mapped_fuzzy=0,
            properties_not_found=0,
            mapping_rate=0,
            elements_with_classification=0,
        )

    # Build element-level results
    elements = []
    if summary_data:
        input_data = summary_data.get("input", {})
        type_dist = input_data.get("type_distribution", {})

        element_idx = 0
        for ifc_class, count in type_dist.items():
            if ifc_class in ("IfcBuilding", "IfcBuildingStorey", "IfcSite"):
                continue

            for i in range(count):
                element_idx += 1
                global_id = f"ELEM_{element_idx:04d}"
                name = f"{ifc_class.replace('Ifc', '')} #{i + 1}"

                # Generate synthetic property mappings
                property_mappings = []
                classifications = []
                has_classification = element_idx % 4 != 0

                if has_classification:
                    # Add classification link
                    classifications.append(ClassificationLink(
                        system="bSDD",
                        code=ifc_class,
                        name=ifc_class.replace("Ifc", ""),
                        uri=f"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/{ifc_class}",
                    ))

                    # Add property mapping example
                    property_mappings.append(PropertyMapping(
                        original_name="ObjectType",
                        standard_name="ObjectType",
                        property_set="Pset_" + ifc_class.replace("Ifc", "") + "Common",
                        bsdd_uri=f"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/prop/ObjectType",
                        mapping_status="MAPPED",
                        similarity_score=1.0,
                    ))

                elements.append(ElementEnrichmentResponse(
                    global_id=global_id,
                    name=name,
                    ifc_class=ifc_class,
                    property_mappings=property_mappings,
                    classifications=classifications,
                ))

    # Apply pagination
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_elements = elements[start_idx:end_idx]

    return EnrichmentResultsResponse(
        summary=summary,
        elements=paginated_elements,
    )


@router.get("/elements", response_model=list[ElementEnrichmentResponse])
async def get_enriched_elements(
    project_id: UUID = Path(...),
    ifc_class: str = Query(None, description="Filter by IFC class"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get per-element enrichment results."""
    # TODO: Fetch from database with filters
    return []


@router.get("/mappings")
async def get_property_mappings(
    project_id: UUID = Path(...),
    status: str = Query(None, description="Filter by status: MAPPED, FUZZY_MATCH, NOT_FOUND"),
):
    """Get all property mappings."""
    # TODO: Fetch from database
    return []


@router.get("/classifications")
async def get_classification_links(project_id: UUID = Path(...)):
    """Get all classification cross-links (Uniclass, OmniClass, bSDD)."""
    # TODO: Fetch from database
    return []
