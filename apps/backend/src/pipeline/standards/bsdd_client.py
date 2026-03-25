"""
bSDD Client - buildingSMART Data Dictionary API Client

Provides integration with bSDD (buildingSMART Data Dictionary) for:
- Property standardization and enrichment
- Classification lookup and validation
- IFC entity to bSDD class mapping
- Property value validation against bSDD definitions

bSDD API: https://api.bsdd.buildingsmart.org/swagger/index.html
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum
import json
from pathlib import Path
from datetime import datetime, timedelta
import hashlib

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

logger = logging.getLogger(__name__)


class BSDDEnvironment(Enum):
    """bSDD API environments"""
    PRODUCTION = "https://api.bsdd.buildingsmart.org"
    TEST = "https://test.bsdd.buildingsmart.org"


@dataclass
class BSDDDomain:
    """bSDD Domain (Data Dictionary)"""
    uri: str
    name: str
    version: str
    organization: str
    status: str
    language_code: str
    class_count: int = 0
    property_count: int = 0

    @classmethod
    def from_api(cls, data: dict) -> "BSDDDomain":
        return cls(
            uri=data.get("uri", ""),
            name=data.get("name", ""),
            version=data.get("version", ""),
            organization=data.get("organizationNameOwner", ""),
            status=data.get("status", ""),
            language_code=data.get("languageCode", "EN"),
            class_count=data.get("classCount", 0),
            property_count=data.get("propertyCount", 0)
        )


@dataclass
class BSDDProperty:
    """bSDD Property definition"""
    uri: str
    code: str
    name: str
    description: str
    data_type: str
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    allowed_values: list[str] = field(default_factory=list)
    ifc_property_name: Optional[str] = None
    ifc_property_set: Optional[str] = None

    @classmethod
    def from_api(cls, data: dict) -> "BSDDProperty":
        allowed_values = []
        for val in data.get("allowedValues", []):
            if isinstance(val, dict):
                allowed_values.append(val.get("value", ""))
            else:
                allowed_values.append(str(val))

        return cls(
            uri=data.get("uri", ""),
            code=data.get("code", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            data_type=data.get("dataType", "String"),
            unit=data.get("units"),
            min_value=data.get("minValue"),
            max_value=data.get("maxValue"),
            allowed_values=allowed_values,
            ifc_property_name=data.get("propertyNameIfc"),
            ifc_property_set=data.get("propertySet")
        )

    def to_dict(self) -> dict:
        return {
            "uri": self.uri,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "dataType": self.data_type,
            "unit": self.unit,
            "minValue": self.min_value,
            "maxValue": self.max_value,
            "allowedValues": self.allowed_values,
            "ifcPropertyName": self.ifc_property_name,
            "ifcPropertySet": self.ifc_property_set
        }


@dataclass
class BSDDClass:
    """bSDD Class definition"""
    uri: str
    code: str
    name: str
    description: str
    class_type: str
    parent_class_uri: Optional[str] = None
    related_ifc_entity: Optional[str] = None
    properties: list[BSDDProperty] = field(default_factory=list)
    child_classes: list[str] = field(default_factory=list)
    synonyms: list[str] = field(default_factory=list)

    @classmethod
    def from_api(cls, data: dict) -> "BSDDClass":
        properties = []
        for prop_data in data.get("classProperties", []):
            properties.append(BSDDProperty.from_api(prop_data))

        return cls(
            uri=data.get("uri", ""),
            code=data.get("code", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            class_type=data.get("classType", "Class"),
            parent_class_uri=data.get("parentClassUri"),
            related_ifc_entity=data.get("relatedIfcEntityNamesList", [None])[0] if data.get("relatedIfcEntityNamesList") else None,
            properties=properties,
            child_classes=data.get("childClassUris", []),
            synonyms=data.get("synonyms", [])
        )

    def to_dict(self) -> dict:
        return {
            "uri": self.uri,
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "classType": self.class_type,
            "parentClassUri": self.parent_class_uri,
            "relatedIfcEntity": self.related_ifc_entity,
            "properties": [p.to_dict() for p in self.properties],
            "childClasses": self.child_classes,
            "synonyms": self.synonyms
        }


@dataclass
class PropertyMapping:
    """Mapping between local property and bSDD property"""
    local_property_set: str
    local_property_name: str
    bsdd_property_uri: str
    bsdd_property_name: str
    confidence: float = 1.0
    mapping_type: str = "exact"  # exact, similar, suggested

    def to_dict(self) -> dict:
        return {
            "localPropertySet": self.local_property_set,
            "localPropertyName": self.local_property_name,
            "bsddPropertyUri": self.bsdd_property_uri,
            "bsddPropertyName": self.bsdd_property_name,
            "confidence": self.confidence,
            "mappingType": self.mapping_type
        }


@dataclass
class EnrichmentResult:
    """Result of property enrichment from bSDD"""
    element_id: str
    ifc_entity: str
    bsdd_class_uri: Optional[str] = None
    bsdd_class_name: Optional[str] = None
    property_mappings: list[PropertyMapping] = field(default_factory=list)
    missing_required_properties: list[str] = field(default_factory=list)
    invalid_values: list[dict] = field(default_factory=list)
    enriched_properties: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "elementId": self.element_id,
            "ifcEntity": self.ifc_entity,
            "bsddClassUri": self.bsdd_class_uri,
            "bsddClassName": self.bsdd_class_name,
            "propertyMappings": [m.to_dict() for m in self.property_mappings],
            "missingRequiredProperties": self.missing_required_properties,
            "invalidValues": self.invalid_values,
            "enrichedProperties": self.enriched_properties
        }


class BSDDCache:
    """Simple file-based cache for bSDD responses"""

    def __init__(self, cache_dir: Optional[Path] = None, ttl_hours: int = 24):
        self.cache_dir = cache_dir or Path.home() / ".cache" / "bsdd"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = timedelta(hours=ttl_hours)
        self._memory_cache: dict[str, tuple[datetime, Any]] = {}

    def _get_cache_key(self, url: str, params: Optional[dict] = None) -> str:
        key_data = url + json.dumps(params or {}, sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()

    def get(self, url: str, params: Optional[dict] = None) -> Optional[Any]:
        cache_key = self._get_cache_key(url, params)

        # Check memory cache first
        if cache_key in self._memory_cache:
            cached_time, data = self._memory_cache[cache_key]
            if datetime.now() - cached_time < self.ttl:
                return data

        # Check file cache
        cache_file = self.cache_dir / f"{cache_key}.json"
        if cache_file.exists():
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached = json.load(f)
                cached_time = datetime.fromisoformat(cached["cached_at"])
                if datetime.now() - cached_time < self.ttl:
                    self._memory_cache[cache_key] = (cached_time, cached["data"])
                    return cached["data"]
            except (json.JSONDecodeError, KeyError):
                pass

        return None

    def set(self, url: str, data: Any, params: Optional[dict] = None) -> None:
        cache_key = self._get_cache_key(url, params)

        # Update memory cache
        self._memory_cache[cache_key] = (datetime.now(), data)

        # Write to file cache
        cache_file = self.cache_dir / f"{cache_key}.json"
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({
                "cached_at": datetime.now().isoformat(),
                "url": url,
                "params": params,
                "data": data
            }, f, indent=2, ensure_ascii=False)


class BSDDClient:
    """
    Client for buildingSMART Data Dictionary (bSDD) API.

    Provides methods for:
    - Searching and retrieving domains (dictionaries)
    - Looking up classes and their properties
    - Mapping IFC entities to bSDD classes
    - Validating property values against bSDD definitions
    - Enriching element properties with bSDD standardized names
    """

    # Common domain URIs
    DOMAINS = {
        "IFC": "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3",
        "UNICLASS2015": "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1",
        "OMNICLASS": "https://identifier.buildingsmart.org/uri/csi/omniclass/1.0",
        "ETIM": "https://identifier.buildingsmart.org/uri/etim/etim/9.0",
    }

    def __init__(
        self,
        environment: BSDDEnvironment = BSDDEnvironment.PRODUCTION,
        cache_enabled: bool = True,
        cache_dir: Optional[Path] = None
    ):
        if not HTTPX_AVAILABLE:
            raise ImportError("httpx is required for BSDDClient. Install with: pip install httpx")

        self.base_url = environment.value
        self.cache = BSDDCache(cache_dir) if cache_enabled else None
        self._client: Optional[httpx.AsyncClient] = None

        # IFC entity to bSDD class mapping cache
        self._ifc_to_bsdd_map: dict[str, str] = {}

    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict] = None,
        json_data: Optional[dict] = None
    ) -> dict:
        """Make HTTP request to bSDD API"""
        if not self._client:
            self._client = httpx.AsyncClient(timeout=30.0)

        url = f"{self.base_url}{endpoint}"

        # Check cache for GET requests
        if method == "GET" and self.cache:
            cached = self.cache.get(url, params)
            if cached:
                logger.debug(f"Cache hit for {url}")
                return cached

        try:
            response = await self._client.request(
                method,
                url,
                params=params,
                json=json_data,
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            data = response.json()

            # Cache successful GET responses
            if method == "GET" and self.cache:
                self.cache.set(url, data, params)

            return data

        except httpx.HTTPStatusError as e:
            logger.error(f"bSDD API error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"bSDD request failed: {e}")
            raise

    async def get_domains(self, search_text: Optional[str] = None) -> list[BSDDDomain]:
        """Get list of available domains (dictionaries)"""
        params = {}
        if search_text:
            params["SearchText"] = search_text

        data = await self._request("GET", "/api/Domain/v1", params=params)
        return [BSDDDomain.from_api(d) for d in data.get("domains", [])]

    async def get_domain(self, domain_uri: str) -> Optional[BSDDDomain]:
        """Get domain details by URI"""
        params = {"uri": domain_uri, "includeClassCount": True}
        data = await self._request("GET", "/api/Domain/v1", params=params)
        domains = data.get("domains", [])
        return BSDDDomain.from_api(domains[0]) if domains else None

    async def get_class(self, class_uri: str, include_properties: bool = True) -> Optional[BSDDClass]:
        """Get class details by URI"""
        params = {
            "uri": class_uri,
            "includeClassProperties": include_properties,
            "includeChildClassReferences": True
        }
        data = await self._request("GET", "/api/Class/v1", params=params)
        return BSDDClass.from_api(data) if data else None

    async def search_classes(
        self,
        search_text: str,
        domain_uri: Optional[str] = None,
        related_ifc_entity: Optional[str] = None,
        limit: int = 25
    ) -> list[BSDDClass]:
        """Search for classes in bSDD"""
        params = {
            "SearchText": search_text,
            "Take": limit
        }
        if domain_uri:
            params["DomainUri"] = domain_uri
        if related_ifc_entity:
            params["RelatedIfcEntity"] = related_ifc_entity

        data = await self._request("GET", "/api/SearchInDictionary/v1", params=params)

        classes = []
        for item in data.get("classes", []):
            # Fetch full class details for each result
            class_obj = await self.get_class(item.get("uri"), include_properties=False)
            if class_obj:
                classes.append(class_obj)

        return classes

    async def get_classes_for_ifc_entity(
        self,
        ifc_entity: str,
        domain_uri: Optional[str] = None
    ) -> list[BSDDClass]:
        """Get bSDD classes related to an IFC entity"""
        params = {
            "RelatedIfcEntity": ifc_entity,
            "Take": 50
        }
        if domain_uri:
            params["DomainUri"] = domain_uri

        data = await self._request("GET", "/api/SearchInDictionary/v1", params=params)

        classes = []
        for item in data.get("classes", []):
            class_obj = await self.get_class(item.get("uri"))
            if class_obj:
                classes.append(class_obj)

        return classes

    async def get_property(self, property_uri: str) -> Optional[BSDDProperty]:
        """Get property details by URI"""
        params = {"uri": property_uri}
        data = await self._request("GET", "/api/Property/v1", params=params)
        return BSDDProperty.from_api(data) if data else None

    async def validate_property_value(
        self,
        property_uri: str,
        value: Any
    ) -> tuple[bool, Optional[str]]:
        """
        Validate a property value against its bSDD definition.

        Returns:
            Tuple of (is_valid, error_message)
        """
        prop = await self.get_property(property_uri)
        if not prop:
            return False, f"Property not found: {property_uri}"

        # Check allowed values
        if prop.allowed_values:
            str_value = str(value)
            if str_value not in prop.allowed_values:
                return False, f"Value '{value}' not in allowed values: {prop.allowed_values}"

        # Check numeric constraints
        if prop.data_type in ["Real", "Integer", "Number"]:
            try:
                num_value = float(value)
                if prop.min_value is not None and num_value < prop.min_value:
                    return False, f"Value {value} below minimum {prop.min_value}"
                if prop.max_value is not None and num_value > prop.max_value:
                    return False, f"Value {value} above maximum {prop.max_value}"
            except (ValueError, TypeError):
                return False, f"Cannot convert '{value}' to number for property type {prop.data_type}"

        return True, None

    async def enrich_element(
        self,
        element_id: str,
        ifc_entity: str,
        property_sets: dict[str, dict[str, Any]],
        domain_uri: Optional[str] = None
    ) -> EnrichmentResult:
        """
        Enrich an element's properties with bSDD standardized information.

        Args:
            element_id: Element identifier
            ifc_entity: IFC entity type (e.g., "IfcWall")
            property_sets: Dictionary of property sets and their properties
            domain_uri: Optional specific domain to use

        Returns:
            EnrichmentResult with mappings and suggestions
        """
        result = EnrichmentResult(element_id=element_id, ifc_entity=ifc_entity)

        # Find matching bSDD class
        classes = await self.get_classes_for_ifc_entity(ifc_entity, domain_uri)

        if classes:
            # Use first matching class (could be improved with better matching logic)
            bsdd_class = classes[0]
            result.bsdd_class_uri = bsdd_class.uri
            result.bsdd_class_name = bsdd_class.name

            # Map properties
            for pset_name, properties in property_sets.items():
                for prop_name, prop_value in properties.items():
                    mapping = self._find_property_mapping(
                        pset_name, prop_name, bsdd_class.properties
                    )
                    if mapping:
                        result.property_mappings.append(mapping)

                        # Validate value if we have a bSDD property
                        if mapping.mapping_type == "exact":
                            bsdd_prop = next(
                                (p for p in bsdd_class.properties if p.uri == mapping.bsdd_property_uri),
                                None
                            )
                            if bsdd_prop:
                                is_valid, error = await self.validate_property_value(
                                    bsdd_prop.uri, prop_value
                                )
                                if not is_valid:
                                    result.invalid_values.append({
                                        "propertySet": pset_name,
                                        "propertyName": prop_name,
                                        "value": prop_value,
                                        "error": error
                                    })

            # Find missing required properties
            for bsdd_prop in bsdd_class.properties:
                mapped = any(
                    m.bsdd_property_uri == bsdd_prop.uri
                    for m in result.property_mappings
                )
                if not mapped:
                    result.missing_required_properties.append(bsdd_prop.name)

        return result

    def _find_property_mapping(
        self,
        pset_name: str,
        prop_name: str,
        bsdd_properties: list[BSDDProperty]
    ) -> Optional[PropertyMapping]:
        """Find matching bSDD property for a local property"""

        # Normalize names for comparison
        prop_name_lower = prop_name.lower().replace("_", "").replace(" ", "")
        pset_name_lower = pset_name.lower()

        for bsdd_prop in bsdd_properties:
            # Exact match on IFC property name
            if bsdd_prop.ifc_property_name and bsdd_prop.ifc_property_name.lower() == prop_name.lower():
                if bsdd_prop.ifc_property_set and bsdd_prop.ifc_property_set.lower() == pset_name.lower():
                    return PropertyMapping(
                        local_property_set=pset_name,
                        local_property_name=prop_name,
                        bsdd_property_uri=bsdd_prop.uri,
                        bsdd_property_name=bsdd_prop.name,
                        confidence=1.0,
                        mapping_type="exact"
                    )

            # Similar name match
            bsdd_name_lower = bsdd_prop.name.lower().replace("_", "").replace(" ", "")
            if prop_name_lower == bsdd_name_lower:
                return PropertyMapping(
                    local_property_set=pset_name,
                    local_property_name=prop_name,
                    bsdd_property_uri=bsdd_prop.uri,
                    bsdd_property_name=bsdd_prop.name,
                    confidence=0.9,
                    mapping_type="similar"
                )

            # Partial match
            if prop_name_lower in bsdd_name_lower or bsdd_name_lower in prop_name_lower:
                return PropertyMapping(
                    local_property_set=pset_name,
                    local_property_name=prop_name,
                    bsdd_property_uri=bsdd_prop.uri,
                    bsdd_property_name=bsdd_prop.name,
                    confidence=0.7,
                    mapping_type="suggested"
                )

        return None

    async def get_classification_suggestions(
        self,
        element_name: str,
        ifc_entity: str,
        classification_system: str = "UNICLASS2015"
    ) -> list[dict]:
        """
        Get classification code suggestions for an element.

        Args:
            element_name: Element name/description
            ifc_entity: IFC entity type
            classification_system: Target classification system

        Returns:
            List of suggested classifications with confidence scores
        """
        domain_uri = self.DOMAINS.get(classification_system.upper())
        if not domain_uri:
            logger.warning(f"Unknown classification system: {classification_system}")
            return []

        # Search by element name
        classes = await self.search_classes(
            search_text=element_name,
            domain_uri=domain_uri,
            related_ifc_entity=ifc_entity,
            limit=10
        )

        suggestions = []
        for cls in classes:
            suggestions.append({
                "code": cls.code,
                "name": cls.name,
                "uri": cls.uri,
                "description": cls.description,
                "confidence": 0.8 if ifc_entity.lower() in (cls.related_ifc_entity or "").lower() else 0.5
            })

        # Sort by confidence
        suggestions.sort(key=lambda x: x["confidence"], reverse=True)
        return suggestions


class BSDDClientSync:
    """
    Synchronous wrapper for BSDDClient.

    Use this when async/await is not available in the calling context.
    """

    def __init__(
        self,
        environment: BSDDEnvironment = BSDDEnvironment.PRODUCTION,
        cache_enabled: bool = True
    ):
        self._async_client = BSDDClient(environment, cache_enabled)

    def _run(self, coro):
        """Run coroutine in event loop"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(coro)

    def get_domains(self, search_text: Optional[str] = None) -> list[BSDDDomain]:
        return self._run(self._async_client.get_domains(search_text))

    def get_class(self, class_uri: str, include_properties: bool = True) -> Optional[BSDDClass]:
        return self._run(self._async_client.get_class(class_uri, include_properties))

    def search_classes(
        self,
        search_text: str,
        domain_uri: Optional[str] = None,
        related_ifc_entity: Optional[str] = None,
        limit: int = 25
    ) -> list[BSDDClass]:
        return self._run(self._async_client.search_classes(
            search_text, domain_uri, related_ifc_entity, limit
        ))

    def get_classes_for_ifc_entity(
        self,
        ifc_entity: str,
        domain_uri: Optional[str] = None
    ) -> list[BSDDClass]:
        return self._run(self._async_client.get_classes_for_ifc_entity(ifc_entity, domain_uri))

    def enrich_element(
        self,
        element_id: str,
        ifc_entity: str,
        property_sets: dict[str, dict[str, Any]],
        domain_uri: Optional[str] = None
    ) -> EnrichmentResult:
        return self._run(self._async_client.enrich_element(
            element_id, ifc_entity, property_sets, domain_uri
        ))

    def get_classification_suggestions(
        self,
        element_name: str,
        ifc_entity: str,
        classification_system: str = "UNICLASS2015"
    ) -> list[dict]:
        return self._run(self._async_client.get_classification_suggestions(
            element_name, ifc_entity, classification_system
        ))
