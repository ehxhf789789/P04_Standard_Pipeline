"""Output schemas."""

from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field


class OutputFile(BaseModel):
    """Schema for output file."""

    id: UUID
    file_type: str  # knowledge_graph, embeddings, tabular_csv, tabular_parquet, gnn_structure, summary, report
    filename: str
    size_kb: float
    mime_type: str
    download_url: str


class OutputFilesResponse(BaseModel):
    """Schema for output files response."""

    files: list[OutputFile]
    total_size_kb: float


class GraphNode(BaseModel):
    """Schema for knowledge graph node."""

    id: str
    label: str
    type: str  # element, property, material, classification, etc.
    properties: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """Schema for knowledge graph edge."""

    source: str
    target: str
    type: str  # has_property, has_material, contained_in, etc.
    properties: dict[str, Any] = Field(default_factory=dict)


class KnowledgeGraphData(BaseModel):
    """Schema for knowledge graph data."""

    nodes: list[GraphNode]
    edges: list[GraphEdge]
    statistics: dict[str, Any] = Field(default_factory=dict)


class EmbeddingVector(BaseModel):
    """Schema for embedding vector."""

    element_id: str
    element_name: str
    ifc_class: str
    vector: list[float]


class SimilarityPair(BaseModel):
    """Schema for similarity pair."""

    element_a_id: str
    element_b_id: str
    similarity_score: float


class EmbeddingData(BaseModel):
    """Schema for embedding data."""

    embeddings: list[EmbeddingVector]
    dimension: int
    model_name: str
    similarity_matrix: Optional[list[SimilarityPair]] = None


class TabularPreview(BaseModel):
    """Schema for tabular data preview."""

    columns: list[str]
    rows: list[dict[str, Any]]
    total_rows: int
    total_columns: int


class GNNStructure(BaseModel):
    """Schema for GNN graph structure."""

    num_nodes: int
    num_edges: int
    num_features: int
    node_ids: list[str]
    edge_index: list[list[int]]  # [2, num_edges] format
    feature_names: list[str]
