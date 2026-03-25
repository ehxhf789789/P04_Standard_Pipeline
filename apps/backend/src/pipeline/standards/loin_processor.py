"""
LOIN Processor - ISO 7817 Level of Information Need

Implements LOIN (Level of Information Need) requirements processing according to
ISO 7817 standard. Converts LOIN specifications to IDS rules for validation.

LOIN Structure:
- Purpose: Why information is needed
- Information Delivery Milestone: When information is needed
- Actor: Who provides/receives information
- Object: What object the requirement applies to
- Information Content: What information is required
  - Geometrical Information
  - Alphanumerical Information
  - Documentation

Lifecycle Phases (ISO 19650):
- Brief: 1-2 (Strategic Definition, Preparation and Brief)
- Design: 3 (Concept Design, Developed Design, Technical Design)
- Construction: 4 (Manufacturing and Construction)
- Handover: 5 (Handover and Close-out)
- Operation: 6-7 (In Use, End of Life)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class LifecyclePhase(Enum):
    """ISO 19650 Project lifecycle phases"""
    STRATEGIC_DEFINITION = "0"      # Stage 0
    PREPARATION_BRIEF = "1"         # Stage 1
    CONCEPT_DESIGN = "2"            # Stage 2
    DEVELOPED_DESIGN = "3"          # Stage 3
    TECHNICAL_DESIGN = "4"          # Stage 4
    MANUFACTURING_CONSTRUCTION = "5" # Stage 5
    HANDOVER_CLOSEOUT = "6"         # Stage 6
    IN_USE = "7"                    # Stage 7
    END_OF_LIFE = "8"               # Stage 8


class GeometryDetail(Enum):
    """Level of geometrical detail"""
    NONE = "none"
    SYMBOLIC = "symbolic"           # 2D symbols
    SCHEMATIC = "schematic"         # Basic 3D shapes
    SIMPLIFIED = "simplified"       # Simplified geometry
    DETAILED = "detailed"           # Full detail
    MANUFACTURER = "manufacturer"   # As-built/manufacturer detail


class GeometryDimensionality(Enum):
    """Geometry dimensionality"""
    D0 = "0D"  # Point
    D1 = "1D"  # Line
    D2 = "2D"  # Surface
    D3 = "3D"  # Solid


class GeometryLocation(Enum):
    """Location accuracy requirement"""
    NONE = "none"
    APPROXIMATE = "approximate"
    ACCURATE = "accurate"
    AS_BUILT = "as-built"


class GeometryAppearance(Enum):
    """Visual appearance requirement"""
    NONE = "none"
    SINGLE_COLOR = "single-color"
    REALISTIC = "realistic"
    PHOTOREALISTIC = "photorealistic"


class GeometryParametric(Enum):
    """Parametric behavior requirement"""
    NONE = "none"
    EXPLICIT = "explicit"
    PARAMETRIC = "parametric"
    CONSTRUCTIVE = "constructive"


@dataclass
class GeometricalInformation:
    """LOIN Geometrical Information requirements"""
    detail: GeometryDetail = GeometryDetail.NONE
    dimensionality: GeometryDimensionality = GeometryDimensionality.D3
    location: GeometryLocation = GeometryLocation.NONE
    appearance: GeometryAppearance = GeometryAppearance.NONE
    parametric_behaviour: GeometryParametric = GeometryParametric.NONE

    def to_dict(self) -> dict:
        return {
            "detail": self.detail.value,
            "dimensionality": self.dimensionality.value,
            "location": self.location.value,
            "appearance": self.appearance.value,
            "parametric_behaviour": self.parametric_behaviour.value
        }

    @classmethod
    def from_dict(cls, data: dict) -> "GeometricalInformation":
        return cls(
            detail=GeometryDetail(data.get("detail", "none")),
            dimensionality=GeometryDimensionality(data.get("dimensionality", "3D")),
            location=GeometryLocation(data.get("location", "none")),
            appearance=GeometryAppearance(data.get("appearance", "none")),
            parametric_behaviour=GeometryParametric(data.get("parametric_behaviour", "none"))
        )


@dataclass
class PropertyRequirement:
    """Single property requirement in LOIN"""
    property_set: str
    property_name: str
    data_type: str
    unit: Optional[str] = None
    required: bool = True
    allowed_values: Optional[list[str]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    bsdd_reference: Optional[str] = None  # bSDD property URI

    def to_dict(self) -> dict:
        return {
            "propertySet": self.property_set,
            "propertyName": self.property_name,
            "dataType": self.data_type,
            "unit": self.unit,
            "required": self.required,
            "allowedValues": self.allowed_values,
            "minValue": self.min_value,
            "maxValue": self.max_value,
            "bsddReference": self.bsdd_reference
        }


@dataclass
class AlphanumericalInformation:
    """LOIN Alphanumerical Information requirements"""
    identification: list[PropertyRequirement] = field(default_factory=list)
    properties: list[PropertyRequirement] = field(default_factory=list)
    classification_systems: list[str] = field(default_factory=list)  # e.g., ["Uniclass2015", "OmniClass"]

    def to_dict(self) -> dict:
        return {
            "identification": [p.to_dict() for p in self.identification],
            "properties": [p.to_dict() for p in self.properties],
            "classificationSystems": self.classification_systems
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AlphanumericalInformation":
        identification = []
        for p in data.get("identification", []):
            identification.append(PropertyRequirement(
                property_set=p.get("propertySet", ""),
                property_name=p.get("propertyName", ""),
                data_type=p.get("dataType", "IfcLabel"),
                unit=p.get("unit"),
                required=p.get("required", True),
                allowed_values=p.get("allowedValues"),
                bsdd_reference=p.get("bsddReference")
            ))

        properties = []
        for p in data.get("properties", []):
            properties.append(PropertyRequirement(
                property_set=p.get("propertySet", ""),
                property_name=p.get("propertyName", ""),
                data_type=p.get("dataType", "IfcLabel"),
                unit=p.get("unit"),
                required=p.get("required", True),
                allowed_values=p.get("allowedValues"),
                min_value=p.get("minValue"),
                max_value=p.get("maxValue"),
                bsdd_reference=p.get("bsddReference")
            ))

        return cls(
            identification=identification,
            properties=properties,
            classification_systems=data.get("classificationSystems", [])
        )


@dataclass
class DocumentRequirement:
    """Single document requirement in LOIN"""
    document_type: str  # e.g., "Specification", "Manual", "Certificate"
    format: str  # e.g., "PDF", "DOCX"
    required: bool = True
    naming_convention: Optional[str] = None  # ISO 19650 naming pattern

    def to_dict(self) -> dict:
        return {
            "documentType": self.document_type,
            "format": self.format,
            "required": self.required,
            "namingConvention": self.naming_convention
        }


@dataclass
class DocumentationInformation:
    """LOIN Documentation requirements"""
    documents: list[DocumentRequirement] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "documents": [d.to_dict() for d in self.documents]
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DocumentationInformation":
        documents = []
        for d in data.get("documents", []):
            documents.append(DocumentRequirement(
                document_type=d.get("documentType", ""),
                format=d.get("format", "PDF"),
                required=d.get("required", True),
                naming_convention=d.get("namingConvention")
            ))
        return cls(documents=documents)


@dataclass
class LOINRequirement:
    """Complete LOIN requirement specification"""
    id: str
    name: str
    description: str

    # Context
    purpose: str  # Why this information is needed
    lifecycle_phase: LifecyclePhase
    milestone: str  # Information delivery milestone
    actor_from: str  # Who provides the information
    actor_to: str  # Who receives the information

    # Applicability
    ifc_entity: str  # e.g., "IfcWall", "IfcDoor"
    predefined_type: Optional[str] = None
    classification: Optional[str] = None  # e.g., "Uniclass2015:Ss_25_10"

    # Information Content
    geometrical: Optional[GeometricalInformation] = None
    alphanumerical: Optional[AlphanumericalInformation] = None
    documentation: Optional[DocumentationInformation] = None

    # Metadata
    version: str = "1.0"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "purpose": self.purpose,
            "lifecyclePhase": self.lifecycle_phase.value,
            "milestone": self.milestone,
            "actorFrom": self.actor_from,
            "actorTo": self.actor_to,
            "ifcEntity": self.ifc_entity,
            "predefinedType": self.predefined_type,
            "classification": self.classification,
            "geometrical": self.geometrical.to_dict() if self.geometrical else None,
            "alphanumerical": self.alphanumerical.to_dict() if self.alphanumerical else None,
            "documentation": self.documentation.to_dict() if self.documentation else None,
            "version": self.version
        }

    @classmethod
    def from_dict(cls, data: dict) -> "LOINRequirement":
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            purpose=data.get("purpose", ""),
            lifecycle_phase=LifecyclePhase(data.get("lifecyclePhase", "2")),
            milestone=data.get("milestone", ""),
            actor_from=data.get("actorFrom", ""),
            actor_to=data.get("actorTo", ""),
            ifc_entity=data.get("ifcEntity", "IfcBuildingElement"),
            predefined_type=data.get("predefinedType"),
            classification=data.get("classification"),
            geometrical=GeometricalInformation.from_dict(data["geometrical"]) if data.get("geometrical") else None,
            alphanumerical=AlphanumericalInformation.from_dict(data["alphanumerical"]) if data.get("alphanumerical") else None,
            documentation=DocumentationInformation.from_dict(data["documentation"]) if data.get("documentation") else None,
            version=data.get("version", "1.0")
        )


class LOINProcessor:
    """
    Processes LOIN (Level of Information Need) specifications.

    Key functions:
    1. Parse LOIN specifications from JSON/XML
    2. Generate IDS rules from LOIN requirements
    3. Filter requirements by lifecycle phase, actor, object type
    4. Export LOIN to various formats
    """

    def __init__(self):
        self.requirements: list[LOINRequirement] = []
        self._requirements_by_phase: dict[LifecyclePhase, list[LOINRequirement]] = {}
        self._requirements_by_entity: dict[str, list[LOINRequirement]] = {}

    def load_from_json(self, file_path: Path) -> None:
        """Load LOIN requirements from JSON file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        self.requirements = []
        for req_data in data.get("requirements", []):
            req = LOINRequirement.from_dict(req_data)
            self.requirements.append(req)

        self._build_indexes()
        logger.info(f"Loaded {len(self.requirements)} LOIN requirements from {file_path}")

    def load_from_dict(self, data: dict) -> None:
        """Load LOIN requirements from dictionary"""
        self.requirements = []
        for req_data in data.get("requirements", []):
            req = LOINRequirement.from_dict(req_data)
            self.requirements.append(req)

        self._build_indexes()

    def _build_indexes(self) -> None:
        """Build lookup indexes for efficient filtering"""
        self._requirements_by_phase = {}
        self._requirements_by_entity = {}

        for req in self.requirements:
            # Index by phase
            if req.lifecycle_phase not in self._requirements_by_phase:
                self._requirements_by_phase[req.lifecycle_phase] = []
            self._requirements_by_phase[req.lifecycle_phase].append(req)

            # Index by entity
            entity = req.ifc_entity.upper()
            if entity not in self._requirements_by_entity:
                self._requirements_by_entity[entity] = []
            self._requirements_by_entity[entity].append(req)

    def get_requirements_for_phase(self, phase: LifecyclePhase) -> list[LOINRequirement]:
        """Get all requirements applicable to a lifecycle phase"""
        return self._requirements_by_phase.get(phase, [])

    def get_requirements_for_entity(self, ifc_entity: str) -> list[LOINRequirement]:
        """Get all requirements applicable to an IFC entity type"""
        entity_upper = ifc_entity.upper()

        # Direct match
        requirements = list(self._requirements_by_entity.get(entity_upper, []))

        # Check for parent entity types (e.g., IfcWall -> IfcBuildingElement)
        parent_types = self._get_parent_entity_types(entity_upper)
        for parent in parent_types:
            requirements.extend(self._requirements_by_entity.get(parent, []))

        return requirements

    def _get_parent_entity_types(self, entity: str) -> list[str]:
        """Get parent IFC entity types for inheritance lookup"""
        # Simplified IFC hierarchy - in production, use ifcopenshell schema
        hierarchy = {
            "IFCWALL": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCWALLSTANDARDCASE": ["IFCWALL", "IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCDOOR": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCWINDOW": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCSLAB": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCBEAM": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCCOLUMN": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCROOF": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCSTAIR": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCRAILING": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCCURTAINWALL": ["IFCBUILDINGELEMENT", "IFCELEMENT", "IFCPRODUCT"],
            "IFCSPACE": ["IFCSPATIALSTRUCTUREELEMENT", "IFCSPATIALELEMENT", "IFCPRODUCT"],
            "IFCBUILDING": ["IFCSPATIALSTRUCTUREELEMENT", "IFCSPATIALELEMENT", "IFCPRODUCT"],
            "IFCBUILDINGSTOREY": ["IFCSPATIALSTRUCTUREELEMENT", "IFCSPATIALELEMENT", "IFCPRODUCT"],
            "IFCSITE": ["IFCSPATIALSTRUCTUREELEMENT", "IFCSPATIALELEMENT", "IFCPRODUCT"],
            "IFCPIPESEGMENT": ["IFCFLOWSEGMENT", "IFCDISTRIBUTIONFLOWELMENT", "IFCDISTRIBUTIONELEMENT"],
            "IFCDUCTSEGMENT": ["IFCFLOWSEGMENT", "IFCDISTRIBUTIONFLOWELMENT", "IFCDISTRIBUTIONELEMENT"],
            "IFCCABLESEGMENT": ["IFCFLOWSEGMENT", "IFCDISTRIBUTIONFLOWELMENT", "IFCDISTRIBUTIONELEMENT"],
        }
        return hierarchy.get(entity, [])

    def generate_ids_specification(
        self,
        phase: Optional[LifecyclePhase] = None,
        entities: Optional[list[str]] = None
    ) -> str:
        """
        Generate IDS XML specification from LOIN requirements.

        This converts LOIN requirements to IDS 1.0 format for validation.
        """
        requirements = self.requirements

        if phase:
            requirements = [r for r in requirements if r.lifecycle_phase == phase]

        if entities:
            entity_set = {e.upper() for e in entities}
            requirements = [r for r in requirements if r.ifc_entity.upper() in entity_set]

        # Build IDS XML
        ids_ns = "http://standards.buildingsmart.org/IDS"
        xs_ns = "http://www.w3.org/2001/XMLSchema"

        root = ET.Element("ids", {
            "xmlns": ids_ns,
            "xmlns:xs": xs_ns
        })

        info = ET.SubElement(root, "info")
        ET.SubElement(info, "title").text = "LOIN-generated IDS Specification"
        ET.SubElement(info, "version").text = "1.0"
        ET.SubElement(info, "description").text = f"Generated from LOIN requirements - Phase: {phase.value if phase else 'All'}"

        specifications = ET.SubElement(root, "specifications")

        for req in requirements:
            spec = self._loin_to_ids_specification(req)
            if spec is not None:
                specifications.append(spec)

        return ET.tostring(root, encoding='unicode', xml_declaration=True)

    def _loin_to_ids_specification(self, req: LOINRequirement) -> Optional[ET.Element]:
        """Convert a single LOIN requirement to IDS specification element"""
        spec = ET.Element("specification", {
            "name": req.name,
            "ifcVersion": "IFC4"
        })

        # Applicability
        applicability = ET.SubElement(spec, "applicability")

        # Entity facet
        entity = ET.SubElement(applicability, "entity")
        name_elem = ET.SubElement(entity, "name")
        simple_value = ET.SubElement(name_elem, "simpleValue")
        simple_value.text = req.ifc_entity

        if req.predefined_type:
            predefined = ET.SubElement(entity, "predefinedType")
            ptype_value = ET.SubElement(predefined, "simpleValue")
            ptype_value.text = req.predefined_type

        # Classification facet (if specified)
        if req.classification:
            classification = ET.SubElement(applicability, "classification")
            system_parts = req.classification.split(":")
            if len(system_parts) == 2:
                system_elem = ET.SubElement(classification, "system")
                system_value = ET.SubElement(system_elem, "simpleValue")
                system_value.text = system_parts[0]

                value_elem = ET.SubElement(classification, "value")
                class_value = ET.SubElement(value_elem, "simpleValue")
                class_value.text = system_parts[1]

        # Requirements
        requirements_elem = ET.SubElement(spec, "requirements")

        # Add alphanumerical requirements as property facets
        if req.alphanumerical:
            for prop_req in req.alphanumerical.properties:
                property_elem = ET.SubElement(requirements_elem, "property")

                pset_elem = ET.SubElement(property_elem, "propertySet")
                pset_value = ET.SubElement(pset_elem, "simpleValue")
                pset_value.text = prop_req.property_set

                name_elem = ET.SubElement(property_elem, "name")
                name_value = ET.SubElement(name_elem, "simpleValue")
                name_value.text = prop_req.property_name

                # Add value constraint if specified
                if prop_req.allowed_values:
                    value_elem = ET.SubElement(property_elem, "value")
                    restriction = ET.SubElement(value_elem, "xs:restriction", {"base": "xs:string"})
                    for val in prop_req.allowed_values:
                        enum = ET.SubElement(restriction, "xs:enumeration", {"value": val})

                elif prop_req.min_value is not None or prop_req.max_value is not None:
                    value_elem = ET.SubElement(property_elem, "value")
                    restriction = ET.SubElement(value_elem, "xs:restriction", {"base": "xs:double"})
                    if prop_req.min_value is not None:
                        ET.SubElement(restriction, "xs:minInclusive", {"value": str(prop_req.min_value)})
                    if prop_req.max_value is not None:
                        ET.SubElement(restriction, "xs:maxInclusive", {"value": str(prop_req.max_value)})

            # Classification requirements
            for classification_system in req.alphanumerical.classification_systems:
                class_elem = ET.SubElement(requirements_elem, "classification")
                system_elem = ET.SubElement(class_elem, "system")
                system_value = ET.SubElement(system_elem, "simpleValue")
                system_value.text = classification_system

        return spec

    def export_to_json(self, file_path: Path) -> None:
        """Export LOIN requirements to JSON"""
        data = {
            "version": "1.0",
            "generatedAt": datetime.now().isoformat(),
            "requirements": [req.to_dict() for req in self.requirements]
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(self.requirements)} LOIN requirements to {file_path}")

    def get_required_properties(
        self,
        ifc_entity: str,
        phase: Optional[LifecyclePhase] = None
    ) -> list[PropertyRequirement]:
        """Get all required properties for an entity type at a specific phase"""
        requirements = self.get_requirements_for_entity(ifc_entity)

        if phase:
            requirements = [r for r in requirements if r.lifecycle_phase == phase]

        properties = []
        seen = set()

        for req in requirements:
            if req.alphanumerical:
                for prop in req.alphanumerical.properties:
                    key = (prop.property_set, prop.property_name)
                    if key not in seen:
                        seen.add(key)
                        properties.append(prop)

        return properties

    def get_geometry_requirements(
        self,
        ifc_entity: str,
        phase: LifecyclePhase
    ) -> Optional[GeometricalInformation]:
        """Get geometry requirements for an entity type at a specific phase"""
        requirements = self.get_requirements_for_entity(ifc_entity)
        requirements = [r for r in requirements if r.lifecycle_phase == phase]

        # Return most detailed geometry requirement
        best_geo = None
        detail_order = [
            GeometryDetail.MANUFACTURER,
            GeometryDetail.DETAILED,
            GeometryDetail.SIMPLIFIED,
            GeometryDetail.SCHEMATIC,
            GeometryDetail.SYMBOLIC,
            GeometryDetail.NONE
        ]

        for req in requirements:
            if req.geometrical:
                if best_geo is None:
                    best_geo = req.geometrical
                else:
                    # Keep more detailed requirement
                    current_idx = detail_order.index(best_geo.detail)
                    new_idx = detail_order.index(req.geometrical.detail)
                    if new_idx < current_idx:
                        best_geo = req.geometrical

        return best_geo

    def validate_element_completeness(
        self,
        element_data: dict,
        ifc_entity: str,
        phase: LifecyclePhase
    ) -> dict[str, Any]:
        """
        Validate an element's data completeness against LOIN requirements.

        Args:
            element_data: Dictionary with element properties
            ifc_entity: IFC entity type
            phase: Current lifecycle phase

        Returns:
            Validation result with missing/incomplete items
        """
        required_properties = self.get_required_properties(ifc_entity, phase)

        missing_properties = []
        incomplete_properties = []
        valid_properties = []

        element_psets = element_data.get("property_sets", {})

        for prop_req in required_properties:
            pset = element_psets.get(prop_req.property_set, {})
            value = pset.get(prop_req.property_name)

            if value is None:
                if prop_req.required:
                    missing_properties.append({
                        "propertySet": prop_req.property_set,
                        "propertyName": prop_req.property_name,
                        "dataType": prop_req.data_type
                    })
            else:
                # Check value constraints
                is_valid = True
                reason = None

                if prop_req.allowed_values and value not in prop_req.allowed_values:
                    is_valid = False
                    reason = f"Value '{value}' not in allowed values: {prop_req.allowed_values}"

                if prop_req.min_value is not None and isinstance(value, (int, float)):
                    if value < prop_req.min_value:
                        is_valid = False
                        reason = f"Value {value} below minimum {prop_req.min_value}"

                if prop_req.max_value is not None and isinstance(value, (int, float)):
                    if value > prop_req.max_value:
                        is_valid = False
                        reason = f"Value {value} above maximum {prop_req.max_value}"

                if is_valid:
                    valid_properties.append({
                        "propertySet": prop_req.property_set,
                        "propertyName": prop_req.property_name,
                        "value": value
                    })
                else:
                    incomplete_properties.append({
                        "propertySet": prop_req.property_set,
                        "propertyName": prop_req.property_name,
                        "value": value,
                        "reason": reason
                    })

        total = len(required_properties)
        valid_count = len(valid_properties)

        return {
            "entity": ifc_entity,
            "phase": phase.value,
            "completeness": valid_count / total if total > 0 else 1.0,
            "totalRequired": total,
            "validCount": valid_count,
            "missingProperties": missing_properties,
            "incompleteProperties": incomplete_properties,
            "validProperties": valid_properties
        }


def create_default_loin_requirements() -> list[LOINRequirement]:
    """Create default LOIN requirements for common AEC scenarios"""

    requirements = []

    # Wall requirements - Design phase
    requirements.append(LOINRequirement(
        id="LOIN-WALL-DESIGN",
        name="Wall Requirements - Design",
        description="Information requirements for walls during design phase",
        purpose="Design coordination and clash detection",
        lifecycle_phase=LifecyclePhase.DEVELOPED_DESIGN,
        milestone="Design Freeze",
        actor_from="Architect",
        actor_to="Structural Engineer",
        ifc_entity="IfcWall",
        geometrical=GeometricalInformation(
            detail=GeometryDetail.SIMPLIFIED,
            dimensionality=GeometryDimensionality.D3,
            location=GeometryLocation.ACCURATE,
            appearance=GeometryAppearance.SINGLE_COLOR
        ),
        alphanumerical=AlphanumericalInformation(
            identification=[
                PropertyRequirement("Pset_WallCommon", "Reference", "IfcLabel", required=True)
            ],
            properties=[
                PropertyRequirement("Pset_WallCommon", "IsExternal", "IfcBoolean", required=True),
                PropertyRequirement("Pset_WallCommon", "LoadBearing", "IfcBoolean", required=True),
                PropertyRequirement("Pset_WallCommon", "FireRating", "IfcLabel", required=False),
                PropertyRequirement("Qto_WallBaseQuantities", "Width", "IfcLengthMeasure", unit="mm", required=True),
                PropertyRequirement("Qto_WallBaseQuantities", "Height", "IfcLengthMeasure", unit="mm", required=True),
            ],
            classification_systems=["Uniclass2015"]
        )
    ))

    # Wall requirements - Construction phase
    requirements.append(LOINRequirement(
        id="LOIN-WALL-CONSTRUCTION",
        name="Wall Requirements - Construction",
        description="Information requirements for walls during construction phase",
        purpose="Construction planning and material ordering",
        lifecycle_phase=LifecyclePhase.MANUFACTURING_CONSTRUCTION,
        milestone="Construction Start",
        actor_from="Main Contractor",
        actor_to="Subcontractor",
        ifc_entity="IfcWall",
        geometrical=GeometricalInformation(
            detail=GeometryDetail.DETAILED,
            dimensionality=GeometryDimensionality.D3,
            location=GeometryLocation.ACCURATE,
            appearance=GeometryAppearance.REALISTIC
        ),
        alphanumerical=AlphanumericalInformation(
            properties=[
                PropertyRequirement("Pset_WallCommon", "IsExternal", "IfcBoolean", required=True),
                PropertyRequirement("Pset_WallCommon", "LoadBearing", "IfcBoolean", required=True),
                PropertyRequirement("Pset_WallCommon", "FireRating", "IfcLabel", required=True),
                PropertyRequirement("Pset_WallCommon", "AcousticRating", "IfcLabel", required=False),
                PropertyRequirement("Pset_WallCommon", "ThermalTransmittance", "IfcThermalTransmittanceMeasure", unit="W/(m2K)", required=False),
                PropertyRequirement("Qto_WallBaseQuantities", "Width", "IfcLengthMeasure", unit="mm", required=True),
                PropertyRequirement("Qto_WallBaseQuantities", "Height", "IfcLengthMeasure", unit="mm", required=True),
                PropertyRequirement("Qto_WallBaseQuantities", "GrossVolume", "IfcVolumeMeasure", unit="m3", required=True),
            ],
            classification_systems=["Uniclass2015", "OmniClass"]
        ),
        documentation=DocumentationInformation(
            documents=[
                DocumentRequirement("Material Specification", "PDF", required=True),
                DocumentRequirement("Installation Guide", "PDF", required=False)
            ]
        )
    ))

    # Door requirements - Design phase
    requirements.append(LOINRequirement(
        id="LOIN-DOOR-DESIGN",
        name="Door Requirements - Design",
        description="Information requirements for doors during design phase",
        purpose="Space planning and egress design",
        lifecycle_phase=LifecyclePhase.DEVELOPED_DESIGN,
        milestone="Design Freeze",
        actor_from="Architect",
        actor_to="Building Owner",
        ifc_entity="IfcDoor",
        geometrical=GeometricalInformation(
            detail=GeometryDetail.SIMPLIFIED,
            dimensionality=GeometryDimensionality.D3,
            location=GeometryLocation.ACCURATE,
            appearance=GeometryAppearance.SINGLE_COLOR
        ),
        alphanumerical=AlphanumericalInformation(
            properties=[
                PropertyRequirement("Pset_DoorCommon", "IsExternal", "IfcBoolean", required=True),
                PropertyRequirement("Pset_DoorCommon", "FireRating", "IfcLabel", required=True),
                PropertyRequirement("Pset_DoorCommon", "SecurityRating", "IfcLabel", required=False),
                PropertyRequirement("Qto_DoorBaseQuantities", "Width", "IfcLengthMeasure", unit="mm", required=True),
                PropertyRequirement("Qto_DoorBaseQuantities", "Height", "IfcLengthMeasure", unit="mm", required=True),
            ],
            classification_systems=["Uniclass2015"]
        )
    ))

    # Space requirements - Design phase
    requirements.append(LOINRequirement(
        id="LOIN-SPACE-DESIGN",
        name="Space Requirements - Design",
        description="Information requirements for spaces during design phase",
        purpose="Area verification and building code compliance",
        lifecycle_phase=LifecyclePhase.DEVELOPED_DESIGN,
        milestone="Permit Submission",
        actor_from="Architect",
        actor_to="Code Official",
        ifc_entity="IfcSpace",
        geometrical=GeometricalInformation(
            detail=GeometryDetail.SIMPLIFIED,
            dimensionality=GeometryDimensionality.D3,
            location=GeometryLocation.ACCURATE,
            appearance=GeometryAppearance.NONE
        ),
        alphanumerical=AlphanumericalInformation(
            properties=[
                PropertyRequirement("Pset_SpaceCommon", "Reference", "IfcLabel", required=True),
                PropertyRequirement("Pset_SpaceCommon", "Category", "IfcLabel", required=True),
                PropertyRequirement("Pset_SpaceOccupancyRequirements", "OccupancyType", "IfcLabel", required=True),
                PropertyRequirement("Pset_SpaceOccupancyRequirements", "AreaPerOccupant", "IfcAreaMeasure", unit="m2", required=False),
                PropertyRequirement("Qto_SpaceBaseQuantities", "NetFloorArea", "IfcAreaMeasure", unit="m2", required=True),
                PropertyRequirement("Qto_SpaceBaseQuantities", "Height", "IfcLengthMeasure", unit="mm", required=True),
            ],
            classification_systems=["Uniclass2015"]
        )
    ))

    # MEP Pipe requirements - Construction phase
    requirements.append(LOINRequirement(
        id="LOIN-PIPE-CONSTRUCTION",
        name="Pipe Requirements - Construction",
        description="Information requirements for pipes during construction phase",
        purpose="MEP coordination and installation",
        lifecycle_phase=LifecyclePhase.MANUFACTURING_CONSTRUCTION,
        milestone="MEP Installation",
        actor_from="MEP Contractor",
        actor_to="Main Contractor",
        ifc_entity="IfcPipeSegment",
        geometrical=GeometricalInformation(
            detail=GeometryDetail.DETAILED,
            dimensionality=GeometryDimensionality.D3,
            location=GeometryLocation.ACCURATE,
            appearance=GeometryAppearance.SINGLE_COLOR
        ),
        alphanumerical=AlphanumericalInformation(
            properties=[
                PropertyRequirement("Pset_PipeSegmentTypeCommon", "NominalDiameter", "IfcPositiveLengthMeasure", unit="mm", required=True),
                PropertyRequirement("Pset_PipeSegmentTypeCommon", "WorkingPressure", "IfcPressureMeasure", unit="Pa", required=True),
                PropertyRequirement("Pset_PipeSegmentTypeCommon", "ConnectionType", "IfcLabel", required=True),
            ],
            classification_systems=["Uniclass2015"]
        )
    ))

    return requirements
