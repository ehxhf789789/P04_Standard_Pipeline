# BIM-to-AI Pipeline Package
"""
5-stage pipeline for transforming IFC data to AI-ready formats.

Stages:
1. Parse: IFC → Structured Objects
2. Validate: IDS-based validation
3. Enrich: bSDD standardization
4. Transform: 4 AI formats (KG, Embeddings, Tabular, GNN)
5. Package: Result aggregation
"""

__all__ = []

# Lazy imports to avoid circular dependencies during development
def __getattr__(name):
    if name == 'IFCParser':
        from .parser import IFCParser
        return IFCParser
    elif name == 'IDSValidator':
        from .validator import IDSValidator
        return IDSValidator
    elif name == 'BSDDEnricher':
        from .enricher import BSDDEnricher
        return BSDDEnricher
    elif name == 'AITransformer':
        from .transformer import AITransformer
        return AITransformer
    elif name == 'PipelinePackager':
        from .packager import PipelinePackager
        return PipelinePackager
    raise AttributeError(f"module 'pipeline' has no attribute '{name}'")
