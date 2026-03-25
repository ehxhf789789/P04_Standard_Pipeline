"""
IDS (Information Delivery Specification) Validator

Validates IFC elements against IDS 1.0 specifications.
Implements 6-facet validation: Entity, Attribute, Property, Material, Classification, PartOf

Reference: https://technical.buildingsmart.org/projects/information-delivery-specification-ids/
"""

import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from lxml import etree
import uuid

logger = logging.getLogger(__name__)


class IDSFacet(Enum):
    """IDS validation facets"""
    ENTITY = "entity"
    ATTRIBUTE = "attribute"
    PROPERTY = "property"
    MATERIAL = "material"
    CLASSIFICATION = "classification"
    PART_OF = "partOf"


class ValidationStatus(Enum):
    """Validation status"""
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"
    NOT_APPLICABLE = "not_applicable"


@dataclass
class FacetResult:
    """Result of a single facet validation"""
    facet: IDSFacet
    status: ValidationStatus
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ElementValidation:
    """Validation result for a single element"""
    element_guid: str
    element_name: Optional[str]
    ifc_class: str
    passed: bool
    facet_results: Dict[IDSFacet, FacetResult] = field(default_factory=dict)
    specification_id: Optional[str] = None


@dataclass
class IDSValidationResult:
    """Complete IDS validation result"""
    success: bool
    specification_name: str
    specification_version: str

    # Summary
    total_elements: int = 0
    passed_elements: int = 0
    failed_elements: int = 0
    pass_rate: float = 0.0

    # Detailed results
    element_results: List[ElementValidation] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'success': self.success,
            'specification_name': self.specification_name,
            'specification_version': self.specification_version,
            'summary': {
                'total_elements': self.total_elements,
                'passed_elements': self.passed_elements,
                'failed_elements': self.failed_elements,
                'pass_rate': self.pass_rate,
            },
            'element_results': [
                {
                    'element_guid': r.element_guid,
                    'element_name': r.element_name,
                    'ifc_class': r.ifc_class,
                    'passed': r.passed,
                    'facets': {
                        facet.value: {
                            'status': result.status.value,
                            'message': result.message,
                            'details': result.details,
                        }
                        for facet, result in r.facet_results.items()
                    }
                }
                for r in self.element_results
            ],
            'errors': self.errors,
            'warnings': self.warnings,
        }


class IDSValidator:
    """
    IDS 1.0 Validator

    Validates IFC elements against IDS specifications using 6-facet checks:
    1. Entity - Correct IFC class
    2. Attribute - Required IFC attributes (Name, Description, etc.)
    3. Property - Required property sets and properties
    4. Material - Required materials
    5. Classification - Required classification references
    6. PartOf - Required spatial/aggregation relationships
    """

    # IDS XML namespaces
    NAMESPACES = {
        'ids': 'http://standards.buildingsmart.org/IDS',
        'xs': 'http://www.w3.org/2001/XMLSchema',
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.specifications: List[Dict[str, Any]] = []

    async def load_ids_file(self, ids_path: Path) -> bool:
        """Load IDS XML file"""
        try:
            tree = etree.parse(str(ids_path))
            root = tree.getroot()

            self.specifications = self._parse_ids_xml(root)
            return True

        except Exception as e:
            logger.error(f"Error loading IDS file: {e}")
            return False

    async def load_ids_xml(self, ids_xml: str) -> bool:
        """Load IDS from XML string"""
        try:
            root = etree.fromstring(ids_xml.encode())
            self.specifications = self._parse_ids_xml(root)
            return True
        except Exception as e:
            logger.error(f"Error parsing IDS XML: {e}")
            return False

    def _parse_ids_xml(self, root: etree._Element) -> List[Dict[str, Any]]:
        """Parse IDS XML structure"""
        specifications = []

        # Find all specification elements
        for spec_elem in root.findall('.//ids:specification', self.NAMESPACES):
            spec = {
                'id': str(uuid.uuid4()),
                'name': spec_elem.get('name', 'Unnamed'),
                'description': spec_elem.get('description'),
                'ifcVersion': spec_elem.get('ifcVersion', 'IFC4'),
                'applicability': {},
                'requirements': [],
            }

            # Parse applicability
            applicability = spec_elem.find('ids:applicability', self.NAMESPACES)
            if applicability is not None:
                spec['applicability'] = self._parse_applicability(applicability)

            # Parse requirements
            requirements = spec_elem.find('ids:requirements', self.NAMESPACES)
            if requirements is not None:
                spec['requirements'] = self._parse_requirements(requirements)

            specifications.append(spec)

        return specifications

    def _parse_applicability(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse applicability criteria"""
        criteria = {
            'entity': None,
            'attribute': None,
            'property': None,
            'material': None,
            'classification': None,
            'partOf': None,
        }

        # Entity facet
        entity = elem.find('ids:entity', self.NAMESPACES)
        if entity is not None:
            name = entity.find('ids:name', self.NAMESPACES)
            if name is not None:
                criteria['entity'] = self._parse_value_constraint(name)

        # Property facet
        property_elem = elem.find('ids:property', self.NAMESPACES)
        if property_elem is not None:
            criteria['property'] = self._parse_property_facet(property_elem)

        # Classification facet
        classification = elem.find('ids:classification', self.NAMESPACES)
        if classification is not None:
            criteria['classification'] = self._parse_classification_facet(classification)

        return criteria

    def _parse_requirements(self, elem: etree._Element) -> List[Dict[str, Any]]:
        """Parse requirement facets"""
        requirements = []

        # Property requirements
        for prop in elem.findall('ids:property', self.NAMESPACES):
            req = {
                'facet': IDSFacet.PROPERTY,
                'data': self._parse_property_facet(prop),
            }
            requirements.append(req)

        # Attribute requirements
        for attr in elem.findall('ids:attribute', self.NAMESPACES):
            req = {
                'facet': IDSFacet.ATTRIBUTE,
                'data': self._parse_attribute_facet(attr),
            }
            requirements.append(req)

        # Material requirements
        for mat in elem.findall('ids:material', self.NAMESPACES):
            req = {
                'facet': IDSFacet.MATERIAL,
                'data': self._parse_material_facet(mat),
            }
            requirements.append(req)

        # Classification requirements
        for cls in elem.findall('ids:classification', self.NAMESPACES):
            req = {
                'facet': IDSFacet.CLASSIFICATION,
                'data': self._parse_classification_facet(cls),
            }
            requirements.append(req)

        # PartOf requirements
        for part in elem.findall('ids:partOf', self.NAMESPACES):
            req = {
                'facet': IDSFacet.PART_OF,
                'data': self._parse_partof_facet(part),
            }
            requirements.append(req)

        return requirements

    def _parse_value_constraint(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse value constraint (simpleValue, restriction, enumeration)"""
        constraint = {'type': None, 'value': None}

        simple = elem.find('ids:simpleValue', self.NAMESPACES)
        if simple is not None:
            constraint['type'] = 'simple'
            constraint['value'] = simple.text

        restriction = elem.find('xs:restriction', self.NAMESPACES)
        if restriction is not None:
            constraint['type'] = 'restriction'
            constraint['base'] = restriction.get('base')

            # Pattern
            pattern = restriction.find('xs:pattern', self.NAMESPACES)
            if pattern is not None:
                constraint['pattern'] = pattern.get('value')

            # Enumeration
            enumerations = restriction.findall('xs:enumeration', self.NAMESPACES)
            if enumerations:
                constraint['enumeration'] = [e.get('value') for e in enumerations]

        return constraint

    def _parse_property_facet(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse property facet"""
        data = {
            'propertySet': None,
            'baseName': None,
            'value': None,
            'dataType': elem.get('dataType'),
        }

        pset = elem.find('ids:propertySet', self.NAMESPACES)
        if pset is not None:
            data['propertySet'] = self._parse_value_constraint(pset)

        name = elem.find('ids:baseName', self.NAMESPACES)
        if name is not None:
            data['baseName'] = self._parse_value_constraint(name)

        value = elem.find('ids:value', self.NAMESPACES)
        if value is not None:
            data['value'] = self._parse_value_constraint(value)

        return data

    def _parse_attribute_facet(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse attribute facet"""
        data = {
            'name': None,
            'value': None,
        }

        name = elem.find('ids:name', self.NAMESPACES)
        if name is not None:
            data['name'] = self._parse_value_constraint(name)

        value = elem.find('ids:value', self.NAMESPACES)
        if value is not None:
            data['value'] = self._parse_value_constraint(value)

        return data

    def _parse_material_facet(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse material facet"""
        data = {
            'value': None,
        }

        value = elem.find('ids:value', self.NAMESPACES)
        if value is not None:
            data['value'] = self._parse_value_constraint(value)

        return data

    def _parse_classification_facet(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse classification facet"""
        data = {
            'system': None,
            'value': None,
        }

        system = elem.find('ids:system', self.NAMESPACES)
        if system is not None:
            data['system'] = self._parse_value_constraint(system)

        value = elem.find('ids:value', self.NAMESPACES)
        if value is not None:
            data['value'] = self._parse_value_constraint(value)

        return data

    def _parse_partof_facet(self, elem: etree._Element) -> Dict[str, Any]:
        """Parse partOf facet"""
        data = {
            'relation': elem.get('relation', 'IfcRelContainedInSpatialStructure'),
            'entity': None,
        }

        entity = elem.find('ids:entity', self.NAMESPACES)
        if entity is not None:
            name = entity.find('ids:name', self.NAMESPACES)
            if name is not None:
                data['entity'] = self._parse_value_constraint(name)

        return data

    async def validate(
        self,
        elements: List[Dict[str, Any]],
        relationships: Optional[List[Dict[str, Any]]] = None
    ) -> IDSValidationResult:
        """
        Validate elements against loaded IDS specifications.

        Args:
            elements: List of parsed IFC elements
            relationships: List of relationships between elements

        Returns:
            IDSValidationResult with detailed validation results
        """
        result = IDSValidationResult(
            success=True,
            specification_name=self.specifications[0]['name'] if self.specifications else 'Unknown',
            specification_version='1.0',
        )

        relationships = relationships or []

        for spec in self.specifications:
            # Find applicable elements
            applicable_elements = self._find_applicable_elements(
                elements, spec['applicability']
            )

            for element in applicable_elements:
                element_result = await self._validate_element(
                    element, spec, relationships
                )
                result.element_results.append(element_result)

                if element_result.passed:
                    result.passed_elements += 1
                else:
                    result.failed_elements += 1
                    result.success = False

        result.total_elements = len(result.element_results)
        result.pass_rate = (
            (result.passed_elements / result.total_elements * 100)
            if result.total_elements > 0 else 0
        )

        return result

    def _find_applicable_elements(
        self,
        elements: List[Dict[str, Any]],
        applicability: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Find elements that match applicability criteria"""
        applicable = []

        for element in elements:
            if self._element_matches_criteria(element, applicability):
                applicable.append(element)

        return applicable

    def _element_matches_criteria(
        self,
        element: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> bool:
        """Check if element matches applicability criteria"""
        # Entity check
        entity_criteria = criteria.get('entity')
        if entity_criteria:
            if not self._value_matches(element.get('ifc_class'), entity_criteria):
                return False

        # Property check
        property_criteria = criteria.get('property')
        if property_criteria:
            pset_name = property_criteria.get('propertySet', {}).get('value')
            prop_name = property_criteria.get('baseName', {}).get('value')

            if pset_name and prop_name:
                props = element.get('properties', {})
                if pset_name not in props:
                    return False
                if prop_name not in props.get(pset_name, {}):
                    return False

        return True

    async def _validate_element(
        self,
        element: Dict[str, Any],
        spec: Dict[str, Any],
        relationships: List[Dict[str, Any]]
    ) -> ElementValidation:
        """Validate a single element against specification requirements"""
        result = ElementValidation(
            element_guid=element.get('guid', 'Unknown'),
            element_name=element.get('name'),
            ifc_class=element.get('ifc_class', 'Unknown'),
            passed=True,
            specification_id=spec['id'],
        )

        for requirement in spec['requirements']:
            facet = requirement['facet']
            data = requirement['data']

            facet_result = await self._validate_facet(
                element, facet, data, relationships
            )
            result.facet_results[facet] = facet_result

            if facet_result.status == ValidationStatus.FAIL:
                result.passed = False

        return result

    async def _validate_facet(
        self,
        element: Dict[str, Any],
        facet: IDSFacet,
        data: Dict[str, Any],
        relationships: List[Dict[str, Any]]
    ) -> FacetResult:
        """Validate a single facet"""
        if facet == IDSFacet.PROPERTY:
            return await self._validate_property_facet(element, data)
        elif facet == IDSFacet.ATTRIBUTE:
            return await self._validate_attribute_facet(element, data)
        elif facet == IDSFacet.MATERIAL:
            return await self._validate_material_facet(element, data)
        elif facet == IDSFacet.CLASSIFICATION:
            return await self._validate_classification_facet(element, data)
        elif facet == IDSFacet.PART_OF:
            return await self._validate_partof_facet(element, data, relationships)
        else:
            return FacetResult(
                facet=facet,
                status=ValidationStatus.NOT_APPLICABLE,
                message="Facet not implemented"
            )

    async def _validate_property_facet(
        self,
        element: Dict[str, Any],
        data: Dict[str, Any]
    ) -> FacetResult:
        """Validate property facet"""
        pset_constraint = data.get('propertySet', {})
        prop_constraint = data.get('baseName', {})
        value_constraint = data.get('value')

        pset_name = pset_constraint.get('value')
        prop_name = prop_constraint.get('value')

        properties = element.get('properties', {})

        # Check if property set exists
        if pset_name not in properties:
            return FacetResult(
                facet=IDSFacet.PROPERTY,
                status=ValidationStatus.FAIL,
                message=f"Property set '{pset_name}' not found",
                details={'missing_pset': pset_name}
            )

        # Check if property exists
        if prop_name not in properties.get(pset_name, {}):
            return FacetResult(
                facet=IDSFacet.PROPERTY,
                status=ValidationStatus.FAIL,
                message=f"Property '{prop_name}' not found in '{pset_name}'",
                details={'missing_property': f"{pset_name}.{prop_name}"}
            )

        # Check value if specified
        if value_constraint:
            actual_value = properties[pset_name][prop_name]
            if not self._value_matches(actual_value, value_constraint):
                return FacetResult(
                    facet=IDSFacet.PROPERTY,
                    status=ValidationStatus.FAIL,
                    message=f"Property value mismatch for '{pset_name}.{prop_name}'",
                    details={
                        'property': f"{pset_name}.{prop_name}",
                        'expected': value_constraint.get('value'),
                        'actual': actual_value,
                    }
                )

        return FacetResult(
            facet=IDSFacet.PROPERTY,
            status=ValidationStatus.PASS,
            message=f"Property '{pset_name}.{prop_name}' validated"
        )

    async def _validate_attribute_facet(
        self,
        element: Dict[str, Any],
        data: Dict[str, Any]
    ) -> FacetResult:
        """Validate attribute facet"""
        name_constraint = data.get('name', {})
        value_constraint = data.get('value')

        attr_name = name_constraint.get('value')

        # Check common IFC attributes
        actual_value = element.get(attr_name.lower()) if attr_name else None

        if actual_value is None:
            return FacetResult(
                facet=IDSFacet.ATTRIBUTE,
                status=ValidationStatus.FAIL,
                message=f"Attribute '{attr_name}' not found",
                details={'missing_attribute': attr_name}
            )

        # Check value if specified
        if value_constraint:
            if not self._value_matches(actual_value, value_constraint):
                return FacetResult(
                    facet=IDSFacet.ATTRIBUTE,
                    status=ValidationStatus.FAIL,
                    message=f"Attribute value mismatch for '{attr_name}'",
                    details={
                        'attribute': attr_name,
                        'expected': value_constraint.get('value'),
                        'actual': actual_value,
                    }
                )

        return FacetResult(
            facet=IDSFacet.ATTRIBUTE,
            status=ValidationStatus.PASS,
            message=f"Attribute '{attr_name}' validated"
        )

    async def _validate_material_facet(
        self,
        element: Dict[str, Any],
        data: Dict[str, Any]
    ) -> FacetResult:
        """Validate material facet"""
        value_constraint = data.get('value')
        materials = element.get('materials', [])

        if not materials:
            return FacetResult(
                facet=IDSFacet.MATERIAL,
                status=ValidationStatus.FAIL,
                message="No materials assigned",
                details={'element_guid': element.get('guid')}
            )

        if value_constraint:
            expected = value_constraint.get('value')
            found = any(
                self._value_matches(m.get('name'), value_constraint)
                for m in materials
            )
            if not found:
                return FacetResult(
                    facet=IDSFacet.MATERIAL,
                    status=ValidationStatus.FAIL,
                    message=f"Required material '{expected}' not found",
                    details={
                        'expected_material': expected,
                        'actual_materials': [m.get('name') for m in materials],
                    }
                )

        return FacetResult(
            facet=IDSFacet.MATERIAL,
            status=ValidationStatus.PASS,
            message="Material requirement met"
        )

    async def _validate_classification_facet(
        self,
        element: Dict[str, Any],
        data: Dict[str, Any]
    ) -> FacetResult:
        """Validate classification facet"""
        system_constraint = data.get('system')
        value_constraint = data.get('value')
        classifications = element.get('classifications', [])

        if not classifications:
            return FacetResult(
                facet=IDSFacet.CLASSIFICATION,
                status=ValidationStatus.FAIL,
                message="No classifications assigned",
                details={'element_guid': element.get('guid')}
            )

        # Check system
        if system_constraint:
            system_name = system_constraint.get('value')
            found = any(
                c.get('source') == system_name or c.get('name') == system_name
                for c in classifications
            )
            if not found:
                return FacetResult(
                    facet=IDSFacet.CLASSIFICATION,
                    status=ValidationStatus.FAIL,
                    message=f"Classification system '{system_name}' not found",
                    details={'expected_system': system_name}
                )

        return FacetResult(
            facet=IDSFacet.CLASSIFICATION,
            status=ValidationStatus.PASS,
            message="Classification requirement met"
        )

    async def _validate_partof_facet(
        self,
        element: Dict[str, Any],
        data: Dict[str, Any],
        relationships: List[Dict[str, Any]]
    ) -> FacetResult:
        """Validate partOf facet"""
        relation = data.get('relation', 'IfcRelContainedInSpatialStructure')
        entity_constraint = data.get('entity')

        element_guid = element.get('guid')

        # Find relationships for this element
        element_rels = [
            r for r in relationships
            if r.get('source') == element_guid and r.get('type') in ['contained_in', 'aggregated_by']
        ]

        if not element_rels:
            return FacetResult(
                facet=IDSFacet.PART_OF,
                status=ValidationStatus.FAIL,
                message="Element not contained in any spatial structure",
                details={'element_guid': element_guid}
            )

        # Check entity type if specified
        if entity_constraint:
            expected_entity = entity_constraint.get('value')
            found = any(
                r.get('target_class') == expected_entity
                for r in element_rels
            )
            if not found:
                return FacetResult(
                    facet=IDSFacet.PART_OF,
                    status=ValidationStatus.FAIL,
                    message=f"Element not part of '{expected_entity}'",
                    details={'expected_entity': expected_entity}
                )

        return FacetResult(
            facet=IDSFacet.PART_OF,
            status=ValidationStatus.PASS,
            message="PartOf requirement met"
        )

    def _value_matches(
        self,
        actual: Any,
        constraint: Dict[str, Any]
    ) -> bool:
        """Check if value matches constraint"""
        constraint_type = constraint.get('type')
        expected = constraint.get('value')

        if constraint_type == 'simple':
            return str(actual) == str(expected)

        elif constraint_type == 'restriction':
            # Pattern matching
            pattern = constraint.get('pattern')
            if pattern:
                return bool(re.match(pattern, str(actual)))

            # Enumeration
            enumeration = constraint.get('enumeration')
            if enumeration:
                return str(actual) in enumeration

        return True
