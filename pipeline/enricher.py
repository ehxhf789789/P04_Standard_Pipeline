"""
Stage 3: Enrich - bSDD Property Standardization

Enriches parsed IFC elements with:
- Standardized property names from bSDD
- bSDD URIs (global identifiers)
- Unit normalization
- Classification cross-linking
"""

import json
import re
import requests
import urllib3
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@dataclass
class StandardizedProperty:
    """A property standardized against bSDD."""
    original_name: str
    standard_name: str
    original_value: any
    normalized_value: any
    property_set: str
    bsdd_uri: Optional[str] = None
    data_type: Optional[str] = None
    unit: Optional[str] = None
    mapping_status: str = "MAPPED"  # MAPPED, FUZZY_MATCH, NOT_FOUND


@dataclass
class EnrichedElement:
    """An element enriched with bSDD standardization."""
    global_id: str
    ifc_class: str
    name: str
    original_properties: dict
    standardized_properties: dict = field(default_factory=dict)
    bsdd_class_uri: Optional[str] = None
    classification_links: dict = field(default_factory=dict)
    enrichment_stats: dict = field(default_factory=dict)


class BSDDEnricher:
    """
    Enriches IFC elements using bSDD knowledge base.

    Performs:
    1. Property name standardization (fuzzy matching)
    2. Unit normalization
    3. Value type conversion
    4. Classification cross-linking
    """

    BSDD_BASE = "https://api.bsdd.buildingsmart.org"
    IFC_43_BASE = "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3"

    # Common property name variations (for fuzzy matching)
    PROPERTY_ALIASES = {
        # Fire related
        "firerating": ["fire rating", "fire_rating", "fire-rating", "firerated"],
        "isexternal": ["is external", "is_external", "external"],
        "loadbearing": ["load bearing", "load_bearing", "load-bearing", "structural"],
        "thermaltransmittance": ["thermal transmittance", "u-value", "u_value", "uvalue"],
        "acousticrating": ["acoustic rating", "acoustic_rating", "sound rating"],
        "combustible": ["is combustible", "is_combustible", "flammable"],

        # Korean aliases (for demonstration)
        "firerating": ["firerating", "firerating", "firerating"],
    }

    # Unit conversion factors (to SI base units)
    UNIT_CONVERSIONS = {
        # Length to mm
        "length": {
            "m": 1000, "cm": 10, "mm": 1, "in": 25.4, "ft": 304.8, "inch": 25.4, "feet": 304.8
        },
        # Area to m^2
        "area": {
            "m2": 1, "m^2": 1, "cm2": 0.0001, "mm2": 0.000001, "ft2": 0.0929, "sqft": 0.0929
        },
        # Time to minutes
        "time": {
            "min": 1, "minute": 1, "minutes": 1, "h": 60, "hr": 60, "hour": 60, "hours": 60,
            "s": 1/60, "sec": 1/60, "second": 1/60
        },
        # Thermal transmittance to W/(m^2*K)
        "thermal": {
            "w/(m2k)": 1, "w/m2k": 1, "btu/(h*ft2*f)": 5.678
        }
    }

    def __init__(self, knowledge_base_path: str, classification_map_path: Optional[str] = None):
        """
        Initialize enricher with bSDD knowledge base.

        Args:
            knowledge_base_path: Path to classes.json from data collector
            classification_map_path: Optional path to classification_map.json
        """
        with open(knowledge_base_path, 'r', encoding='utf-8') as f:
            self.kb = json.load(f)

        self.classification_map = {}
        if classification_map_path and Path(classification_map_path).exists():
            with open(classification_map_path, 'r', encoding='utf-8') as f:
                self.classification_map = json.load(f)

        # Build property lookup index
        self._property_index = self._build_property_index()

        # Session for API calls
        self.session = requests.Session()
        self.session.verify = False

    def _build_property_index(self) -> dict:
        """Build an index for fast property lookup."""
        index = {}

        for ifc_class, class_data in self.kb.items():
            for prop in class_data.get("properties", []):
                # Index by normalized property name
                key = self._normalize_name(prop.get("name", ""))
                if key not in index:
                    index[key] = []
                index[key].append({
                    "ifc_class": ifc_class,
                    "standard_name": prop.get("name"),
                    "property_set": prop.get("propertySet"),
                    "uri": prop.get("uri"),
                    "data_type": prop.get("dataType"),
                    "unit": prop.get("unit"),
                    "definition": prop.get("definition")
                })

        return index

    def _normalize_name(self, name: str) -> str:
        """Normalize property name for matching."""
        if not name:
            return ""
        return name.lower().replace(" ", "").replace("_", "").replace("-", "")

    def enrich_element(self, element: dict) -> EnrichedElement:
        """
        Enrich a single parsed element with bSDD standardization.

        Args:
            element: Parsed element dictionary from parser

        Returns:
            EnrichedElement with standardized properties
        """
        ifc_class = element["ifc_class"]

        enriched = EnrichedElement(
            global_id=element["global_id"],
            ifc_class=ifc_class,
            name=element.get("name", "Unknown"),
            original_properties=element.get("property_sets", {}),
            bsdd_class_uri=f"{self.IFC_43_BASE}/class/{ifc_class}"
        )

        # Statistics
        total_props = 0
        mapped_props = 0
        fuzzy_matched = 0
        not_found = 0

        # Process each property set
        for pset_name, properties in element.get("property_sets", {}).items():
            for prop_name, prop_value in properties.items():
                total_props += 1

                # Look up in bSDD
                standard_prop = self._lookup_property(ifc_class, pset_name, prop_name)

                if standard_prop:
                    # Normalize value
                    normalized_value = self._normalize_value(
                        prop_value,
                        standard_prop.get("data_type"),
                        standard_prop.get("unit")
                    )

                    mapping_status = standard_prop.get("match_type", "MAPPED")
                    if mapping_status == "MAPPED":
                        mapped_props += 1
                    elif mapping_status == "FUZZY_MATCH":
                        fuzzy_matched += 1

                    key = f"{pset_name}.{standard_prop['standard_name']}"
                    enriched.standardized_properties[key] = StandardizedProperty(
                        original_name=prop_name,
                        standard_name=standard_prop["standard_name"],
                        original_value=prop_value,
                        normalized_value=normalized_value,
                        property_set=pset_name,
                        bsdd_uri=standard_prop.get("uri"),
                        data_type=standard_prop.get("data_type"),
                        unit=standard_prop.get("unit"),
                        mapping_status=mapping_status
                    )
                else:
                    not_found += 1
                    key = f"{pset_name}.{prop_name}"
                    enriched.standardized_properties[key] = StandardizedProperty(
                        original_name=prop_name,
                        standard_name=prop_name,
                        original_value=prop_value,
                        normalized_value=prop_value,
                        property_set=pset_name,
                        mapping_status="NOT_FOUND"
                    )

        # Cross-link classification
        enriched.classification_links = self._cross_link_classification(ifc_class)

        # Store stats
        enriched.enrichment_stats = {
            "total_properties": total_props,
            "mapped_exact": mapped_props,
            "mapped_fuzzy": fuzzy_matched,
            "not_found": not_found,
            "mapping_rate": round((mapped_props + fuzzy_matched) / total_props * 100, 1) if total_props > 0 else 0
        }

        return enriched

    def _lookup_property(self, ifc_class: str, pset_name: str, prop_name: str) -> Optional[dict]:
        """
        Look up property in bSDD knowledge base.

        Priority:
        1. Exact match (pset_name + prop_name)
        2. Fuzzy match (normalized prop_name)
        3. API lookup (if not found locally)
        """
        normalized = self._normalize_name(prop_name)

        # 1. Exact match in class properties
        class_data = self.kb.get(ifc_class, {})
        for prop in class_data.get("properties", []):
            if (prop.get("propertySet") == pset_name and
                self._normalize_name(prop.get("name", "")) == normalized):
                return {
                    "standard_name": prop.get("name"),
                    "uri": prop.get("uri"),
                    "data_type": prop.get("dataType"),
                    "unit": prop.get("unit"),
                    "match_type": "MAPPED"
                }

        # 2. Fuzzy match using property index
        if normalized in self._property_index:
            candidates = self._property_index[normalized]
            # Prefer same class
            for candidate in candidates:
                if candidate["ifc_class"] == ifc_class:
                    return {
                        "standard_name": candidate["standard_name"],
                        "uri": candidate["uri"],
                        "data_type": candidate["data_type"],
                        "unit": candidate["unit"],
                        "match_type": "FUZZY_MATCH"
                    }
            # Otherwise return first match
            if candidates:
                candidate = candidates[0]
                return {
                    "standard_name": candidate["standard_name"],
                    "uri": candidate["uri"],
                    "data_type": candidate["data_type"],
                    "unit": candidate["unit"],
                    "match_type": "FUZZY_MATCH"
                }

        # 3. Check aliases
        for standard_name, aliases in self.PROPERTY_ALIASES.items():
            if normalized in [self._normalize_name(a) for a in aliases]:
                if standard_name in self._property_index:
                    candidate = self._property_index[standard_name][0]
                    return {
                        "standard_name": candidate["standard_name"],
                        "uri": candidate["uri"],
                        "data_type": candidate["data_type"],
                        "unit": candidate["unit"],
                        "match_type": "FUZZY_MATCH"
                    }

        # 4. API lookup (optional, can be slow)
        # return self._api_lookup(prop_name)

        return None

    def _api_lookup(self, prop_name: str) -> Optional[dict]:
        """Look up property using bSDD API (real-time)."""
        try:
            response = self.session.get(
                f"{self.BSDD_BASE}/api/SearchInDictionary/v1",
                params={
                    "DictionaryUri": f"{self.IFC_43_BASE}",
                    "SearchText": prop_name,
                    "LanguageCode": "EN"
                },
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                # Parse results...
                pass
        except:
            pass
        return None

    def _normalize_value(self, value: any, data_type: Optional[str], unit: Optional[str]) -> any:
        """
        Normalize property value based on data type and unit.

        Examples:
        - "2HR" -> "P2H" (ISO 8601 duration)
        - "120 minutes" -> "P2H"
        - "2.5 m" -> 2500 (mm)
        """
        if value is None:
            return None

        str_value = str(value).strip()

        # Fire rating normalization (time-based)
        if data_type in ["IFCLABEL", "STRING"] and any(x in str_value.upper() for x in ["HR", "HOUR", "MIN"]):
            return self._normalize_fire_rating(str_value)

        # Boolean normalization
        if data_type == "IFCBOOLEAN":
            if isinstance(value, bool):
                return value
            str_lower = str_value.lower()
            if str_lower in ["true", "yes", "1", "t"]:
                return True
            elif str_lower in ["false", "no", "0", "f"]:
                return False
            return value

        # Numeric with unit
        if data_type in ["IFCREAL", "IFCLENGTHMEASURE", "IFCAREAMEASURE", "IFCTHERMALTRANSMITTANCEMEASURE"]:
            return self._normalize_numeric(str_value, unit)

        return value

    def _normalize_fire_rating(self, value: str) -> str:
        """
        Normalize fire rating to ISO 8601 duration.

        Examples:
        - "2HR" -> "P2H"
        - "2 Hour" -> "P2H"
        - "120" (minutes) -> "P2H"
        - "90 min" -> "P1H30M"
        """
        value = value.upper().strip()

        # Pattern: number + unit
        match = re.match(r'(\d+\.?\d*)\s*(HR|HOUR|HOURS?|H|MIN|MINUTES?|M)?', value)
        if match:
            num = float(match.group(1))
            unit = match.group(2) or ""

            if unit in ["HR", "HOUR", "HOURS", "H"]:
                # Hours
                hours = int(num)
                minutes = int((num - hours) * 60)
                if minutes > 0:
                    return f"P{hours}H{minutes}M"
                return f"P{hours}H"
            elif unit in ["MIN", "MINUTES", "M"] or not unit:
                # Minutes (or assume minutes if no unit)
                total_minutes = int(num)
                hours = total_minutes // 60
                minutes = total_minutes % 60
                if hours > 0 and minutes > 0:
                    return f"P{hours}H{minutes}M"
                elif hours > 0:
                    return f"P{hours}H"
                else:
                    return f"P{minutes}M"

        return value

    def _normalize_numeric(self, value: str, target_unit: Optional[str]) -> any:
        """Normalize numeric value with unit conversion."""
        # Extract number and unit from value
        match = re.match(r'(-?\d+\.?\d*)\s*(\w+)?', str(value))
        if match:
            num = float(match.group(1))
            unit = match.group(2)

            if unit and target_unit:
                # Find conversion factor
                for unit_type, conversions in self.UNIT_CONVERSIONS.items():
                    if unit.lower() in conversions:
                        factor = conversions[unit.lower()]
                        return round(num * factor, 4)

            return num

        try:
            return float(value)
        except:
            return value

    def _cross_link_classification(self, ifc_class: str) -> dict:
        """
        Get cross-linked classification codes for an IFC class.

        Returns mapping between Uniclass, OmniClass, and bSDD.
        """
        if ifc_class in self.classification_map:
            return self.classification_map[ifc_class]

        return {
            "uniclass2015": None,
            "omniclass": None,
            "bsdd": {"uri": f"{self.IFC_43_BASE}/class/{ifc_class}"}
        }

    def enrich_all(self, elements: list[dict]) -> list[EnrichedElement]:
        """Enrich all parsed elements."""
        return [self.enrich_element(el) for el in elements]

    def get_enrichment_summary(self, enriched_elements: list[EnrichedElement]) -> dict:
        """Get summary statistics for enrichment."""
        total_props = sum(e.enrichment_stats.get("total_properties", 0) for e in enriched_elements)
        mapped_exact = sum(e.enrichment_stats.get("mapped_exact", 0) for e in enriched_elements)
        mapped_fuzzy = sum(e.enrichment_stats.get("mapped_fuzzy", 0) for e in enriched_elements)
        not_found = sum(e.enrichment_stats.get("not_found", 0) for e in enriched_elements)

        # Elements with classification links
        with_classification = sum(1 for e in enriched_elements if e.classification_links.get("uniclass2015"))

        return {
            "total_elements": len(enriched_elements),
            "total_properties": total_props,
            "properties_mapped_exact": mapped_exact,
            "properties_mapped_fuzzy": mapped_fuzzy,
            "properties_not_found": not_found,
            "overall_mapping_rate": round((mapped_exact + mapped_fuzzy) / total_props * 100, 1) if total_props > 0 else 0,
            "elements_with_classification": with_classification,
        }


def enriched_to_dict(enriched: EnrichedElement) -> dict:
    """Convert EnrichedElement to dictionary for serialization."""
    return {
        "global_id": enriched.global_id,
        "ifc_class": enriched.ifc_class,
        "name": enriched.name,
        "bsdd_class_uri": enriched.bsdd_class_uri,
        "original_properties": enriched.original_properties,
        "standardized_properties": {
            k: {
                "original_name": v.original_name,
                "standard_name": v.standard_name,
                "original_value": v.original_value,
                "normalized_value": v.normalized_value,
                "property_set": v.property_set,
                "bsdd_uri": v.bsdd_uri,
                "data_type": v.data_type,
                "unit": v.unit,
                "mapping_status": v.mapping_status
            }
            for k, v in enriched.standardized_properties.items()
        },
        "classification_links": enriched.classification_links,
        "enrichment_stats": enriched.enrichment_stats
    }


# Test the enricher
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from pipeline.parser import IFCParser

    print("=" * 60)
    print("Stage 3: Enrich - bSDD Property Standardization")
    print("=" * 60)

    # Parse IFC
    parser = IFCParser("data/sample.ifc")
    elements = parser.parse_all_elements()
    print(f"\nParsed {len(elements)} elements")

    # Initialize enricher
    enricher = BSDDEnricher(
        "data/bsdd_knowledge_base/classes.json",
        "data/bsdd_knowledge_base/classification_map.json"
    )

    # Enrich elements
    print("\nEnriching elements...")
    enriched = enricher.enrich_all(elements)

    # Print results
    print("\n" + "-" * 60)
    print("Enrichment Results:")
    print("-" * 60)

    for e in enriched:
        print(f"\n{e.ifc_class}: {e.name}")
        print(f"  bSDD URI: {e.bsdd_class_uri}")
        print(f"  Stats: {e.enrichment_stats}")

        if e.standardized_properties:
            print("  Standardized Properties:")
            for key, prop in e.standardized_properties.items():
                status = prop.mapping_status
                if status == "MAPPED":
                    status_str = "[OK]"
                elif status == "FUZZY_MATCH":
                    status_str = "[~]"
                else:
                    status_str = "[?]"

                print(f"    {status_str} {key}")
                print(f"        Original: {prop.original_name} = {prop.original_value}")
                if prop.original_value != prop.normalized_value:
                    print(f"        Normalized: {prop.standard_name} = {prop.normalized_value}")
                if prop.bsdd_uri:
                    print(f"        bSDD: {prop.bsdd_uri[:60]}...")

        if e.classification_links:
            print("  Classification Links:")
            for sys_name, data in e.classification_links.items():
                if data:
                    if isinstance(data, dict):
                        print(f"    - {sys_name}: {data.get('code', data.get('uri', 'N/A'))}")

    # Summary
    summary = enricher.get_enrichment_summary(enriched)
    print("\n" + "=" * 60)
    print("Summary:")
    print("=" * 60)
    print(f"Total elements: {summary['total_elements']}")
    print(f"Total properties: {summary['total_properties']}")
    print(f"Mapped (exact): {summary['properties_mapped_exact']}")
    print(f"Mapped (fuzzy): {summary['properties_mapped_fuzzy']}")
    print(f"Not found: {summary['properties_not_found']}")
    print(f"Mapping rate: {summary['overall_mapping_rate']}%")
    print(f"Elements with classification: {summary['elements_with_classification']}")
