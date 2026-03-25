"""
Knowledge Graph Generator

Converts BIM/IFC data and construction documents to semantic knowledge graphs
using standardized ontologies:
- ifcOWL: IFC Express to OWL mapping (buildingSMART)
- BOT (Building Topology Ontology): W3C-LBD ontology for building topology
- PROPS: Property ontology for building properties
- Custom domain ontologies

Output formats:
- RDF/XML
- Turtle (TTL)
- JSON-LD
- N-Triples
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Any, Generator
from urllib.parse import quote
import hashlib

logger = logging.getLogger(__name__)


class KGOutputFormat(Enum):
    """Knowledge graph output formats"""
    TURTLE = "ttl"
    RDF_XML = "rdf"
    JSON_LD = "jsonld"
    N_TRIPLES = "nt"
    N_QUADS = "nq"


class OntologyType(Enum):
    """Supported ontologies for BIM knowledge graphs"""
    IFC_OWL = "ifcOWL"  # Full IFC schema in OWL
    BOT = "bot"  # Building Topology Ontology (W3C-LBD)
    PROPS = "props"  # Property ontology
    BEO = "beo"  # Building Element Ontology
    MEP = "mep"  # MEP systems ontology
    CUSTOM = "custom"


@dataclass
class TripleStore:
    """Container for RDF triples"""
    subject: str
    predicate: str
    object: str
    object_type: str = "uri"  # "uri", "literal", "typed_literal"
    datatype: Optional[str] = None
    language: Optional[str] = None

    def to_turtle(self) -> str:
        """Convert triple to Turtle format"""
        subj = f"<{self.subject}>" if self.subject.startswith("http") else self.subject
        pred = f"<{self.predicate}>" if self.predicate.startswith("http") else self.predicate

        if self.object_type == "uri":
            obj = f"<{self.object}>" if self.object.startswith("http") else self.object
        elif self.object_type == "typed_literal":
            escaped = self.object.replace('"', '\\"').replace('\n', '\\n')
            obj = f'"{escaped}"^^<{self.datatype}>'
        else:
            escaped = str(self.object).replace('"', '\\"').replace('\n', '\\n')
            if self.language:
                obj = f'"{escaped}"@{self.language}'
            else:
                obj = f'"{escaped}"'

        return f"{subj} {pred} {obj} ."

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON-LD"""
        return {
            "subject": self.subject,
            "predicate": self.predicate,
            "object": self.object,
            "objectType": self.object_type,
            "datatype": self.datatype,
            "language": self.language
        }


@dataclass
class KGNamespaces:
    """Standard namespaces for BIM knowledge graphs"""
    # W3C standards
    RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    RDFS = "http://www.w3.org/2000/01/rdf-schema#"
    OWL = "http://www.w3.org/2002/07/owl#"
    XSD = "http://www.w3.org/2001/XMLSchema#"

    # buildingSMART / LBD
    IFC = "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL#"
    BOT = "https://w3id.org/bot#"
    PROPS = "https://w3id.org/props#"
    BEO = "https://pi.pauwel.be/voc/buildingelement#"

    # Project specific
    INST = "https://example.org/bim/"
    PROJECT = "https://example.org/project/"

    @classmethod
    def get_prefixes_turtle(cls, project_uri: str = None) -> str:
        """Generate Turtle prefix declarations"""
        prefixes = [
            "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
            "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
            "@prefix owl: <http://www.w3.org/2002/07/owl#> .",
            "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
            "@prefix ifc: <https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL#> .",
            "@prefix bot: <https://w3id.org/bot#> .",
            "@prefix props: <https://w3id.org/props#> .",
            "@prefix beo: <https://pi.pauwel.be/voc/buildingelement#> .",
            f"@prefix inst: <{project_uri or cls.INST}> .",
        ]
        return "\n".join(prefixes)

    @classmethod
    def get_context_jsonld(cls, project_uri: str = None) -> dict:
        """Generate JSON-LD context"""
        return {
            "@context": {
                "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
                "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                "owl": "http://www.w3.org/2002/07/owl#",
                "xsd": "http://www.w3.org/2001/XMLSchema#",
                "ifc": "https://standards.buildingsmart.org/IFC/DEV/IFC4/ADD2_TC1/OWL#",
                "bot": "https://w3id.org/bot#",
                "props": "https://w3id.org/props#",
                "beo": "https://pi.pauwel.be/voc/buildingelement#",
                "inst": project_uri or cls.INST,
            }
        }


@dataclass
class KnowledgeGraphStats:
    """Statistics for generated knowledge graph"""
    total_triples: int = 0
    nodes: int = 0
    edges: int = 0
    classes_used: set = field(default_factory=set)
    properties_used: set = field(default_factory=set)
    spatial_elements: int = 0
    building_elements: int = 0
    relationships: int = 0


class KnowledgeGraphGenerator:
    """
    Generates semantic knowledge graphs from BIM/IFC data.

    Supports multiple ontologies:
    - BOT (Building Topology Ontology): Lightweight topology representation
    - ifcOWL: Full IFC schema conversion
    - Custom project ontologies

    Example:
        generator = KnowledgeGraphGenerator(project_id="project-123")
        generator.add_building(building_data)
        generator.add_element(element_data)
        ttl_content = generator.export(KGOutputFormat.TURTLE)
    """

    # IFC entity to BOT class mapping
    IFC_TO_BOT = {
        "IfcSite": "bot:Site",
        "IfcBuilding": "bot:Building",
        "IfcBuildingStorey": "bot:Storey",
        "IfcSpace": "bot:Space",
        # Building elements
        "IfcWall": "beo:Wall",
        "IfcWallStandardCase": "beo:Wall",
        "IfcDoor": "beo:Door",
        "IfcWindow": "beo:Window",
        "IfcSlab": "beo:Slab",
        "IfcRoof": "beo:Roof",
        "IfcBeam": "beo:Beam",
        "IfcColumn": "beo:Column",
        "IfcStair": "beo:Stair",
        "IfcRailing": "beo:Railing",
        "IfcCovering": "beo:Covering",
        "IfcCurtainWall": "beo:CurtainWall",
        # MEP elements
        "IfcPipeSegment": "mep:PipeSegment",
        "IfcDuctSegment": "mep:DuctSegment",
        "IfcCableSegment": "mep:CableSegment",
        "IfcFlowTerminal": "mep:FlowTerminal",
    }

    def __init__(
        self,
        project_id: str,
        project_uri: Optional[str] = None,
        ontologies: list[OntologyType] = None
    ):
        self.project_id = project_id
        self.project_uri = project_uri or f"https://example.org/project/{project_id}/"
        self.instance_uri = f"{self.project_uri}instance/"
        self.ontologies = ontologies or [OntologyType.BOT, OntologyType.PROPS]

        self.triples: list[TripleStore] = []
        self.stats = KnowledgeGraphStats()
        self._entity_uris: dict[str, str] = {}

    def _get_entity_uri(self, global_id: str) -> str:
        """Get or create URI for an entity"""
        if global_id not in self._entity_uris:
            safe_id = quote(global_id, safe='')
            self._entity_uris[global_id] = f"{self.instance_uri}{safe_id}"
        return self._entity_uris[global_id]

    def _add_triple(
        self,
        subject: str,
        predicate: str,
        obj: str,
        object_type: str = "uri",
        datatype: Optional[str] = None,
        language: Optional[str] = None
    ) -> None:
        """Add a triple to the graph"""
        triple = TripleStore(
            subject=subject,
            predicate=predicate,
            object=obj,
            object_type=object_type,
            datatype=datatype,
            language=language
        )
        self.triples.append(triple)
        self.stats.total_triples += 1

    def add_project(self, project_data: dict) -> str:
        """Add project as graph root"""
        project_uri = self.project_uri
        ns = KGNamespaces

        # Type
        self._add_triple(project_uri, f"{ns.RDF}type", f"{ns.BOT}Site")

        # Properties
        if name := project_data.get("name"):
            self._add_triple(
                project_uri,
                f"{ns.RDFS}label",
                name,
                "literal",
                language="en"
            )

        if description := project_data.get("description"):
            self._add_triple(
                project_uri,
                f"{ns.RDFS}comment",
                description,
                "literal"
            )

        self.stats.nodes += 1
        return project_uri

    def add_site(self, site_data: dict) -> str:
        """Add IfcSite to knowledge graph"""
        global_id = site_data.get("global_id", str(hash(str(site_data))))
        site_uri = self._get_entity_uri(global_id)
        ns = KGNamespaces

        # Type
        self._add_triple(site_uri, f"{ns.RDF}type", f"{ns.BOT}Site")
        self._add_triple(site_uri, f"{ns.RDF}type", f"{ns.IFC}IfcSite")

        # IFC GlobalId
        self._add_triple(
            site_uri,
            f"{ns.IFC}globalId_IfcRoot",
            global_id,
            "literal"
        )

        # Name
        if name := site_data.get("name"):
            self._add_triple(
                site_uri,
                f"{ns.RDFS}label",
                name,
                "literal"
            )

        self.stats.spatial_elements += 1
        self.stats.nodes += 1
        return site_uri

    def add_building(self, building_data: dict, site_uri: Optional[str] = None) -> str:
        """Add IfcBuilding to knowledge graph"""
        global_id = building_data.get("global_id", str(hash(str(building_data))))
        building_uri = self._get_entity_uri(global_id)
        ns = KGNamespaces

        # Types
        self._add_triple(building_uri, f"{ns.RDF}type", f"{ns.BOT}Building")
        self._add_triple(building_uri, f"{ns.RDF}type", f"{ns.IFC}IfcBuilding")

        # GlobalId
        self._add_triple(
            building_uri,
            f"{ns.IFC}globalId_IfcRoot",
            global_id,
            "literal"
        )

        # Name
        if name := building_data.get("name"):
            self._add_triple(
                building_uri,
                f"{ns.RDFS}label",
                name,
                "literal"
            )

        # Relationship to site
        if site_uri:
            self._add_triple(site_uri, f"{ns.BOT}hasBuilding", building_uri)
            self.stats.relationships += 1

        self.stats.spatial_elements += 1
        self.stats.nodes += 1
        return building_uri

    def add_storey(self, storey_data: dict, building_uri: Optional[str] = None) -> str:
        """Add IfcBuildingStorey to knowledge graph"""
        global_id = storey_data.get("global_id", str(hash(str(storey_data))))
        storey_uri = self._get_entity_uri(global_id)
        ns = KGNamespaces

        # Types
        self._add_triple(storey_uri, f"{ns.RDF}type", f"{ns.BOT}Storey")
        self._add_triple(storey_uri, f"{ns.RDF}type", f"{ns.IFC}IfcBuildingStorey")

        # GlobalId
        self._add_triple(
            storey_uri,
            f"{ns.IFC}globalId_IfcRoot",
            global_id,
            "literal"
        )

        # Name
        if name := storey_data.get("name"):
            self._add_triple(
                storey_uri,
                f"{ns.RDFS}label",
                name,
                "literal"
            )

        # Elevation
        if elevation := storey_data.get("elevation"):
            self._add_triple(
                storey_uri,
                f"{ns.PROPS}elevation",
                str(elevation),
                "typed_literal",
                datatype=f"{ns.XSD}double"
            )

        # Relationship to building
        if building_uri:
            self._add_triple(building_uri, f"{ns.BOT}hasStorey", storey_uri)
            self.stats.relationships += 1

        self.stats.spatial_elements += 1
        self.stats.nodes += 1
        return storey_uri

    def add_space(self, space_data: dict, storey_uri: Optional[str] = None) -> str:
        """Add IfcSpace to knowledge graph"""
        global_id = space_data.get("global_id", str(hash(str(space_data))))
        space_uri = self._get_entity_uri(global_id)
        ns = KGNamespaces

        # Types
        self._add_triple(space_uri, f"{ns.RDF}type", f"{ns.BOT}Space")
        self._add_triple(space_uri, f"{ns.RDF}type", f"{ns.IFC}IfcSpace")

        # GlobalId
        self._add_triple(
            space_uri,
            f"{ns.IFC}globalId_IfcRoot",
            global_id,
            "literal"
        )

        # Name
        if name := space_data.get("name"):
            self._add_triple(
                space_uri,
                f"{ns.RDFS}label",
                name,
                "literal"
            )

        # Area
        if area := space_data.get("area"):
            self._add_triple(
                space_uri,
                f"{ns.PROPS}area",
                str(area),
                "typed_literal",
                datatype=f"{ns.XSD}double"
            )

        # Relationship to storey
        if storey_uri:
            self._add_triple(storey_uri, f"{ns.BOT}hasSpace", space_uri)
            self.stats.relationships += 1

        self.stats.spatial_elements += 1
        self.stats.nodes += 1
        return space_uri

    def add_element(
        self,
        element_data: dict,
        container_uri: Optional[str] = None
    ) -> str:
        """
        Add a building element to knowledge graph.

        Args:
            element_data: Dictionary containing:
                - global_id: IFC GlobalId
                - ifc_class: IFC entity type (e.g., "IfcWall")
                - name: Element name
                - property_sets: Dictionary of property sets
                - materials: List of materials
                - classifications: List of classification references
            container_uri: URI of containing space/storey
        """
        global_id = element_data.get("global_id", str(hash(str(element_data))))
        element_uri = self._get_entity_uri(global_id)
        ifc_class = element_data.get("ifc_class", "IfcBuildingElement")
        ns = KGNamespaces

        # IFC type
        self._add_triple(
            element_uri,
            f"{ns.RDF}type",
            f"{ns.IFC}{ifc_class}"
        )

        # BOT/BEO type if available
        if bot_class := self.IFC_TO_BOT.get(ifc_class):
            self._add_triple(element_uri, f"{ns.RDF}type", bot_class)

        # GlobalId
        self._add_triple(
            element_uri,
            f"{ns.IFC}globalId_IfcRoot",
            global_id,
            "literal"
        )

        # Name
        if name := element_data.get("name"):
            self._add_triple(
                element_uri,
                f"{ns.RDFS}label",
                name,
                "literal"
            )

        # Property sets
        for pset_name, properties in element_data.get("property_sets", {}).items():
            self._add_property_set(element_uri, pset_name, properties)

        # Materials
        for material in element_data.get("materials", []):
            self._add_material(element_uri, material)

        # Classifications
        for classification in element_data.get("classifications", []):
            self._add_classification(element_uri, classification)

        # Containment relationship
        if container_uri:
            self._add_triple(container_uri, f"{ns.BOT}containsElement", element_uri)
            self.stats.relationships += 1

        self.stats.building_elements += 1
        self.stats.nodes += 1
        return element_uri

    def _add_property_set(
        self,
        element_uri: str,
        pset_name: str,
        properties: dict
    ) -> str:
        """Add property set to element"""
        ns = KGNamespaces

        # Create property set node
        pset_id = hashlib.md5(f"{element_uri}{pset_name}".encode()).hexdigest()[:8]
        pset_uri = f"{self.instance_uri}pset_{pset_id}"

        self._add_triple(pset_uri, f"{ns.RDF}type", f"{ns.IFC}IfcPropertySet")
        self._add_triple(
            pset_uri,
            f"{ns.RDFS}label",
            pset_name,
            "literal"
        )
        self._add_triple(element_uri, f"{ns.IFC}hasPropertySet", pset_uri)

        # Add properties
        for prop_name, prop_value in properties.items():
            if prop_value is not None:
                # Determine datatype
                if isinstance(prop_value, bool):
                    datatype = f"{ns.XSD}boolean"
                    value = str(prop_value).lower()
                elif isinstance(prop_value, int):
                    datatype = f"{ns.XSD}integer"
                    value = str(prop_value)
                elif isinstance(prop_value, float):
                    datatype = f"{ns.XSD}double"
                    value = str(prop_value)
                else:
                    datatype = f"{ns.XSD}string"
                    value = str(prop_value)

                # Create property predicate URI
                prop_pred = f"{ns.PROPS}{quote(prop_name, safe='')}"
                self._add_triple(
                    pset_uri,
                    prop_pred,
                    value,
                    "typed_literal",
                    datatype=datatype
                )
                self.stats.properties_used.add(prop_name)

        self.stats.nodes += 1
        return pset_uri

    def _add_material(self, element_uri: str, material: dict) -> None:
        """Add material relationship"""
        ns = KGNamespaces

        material_name = material.get("name", "Unknown")
        material_id = hashlib.md5(material_name.encode()).hexdigest()[:8]
        material_uri = f"{self.instance_uri}material_{material_id}"

        self._add_triple(material_uri, f"{ns.RDF}type", f"{ns.IFC}IfcMaterial")
        self._add_triple(
            material_uri,
            f"{ns.RDFS}label",
            material_name,
            "literal"
        )
        self._add_triple(element_uri, f"{ns.IFC}hasMaterial", material_uri)

        self.stats.relationships += 1

    def _add_classification(self, element_uri: str, classification: dict) -> None:
        """Add classification reference"""
        ns = KGNamespaces

        system = classification.get("system", "Unknown")
        code = classification.get("code", "")
        name = classification.get("name", code)

        class_id = hashlib.md5(f"{system}{code}".encode()).hexdigest()[:8]
        class_uri = f"{self.instance_uri}classification_{class_id}"

        self._add_triple(class_uri, f"{ns.RDF}type", f"{ns.IFC}IfcClassificationReference")
        self._add_triple(
            class_uri,
            f"{ns.RDFS}label",
            f"{system}: {name}",
            "literal"
        )
        self._add_triple(
            class_uri,
            f"{ns.PROPS}classificationSystem",
            system,
            "literal"
        )
        self._add_triple(
            class_uri,
            f"{ns.PROPS}classificationCode",
            code,
            "literal"
        )
        self._add_triple(element_uri, f"{ns.IFC}hasClassification", class_uri)

        self.stats.relationships += 1

    def add_relationship(
        self,
        source_uri: str,
        target_uri: str,
        relationship_type: str
    ) -> None:
        """
        Add a relationship between entities.

        Common relationship types:
        - bot:containsElement
        - bot:adjacentTo
        - bot:intersectsZone
        - ifc:relConnectsElements
        - ifc:relVoidsElement
        """
        self._add_triple(source_uri, relationship_type, target_uri)
        self.stats.relationships += 1
        self.stats.edges += 1

    def add_document_reference(
        self,
        element_uri: str,
        document_data: dict
    ) -> str:
        """Add document reference to element"""
        ns = KGNamespaces

        doc_id = document_data.get("id", hashlib.md5(str(document_data).encode()).hexdigest()[:8])
        doc_uri = f"{self.instance_uri}document_{doc_id}"

        self._add_triple(doc_uri, f"{ns.RDF}type", f"{ns.IFC}IfcDocumentReference")

        if name := document_data.get("name"):
            self._add_triple(doc_uri, f"{ns.RDFS}label", name, "literal")

        if url := document_data.get("url"):
            self._add_triple(doc_uri, f"{ns.PROPS}documentUrl", url, "literal")

        if doc_type := document_data.get("type"):
            self._add_triple(doc_uri, f"{ns.PROPS}documentType", doc_type, "literal")

        self._add_triple(element_uri, f"{ns.IFC}hasDocument", doc_uri)

        self.stats.nodes += 1
        self.stats.relationships += 1
        return doc_uri

    def export(self, format: KGOutputFormat = KGOutputFormat.TURTLE) -> str:
        """Export knowledge graph to specified format"""
        if format == KGOutputFormat.TURTLE:
            return self._export_turtle()
        elif format == KGOutputFormat.JSON_LD:
            return self._export_jsonld()
        elif format == KGOutputFormat.N_TRIPLES:
            return self._export_ntriples()
        else:
            raise ValueError(f"Unsupported format: {format}")

    def _export_turtle(self) -> str:
        """Export to Turtle format"""
        lines = [
            f"# Knowledge Graph for Project: {self.project_id}",
            f"# Generated: {datetime.now().isoformat()}",
            f"# Triples: {self.stats.total_triples}",
            "",
            KGNamespaces.get_prefixes_turtle(self.project_uri),
            "",
        ]

        for triple in self.triples:
            lines.append(triple.to_turtle())

        return "\n".join(lines)

    def _export_jsonld(self) -> str:
        """Export to JSON-LD format"""
        context = KGNamespaces.get_context_jsonld(self.project_uri)

        # Group triples by subject
        graph = {}
        for triple in self.triples:
            if triple.subject not in graph:
                graph[triple.subject] = {"@id": triple.subject}

            pred = triple.predicate
            obj = triple.object if triple.object_type == "uri" else {
                "@value": triple.object,
                "@type": triple.datatype
            } if triple.datatype else triple.object

            if pred in graph[triple.subject]:
                existing = graph[triple.subject][pred]
                if isinstance(existing, list):
                    existing.append(obj)
                else:
                    graph[triple.subject][pred] = [existing, obj]
            else:
                graph[triple.subject][pred] = obj

        result = {
            **context,
            "@graph": list(graph.values())
        }

        return json.dumps(result, indent=2, ensure_ascii=False)

    def _export_ntriples(self) -> str:
        """Export to N-Triples format"""
        lines = []
        for triple in self.triples:
            subj = f"<{triple.subject}>"
            pred = f"<{triple.predicate}>"

            if triple.object_type == "uri":
                obj = f"<{triple.object}>"
            elif triple.datatype:
                escaped = triple.object.replace('"', '\\"')
                obj = f'"{escaped}"^^<{triple.datatype}>'
            elif triple.language:
                escaped = triple.object.replace('"', '\\"')
                obj = f'"{escaped}"@{triple.language}'
            else:
                escaped = str(triple.object).replace('"', '\\"')
                obj = f'"{escaped}"'

            lines.append(f"{subj} {pred} {obj} .")

        return "\n".join(lines)

    def save(self, output_path: Path, format: KGOutputFormat = KGOutputFormat.TURTLE) -> None:
        """Save knowledge graph to file"""
        content = self.export(format)
        output_path.write_text(content, encoding='utf-8')
        logger.info(f"Saved knowledge graph to {output_path} ({self.stats.total_triples} triples)")

    def get_stats(self) -> dict:
        """Get knowledge graph statistics"""
        return {
            "totalTriples": self.stats.total_triples,
            "nodes": self.stats.nodes,
            "edges": self.stats.edges,
            "spatialElements": self.stats.spatial_elements,
            "buildingElements": self.stats.building_elements,
            "relationships": self.stats.relationships,
            "classesUsed": list(self.stats.classes_used),
            "propertiesUsed": list(self.stats.properties_used)
        }

    def query_sparql(self, query: str) -> list[dict]:
        """
        Execute SPARQL query on the graph.
        Note: This is a placeholder - for production, use rdflib or a triplestore.
        """
        try:
            from rdflib import Graph
            from rdflib.plugins.sparql import prepareQuery

            g = Graph()
            g.parse(data=self.export(KGOutputFormat.TURTLE), format='turtle')

            results = g.query(query)
            return [dict(row.asdict()) for row in results]
        except ImportError:
            logger.warning("rdflib not installed - SPARQL queries not available")
            return []
