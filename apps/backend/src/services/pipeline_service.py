"""
Pipeline service layer.

Manages pipeline execution, state tracking, and result retrieval.

Integrates:
- Document parsers (IFC, PDF, DOCX, XLSX, PPTX, HWPX)
- Standards validation (IDS 1.0, LOIN)
- bSDD enrichment
- AI output generation (KG, Embeddings, Tabular, GNN)
"""

import json
import logging
import threading
import traceback
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import UUID, uuid4

from celery.result import AsyncResult

from src.config import get_settings
from src.workers.celery_app import celery_app
from src.workers.tasks.pipeline_tasks import run_pipeline_task

settings = get_settings()
logger = logging.getLogger(__name__)

# Add pipeline module to path
import sys
pipeline_path = Path(__file__).parent.parent.parent.parent.parent / "pipeline"
if str(pipeline_path.parent) not in sys.path:
    sys.path.insert(0, str(pipeline_path.parent))


class PipelineService:
    """Service for managing pipeline execution."""

    def __init__(self):
        # Resolve paths relative to the backend directory
        backend_dir = Path(__file__).parent.parent.parent
        self.data_path = (backend_dir / settings.pipeline_data_path).resolve()
        self.output_base_path = (backend_dir / settings.pipeline_output_path).resolve()
        self._sync_runs: dict[str, dict] = {}  # For development without Celery

        # Ensure output directory exists
        self.output_base_path.mkdir(parents=True, exist_ok=True)

        print(f"Pipeline data path: {self.data_path}")
        print(f"Pipeline output path: {self.output_base_path}")

    def start_pipeline(
        self,
        project_id: UUID,
        ifc_file_path: str,
        loin_config_id: Optional[UUID] = None,
    ) -> dict:
        """
        Start a new pipeline run.

        Args:
            project_id: ID of the project
            ifc_file_path: Path to the uploaded IFC file
            loin_config_id: Optional LOIN configuration ID

        Returns:
            Dictionary with run_id and task_id
        """
        run_id = str(uuid4())

        # Create output directory for this run
        output_dir = self.output_base_path / str(project_id) / run_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # Determine LOIN config path
        loin_config_path = None
        if loin_config_id:
            # TODO: Load from database
            pass
        else:
            # Use default LOIN config
            default_loin = self.data_path / "loin_requirements.json"
            if default_loin.exists():
                loin_config_path = str(default_loin)

        # Store run info in memory for sync mode
        self._sync_runs[run_id] = {
            "status": "pending",
            "project_id": str(project_id),
            "ifc_file_path": ifc_file_path,
            "output_dir": str(output_dir),
            "loin_config_path": loin_config_path,
            "start_time": datetime.now(),
        }

        # Start pipeline execution in background thread
        thread = threading.Thread(
            target=self._run_pipeline_sync,
            args=(run_id,),
            daemon=True
        )
        thread.start()

        return {
            "run_id": run_id,
            "task_id": run_id,
            "status": "pending",
            "output_dir": str(output_dir),
        }

    def _run_pipeline_sync(self, run_id: str):
        """
        Execute pipeline stages synchronously in background thread.

        This is for development mode without Celery/Redis.
        """
        run_info = self._sync_runs.get(run_id)
        if not run_info:
            return

        ifc_file_path = run_info["ifc_file_path"]
        output_dir = run_info["output_dir"]
        loin_config_path = run_info.get("loin_config_path")

        try:
            run_info["status"] = "running"
            run_info["overall_progress"] = 0

            # Import pipeline modules
            from pipeline.parser import IFCParser
            from pipeline.validator import IDSValidator
            from pipeline.enricher import BSDDEnricher
            from pipeline.transformer import AITransformer
            from pipeline.packager import PipelinePackager

            # Stage 1: Parse
            self._update_stage(run_id, "parse", "running", 0, "IFC 파일 파싱 중...")
            parser = IFCParser(ifc_file_path)
            parsed_elements = parser.parse_all_elements()
            parser_stats = parser.get_statistics()
            parser_stats["file_path"] = ifc_file_path
            spatial_tree = parser.get_spatial_tree()
            self._update_stage(run_id, "parse", "completed", 100, f"{len(parsed_elements)} 요소 파싱 완료")
            run_info["overall_progress"] = 20

            if run_info.get("status") == "cancelled":
                return

            # Stage 2: Validate
            self._update_stage(run_id, "validate", "running", 0, "IDS 규칙으로 검증 중...")
            bsdd_kb_path = self.data_path / "bsdd_knowledge_base" / "classes.json"
            if bsdd_kb_path.exists():
                with open(bsdd_kb_path) as f:
                    bsdd_kb = json.load(f)
            else:
                bsdd_kb = {}

            validator = IDSValidator(
                bsdd_kb,
                loin_config_path=loin_config_path
            )
            validations = validator.validate(parsed_elements)
            validation_summary = validator.get_summary(validations)
            bcf_issues = validator.generate_bcf_issues(validations)
            validation_summary["bcf_issues_count"] = len(bcf_issues)

            # Save IDS rules
            ids_xml = validator.generate_ids_xml()
            ids_output_path = Path(output_dir) / "generated_rules.ids"
            with open(ids_output_path, 'w', encoding='utf-8') as f:
                f.write(ids_xml)

            self._update_stage(run_id, "validate", "completed", 100,
                f"{validation_summary['elements_passed']}/{validation_summary['total_elements']} 검증 통과")
            run_info["overall_progress"] = 40

            if run_info.get("status") == "cancelled":
                return

            # Stage 3: Enrich
            self._update_stage(run_id, "enrich", "running", 0, "bSDD 표준화 적용 중...")
            classes_path = self.data_path / "bsdd_knowledge_base" / "classes.json"
            classification_map_path = self.data_path / "bsdd_knowledge_base" / "classification_map.json"

            enricher = BSDDEnricher(
                str(classes_path),
                str(classification_map_path)
            )
            enriched_elements = enricher.enrich_all(parsed_elements)
            enrichment_summary = enricher.get_enrichment_summary(enriched_elements)
            self._update_stage(run_id, "enrich", "completed", 100,
                f"{enrichment_summary['overall_mapping_rate']}% 속성 매핑됨")
            run_info["overall_progress"] = 60

            if run_info.get("status") == "cancelled":
                return

            # Stage 4: Transform
            self._update_stage(run_id, "transform", "running", 0, "AI 형식으로 변환 중...")
            transformer = AITransformer(enriched_elements, parsed_elements, spatial_tree)
            transform_result = transformer.transform_all(output_dir)
            self._update_stage(run_id, "transform", "completed", 100, "4가지 AI 형식 생성 완료")
            run_info["overall_progress"] = 80

            if run_info.get("status") == "cancelled":
                return

            # Stage 5: Package
            self._update_stage(run_id, "package", "running", 0, "결과 패키징 중...")
            packager = PipelinePackager()
            summary = packager.package(
                parser_stats=parser_stats,
                validation_summary=validation_summary,
                enrichment_summary=enrichment_summary,
                transformation_stats=transform_result.statistics,
                output_dir=output_dir
            )
            self._update_stage(run_id, "package", "completed", 100, "패키징 완료")
            run_info["overall_progress"] = 100

            # Mark as completed
            run_info["status"] = "completed"
            run_info["result"] = {
                "summary": packager.get_summary_dict(summary),
                "execution_time_seconds": summary.execution_time_seconds,
            }

            # Update project status
            self._update_project_status(run_info["project_id"], "completed")

        except Exception as e:
            run_info["status"] = "failed"
            run_info["error"] = str(e)
            run_info["message"] = f"파이프라인 실행 실패: {str(e)}"
            print(f"Pipeline error: {e}")
            traceback.print_exc()

            # Update project status
            self._update_project_status(run_info["project_id"], "failed")

    def _update_project_status(self, project_id: str, status: str):
        """Update project's latest_run_status."""
        try:
            from src.api.v1.endpoints.projects import _projects, _save_projects_metadata
            from uuid import UUID

            pid = UUID(project_id)
            if pid in _projects:
                _projects[pid]["latest_run_status"] = status
                _save_projects_metadata()
                print(f"[Pipeline] Updated project {project_id[:8]} status to: {status}")
        except Exception as e:
            print(f"Failed to update project status: {e}")

    def _update_stage(self, run_id: str, stage: str, status: str, progress: int, message: str):
        """Update stage progress for a sync run."""
        run_info = self._sync_runs.get(run_id)
        if run_info:
            run_info["current_stage"] = stage
            run_info["stage_status"] = status
            run_info["stage_progress"] = progress
            run_info["message"] = message
            print(f"[Pipeline {run_id[:8]}] {stage}: {message}")

    def get_pipeline_status(self, run_id: str) -> dict:
        """
        Get the current status of a pipeline run.

        Args:
            run_id: The pipeline run ID (same as task_id)

        Returns:
            Status dictionary with progress information
        """
        # Check for sync mode first (development without Celery)
        if run_id in self._sync_runs:
            run_info = self._sync_runs[run_id]
            return {
                "run_id": run_id,
                "status": run_info.get("status", "pending"),
                "current_stage": run_info.get("current_stage"),
                "stage_status": run_info.get("stage_status"),
                "stage_progress": run_info.get("stage_progress", 0),
                "overall_progress": run_info.get("overall_progress", 0),
                "message": run_info.get("message"),
            }

        # Try Celery (production mode) - but may fail without Redis
        try:
            result = AsyncResult(run_id, app=celery_app)

            status = {
                "run_id": run_id,
                "celery_state": result.state,
                "status": self._map_celery_state(result.state),
            }

            if result.state == "PROGRESS":
                info = result.info or {}
                status.update({
                    "current_stage": info.get("stage"),
                    "stage_status": info.get("stage_status"),
                    "stage_progress": info.get("stage_progress", 0),
                    "overall_progress": info.get("overall_progress", 0),
                    "message": info.get("message"),
                    "timestamp": info.get("timestamp"),
                })

            elif result.state == "SUCCESS":
                info = result.result or {}
                status.update({
                    "status": info.get("status", "completed"),
                    "execution_time": info.get("execution_time_seconds"),
                    "result": info,
                })

            elif result.state == "FAILURE":
                status.update({
                    "status": "failed",
                    "error": str(result.result) if result.result else "Unknown error",
                })

            return status
        except Exception:
            return {"run_id": run_id, "status": "unknown"}

    def cancel_pipeline(self, run_id: str) -> bool:
        """
        Cancel a running pipeline.

        Args:
            run_id: The pipeline run ID

        Returns:
            True if cancellation was successful
        """
        # Check sync mode first
        if run_id in self._sync_runs:
            self._sync_runs[run_id]["status"] = "cancelled"
            return True

        # Try Celery
        try:
            result = AsyncResult(run_id, app=celery_app)
            if result.state in ("PENDING", "STARTED", "PROGRESS"):
                result.revoke(terminate=True)
                return True
        except Exception:
            pass

        return False

    def get_pipeline_result(self, run_id: str) -> Optional[dict]:
        """
        Get the final result of a completed pipeline.

        Args:
            run_id: The pipeline run ID

        Returns:
            Result dictionary or None if not completed
        """
        # Check sync mode first
        if run_id in self._sync_runs:
            run_info = self._sync_runs[run_id]
            if run_info.get("status") == "completed":
                return run_info.get("result")
            return None

        # Try Celery
        try:
            result = AsyncResult(run_id, app=celery_app)
            if result.state == "SUCCESS":
                return result.result
        except Exception:
            pass

        return None

    def get_output_files(self, project_id: UUID, run_id: str) -> list[dict]:
        """
        List output files for a pipeline run.

        Args:
            project_id: The project ID
            run_id: The pipeline run ID

        Returns:
            List of output file information
        """
        output_dir = self.output_base_path / str(project_id) / run_id

        if not output_dir.exists():
            return []

        files = []
        for f in output_dir.iterdir():
            if f.is_file():
                files.append({
                    "name": f.name,
                    "path": str(f),
                    "size_kb": round(f.stat().st_size / 1024, 2),
                    "type": f.suffix[1:] if f.suffix else "unknown",
                    "modified_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                })

        return files

    def get_output_file_path(
        self, project_id: UUID, run_id: str, filename: str
    ) -> Optional[Path]:
        """
        Get the path to a specific output file.

        Args:
            project_id: The project ID
            run_id: The pipeline run ID
            filename: The output filename

        Returns:
            Path to the file or None if not found
        """
        file_path = self.output_base_path / str(project_id) / run_id / filename

        if file_path.exists() and file_path.is_file():
            return file_path

        return None

    def load_summary(self, project_id: UUID, run_id: str) -> Optional[dict]:
        """
        Load the summary.json for a pipeline run.

        Args:
            project_id: The project ID
            run_id: The pipeline run ID

        Returns:
            Summary dictionary or None
        """
        summary_path = self.output_base_path / str(project_id) / run_id / "summary.json"

        if summary_path.exists():
            with open(summary_path, encoding="utf-8") as f:
                return json.load(f)

        return None

    def load_knowledge_graph(self, project_id: UUID, run_id: str) -> Optional[dict]:
        """
        Load the knowledge graph data for a pipeline run.

        Args:
            project_id: The project ID
            run_id: The pipeline run ID

        Returns:
            Knowledge graph data or None
        """
        # Try to load from graph_structure.json (GNN format has node/edge info)
        graph_path = self.output_base_path / str(project_id) / run_id / "graph_structure.json"

        if graph_path.exists():
            with open(graph_path, encoding="utf-8") as f:
                return json.load(f)

        return None

    def _map_celery_state(self, state: str) -> str:
        """Map Celery state to pipeline status."""
        mapping = {
            "PENDING": "pending",
            "STARTED": "running",
            "PROGRESS": "running",
            "SUCCESS": "completed",
            "FAILURE": "failed",
            "REVOKED": "cancelled",
            "RETRY": "running",
        }
        return mapping.get(state, "unknown")


# Singleton instance
pipeline_service = PipelineService()
