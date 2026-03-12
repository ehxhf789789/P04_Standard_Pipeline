"""
Pipeline execution tasks.

Wraps the existing 5-stage pipeline for async execution via Celery.
"""

import json
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from celery import shared_task
from celery.utils.log import get_task_logger

# Add pipeline to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent.parent.parent))

logger = get_task_logger(__name__)


class PipelineProgress:
    """Helper class to track and report pipeline progress."""

    def __init__(self, task, run_id: str, project_id: str):
        self.task = task
        self.run_id = run_id
        self.project_id = project_id
        self.stages = ["parse", "validate", "enrich", "transform", "package"]
        self.current_stage_idx = 0
        self.stage_results = {}

    def start_stage(self, stage: str):
        """Mark a stage as started."""
        self.current_stage_idx = self.stages.index(stage)
        self._update_state(
            stage=stage,
            stage_status="running",
            message=f"Starting {stage} stage...",
        )

    def update_progress(self, stage: str, step: int, total: int, message: str):
        """Update progress within a stage."""
        stage_progress = int((step / total) * 100) if total > 0 else 0
        overall_progress = int(
            (self.current_stage_idx * 20) + (stage_progress * 0.2)
        )
        self._update_state(
            stage=stage,
            stage_status="running",
            stage_progress=stage_progress,
            overall_progress=overall_progress,
            message=message,
        )

    def complete_stage(self, stage: str, summary: dict):
        """Mark a stage as completed."""
        self.stage_results[stage] = summary
        overall_progress = (self.current_stage_idx + 1) * 20
        self._update_state(
            stage=stage,
            stage_status="completed",
            stage_progress=100,
            overall_progress=overall_progress,
            message=f"Stage {stage} completed",
            stage_summary=summary,
        )

    def fail_stage(self, stage: str, error: str):
        """Mark a stage as failed."""
        self._update_state(
            stage=stage,
            stage_status="failed",
            message=f"Stage {stage} failed: {error}",
            error=error,
        )

    def _update_state(self, **kwargs):
        """Update Celery task state."""
        self.task.update_state(
            state="PROGRESS",
            meta={
                "run_id": self.run_id,
                "project_id": self.project_id,
                "timestamp": datetime.utcnow().isoformat(),
                **kwargs,
            },
        )


@shared_task(bind=True, name="run_pipeline")
def run_pipeline_task(
    self,
    run_id: str,
    project_id: str,
    ifc_file_path: str,
    output_dir: str,
    loin_config_path: str = None,
) -> dict:
    """
    Execute the full 5-stage BIM-to-AI pipeline.

    Args:
        run_id: Unique ID for this pipeline run
        project_id: ID of the project
        ifc_file_path: Path to the IFC file
        output_dir: Directory for output files
        loin_config_path: Optional path to LOIN configuration

    Returns:
        Pipeline summary dictionary
    """
    from pipeline.parser import IFCParser
    from pipeline.validator import IDSValidator
    from pipeline.enricher import BSDDEnricher
    from pipeline.transformer import AITransformer
    from pipeline.packager import PipelinePackager

    progress = PipelineProgress(self, run_id, project_id)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    try:
        # Initialize packager (tracks timing)
        packager = PipelinePackager()

        # ========== Stage 1: Parse ==========
        progress.start_stage("parse")
        logger.info(f"[{run_id}] Stage 1: Parsing IFC file...")

        parser = IFCParser(ifc_file_path)
        progress.update_progress("parse", 1, 3, "Loading IFC file...")

        parsed_elements = parser.parse_all_elements()
        progress.update_progress("parse", 2, 3, f"Parsed {len(parsed_elements)} elements")

        parser_stats = parser.get_statistics()
        parser_stats["file_path"] = ifc_file_path
        spatial_tree = parser.get_spatial_tree()
        progress.update_progress("parse", 3, 3, "Extracting spatial tree...")

        progress.complete_stage("parse", {
            "total_elements": len(parsed_elements),
            "building_elements": parser_stats.get("building_elements", 0),
            "schema": parser_stats.get("schema", "IFC4"),
        })

        # ========== Stage 2: Validate ==========
        progress.start_stage("validate")
        logger.info(f"[{run_id}] Stage 2: Validating against IDS rules...")

        # Load bSDD knowledge base
        kb_path = Path("data/bsdd_knowledge_base/classes.json")
        with open(kb_path, encoding="utf-8") as f:
            bsdd_kb = json.load(f)
        progress.update_progress("validate", 1, 3, "Loaded bSDD knowledge base")

        # Initialize validator with LOIN config
        loin_path = loin_config_path or "data/loin_requirements.json"
        validator = IDSValidator(bsdd_kb, loin_config_path=loin_path)
        progress.update_progress("validate", 2, 3, "Running validation checks...")

        validations = validator.validate(parsed_elements)
        validation_summary = validator.get_summary(validations)
        bcf_issues = validator.generate_bcf_issues(validations)
        validation_summary["bcf_issues_count"] = len(bcf_issues)
        progress.update_progress("validate", 3, 3, "Generating IDS rules...")

        # Save generated IDS rules
        ids_xml = validator.generate_ids_xml()
        ids_output_path = output_path / "generated_rules.ids"
        with open(ids_output_path, "w", encoding="utf-8") as f:
            f.write(ids_xml)

        progress.complete_stage("validate", {
            "elements_passed": validation_summary["elements_passed"],
            "elements_failed": validation_summary["elements_failed"],
            "pass_rate": validation_summary["element_pass_rate"],
            "bcf_issues": len(bcf_issues),
        })

        # ========== Stage 3: Enrich ==========
        progress.start_stage("enrich")
        logger.info(f"[{run_id}] Stage 3: Enriching with bSDD standardization...")

        enricher = BSDDEnricher(
            "data/bsdd_knowledge_base/classes.json",
            "data/bsdd_knowledge_base/classification_map.json",
        )
        progress.update_progress("enrich", 1, 2, "Mapping properties to bSDD...")

        enriched_elements = enricher.enrich_all(parsed_elements)
        enrichment_summary = enricher.get_enrichment_summary(enriched_elements)
        progress.update_progress("enrich", 2, 2, "Cross-linking classifications...")

        progress.complete_stage("enrich", {
            "total_properties": enrichment_summary["total_properties"],
            "mapped": enrichment_summary["properties_mapped_exact"],
            "mapping_rate": enrichment_summary["overall_mapping_rate"],
        })

        # ========== Stage 4: Transform ==========
        progress.start_stage("transform")
        logger.info(f"[{run_id}] Stage 4: Transforming to AI formats...")

        transformer = AITransformer(enriched_elements, parsed_elements, spatial_tree)

        progress.update_progress("transform", 1, 4, "Building Knowledge Graph...")
        transformer.to_knowledge_graph(str(output_path))

        progress.update_progress("transform", 2, 4, "Generating Vector Embeddings...")
        transformer.to_vector_embeddings(str(output_path))

        progress.update_progress("transform", 3, 4, "Creating Tabular Dataset...")
        transformer.to_tabular(str(output_path))

        progress.update_progress("transform", 4, 4, "Building GNN Graph Structure...")
        transform_result = transformer.transform_all(str(output_path))

        progress.complete_stage("transform", {
            "kg_nodes": transform_result.statistics.get("kg_nodes", 0),
            "kg_edges": transform_result.statistics.get("kg_edges", 0),
            "embedding_count": transform_result.statistics.get("embedding_count", 0),
            "embedding_dim": transform_result.statistics.get("embedding_dim", 384),
        })

        # ========== Stage 5: Package ==========
        progress.start_stage("package")
        logger.info(f"[{run_id}] Stage 5: Packaging results...")

        progress.update_progress("package", 1, 2, "Generating summary...")

        summary = packager.package(
            parser_stats=parser_stats,
            validation_summary=validation_summary,
            enrichment_summary=enrichment_summary,
            transformation_stats=transform_result.statistics,
            output_dir=str(output_path),
        )

        progress.update_progress("package", 2, 2, "Writing report...")

        progress.complete_stage("package", {
            "execution_time": summary.execution_time_seconds,
            "output_files": len(summary.output_files),
        })

        # Final result
        result = {
            "status": "completed",
            "run_id": run_id,
            "project_id": project_id,
            "execution_time_seconds": summary.execution_time_seconds,
            "input": {
                "file_name": summary.input.file_name,
                "total_elements": summary.input.total_elements,
                "building_elements": summary.input.building_elements,
            },
            "validation": {
                "pass_rate": summary.validation.element_pass_rate,
                "bcf_issues": summary.validation.bcf_issues_count,
            },
            "enrichment": {
                "mapping_rate": summary.enrichment.mapping_rate,
            },
            "transformation": {
                "kg_nodes": summary.transformation.knowledge_graph_nodes,
                "kg_edges": summary.transformation.knowledge_graph_edges,
                "embedding_count": summary.transformation.embedding_count,
            },
            "output_files": [f["name"] for f in summary.output_files],
        }

        logger.info(f"[{run_id}] Pipeline completed successfully")
        return result

    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        logger.error(f"[{run_id}] Pipeline failed: {error_msg}\n{error_trace}")

        progress.fail_stage(
            progress.stages[progress.current_stage_idx],
            error_msg,
        )

        return {
            "status": "failed",
            "run_id": run_id,
            "project_id": project_id,
            "error": error_msg,
            "traceback": error_trace,
        }


@shared_task(name="run_single_stage")
def run_single_stage_task(
    stage: str,
    run_id: str,
    project_id: str,
    input_data: dict,
) -> dict:
    """
    Run a single pipeline stage (for debugging/testing).

    Args:
        stage: Stage name (parse, validate, enrich, transform, package)
        run_id: Unique ID for this run
        project_id: ID of the project
        input_data: Stage-specific input data

    Returns:
        Stage result dictionary
    """
    # Implementation for individual stage execution
    raise NotImplementedError("Single stage execution not yet implemented")
