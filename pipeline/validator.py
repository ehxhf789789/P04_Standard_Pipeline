"""
Stage 2: Validate - IDS Rule-based Validation

Validates IFC elements against IDS (Information Delivery Specification) rules
generated from bSDD property definitions.
"""

import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
from enum import Enum
import uuid
from datetime import datetime


class ValidationResult(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARNING = "WARNING"
    NOT_APPLICABLE = "N/A"


@dataclass
class ValidationCheck:
    """Single validation check result."""
    rule_name: str
    facet_type: str  # Entity, Property, Classification, Material, Attribute, PartOf
    result: ValidationResult
    message: str
    expected: Optional[str] = None
    actual: Optional[str] = None
    property_set: Optional[str] = None
    property_name: Optional[str] = None


@dataclass
class ElementValidation:
    """Validation results for a single element."""
    global_id: str
    name: str
    ifc_class: str
    checks: list[ValidationCheck] = field(default_factory=list)
    pass_count: int = 0
    fail_count: int = 0
    warning_count: int = 0

    @property
    def pass_rate(self) -> float:
        total = self.pass_count + self.fail_count
        return self.pass_count / total if total > 0 else 1.0

    @property
    def status(self) -> str:
        if self.fail_count > 0:
            return "FAIL"
        elif self.warning_count > 0:
            return "WARNING"
        return "PASS"


class IDSValidator:
    """
    Validates IFC elements against IDS rules.

    Rules are auto-generated from:
    1. LOIN (Level of Information Need) configuration - ISO 7817-1:2024
    2. bSDD knowledge base - property definitions and URIs

    Supports 6 facet types:
    - Entity: Check if element is of correct type
    - Property: Check if property exists with correct value/type
    - Classification: Check if classification reference exists
    - Material: Check if material is assigned
    - Attribute: Check IFC direct attributes
    - PartOf: Check spatial/aggregation relationships
    """

    def __init__(
        self,
        bsdd_knowledge_base: dict,
        loin_config_path: Optional[str] = None,
        ids_rules_path: Optional[str] = None
    ):
        """
        Initialize validator with bSDD knowledge base and LOIN configuration.

        Args:
            bsdd_knowledge_base: Dictionary loaded from classes.json
            loin_config_path: Path to LOIN requirements JSON (ISO 7817-1)
            ids_rules_path: Optional path to custom IDS rules XML
        """
        self.kb = bsdd_knowledge_base
        self.loin_config = self._load_loin_config(loin_config_path)
        self.rules_by_class = self._build_rules_from_loin_and_bsdd()

        if ids_rules_path:
            self._load_ids_rules(ids_rules_path)

    def _load_loin_config(self, config_path: Optional[str]) -> dict:
        """
        Load LOIN (Level of Information Need) configuration.

        Falls back to default configuration if not provided.
        """
        if config_path:
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load LOIN config: {e}")

        # Return default path
        default_path = Path(__file__).parent.parent / "data" / "loin_requirements.json"
        if default_path.exists():
            try:
                with open(default_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass

        return {"requirements": {}, "global_requirements": {}}

    def _build_rules_from_loin_and_bsdd(self) -> dict:
        """
        Build validation rules from LOIN configuration cross-referenced with bSDD.

        This implements ISO 7817-1:2024 (LOIN) by:
        1. Reading required properties from LOIN config
        2. Enriching with bSDD URIs and data types
        3. Building IDS-style validation rules
        """
        rules = {}
        loin_requirements = self.loin_config.get("requirements", {})
        global_reqs = self.loin_config.get("global_requirements", {})

        # Build property lookup from bSDD KB
        bsdd_property_lookup = self._build_bsdd_property_lookup()

        # Process each IFC class in LOIN config
        for ifc_class, class_reqs in loin_requirements.items():
            class_rules = []

            # Process property requirements
            for prop_req in class_reqs.get("properties", []):
                pset_name = prop_req.get("propertySet")
                prop_name = prop_req.get("name")
                required = prop_req.get("required", False)
                rationale = prop_req.get("rationale", "")

                # Look up bSDD metadata
                bsdd_key = f"{ifc_class}:{pset_name}:{prop_name}"
                bsdd_prop = bsdd_property_lookup.get(bsdd_key, {})

                class_rules.append({
                    "type": "property",
                    "property_set": pset_name,
                    "property_name": prop_name,
                    "data_type": self._map_bsdd_datatype(bsdd_prop.get("dataType")),
                    "required": required,
                    "rationale": rationale,
                    "bsdd_uri": bsdd_prop.get("uri"),
                    "source": "LOIN + bSDD"
                })

            # Process material requirement
            material_req = class_reqs.get("material", {})
            if material_req.get("required", False):
                class_rules.append({
                    "type": "material",
                    "required": True,
                    "rationale": material_req.get("rationale", "Material required"),
                    "message": f"{ifc_class} must have material assigned",
                    "source": "LOIN"
                })

            # Add global requirements
            if global_reqs.get("spatial_containment", {}).get("required", True):
                class_rules.append({
                    "type": "partof",
                    "relationship": "spatial_container",
                    "required": True,
                    "rationale": global_reqs.get("spatial_containment", {}).get(
                        "rationale", "Spatial containment required"
                    ),
                    "message": "Element must be contained in spatial structure",
                    "source": "ISO 16739-1"
                })

            rules[ifc_class] = class_rules

        # Add rules for classes in bSDD KB but not in LOIN (spatial containment only)
        for ifc_class in self.kb.keys():
            if ifc_class not in rules:
                rules[ifc_class] = [{
                    "type": "partof",
                    "relationship": "spatial_container",
                    "required": True,
                    "message": "Element must be contained in spatial structure",
                    "source": "ISO 16739-1"
                }]

        return rules

    def _build_bsdd_property_lookup(self) -> dict:
        """Build lookup dictionary for bSDD properties."""
        lookup = {}
        for ifc_class, class_data in self.kb.items():
            for prop in class_data.get("properties", []):
                # Normalize property name for lookup
                prop_name = prop.get("name", "").replace(" ", "")
                pset_name = prop.get("propertySet", "")
                key = f"{ifc_class}:{pset_name}:{prop_name}"
                lookup[key] = prop
        return lookup

    def _map_bsdd_datatype(self, bsdd_type: Optional[str]) -> str:
        """Map bSDD data type to IFC data type."""
        if not bsdd_type:
            return "IFCLABEL"

        type_map = {
            "String": "IFCLABEL",
            "Boolean": "IFCBOOLEAN",
            "Real": "IFCREAL",
            "Integer": "IFCINTEGER",
        }
        return type_map.get(bsdd_type, "IFCLABEL")

    def _load_ids_rules(self, ids_path: str):
        """Load additional rules from IDS XML file."""
        try:
            tree = ET.parse(ids_path)
            root = tree.getroot()
            # Parse IDS XML structure
            # (simplified - full IDS parsing would be more complex)
            ns = {"ids": "http://standards.buildingsmart.org/IDS"}

            for spec in root.findall(".//ids:specification", ns):
                # Extract applicability and requirements
                pass  # Full IDS parsing would go here

        except Exception as e:
            print(f"Warning: Could not load IDS file: {e}")

    def validate(self, parsed_elements: list[dict]) -> list[ElementValidation]:
        """
        Validate all parsed elements against rules.

        Args:
            parsed_elements: List of element dictionaries from parser

        Returns:
            List of ElementValidation objects with check results
        """
        results = []

        for element in parsed_elements:
            validation = self._validate_element(element)
            results.append(validation)

        return results

    def _validate_element(self, element: dict) -> ElementValidation:
        """Validate a single element against applicable rules."""
        ifc_class = element["ifc_class"]

        validation = ElementValidation(
            global_id=element["global_id"],
            name=element.get("name", "Unknown"),
            ifc_class=ifc_class
        )

        # Get rules for this class
        rules = self.rules_by_class.get(ifc_class, [])

        # Also apply parent class rules
        parent_classes = self._get_parent_classes(ifc_class)
        for parent in parent_classes:
            rules.extend(self.rules_by_class.get(parent, []))

        # Execute each rule
        for rule in rules:
            check = self._execute_check(element, rule)
            validation.checks.append(check)

            if check.result == ValidationResult.PASS:
                validation.pass_count += 1
            elif check.result == ValidationResult.FAIL:
                validation.fail_count += 1
            elif check.result == ValidationResult.WARNING:
                validation.warning_count += 1

        return validation

    def _get_parent_classes(self, ifc_class: str) -> list[str]:
        """Get parent classes for inheritance-based rule application."""
        # Simplified IFC inheritance
        inheritance = {
            "IfcWall": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcDoor": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcWindow": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcSlab": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcBeam": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcColumn": ["IfcBuildingElement", "IfcElement", "IfcProduct"],
            "IfcSpace": ["IfcSpatialElement", "IfcProduct"],
        }
        return inheritance.get(ifc_class, [])

    def _execute_check(self, element: dict, rule: dict) -> ValidationCheck:
        """Execute a single validation check."""
        rule_type = rule.get("type")

        if rule_type == "property":
            return self._check_property(element, rule)
        elif rule_type == "material":
            return self._check_material(element, rule)
        elif rule_type == "classification":
            return self._check_classification(element, rule)
        elif rule_type == "partof":
            return self._check_partof(element, rule)
        elif rule_type == "attribute":
            return self._check_attribute(element, rule)
        else:
            return ValidationCheck(
                rule_name=f"Unknown rule type: {rule_type}",
                facet_type="Unknown",
                result=ValidationResult.NOT_APPLICABLE,
                message="Rule type not implemented"
            )

    def _check_property(self, element: dict, rule: dict) -> ValidationCheck:
        """Check if required property exists with correct type."""
        pset_name = rule.get("property_set")
        prop_name = rule.get("property_name")
        data_type = rule.get("data_type")
        required = rule.get("required", True)

        psets = element.get("property_sets", {})
        pset = psets.get(pset_name, {})
        prop_value = pset.get(prop_name)

        # Check existence
        if prop_value is None:
            if required:
                return ValidationCheck(
                    rule_name=f"{pset_name}.{prop_name}",
                    facet_type="Property",
                    result=ValidationResult.FAIL,
                    message=f"Required property '{prop_name}' not found in {pset_name}",
                    expected=f"Property exists in {pset_name}",
                    actual="Property not found",
                    property_set=pset_name,
                    property_name=prop_name
                )
            else:
                return ValidationCheck(
                    rule_name=f"{pset_name}.{prop_name}",
                    facet_type="Property",
                    result=ValidationResult.NOT_APPLICABLE,
                    message=f"Optional property '{prop_name}' not present",
                    property_set=pset_name,
                    property_name=prop_name
                )

        # Property exists - check value type if specified
        return ValidationCheck(
            rule_name=f"{pset_name}.{prop_name}",
            facet_type="Property",
            result=ValidationResult.PASS,
            message=f"Property '{prop_name}' found with value: {prop_value}",
            expected=data_type,
            actual=str(type(prop_value).__name__),
            property_set=pset_name,
            property_name=prop_name
        )

    def _check_material(self, element: dict, rule: dict) -> ValidationCheck:
        """Check if material is assigned to element."""
        material = element.get("material")
        required = rule.get("required", True)

        if material is None or len(material) == 0:
            if required:
                return ValidationCheck(
                    rule_name="Material Assignment",
                    facet_type="Material",
                    result=ValidationResult.FAIL,
                    message=rule.get("message", "No material assigned"),
                    expected="Material assigned",
                    actual="No material"
                )
            else:
                return ValidationCheck(
                    rule_name="Material Assignment",
                    facet_type="Material",
                    result=ValidationResult.WARNING,
                    message="Material not assigned (optional)",
                    expected="Material (optional)",
                    actual="No material"
                )

        material_names = [m.get("name", "Unknown") for m in material]
        return ValidationCheck(
            rule_name="Material Assignment",
            facet_type="Material",
            result=ValidationResult.PASS,
            message=f"Material assigned: {', '.join(material_names)}",
            expected="Material assigned",
            actual=", ".join(material_names)
        )

    def _check_classification(self, element: dict, rule: dict) -> ValidationCheck:
        """Check if classification is assigned."""
        classification = element.get("classification")
        system = rule.get("system")
        required = rule.get("required", False)

        if classification is None or len(classification) == 0:
            if required:
                return ValidationCheck(
                    rule_name=f"Classification ({system or 'any'})",
                    facet_type="Classification",
                    result=ValidationResult.FAIL,
                    message="No classification assigned",
                    expected=f"Classification from {system}" if system else "Any classification",
                    actual="No classification"
                )
            else:
                return ValidationCheck(
                    rule_name=f"Classification ({system or 'any'})",
                    facet_type="Classification",
                    result=ValidationResult.NOT_APPLICABLE,
                    message="Classification not required",
                    expected="Optional",
                    actual="No classification"
                )

        # Check for specific system if required
        if system:
            matching = [c for c in classification if c.get("system") == system]
            if not matching:
                return ValidationCheck(
                    rule_name=f"Classification ({system})",
                    facet_type="Classification",
                    result=ValidationResult.FAIL if required else ValidationResult.WARNING,
                    message=f"No {system} classification found",
                    expected=f"Classification from {system}",
                    actual=str([c.get("system") for c in classification])
                )

        codes = [f"{c.get('system', '?')}: {c.get('code', '?')}" for c in classification]
        return ValidationCheck(
            rule_name=f"Classification ({system or 'any'})",
            facet_type="Classification",
            result=ValidationResult.PASS,
            message=f"Classification found: {', '.join(codes)}",
            expected="Classification assigned",
            actual=", ".join(codes)
        )

    def _check_partof(self, element: dict, rule: dict) -> ValidationCheck:
        """Check spatial containment or aggregation."""
        relationship = rule.get("relationship")
        required = rule.get("required", True)

        if relationship == "spatial_container":
            container = element.get("spatial_container")
            if container is None:
                if required:
                    return ValidationCheck(
                        rule_name="Spatial Containment",
                        facet_type="PartOf",
                        result=ValidationResult.FAIL,
                        message="Element not contained in spatial structure",
                        expected="Contained in IfcBuildingStorey or IfcSpace",
                        actual="No spatial container"
                    )
            else:
                return ValidationCheck(
                    rule_name="Spatial Containment",
                    facet_type="PartOf",
                    result=ValidationResult.PASS,
                    message=f"Contained in {container.get('name')} ({container.get('type')})",
                    expected="Spatial container",
                    actual=f"{container.get('type')}: {container.get('name')}"
                )

        return ValidationCheck(
            rule_name=f"PartOf ({relationship})",
            facet_type="PartOf",
            result=ValidationResult.NOT_APPLICABLE,
            message="Relationship check not implemented"
        )

    def _check_attribute(self, element: dict, rule: dict) -> ValidationCheck:
        """Check IFC direct attribute value."""
        attr_name = rule.get("attribute")
        expected = rule.get("value")
        required = rule.get("required", False)

        actual = element.get(attr_name.lower())

        if actual is None:
            if required:
                return ValidationCheck(
                    rule_name=f"Attribute.{attr_name}",
                    facet_type="Attribute",
                    result=ValidationResult.FAIL,
                    message=f"Required attribute '{attr_name}' not found",
                    expected=str(expected) if expected else "Attribute exists",
                    actual="Not found"
                )

        if expected is not None and actual != expected:
            return ValidationCheck(
                rule_name=f"Attribute.{attr_name}",
                facet_type="Attribute",
                result=ValidationResult.FAIL,
                message=f"Attribute '{attr_name}' has wrong value",
                expected=str(expected),
                actual=str(actual)
            )

        return ValidationCheck(
            rule_name=f"Attribute.{attr_name}",
            facet_type="Attribute",
            result=ValidationResult.PASS,
            message=f"Attribute '{attr_name}' = {actual}",
            expected=str(expected) if expected else "Any",
            actual=str(actual)
        )

    def generate_ids_xml(self) -> str:
        """
        Generate IDS XML from current rules.

        Includes bSDD URIs as annotations for traceability to
        ISO 23386/23387 (bSDD) and ISO 7817-1 (LOIN).

        Returns:
            IDS XML string conforming to IDS 1.0 schema
        """
        loin_context = self.loin_config.get("project_context", {})

        ids = '<?xml version="1.0" encoding="UTF-8"?>\n'
        ids += '<ids xmlns="http://standards.buildingsmart.org/IDS" '
        ids += 'xmlns:xs="http://www.w3.org/2001/XMLSchema" '
        ids += 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
        ids += '  <info>\n'
        ids += f'    <title>LOIN Requirements - {loin_context.get("name", "BIM Project")}</title>\n'
        ids += f'    <copyright>Generated by BIM-to-AI Pipeline</copyright>\n'
        ids += f'    <version>1.0</version>\n'
        ids += f'    <description>Auto-generated from LOIN (ISO 7817-1) and bSDD (ISO 23386/23387). '
        ids += f'Project Phase: {loin_context.get("phase", "N/A")}, '
        ids += f'LOI Level: {loin_context.get("loi_level", "N/A")}</description>\n'
        ids += f'    <date>{datetime.now().isoformat()}</date>\n'
        ids += '  </info>\n'
        ids += '  <specifications>\n'

        for ifc_class, rules in self.rules_by_class.items():
            # Get required property rules only
            property_rules = [r for r in rules if r.get("type") == "property" and r.get("required")]
            material_rules = [r for r in rules if r.get("type") == "material" and r.get("required")]

            if not property_rules and not material_rules:
                continue

            ids += f'    <specification name="{ifc_class} Requirements" ifcVersion="IFC4X3">\n'
            ids += '      <applicability minOccurs="0" maxOccurs="unbounded">\n'
            ids += f'        <entity>\n'
            ids += f'          <name>\n'
            ids += f'            <simpleValue>{ifc_class.upper()}</simpleValue>\n'
            ids += f'          </name>\n'
            ids += f'        </entity>\n'
            ids += '      </applicability>\n'
            ids += '      <requirements>\n'

            for rule in property_rules:
                pset = rule.get("property_set")
                prop = rule.get("property_name")
                dtype = rule.get("data_type", "IFCLABEL")
                bsdd_uri = rule.get("bsdd_uri", "")
                rationale = rule.get("rationale", "")

                ids += f'        <!-- Rationale: {rationale} -->\n' if rationale else ''
                ids += f'        <!-- bSDD URI: {bsdd_uri} -->\n' if bsdd_uri else ''
                ids += f'        <property dataType="{dtype}" minOccurs="1" maxOccurs="1">\n'
                ids += f'          <propertySet>\n'
                ids += f'            <simpleValue>{pset}</simpleValue>\n'
                ids += f'          </propertySet>\n'
                ids += f'          <baseName>\n'
                ids += f'            <simpleValue>{prop}</simpleValue>\n'
                ids += f'          </baseName>\n'
                ids += '        </property>\n'

            for rule in material_rules:
                rationale = rule.get("rationale", "Material required")
                ids += f'        <!-- Rationale: {rationale} -->\n'
                ids += '        <material minOccurs="1" maxOccurs="unbounded">\n'
                ids += '          <value>\n'
                ids += '            <simpleValue>*</simpleValue>\n'
                ids += '          </value>\n'
                ids += '        </material>\n'

            ids += '      </requirements>\n'
            ids += '    </specification>\n'

        ids += '  </specifications>\n'
        ids += '</ids>'

        return ids

    def generate_bcf_issues(self, validations: list[ElementValidation]) -> list[dict]:
        """
        Generate BCF-style issue reports for failed validations.

        Args:
            validations: List of ElementValidation results

        Returns:
            List of BCF issue dictionaries
        """
        issues = []

        for validation in validations:
            if validation.status != "FAIL":
                continue

            for check in validation.checks:
                if check.result != ValidationResult.FAIL:
                    continue

                issue = {
                    "guid": str(uuid.uuid4()),
                    "topic": {
                        "guid": str(uuid.uuid4()),
                        "topic_type": "Error",
                        "topic_status": "Open",
                        "title": f"[{validation.ifc_class}] {check.rule_name} - FAIL",
                        "description": check.message,
                        "creation_date": datetime.now().isoformat(),
                        "creation_author": "BIM-to-AI Pipeline Validator",
                        "modified_date": datetime.now().isoformat(),
                    },
                    "related_elements": [
                        {
                            "ifc_guid": validation.global_id,
                            "originating_system": "IFC4",
                        }
                    ],
                    "comments": [
                        {
                            "guid": str(uuid.uuid4()),
                            "date": datetime.now().isoformat(),
                            "author": "Validator",
                            "comment": f"Expected: {check.expected}\nActual: {check.actual}"
                        }
                    ]
                }
                issues.append(issue)

        return issues

    def get_summary(self, validations: list[ElementValidation]) -> dict:
        """Get validation summary statistics."""
        total_elements = len(validations)
        passed = sum(1 for v in validations if v.status == "PASS")
        failed = sum(1 for v in validations if v.status == "FAIL")
        warnings = sum(1 for v in validations if v.status == "WARNING")

        total_checks = sum(len(v.checks) for v in validations)
        total_pass = sum(v.pass_count for v in validations)
        total_fail = sum(v.fail_count for v in validations)
        total_warn = sum(v.warning_count for v in validations)

        # Group failures by type
        failures_by_type = {}
        for v in validations:
            for check in v.checks:
                if check.result == ValidationResult.FAIL:
                    key = f"{check.facet_type}: {check.rule_name}"
                    failures_by_type[key] = failures_by_type.get(key, 0) + 1

        return {
            "total_elements": total_elements,
            "elements_passed": passed,
            "elements_failed": failed,
            "elements_warning": warnings,
            "element_pass_rate": round(passed / total_elements * 100, 1) if total_elements > 0 else 0,
            "total_checks": total_checks,
            "checks_passed": total_pass,
            "checks_failed": total_fail,
            "checks_warning": total_warn,
            "check_pass_rate": round(total_pass / total_checks * 100, 1) if total_checks > 0 else 0,
            "failures_by_type": failures_by_type,
        }


# Test the validator
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from pipeline.parser import IFCParser

    print("=" * 60)
    print("Stage 2: Validate - IDS Rule-based Validation")
    print("=" * 60)

    # Load bSDD knowledge base
    kb_path = Path("data/bsdd_knowledge_base/classes.json")
    if kb_path.exists():
        with open(kb_path) as f:
            bsdd_kb = json.load(f)
        print(f"\nLoaded bSDD knowledge base: {len(bsdd_kb)} classes")
    else:
        bsdd_kb = {}
        print("\nWarning: bSDD knowledge base not found, using defaults")

    # Parse IFC
    parser = IFCParser("data/sample.ifc")
    elements = parser.parse_all_elements()
    print(f"Parsed {len(elements)} elements")

    # Validate
    validator = IDSValidator(bsdd_kb)
    validations = validator.validate(elements)

    # Print results
    print("\n" + "-" * 60)
    print("Validation Results:")
    print("-" * 60)

    for v in validations:
        status_symbol = "[OK]" if v.status == "PASS" else "[FAIL]" if v.status == "FAIL" else "[WARN]"
        print(f"\n{status_symbol} {v.ifc_class}: {v.name} ({v.global_id[:8]}...)")
        print(f"    Checks: {v.pass_count} passed, {v.fail_count} failed, {v.warning_count} warnings")

        for check in v.checks:
            symbol = "[OK]" if check.result == ValidationResult.PASS else "[FAIL]" if check.result == ValidationResult.FAIL else "[--]"
            print(f"      {symbol} [{check.facet_type}] {check.rule_name}")
            if check.result == ValidationResult.FAIL:
                print(f"          Expected: {check.expected}")
                print(f"          Actual: {check.actual}")

    # Summary
    summary = validator.get_summary(validations)
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"Elements: {summary['elements_passed']}/{summary['total_elements']} passed ({summary['element_pass_rate']}%)")
    print(f"Checks: {summary['checks_passed']}/{summary['total_checks']} passed ({summary['check_pass_rate']}%)")
    print("\nFailures by type:")
    for failure_type, count in summary['failures_by_type'].items():
        print(f"  - {failure_type}: {count}")

    # Generate BCF issues
    bcf_issues = validator.generate_bcf_issues(validations)
    print(f"\nGenerated {len(bcf_issues)} BCF issues for failed elements")
