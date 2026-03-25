"""
IFC (Industry Foundation Classes) Parser

Extracts geometry, properties, relationships, and spatial structure from IFC files.
Supports IFC2x3, IFC4, and IFC4.3 schemas.
"""

import time
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from datetime import datetime
import uuid

try:
    import ifcopenshell
    import ifcopenshell.util.element
    import ifcopenshell.util.placement
    import ifcopenshell.util.unit
    HAS_IFCOPENSHELL = True
except ImportError:
    HAS_IFCOPENSHELL = False

from .base import (
    DocumentParser,
    DocumentType,
    DocumentMetadata,
    ParseResult,
)

logger = logging.getLogger(__name__)


class IFCParser(DocumentParser):
    """
    IFC (Industry Foundation Classes) Parser

    Features:
    - Full spatial hierarchy extraction (Site → Building → Storey → Space → Element)
    - Property set extraction (Pset_*, Qto_*)
    - Material extraction with layers
    - Relationship mapping (containment, aggregation, connection)
    - Geometry metadata extraction
    - Classification extraction (bSDD, Uniclass, etc.)
    - IFC schema version handling
    """

    document_type = DocumentType.IFC
    supported_extensions = ['.ifc', '.ifcxml', '.ifcjson']

    # IFC element types to extract
    ELEMENT_TYPES = [
        'IfcWall', 'IfcWallStandardCase',
        'IfcSlab', 'IfcSlabStandardCase',
        'IfcBeam', 'IfcBeamStandardCase',
        'IfcColumn', 'IfcColumnStandardCase',
        'IfcDoor', 'IfcDoorStandardCase',
        'IfcWindow', 'IfcWindowStandardCase',
        'IfcStair', 'IfcStairFlight',
        'IfcRailing',
        'IfcRoof',
        'IfcCurtainWall',
        'IfcPlate',
        'IfcMember',
        'IfcFooting',
        'IfcPile',
        'IfcCovering',
        'IfcBuildingElementProxy',
        'IfcFurnishingElement',
        'IfcDistributionElement',
        'IfcFlowTerminal',
        'IfcFlowSegment',
        'IfcFlowFitting',
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.extract_geometry = self.config.get('extract_geometry', True)
        self.extract_materials = self.config.get('extract_materials', True)
        self.max_elements = self.config.get('max_elements', 100000)

    async def parse(self, file_path: Path) -> ParseResult:
        """Parse IFC file and extract all data"""
        start_time = time.time()

        result = ParseResult(
            success=False,
            document_type=self.document_type,
            file_path=str(file_path),
            file_hash=self.compute_file_hash(file_path),
        )

        if not HAS_IFCOPENSHELL:
            result.errors.append(
                "ifcopenshell not installed. Run: pip install ifcopenshell"
            )
            return result

        try:
            ifc_file = ifcopenshell.open(file_path)

            # Extract metadata
            result.metadata = await self.extract_metadata(file_path)
            result.metadata.custom['schema'] = ifc_file.schema

            # Extract spatial structure
            result.spatial_structure = await self._extract_spatial_structure(ifc_file)

            # Extract elements
            result.elements = await self._extract_elements(ifc_file)

            # Extract relationships
            result.relationships = await self._extract_relationships(ifc_file)

            # Generate full text representation
            result.full_text = self._generate_text_representation(result)

            # Statistics
            element_counts = {}
            for elem in result.elements:
                ifc_class = elem.get('ifc_class', 'Unknown')
                element_counts[ifc_class] = element_counts.get(ifc_class, 0) + 1

            result.statistics = {
                'schema_version': ifc_file.schema,
                'total_elements': len(result.elements),
                'element_counts': element_counts,
                'relationship_count': len(result.relationships),
                'site_count': len(result.spatial_structure.get('sites', [])),
                'building_count': sum(
                    len(site.get('buildings', []))
                    for site in result.spatial_structure.get('sites', [])
                ),
            }

            ifc_file = None  # Release file handle
            result.success = True

        except Exception as e:
            logger.error(f"Error parsing IFC: {e}")
            result.errors.append(str(e))

        result.processing_time_ms = int((time.time() - start_time) * 1000)
        return result

    async def extract_metadata(self, file_path: Path) -> DocumentMetadata:
        """Extract IFC file metadata"""
        metadata = DocumentMetadata()

        if not HAS_IFCOPENSHELL:
            return metadata

        try:
            ifc_file = ifcopenshell.open(file_path)

            # Get file header info
            header = ifc_file.header

            # Try to get project info
            projects = ifc_file.by_type('IfcProject')
            if projects:
                project = projects[0]
                metadata.title = project.Name or project.LongName
                metadata.custom['project_guid'] = project.GlobalId

            # Get owner history for author info
            owner_histories = ifc_file.by_type('IfcOwnerHistory')
            if owner_histories:
                oh = owner_histories[0]
                if oh.OwningUser:
                    person = oh.OwningUser.ThePerson
                    if person:
                        names = []
                        if person.GivenName:
                            names.append(person.GivenName)
                        if person.FamilyName:
                            names.append(person.FamilyName)
                        metadata.author = ' '.join(names)

                if oh.OwningApplication:
                    metadata.creator = oh.OwningApplication.ApplicationFullName

                # Dates
                if oh.CreationDate:
                    try:
                        metadata.created = datetime.fromtimestamp(oh.CreationDate)
                    except:
                        pass
                if oh.LastModifiedDate:
                    try:
                        metadata.modified = datetime.fromtimestamp(oh.LastModifiedDate)
                    except:
                        pass

            # Additional metadata
            metadata.custom['schema'] = ifc_file.schema
            metadata.custom['file_description'] = str(header.file_description.description) if hasattr(header, 'file_description') else None

            ifc_file = None

        except Exception as e:
            logger.error(f"Error extracting IFC metadata: {e}")

        return metadata

    async def extract_text(self, file_path: Path) -> str:
        """Extract text representation of IFC file"""
        result = await self.parse(file_path)
        return result.full_text if result.success else ""

    async def _extract_spatial_structure(
        self, ifc_file: 'ifcopenshell.file'
    ) -> Dict[str, Any]:
        """Extract spatial hierarchy: Site → Building → Storey → Space"""
        structure = {'sites': []}

        # Get all sites
        for site in ifc_file.by_type('IfcSite'):
            site_data = {
                'guid': site.GlobalId,
                'name': site.Name or 'Unnamed Site',
                'description': site.Description,
                'long_name': site.LongName,
                'ref_latitude': self._parse_coordinates(site.RefLatitude) if site.RefLatitude else None,
                'ref_longitude': self._parse_coordinates(site.RefLongitude) if site.RefLongitude else None,
                'buildings': [],
            }

            # Get buildings in site
            for rel in site.IsDecomposedBy or []:
                for building in rel.RelatedObjects:
                    if building.is_a('IfcBuilding'):
                        building_data = await self._process_building(building)
                        site_data['buildings'].append(building_data)

            structure['sites'].append(site_data)

        return structure

    async def _process_building(self, building) -> Dict[str, Any]:
        """Process a building and its storeys"""
        building_data = {
            'guid': building.GlobalId,
            'name': building.Name or 'Unnamed Building',
            'description': building.Description,
            'long_name': building.LongName,
            'elevation': building.ElevationOfRefHeight,
            'storeys': [],
        }

        # Get storeys
        for rel in building.IsDecomposedBy or []:
            for storey in rel.RelatedObjects:
                if storey.is_a('IfcBuildingStorey'):
                    storey_data = await self._process_storey(storey)
                    building_data['storeys'].append(storey_data)

        # Sort storeys by elevation
        building_data['storeys'].sort(
            key=lambda s: s.get('elevation') or 0
        )

        return building_data

    async def _process_storey(self, storey) -> Dict[str, Any]:
        """Process a storey and its spaces"""
        storey_data = {
            'guid': storey.GlobalId,
            'name': storey.Name or 'Unnamed Storey',
            'description': storey.Description,
            'elevation': storey.Elevation,
            'spaces': [],
            'element_count': 0,
        }

        # Get spaces
        for rel in storey.IsDecomposedBy or []:
            for space in rel.RelatedObjects:
                if space.is_a('IfcSpace'):
                    space_data = {
                        'guid': space.GlobalId,
                        'name': space.Name or 'Unnamed Space',
                        'long_name': space.LongName,
                        'description': space.Description,
                    }
                    storey_data['spaces'].append(space_data)

        # Count elements contained in storey
        for rel in storey.ContainsElements or []:
            storey_data['element_count'] += len(rel.RelatedElements)

        return storey_data

    async def _extract_elements(
        self, ifc_file: 'ifcopenshell.file'
    ) -> List[Dict[str, Any]]:
        """Extract all building elements with properties"""
        elements = []
        processed_count = 0

        for ifc_class in self.ELEMENT_TYPES:
            for element in ifc_file.by_type(ifc_class):
                if processed_count >= self.max_elements:
                    break

                element_data = await self._process_element(element)
                elements.append(element_data)
                processed_count += 1

            if processed_count >= self.max_elements:
                logger.warning(f"Max elements ({self.max_elements}) reached")
                break

        return elements

    async def _process_element(self, element) -> Dict[str, Any]:
        """Process a single element"""
        element_data = {
            'guid': element.GlobalId,
            'name': element.Name,
            'ifc_class': element.is_a(),
            'object_type': getattr(element, 'ObjectType', None),
            'tag': getattr(element, 'Tag', None),
            'description': element.Description,
            'properties': {},
            'quantities': {},
            'materials': [],
            'classifications': [],
            'location': None,
        }

        # Extract property sets
        element_data['properties'] = self._extract_property_sets(element)

        # Extract quantities
        element_data['quantities'] = self._extract_quantities(element)

        # Extract materials
        if self.extract_materials:
            element_data['materials'] = self._extract_materials(element)

        # Extract classifications
        element_data['classifications'] = self._extract_classifications(element)

        # Extract location info
        if self.extract_geometry:
            element_data['location'] = self._extract_location(element)

        return element_data

    def _extract_property_sets(self, element) -> Dict[str, Dict[str, Any]]:
        """Extract all property sets from an element"""
        properties = {}

        for definition in element.IsDefinedBy or []:
            if definition.is_a('IfcRelDefinesByProperties'):
                pset = definition.RelatingPropertyDefinition
                if pset.is_a('IfcPropertySet'):
                    pset_name = pset.Name or 'Unnamed_Pset'
                    properties[pset_name] = {}

                    for prop in pset.HasProperties or []:
                        prop_value = self._get_property_value(prop)
                        if prop_value is not None:
                            properties[pset_name][prop.Name] = prop_value

        return properties

    def _get_property_value(self, prop) -> Any:
        """Extract value from an IFC property"""
        try:
            if prop.is_a('IfcPropertySingleValue'):
                if prop.NominalValue:
                    value = prop.NominalValue.wrappedValue
                    # Handle special types
                    if hasattr(value, 'is_a'):
                        return str(value)
                    return value

            elif prop.is_a('IfcPropertyEnumeratedValue'):
                values = prop.EnumerationValues
                if values:
                    return [v.wrappedValue for v in values]

            elif prop.is_a('IfcPropertyListValue'):
                values = prop.ListValues
                if values:
                    return [v.wrappedValue for v in values]

            elif prop.is_a('IfcPropertyBoundedValue'):
                return {
                    'upper': prop.UpperBoundValue.wrappedValue if prop.UpperBoundValue else None,
                    'lower': prop.LowerBoundValue.wrappedValue if prop.LowerBoundValue else None,
                }

        except Exception as e:
            logger.warning(f"Error extracting property value: {e}")

        return None

    def _extract_quantities(self, element) -> Dict[str, Dict[str, Any]]:
        """Extract quantity sets from an element"""
        quantities = {}

        for definition in element.IsDefinedBy or []:
            if definition.is_a('IfcRelDefinesByProperties'):
                qset = definition.RelatingPropertyDefinition
                if qset.is_a('IfcElementQuantity'):
                    qset_name = qset.Name or 'Unnamed_Qto'
                    quantities[qset_name] = {}

                    for qty in qset.Quantities or []:
                        qty_value = self._get_quantity_value(qty)
                        if qty_value is not None:
                            quantities[qset_name][qty.Name] = qty_value

        return quantities

    def _get_quantity_value(self, qty) -> Dict[str, Any]:
        """Extract value from an IFC quantity"""
        result = {
            'value': None,
            'unit': None,
            'type': qty.is_a() if hasattr(qty, 'is_a') else None,
        }

        try:
            if qty.is_a('IfcQuantityLength'):
                result['value'] = qty.LengthValue
                result['unit'] = 'length'
            elif qty.is_a('IfcQuantityArea'):
                result['value'] = qty.AreaValue
                result['unit'] = 'area'
            elif qty.is_a('IfcQuantityVolume'):
                result['value'] = qty.VolumeValue
                result['unit'] = 'volume'
            elif qty.is_a('IfcQuantityWeight'):
                result['value'] = qty.WeightValue
                result['unit'] = 'weight'
            elif qty.is_a('IfcQuantityCount'):
                result['value'] = qty.CountValue
                result['unit'] = 'count'
            elif qty.is_a('IfcQuantityTime'):
                result['value'] = qty.TimeValue
                result['unit'] = 'time'
        except Exception as e:
            logger.warning(f"Error extracting quantity: {e}")

        return result if result['value'] is not None else None

    def _extract_materials(self, element) -> List[Dict[str, Any]]:
        """Extract materials associated with an element"""
        materials = []

        for association in element.HasAssociations or []:
            if association.is_a('IfcRelAssociatesMaterial'):
                material = association.RelatingMaterial

                if material.is_a('IfcMaterial'):
                    materials.append({
                        'name': material.Name,
                        'category': getattr(material, 'Category', None),
                        'type': 'single',
                    })

                elif material.is_a('IfcMaterialLayerSetUsage'):
                    layer_set = material.ForLayerSet
                    for layer in layer_set.MaterialLayers or []:
                        materials.append({
                            'name': layer.Material.Name if layer.Material else 'Unknown',
                            'thickness': layer.LayerThickness,
                            'type': 'layer',
                        })

                elif material.is_a('IfcMaterialLayerSet'):
                    for layer in material.MaterialLayers or []:
                        materials.append({
                            'name': layer.Material.Name if layer.Material else 'Unknown',
                            'thickness': layer.LayerThickness,
                            'type': 'layer',
                        })

                elif material.is_a('IfcMaterialList'):
                    for mat in material.Materials or []:
                        materials.append({
                            'name': mat.Name,
                            'type': 'list',
                        })

        return materials

    def _extract_classifications(self, element) -> List[Dict[str, Any]]:
        """Extract classification references"""
        classifications = []

        for association in element.HasAssociations or []:
            if association.is_a('IfcRelAssociatesClassification'):
                ref = association.RelatingClassification

                if ref.is_a('IfcClassificationReference'):
                    classifications.append({
                        'name': ref.Name,
                        'identification': ref.Identification,
                        'location': ref.Location,
                        'source': ref.ReferencedSource.Name if ref.ReferencedSource else None,
                    })
                elif ref.is_a('IfcClassification'):
                    classifications.append({
                        'name': ref.Name,
                        'source': ref.Source,
                        'edition': ref.Edition,
                    })

        return classifications

    def _extract_location(self, element) -> Optional[Dict[str, Any]]:
        """Extract element location/placement"""
        try:
            placement = element.ObjectPlacement
            if placement and placement.is_a('IfcLocalPlacement'):
                rel_placement = placement.RelativePlacement
                if rel_placement and rel_placement.is_a('IfcAxis2Placement3D'):
                    location = rel_placement.Location
                    if location:
                        return {
                            'x': location.Coordinates[0],
                            'y': location.Coordinates[1],
                            'z': location.Coordinates[2] if len(location.Coordinates) > 2 else 0,
                        }
        except Exception as e:
            logger.warning(f"Error extracting location: {e}")

        return None

    async def _extract_relationships(
        self, ifc_file: 'ifcopenshell.file'
    ) -> List[Dict[str, Any]]:
        """Extract relationships between elements"""
        relationships = []

        # Containment relationships
        for rel in ifc_file.by_type('IfcRelContainedInSpatialStructure'):
            for element in rel.RelatedElements:
                relationships.append({
                    'type': 'contained_in',
                    'source': element.GlobalId,
                    'target': rel.RelatingStructure.GlobalId,
                    'source_class': element.is_a(),
                    'target_class': rel.RelatingStructure.is_a(),
                })

        # Aggregation relationships
        for rel in ifc_file.by_type('IfcRelAggregates'):
            for child in rel.RelatedObjects:
                relationships.append({
                    'type': 'aggregated_by',
                    'source': child.GlobalId,
                    'target': rel.RelatingObject.GlobalId,
                    'source_class': child.is_a(),
                    'target_class': rel.RelatingObject.is_a(),
                })

        # Connection relationships
        for rel in ifc_file.by_type('IfcRelConnectsElements'):
            relationships.append({
                'type': 'connected_to',
                'source': rel.RelatingElement.GlobalId,
                'target': rel.RelatedElement.GlobalId,
                'source_class': rel.RelatingElement.is_a(),
                'target_class': rel.RelatedElement.is_a(),
            })

        # Voids relationships (openings)
        for rel in ifc_file.by_type('IfcRelVoidsElement'):
            relationships.append({
                'type': 'has_opening',
                'source': rel.RelatingBuildingElement.GlobalId,
                'target': rel.RelatedOpeningElement.GlobalId,
                'source_class': rel.RelatingBuildingElement.is_a(),
                'target_class': rel.RelatedOpeningElement.is_a(),
            })

        # Fills relationships (doors/windows in openings)
        for rel in ifc_file.by_type('IfcRelFillsElement'):
            relationships.append({
                'type': 'fills',
                'source': rel.RelatedBuildingElement.GlobalId,
                'target': rel.RelatingOpeningElement.GlobalId,
                'source_class': rel.RelatedBuildingElement.is_a(),
                'target_class': rel.RelatingOpeningElement.is_a(),
            })

        return relationships

    def _parse_coordinates(self, coords: tuple) -> float:
        """Parse IFC coordinate tuple to decimal degrees"""
        if not coords or len(coords) < 3:
            return None

        degrees = coords[0]
        minutes = coords[1] if len(coords) > 1 else 0
        seconds = coords[2] if len(coords) > 2 else 0
        millionths = coords[3] if len(coords) > 3 else 0

        return degrees + minutes/60 + seconds/3600 + millionths/3600000000

    def _generate_text_representation(self, result: ParseResult) -> str:
        """Generate text representation of IFC data for embedding/search"""
        parts = []

        # Spatial structure
        parts.append("=== SPATIAL STRUCTURE ===")
        for site in result.spatial_structure.get('sites', []):
            parts.append(f"Site: {site['name']}")
            for building in site.get('buildings', []):
                parts.append(f"  Building: {building['name']}")
                for storey in building.get('storeys', []):
                    parts.append(f"    Storey: {storey['name']} (Elevation: {storey.get('elevation', 'N/A')})")

        # Elements summary
        parts.append("\n=== ELEMENTS ===")
        for elem in result.elements[:100]:  # Limit for text representation
            elem_parts = [
                f"{elem['ifc_class']}: {elem['name'] or 'Unnamed'}",
            ]

            # Add key properties
            for pset_name, props in elem.get('properties', {}).items():
                for prop_name, value in props.items():
                    elem_parts.append(f"  {pset_name}.{prop_name}: {value}")

            # Add materials
            for mat in elem.get('materials', []):
                elem_parts.append(f"  Material: {mat['name']}")

            parts.append('\n'.join(elem_parts))

        return '\n'.join(parts)
