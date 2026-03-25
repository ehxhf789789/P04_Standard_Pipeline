"""
Standards Integration Framework

Implements validation and enrichment based on:
- IDS 1.0 (Information Delivery Specification) - ISO 19650 compliant
- ISO 7817 LOIN (Level of Information Need)
- bSDD (buildingSMART Data Dictionary)
- BCF 3.0 (BIM Collaboration Format)

Usage:
    from pipeline.standards import IDSValidator, LOINProcessor, BSDDClient, BCFHandler

    # Validate IFC model against IDS specification
    validator = IDSValidator()
    validator.load_ids(ids_file_path)
    result = validator.validate_model(ifc_model)

    # Check LOIN completeness
    loin = LOINProcessor()
    loin.load_from_json(loin_requirements_path)
    required_props = loin.get_required_properties("IfcWall", LifecyclePhase.DESIGN)

    # Enrich with bSDD
    async with BSDDClient() as bsdd:
        enrichment = await bsdd.enrich_element(element_id, entity, properties)

    # Generate BCF issues for feedback
    bcf = BCFHandler(project_name="My Project")
    bcf.create_topic_from_validation(validation_result)
    bcf_zip = bcf.export_bcf_zip()
"""

# IDS Validator
from .ids_validator import (
    IDSValidator,
    IDSValidationResult,
    ElementValidation,
    FacetResult,
    IDSFacet,
    IDSRequirement,
)

# LOIN Processor
from .loin_processor import (
    LOINProcessor,
    LOINRequirement,
    LifecyclePhase,
    GeometricalInformation,
    AlphanumericalInformation,
    DocumentationInformation,
    PropertyRequirement,
    GeometryDetail,
    create_default_loin_requirements,
)

# bSDD Client
from .bsdd_client import (
    BSDDClient,
    BSDDClientSync,
    BSDDClass,
    BSDDProperty,
    BSDDDomain,
    EnrichmentResult,
    PropertyMapping,
    BSDDEnvironment,
)

# BCF Handler
from .bcf_handler import (
    BCFHandler,
    BCFProject,
    Topic,
    Viewpoint,
    Comment,
    Component,
    TopicType,
    TopicStatus,
    Priority,
)

__all__ = [
    # IDS
    'IDSValidator',
    'IDSValidationResult',
    'ElementValidation',
    'FacetResult',
    'IDSFacet',
    'IDSRequirement',
    # LOIN
    'LOINProcessor',
    'LOINRequirement',
    'LifecyclePhase',
    'GeometricalInformation',
    'AlphanumericalInformation',
    'DocumentationInformation',
    'PropertyRequirement',
    'GeometryDetail',
    'create_default_loin_requirements',
    # bSDD
    'BSDDClient',
    'BSDDClientSync',
    'BSDDClass',
    'BSDDProperty',
    'BSDDDomain',
    'EnrichmentResult',
    'PropertyMapping',
    'BSDDEnvironment',
    # BCF
    'BCFHandler',
    'BCFProject',
    'Topic',
    'Viewpoint',
    'Comment',
    'Component',
    'TopicType',
    'TopicStatus',
    'Priority',
]
