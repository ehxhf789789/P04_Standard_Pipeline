"""
AI-Ready Data Output Modules

Generates AI-optimized outputs from BIM/construction documents:
- Knowledge Graph (RDF/TTL using ifcOWL, BOT ontology)
- Embeddings (vector embeddings for semantic search)
- Tabular Data (structured CSV/JSON for ML training)
- GNN-Ready Data (graph format for Graph Neural Networks)
"""

from .knowledge_graph import (
    KnowledgeGraphGenerator,
    KGOutputFormat,
    OntologyType,
    TripleStore,
)

from .embedding_generator import (
    EmbeddingGenerator,
    EmbeddingModel,
    EmbeddingResult,
    ChunkingStrategy,
)

from .tabular_generator import (
    TabularGenerator,
    TabularOutputFormat,
    FeatureSet,
)

from .gnn_generator import (
    GNNDataGenerator,
    GNNOutputFormat,
    GraphData,
    NodeFeatures,
    EdgeFeatures,
)

__all__ = [
    # Knowledge Graph
    'KnowledgeGraphGenerator',
    'KGOutputFormat',
    'OntologyType',
    'TripleStore',
    # Embeddings
    'EmbeddingGenerator',
    'EmbeddingModel',
    'EmbeddingResult',
    'ChunkingStrategy',
    # Tabular
    'TabularGenerator',
    'TabularOutputFormat',
    'FeatureSet',
    # GNN
    'GNNDataGenerator',
    'GNNOutputFormat',
    'GraphData',
    'NodeFeatures',
    'EdgeFeatures',
]
