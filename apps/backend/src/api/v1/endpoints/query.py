"""Query & Search endpoint - search across parsed documents."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.services.document_service import search_documents

router = APIRouter()


def _get_upload_dir():
    from src.api.v1.endpoints.files import UPLOAD_DIR
    return UPLOAD_DIR


def _get_files():
    from src.api.v1.endpoints.files import _files
    return _files


class SearchRequest(BaseModel):
    query: str
    project_id: Optional[str] = None
    lifecycle_phase: Optional[str] = None


class SearchResult(BaseModel):
    file_id: str
    filename: str
    lifecycle_phase: str
    score: float
    snippets: list[str]
    keywords: list[str]
    tables_count: int
    standards_applied: list[dict]


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str


class StatsResponse(BaseModel):
    total_documents: int
    processed_documents: int
    total_tables: int
    total_keywords: int
    by_phase: dict
    by_status: dict
    by_category: dict


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Search across all parsed documents."""
    results = search_documents(
        upload_dir=str(_get_upload_dir()),
        query=request.query,
        project_id=request.project_id,
    )

    # Filter by lifecycle phase if specified
    if request.lifecycle_phase:
        results = [r for r in results if r.get("lifecycle_phase") == request.lifecycle_phase]

    return SearchResponse(
        results=[SearchResult(**r) for r in results],
        total=len(results),
        query=request.query,
    )


@router.get("/ai-data/keywords")
async def get_all_keywords():
    """Get aggregated keywords across all documents (for embeddings view)."""
    from src.services.document_service import get_parsed_data
    files_data = _get_files()
    all_keywords: dict[str, int] = {}
    doc_sources: list[dict] = []

    for fdata in files_data.values():
        if fdata.get("ai_status") != "completed":
            continue
        file_path = fdata.get("file_path")
        if not file_path:
            continue
        parsed = get_parsed_data(file_path)
        if not parsed:
            continue
        for kw in parsed.get("keywords", []):
            word = kw["word"] if isinstance(kw, dict) else kw
            count = kw["count"] if isinstance(kw, dict) else 1
            all_keywords[word] = all_keywords.get(word, 0) + count
        doc_sources.append({
            "file_id": str(fdata.get("id", "")),
            "filename": fdata.get("original_filename", ""),
            "phase": fdata.get("lifecycle_phase", ""),
            "word_count": parsed.get("statistics", {}).get("word_count", 0),
            "keyword_count": len(parsed.get("keywords", [])),
        })

    sorted_kw = sorted(all_keywords.items(), key=lambda x: x[1], reverse=True)
    return {
        "keywords": [{"word": w, "count": c} for w, c in sorted_kw[:100]],
        "total_unique": len(all_keywords),
        "documents": doc_sources,
    }


@router.get("/ai-data/knowledge-graph")
async def get_knowledge_graph():
    """Get knowledge graph data (nodes and edges from parsed documents)."""
    from src.services.document_service import get_parsed_data
    files_data = _get_files()
    nodes: list[dict] = []
    edges: list[dict] = []
    node_ids: set[str] = set()

    for fdata in files_data.values():
        if fdata.get("ai_status") != "completed":
            continue
        file_path = fdata.get("file_path")
        if not file_path:
            continue
        parsed = get_parsed_data(file_path)
        if not parsed:
            continue

        fname = fdata.get("original_filename", "")
        fid = str(fdata.get("id", ""))

        # Document node
        if fid not in node_ids:
            nodes.append({"id": fid, "label": fname, "type": "document", "phase": fdata.get("lifecycle_phase", "")})
            node_ids.add(fid)

        # Keyword nodes + edges
        for kw in parsed.get("keywords", [])[:10]:
            word = kw["word"] if isinstance(kw, dict) else kw
            kw_id = f"kw_{word}"
            if kw_id not in node_ids:
                nodes.append({"id": kw_id, "label": word, "type": "keyword"})
                node_ids.add(kw_id)
            edges.append({"source": fid, "target": kw_id, "relation": "contains_keyword"})

        # bSDD mapping nodes
        for mapping in parsed.get("bsdd_mappings", []):
            cls = mapping.get("bsdd_class", "")
            cls_id = f"bsdd_{cls}"
            if cls_id not in node_ids:
                nodes.append({"id": cls_id, "label": cls, "type": "bsdd_class"})
                node_ids.add(cls_id)
            edges.append({"source": fid, "target": cls_id, "relation": "mapped_to"})

    return {"nodes": nodes, "edges": edges, "node_count": len(nodes), "edge_count": len(edges)}


@router.get("/ai-data/tabular")
async def get_tabular_data():
    """Get all extracted tables across documents."""
    from src.services.document_service import get_parsed_data
    files_data = _get_files()
    all_tables: list[dict] = []

    for fdata in files_data.values():
        if fdata.get("ai_status") != "completed":
            continue
        file_path = fdata.get("file_path")
        if not file_path:
            continue
        parsed = get_parsed_data(file_path)
        if not parsed:
            continue
        for table in parsed.get("tables", []):
            all_tables.append({
                "source": fdata.get("original_filename", ""),
                "phase": fdata.get("lifecycle_phase", ""),
                **table,
            })

    return {"tables": all_tables, "total": len(all_tables)}


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get real statistics across all processed documents."""
    files_data = _get_files()
    total_docs = len(files_data)
    processed = 0
    total_tables = 0
    total_keywords = 0
    by_phase = {}
    by_status = {}
    by_category = {}

    for fdata in files_data.values():
        phase = fdata.get("lifecycle_phase", "unassigned")
        by_phase[phase] = by_phase.get(phase, 0) + 1

        status = fdata.get("ai_status", "pending")
        by_status[status] = by_status.get(status, 0) + 1

        cat = fdata.get("category", "other")
        by_category[cat] = by_category.get(cat, 0) + 1

        if status == "completed":
            processed += 1
            # Try to load parsed data for stats
            from src.services.document_service import get_parsed_data
            file_path = fdata.get("file_path")
            if file_path:
                parsed = get_parsed_data(file_path)
                if parsed:
                    total_tables += len(parsed.get("tables", []))
                    total_keywords += len(parsed.get("keywords", []))

    return StatsResponse(
        total_documents=total_docs,
        processed_documents=processed,
        total_tables=total_tables,
        total_keywords=total_keywords,
        by_phase=by_phase,
        by_status=by_status,
        by_category=by_category,
    )
