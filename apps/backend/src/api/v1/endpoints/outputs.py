"""Output files endpoints."""

import json
from pathlib import Path
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Path as PathParam, Query
from fastapi.responses import FileResponse, StreamingResponse

from src.api.v1.schemas.outputs import (
    OutputFilesResponse,
    OutputFile,
    KnowledgeGraphData,
    GraphNode,
    GraphEdge,
    EmbeddingData,
    EmbeddingVector,
    TabularPreview,
    GNNStructure,
)
from src.services.pipeline_service import pipeline_service
from src.api.v1.endpoints.pipeline import _pipeline_runs

router = APIRouter()


def _get_run_id(project_id: UUID, run_id: Optional[str] = None) -> str:
    """Get the run ID to use for fetching outputs."""
    if run_id:
        return run_id

    # Find the latest completed run for this project from _pipeline_runs
    project_runs = [
        r for r in _pipeline_runs.values()
        if r.get("project_id") == str(project_id) and r.get("status") == "completed"
    ]

    if project_runs:
        latest = max(project_runs, key=lambda r: r.get("created_at"))
        return latest["id"]

    # Fallback: check pipeline service for any runs
    pid_str = str(project_id)
    for rid, info in pipeline_service._sync_runs.items():
        if info.get("project_id") == pid_str and info.get("status") == "completed":
            return rid

    # Fallback: scan output directory for project's runs
    output_dir = pipeline_service.output_base_path / str(project_id)
    if output_dir.exists():
        # Get latest run directory by modification time
        run_dirs = [d for d in output_dir.iterdir() if d.is_dir() and (d / "summary.json").exists()]
        if run_dirs:
            latest_dir = max(run_dirs, key=lambda d: d.stat().st_mtime)
            return latest_dir.name

    return "demo"


@router.get("", response_model=OutputFilesResponse)
async def list_outputs(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None, description="Specific pipeline run ID"),
):
    """List all output files for a pipeline run."""
    target_run_id = _get_run_id(project_id, run_id)

    files = pipeline_service.get_output_files(project_id, target_run_id)

    if not files:
        # Return demo data from root outputs
        demo_outputs = Path("outputs")
        if demo_outputs.exists():
            for f in demo_outputs.iterdir():
                if f.is_file():
                    files.append({
                        "name": f.name,
                        "path": str(f),
                        "size_kb": round(f.stat().st_size / 1024, 2),
                        "type": f.suffix[1:] if f.suffix else "unknown",
                    })

    if not files:
        return OutputFilesResponse(files=[], total_size_kb=0)

    output_files = []
    for i, f in enumerate(files):
        file_type = _infer_file_type(f["name"])
        mime_type = _get_mime_type(f.get("type", ""))

        output_files.append(OutputFile(
            id=UUID(int=i + 1),
            file_type=file_type,
            filename=f["name"],
            size_kb=f["size_kb"],
            mime_type=mime_type,
            download_url=f"/api/v1/projects/{project_id}/outputs/download/{f['name']}",
        ))

    total_size = sum(f["size_kb"] for f in files)
    return OutputFilesResponse(files=output_files, total_size_kb=round(total_size, 2))


@router.get("/knowledge-graph", response_model=KnowledgeGraphData)
async def get_knowledge_graph(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None),
):
    """Get knowledge graph data for visualization."""
    target_run_id = _get_run_id(project_id, run_id)

    graph_data = pipeline_service.load_knowledge_graph(project_id, target_run_id)

    if not graph_data:
        # Try loading from root outputs
        graph_path = Path("outputs/graph_structure.json")
        if graph_path.exists():
            with open(graph_path, encoding="utf-8") as f:
                graph_data = json.load(f)

    if graph_data:
        nodes = []
        edges = []

        if "node_ids" in graph_data:
            for node_id in graph_data.get("node_ids", []):
                nodes.append(GraphNode(
                    id=node_id,
                    label=node_id,
                    type="element",
                    properties={},
                ))

            edge_index = graph_data.get("edge_index", [[], []])
            if len(edge_index) == 2:
                node_ids = graph_data.get("node_ids", [])
                for i in range(min(len(edge_index[0]), 200)):  # Limit edges
                    src_idx = edge_index[0][i]
                    tgt_idx = edge_index[1][i]
                    if src_idx < len(node_ids) and tgt_idx < len(node_ids):
                        edges.append(GraphEdge(
                            source=node_ids[src_idx],
                            target=node_ids[tgt_idx],
                            type="related_to",
                        ))

        return KnowledgeGraphData(
            nodes=nodes,
            edges=edges,
            statistics={"nodes": len(nodes), "edges": len(edges)},
        )

    return KnowledgeGraphData(nodes=[], edges=[], statistics={"nodes": 0, "edges": 0})


@router.get("/embeddings", response_model=EmbeddingData)
async def get_embeddings(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None),
    include_vectors: bool = Query(False),
):
    """Get embedding vectors data."""
    target_run_id = _get_run_id(project_id, run_id)

    embeddings_path = pipeline_service.get_output_file_path(
        project_id, target_run_id, "embeddings.npy"
    )
    csv_path = pipeline_service.get_output_file_path(
        project_id, target_run_id, "dataset.csv"
    )

    if not embeddings_path:
        embeddings_path = Path("outputs/embeddings.npy")
        if not embeddings_path.exists():
            embeddings_path = None

    if not csv_path:
        csv_path = Path("outputs/dataset.csv")
        if not csv_path.exists():
            csv_path = None

    # Load element metadata from CSV
    element_data = []
    if csv_path and csv_path.exists():
        try:
            import pandas as pd
            df = pd.read_csv(csv_path)
            for _, row in df.iterrows():
                element_data.append({
                    "id": row.get("GlobalId", ""),
                    "name": row.get("Name", ""),
                    "ifc_class": row.get("IFC_Class", "IfcBuildingElement"),
                })
        except Exception:
            pass

    if embeddings_path and embeddings_path.exists():
        try:
            import numpy as np
            embeddings = np.load(str(embeddings_path))
            count, dim = embeddings.shape

            vectors = []
            if include_vectors:
                for i in range(min(count, 50)):
                    # Use actual element data if available
                    if i < len(element_data):
                        elem = element_data[i]
                        vectors.append(EmbeddingVector(
                            element_id=elem["id"] or f"element_{i}",
                            element_name=elem["name"] or f"Element {i}",
                            ifc_class=elem["ifc_class"],
                            vector=embeddings[i].tolist(),
                        ))
                    else:
                        vectors.append(EmbeddingVector(
                            element_id=f"element_{i}",
                            element_name=f"Element {i}",
                            ifc_class="IfcBuildingElement",
                            vector=embeddings[i].tolist(),
                        ))

            return EmbeddingData(
                embeddings=vectors,
                dimension=int(dim),
                model_name="all-MiniLM-L6-v2",
            )
        except Exception:
            pass

    return EmbeddingData(embeddings=[], dimension=384, model_name="all-MiniLM-L6-v2")


@router.get("/tabular", response_model=TabularPreview)
async def get_tabular_preview(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    """Get tabular data preview."""
    target_run_id = _get_run_id(project_id, run_id)

    csv_path = pipeline_service.get_output_file_path(project_id, target_run_id, "dataset.csv")

    if not csv_path:
        csv_path = Path("outputs/dataset.csv")
        if not csv_path.exists():
            csv_path = None

    if csv_path and csv_path.exists():
        try:
            import pandas as pd
            df = pd.read_csv(csv_path, nrows=limit)
            return TabularPreview(
                columns=df.columns.tolist(),
                rows=df.to_dict(orient="records"),
                total_rows=len(df),
                total_columns=len(df.columns),
            )
        except Exception:
            pass

    return TabularPreview(columns=[], rows=[], total_rows=0, total_columns=0)


@router.get("/gnn-structure", response_model=GNNStructure)
async def get_gnn_structure(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None),
):
    """Get GNN graph structure data."""
    target_run_id = _get_run_id(project_id, run_id)

    graph_data = pipeline_service.load_knowledge_graph(project_id, target_run_id)

    if not graph_data:
        graph_path = Path("outputs/graph_structure.json")
        if graph_path.exists():
            with open(graph_path, encoding="utf-8") as f:
                graph_data = json.load(f)

    if graph_data:
        return GNNStructure(
            num_nodes=graph_data.get("num_nodes", 0),
            num_edges=graph_data.get("num_edges", 0),
            num_features=graph_data.get("num_features", 0),
            node_ids=graph_data.get("node_ids", []),
            edge_index=graph_data.get("edge_index", []),
            feature_names=graph_data.get("feature_names", []),
        )

    return GNNStructure(
        num_nodes=0, num_edges=0, num_features=0,
        node_ids=[], edge_index=[], feature_names=[],
    )


@router.get("/download/{filename}")
async def download_file(
    project_id: UUID = PathParam(...),
    filename: str = PathParam(...),
    run_id: str = Query(None),
):
    """Download a specific output file."""
    target_run_id = _get_run_id(project_id, run_id)

    file_path = pipeline_service.get_output_file_path(project_id, target_run_id, filename)

    if not file_path:
        fallback = Path("outputs") / filename
        if fallback.exists():
            file_path = fallback
        else:
            raise HTTPException(status_code=404, detail="File not found")

    mime_type = _get_mime_type(file_path.suffix[1:] if file_path.suffix else "")

    return FileResponse(path=str(file_path), filename=filename, media_type=mime_type)


@router.get("/download/all.zip")
async def download_all(
    project_id: UUID = PathParam(...),
    run_id: str = Query(None),
):
    """Download all outputs as a ZIP file."""
    import io
    import zipfile

    target_run_id = _get_run_id(project_id, run_id)

    files = pipeline_service.get_output_files(project_id, target_run_id)

    if not files:
        outputs_dir = Path("outputs")
        if outputs_dir.exists():
            for f in outputs_dir.iterdir():
                if f.is_file():
                    files.append({"name": f.name, "path": str(f)})

    if not files:
        raise HTTPException(status_code=404, detail="No output files found")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            fp = Path(f["path"])
            if fp.exists():
                zf.write(fp, f["name"])

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=bim_outputs_{target_run_id}.zip"},
    )


def _infer_file_type(filename: str) -> str:
    name = filename.lower()
    if "knowledge_graph" in name or name.endswith(".html"):
        return "knowledge_graph"
    if "embedding" in name or name.endswith(".npy"):
        return "embeddings"
    if name.endswith(".csv"):
        return "tabular_csv"
    if name.endswith(".parquet"):
        return "tabular_parquet"
    if "graph_structure" in name:
        return "gnn_structure"
    if name == "summary.json":
        return "summary"
    if name == "report.md":
        return "report"
    if name.endswith(".ids"):
        return "ids_rules"
    return "other"


def _get_mime_type(ext: str) -> str:
    return {
        "html": "text/html",
        "json": "application/json",
        "csv": "text/csv",
        "parquet": "application/octet-stream",
        "npy": "application/octet-stream",
        "md": "text/markdown",
        "ids": "application/xml",
    }.get(ext, "application/octet-stream")
