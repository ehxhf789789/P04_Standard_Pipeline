"""
GNN Data Generator

Generates graph-structured data for Graph Neural Networks (GNNs) from BIM models.

Supports GNN frameworks:
- PyTorch Geometric (PyG)
- DGL (Deep Graph Library)
- NetworkX (for visualization and basic analysis)
- Custom formats

Graph construction strategies:
- Spatial proximity graphs
- Containment hierarchy graphs
- Connection/relationship graphs
- Hybrid multi-relational graphs

Applications:
- Node classification (element type prediction)
- Link prediction (relationship inference)
- Graph classification (building type)
- Anomaly detection
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Any, Union
import hashlib
from collections import defaultdict

logger = logging.getLogger(__name__)


class GNNOutputFormat(Enum):
    """Output formats for GNN data"""
    PYTORCH_GEOMETRIC = "pyg"
    DGL = "dgl"
    NETWORKX = "networkx"
    JSON = "json"
    EDGE_LIST = "edgelist"
    ADJACENCY = "adjacency"


class NodeType(Enum):
    """Types of nodes in the BIM graph"""
    PROJECT = "project"
    SITE = "site"
    BUILDING = "building"
    STOREY = "storey"
    SPACE = "space"
    ELEMENT = "element"
    PROPERTY_SET = "property_set"
    MATERIAL = "material"
    CLASSIFICATION = "classification"
    DOCUMENT = "document"


class EdgeType(Enum):
    """Types of edges/relationships in the BIM graph"""
    # Spatial containment
    CONTAINS = "contains"
    CONTAINED_IN = "contained_in"

    # Element relationships
    CONNECTS_TO = "connects_to"
    ADJACENT_TO = "adjacent_to"
    BOUNDED_BY = "bounded_by"
    VOIDS = "voids"
    FILLS = "fills"

    # Property relationships
    HAS_PROPERTY_SET = "has_property_set"
    HAS_MATERIAL = "has_material"
    HAS_CLASSIFICATION = "has_classification"
    HAS_DOCUMENT = "has_document"

    # Spatial proximity (computed)
    NEAR = "near"
    SAME_LEVEL = "same_level"


@dataclass
class NodeFeatures:
    """Features for a single node"""
    node_id: str
    node_type: NodeType
    features: dict[str, Any] = field(default_factory=dict)
    label: Optional[int] = None
    embedding: Optional[list[float]] = None

    def to_dict(self) -> dict:
        return {
            "id": self.node_id,
            "type": self.node_type.value,
            "features": self.features,
            "label": self.label,
            "embedding": self.embedding
        }

    def get_feature_vector(self, feature_names: list[str]) -> list[float]:
        """Extract feature vector in specified order"""
        vector = []
        for name in feature_names:
            value = self.features.get(name, 0.0)
            if isinstance(value, bool):
                value = float(value)
            elif isinstance(value, str):
                value = hash(value) % 1000 / 1000.0  # Simple string encoding
            elif value is None:
                value = 0.0
            vector.append(float(value))
        return vector


@dataclass
class EdgeFeatures:
    """Features for a single edge"""
    source_id: str
    target_id: str
    edge_type: EdgeType
    features: dict[str, Any] = field(default_factory=dict)
    weight: float = 1.0

    def to_dict(self) -> dict:
        return {
            "source": self.source_id,
            "target": self.target_id,
            "type": self.edge_type.value,
            "features": self.features,
            "weight": self.weight
        }


@dataclass
class GraphData:
    """Complete graph data structure"""
    nodes: list[NodeFeatures] = field(default_factory=list)
    edges: list[EdgeFeatures] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    # Index structures (built automatically)
    _node_index: dict[str, int] = field(default_factory=dict, repr=False)
    _edge_index_by_type: dict[EdgeType, list[tuple[int, int]]] = field(default_factory=dict, repr=False)

    def build_indexes(self) -> None:
        """Build index structures for efficient lookup"""
        self._node_index = {node.node_id: idx for idx, node in enumerate(self.nodes)}
        self._edge_index_by_type = defaultdict(list)

        for edge in self.edges:
            src_idx = self._node_index.get(edge.source_id, -1)
            tgt_idx = self._node_index.get(edge.target_id, -1)
            if src_idx >= 0 and tgt_idx >= 0:
                self._edge_index_by_type[edge.edge_type].append((src_idx, tgt_idx))

    def get_node_index(self, node_id: str) -> int:
        """Get numerical index for a node"""
        return self._node_index.get(node_id, -1)

    def get_adjacency_list(self) -> dict[int, list[int]]:
        """Get adjacency list representation"""
        adj = defaultdict(list)
        for edge in self.edges:
            src_idx = self._node_index.get(edge.source_id, -1)
            tgt_idx = self._node_index.get(edge.target_id, -1)
            if src_idx >= 0 and tgt_idx >= 0:
                adj[src_idx].append(tgt_idx)
        return dict(adj)

    def get_edge_index(self) -> tuple[list[int], list[int]]:
        """Get edge index in COO format [2, num_edges]"""
        sources = []
        targets = []
        for edge in self.edges:
            src_idx = self._node_index.get(edge.source_id, -1)
            tgt_idx = self._node_index.get(edge.target_id, -1)
            if src_idx >= 0 and tgt_idx >= 0:
                sources.append(src_idx)
                targets.append(tgt_idx)
        return sources, targets

    def get_stats(self) -> dict:
        """Get graph statistics"""
        node_type_counts = defaultdict(int)
        for node in self.nodes:
            node_type_counts[node.node_type.value] += 1

        edge_type_counts = defaultdict(int)
        for edge in self.edges:
            edge_type_counts[edge.edge_type.value] += 1

        return {
            "numNodes": len(self.nodes),
            "numEdges": len(self.edges),
            "nodeTypeCounts": dict(node_type_counts),
            "edgeTypeCounts": dict(edge_type_counts),
            "avgDegree": len(self.edges) * 2 / len(self.nodes) if self.nodes else 0
        }


class GNNDataGenerator:
    """
    Generates graph data for Graph Neural Networks from BIM models.

    Constructs graphs where:
    - Nodes represent BIM elements, spaces, materials, etc.
    - Edges represent relationships (containment, connection, proximity)
    - Node features are derived from element properties
    - Edge features capture relationship characteristics

    Example:
        generator = GNNDataGenerator()

        # Add spatial structure
        generator.add_building(building_data)
        generator.add_storey(storey_data, building_id)

        # Add elements
        for element in elements:
            generator.add_element(element, storey_id)

        # Add relationships
        generator.add_connections(connection_data)
        generator.compute_proximity_edges(threshold=2.0)

        # Export
        graph = generator.build_graph()
        generator.export(graph, "output.pt", GNNOutputFormat.PYTORCH_GEOMETRIC)
    """

    # Default node feature names
    DEFAULT_ELEMENT_FEATURES = [
        "is_external", "load_bearing", "fire_rating_encoded",
        "width", "height", "length", "area", "volume",
        "center_x", "center_y", "center_z"
    ]

    # IFC class to label encoding
    IFC_CLASS_LABELS = {
        "IfcWall": 0,
        "IfcWallStandardCase": 0,
        "IfcDoor": 1,
        "IfcWindow": 2,
        "IfcSlab": 3,
        "IfcRoof": 4,
        "IfcBeam": 5,
        "IfcColumn": 6,
        "IfcStair": 7,
        "IfcRailing": 8,
        "IfcSpace": 9,
        "IfcCovering": 10,
        "IfcCurtainWall": 11,
        "IfcPipeSegment": 12,
        "IfcDuctSegment": 13,
    }

    def __init__(
        self,
        include_property_nodes: bool = False,
        include_material_nodes: bool = True,
        include_classification_nodes: bool = False
    ):
        self.include_property_nodes = include_property_nodes
        self.include_material_nodes = include_material_nodes
        self.include_classification_nodes = include_classification_nodes

        self._nodes: dict[str, NodeFeatures] = {}
        self._edges: list[EdgeFeatures] = []
        self._element_locations: dict[str, tuple[float, float, float]] = {}
        self._containment: dict[str, str] = {}  # child -> parent

    def add_site(self, site_data: dict) -> str:
        """Add site node"""
        site_id = site_data.get("global_id", f"site_{hash(str(site_data))}")

        features = {
            "name": site_data.get("name", ""),
            "longitude": site_data.get("longitude", 0.0),
            "latitude": site_data.get("latitude", 0.0),
            "elevation": site_data.get("elevation", 0.0),
        }

        self._nodes[site_id] = NodeFeatures(
            node_id=site_id,
            node_type=NodeType.SITE,
            features=features
        )

        return site_id

    def add_building(self, building_data: dict, site_id: Optional[str] = None) -> str:
        """Add building node"""
        building_id = building_data.get("global_id", f"building_{hash(str(building_data))}")

        features = {
            "name": building_data.get("name", ""),
            "elevation": building_data.get("elevation", 0.0),
            "storey_count": building_data.get("storey_count", 0),
        }

        self._nodes[building_id] = NodeFeatures(
            node_id=building_id,
            node_type=NodeType.BUILDING,
            features=features
        )

        if site_id:
            self._add_containment_edge(site_id, building_id)

        return building_id

    def add_storey(self, storey_data: dict, building_id: Optional[str] = None) -> str:
        """Add storey node"""
        storey_id = storey_data.get("global_id", f"storey_{hash(str(storey_data))}")

        features = {
            "name": storey_data.get("name", ""),
            "elevation": storey_data.get("elevation", 0.0),
            "level_index": storey_data.get("level_index", 0),
        }

        self._nodes[storey_id] = NodeFeatures(
            node_id=storey_id,
            node_type=NodeType.STOREY,
            features=features
        )

        if building_id:
            self._add_containment_edge(building_id, storey_id)

        return storey_id

    def add_space(self, space_data: dict, storey_id: Optional[str] = None) -> str:
        """Add space node"""
        space_id = space_data.get("global_id", f"space_{hash(str(space_data))}")

        features = {
            "name": space_data.get("name", ""),
            "area": space_data.get("area", 0.0),
            "volume": space_data.get("volume", 0.0),
            "occupancy_type": space_data.get("occupancy_type", ""),
        }

        self._nodes[space_id] = NodeFeatures(
            node_id=space_id,
            node_type=NodeType.SPACE,
            features=features
        )

        if storey_id:
            self._add_containment_edge(storey_id, space_id)

        # Store location for proximity computation
        if location := space_data.get("location"):
            self._element_locations[space_id] = (
                location.get("x", 0.0),
                location.get("y", 0.0),
                location.get("z", 0.0)
            )

        return space_id

    def add_element(
        self,
        element_data: dict,
        container_id: Optional[str] = None
    ) -> str:
        """Add building element node"""
        element_id = element_data.get("global_id", f"elem_{hash(str(element_data))}")
        ifc_class = element_data.get("ifc_class", "IfcBuildingElement")

        # Extract features
        features = {
            "ifc_class": ifc_class,
            "ifc_class_encoded": self.IFC_CLASS_LABELS.get(ifc_class, -1),
            "name": element_data.get("name", ""),
        }

        # Add property features
        psets = element_data.get("property_sets", {})
        for pset_name, props in psets.items():
            if "Common" in pset_name:
                features["is_external"] = props.get("IsExternal", False)
                features["load_bearing"] = props.get("LoadBearing", False)
                fire_rating = props.get("FireRating", "")
                features["fire_rating"] = fire_rating
                features["fire_rating_encoded"] = self._encode_fire_rating(fire_rating)

        # Add quantity features
        quantities = element_data.get("quantities", {})
        features["width"] = quantities.get("Width", 0.0)
        features["height"] = quantities.get("Height", 0.0)
        features["length"] = quantities.get("Length", 0.0)
        features["area"] = quantities.get("Area", 0.0)
        features["volume"] = quantities.get("Volume", 0.0)

        # Add location features
        if location := element_data.get("location"):
            features["center_x"] = location.get("x", 0.0)
            features["center_y"] = location.get("y", 0.0)
            features["center_z"] = location.get("z", 0.0)
            self._element_locations[element_id] = (
                features["center_x"],
                features["center_y"],
                features["center_z"]
            )

        # Create node
        self._nodes[element_id] = NodeFeatures(
            node_id=element_id,
            node_type=NodeType.ELEMENT,
            features=features,
            label=self.IFC_CLASS_LABELS.get(ifc_class)
        )

        # Add containment edge
        if container_id:
            self._add_containment_edge(container_id, element_id)

        # Add material nodes/edges
        if self.include_material_nodes:
            for material in element_data.get("materials", []):
                material_id = self._add_material(material)
                self._edges.append(EdgeFeatures(
                    source_id=element_id,
                    target_id=material_id,
                    edge_type=EdgeType.HAS_MATERIAL
                ))

        # Add classification nodes/edges
        if self.include_classification_nodes:
            for classification in element_data.get("classifications", []):
                class_id = self._add_classification(classification)
                self._edges.append(EdgeFeatures(
                    source_id=element_id,
                    target_id=class_id,
                    edge_type=EdgeType.HAS_CLASSIFICATION
                ))

        return element_id

    def _add_material(self, material_data: dict) -> str:
        """Add or get material node"""
        name = material_data.get("name", "Unknown")
        material_id = f"mat_{hashlib.md5(name.encode()).hexdigest()[:8]}"

        if material_id not in self._nodes:
            self._nodes[material_id] = NodeFeatures(
                node_id=material_id,
                node_type=NodeType.MATERIAL,
                features={
                    "name": name,
                    "category": material_data.get("category", ""),
                }
            )

        return material_id

    def _add_classification(self, classification_data: dict) -> str:
        """Add or get classification node"""
        system = classification_data.get("system", "")
        code = classification_data.get("code", "")
        class_id = f"class_{hashlib.md5(f'{system}_{code}'.encode()).hexdigest()[:8]}"

        if class_id not in self._nodes:
            self._nodes[class_id] = NodeFeatures(
                node_id=class_id,
                node_type=NodeType.CLASSIFICATION,
                features={
                    "system": system,
                    "code": code,
                    "name": classification_data.get("name", code),
                }
            )

        return class_id

    def _add_containment_edge(self, parent_id: str, child_id: str) -> None:
        """Add containment relationship edges"""
        self._containment[child_id] = parent_id

        self._edges.append(EdgeFeatures(
            source_id=parent_id,
            target_id=child_id,
            edge_type=EdgeType.CONTAINS
        ))

        self._edges.append(EdgeFeatures(
            source_id=child_id,
            target_id=parent_id,
            edge_type=EdgeType.CONTAINED_IN
        ))

    def _encode_fire_rating(self, rating: str) -> float:
        """Encode fire rating to numeric value"""
        if not rating:
            return 0.0

        rating_map = {
            "REI30": 0.5,
            "REI60": 1.0,
            "REI90": 1.5,
            "REI120": 2.0,
            "REI180": 2.5,
            "REI240": 3.0,
        }

        for key, value in rating_map.items():
            if key in str(rating).upper():
                return value

        return 0.0

    def add_connection(
        self,
        source_id: str,
        target_id: str,
        connection_type: str = "connects"
    ) -> None:
        """Add connection relationship between elements"""
        edge_type = EdgeType.CONNECTS_TO

        if connection_type == "adjacent":
            edge_type = EdgeType.ADJACENT_TO
        elif connection_type == "bounded":
            edge_type = EdgeType.BOUNDED_BY
        elif connection_type == "voids":
            edge_type = EdgeType.VOIDS
        elif connection_type == "fills":
            edge_type = EdgeType.FILLS

        self._edges.append(EdgeFeatures(
            source_id=source_id,
            target_id=target_id,
            edge_type=edge_type
        ))

        # Add reverse edge for bidirectional relationships
        if edge_type in [EdgeType.CONNECTS_TO, EdgeType.ADJACENT_TO]:
            self._edges.append(EdgeFeatures(
                source_id=target_id,
                target_id=source_id,
                edge_type=edge_type
            ))

    def add_connections_from_ifc(self, connections: list[dict]) -> None:
        """Add connections from IFC relationship data"""
        for conn in connections:
            relating_element = conn.get("relating_element")
            related_elements = conn.get("related_elements", [])
            conn_type = conn.get("connection_type", "connects")

            if relating_element:
                for related in related_elements:
                    self.add_connection(relating_element, related, conn_type)

    def compute_proximity_edges(
        self,
        threshold_meters: float = 2.0,
        same_level_only: bool = True
    ) -> int:
        """
        Compute spatial proximity edges between elements.

        Args:
            threshold_meters: Maximum distance for proximity relationship
            same_level_only: Only create edges between elements on same level

        Returns:
            Number of edges created
        """
        import math

        edges_created = 0
        element_ids = list(self._element_locations.keys())

        for i, id1 in enumerate(element_ids):
            loc1 = self._element_locations[id1]

            for j in range(i + 1, len(element_ids)):
                id2 = element_ids[j]
                loc2 = self._element_locations[id2]

                # Check same level if required
                if same_level_only:
                    z_diff = abs(loc1[2] - loc2[2])
                    if z_diff > 0.5:  # 0.5m tolerance for same level
                        continue

                # Compute distance
                dx = loc1[0] - loc2[0]
                dy = loc1[1] - loc2[1]
                dz = loc1[2] - loc2[2] if not same_level_only else 0

                distance = math.sqrt(dx*dx + dy*dy + dz*dz)

                if distance <= threshold_meters:
                    self._edges.append(EdgeFeatures(
                        source_id=id1,
                        target_id=id2,
                        edge_type=EdgeType.NEAR,
                        features={"distance": distance},
                        weight=1.0 - (distance / threshold_meters)  # Closer = higher weight
                    ))
                    self._edges.append(EdgeFeatures(
                        source_id=id2,
                        target_id=id1,
                        edge_type=EdgeType.NEAR,
                        features={"distance": distance},
                        weight=1.0 - (distance / threshold_meters)
                    ))
                    edges_created += 2

        logger.info(f"Created {edges_created} proximity edges")
        return edges_created

    def compute_same_level_edges(self) -> int:
        """Create edges between elements on the same storey/level"""
        edges_created = 0

        # Group elements by container
        level_elements = defaultdict(list)
        for child_id, parent_id in self._containment.items():
            node = self._nodes.get(child_id)
            if node and node.node_type == NodeType.ELEMENT:
                level_elements[parent_id].append(child_id)

        # Create edges within each level
        for level_id, elements in level_elements.items():
            for i, id1 in enumerate(elements):
                for j in range(i + 1, len(elements)):
                    id2 = elements[j]
                    self._edges.append(EdgeFeatures(
                        source_id=id1,
                        target_id=id2,
                        edge_type=EdgeType.SAME_LEVEL
                    ))
                    self._edges.append(EdgeFeatures(
                        source_id=id2,
                        target_id=id1,
                        edge_type=EdgeType.SAME_LEVEL
                    ))
                    edges_created += 2

        logger.info(f"Created {edges_created} same-level edges")
        return edges_created

    def build_graph(self) -> GraphData:
        """Build final graph data structure"""
        graph = GraphData(
            nodes=list(self._nodes.values()),
            edges=self._edges,
            metadata={
                "created_at": datetime.now().isoformat(),
                "include_property_nodes": self.include_property_nodes,
                "include_material_nodes": self.include_material_nodes,
                "include_classification_nodes": self.include_classification_nodes
            }
        )
        graph.build_indexes()
        return graph

    def export(
        self,
        graph: GraphData,
        output_path: Path,
        format: GNNOutputFormat = GNNOutputFormat.PYTORCH_GEOMETRIC,
        feature_names: list[str] = None
    ) -> None:
        """Export graph to specified format"""
        output_path = Path(output_path)

        if format == GNNOutputFormat.PYTORCH_GEOMETRIC:
            self._export_pyg(graph, output_path, feature_names)
        elif format == GNNOutputFormat.DGL:
            self._export_dgl(graph, output_path, feature_names)
        elif format == GNNOutputFormat.NETWORKX:
            self._export_networkx(graph, output_path)
        elif format == GNNOutputFormat.JSON:
            self._export_json(graph, output_path)
        elif format == GNNOutputFormat.EDGE_LIST:
            self._export_edgelist(graph, output_path)
        else:
            raise ValueError(f"Unsupported format: {format}")

        logger.info(f"Exported graph to {output_path} ({format.value})")

    def _export_pyg(
        self,
        graph: GraphData,
        output_path: Path,
        feature_names: list[str]
    ) -> None:
        """Export to PyTorch Geometric format"""
        try:
            import torch
            from torch_geometric.data import Data

            feature_names = feature_names or self.DEFAULT_ELEMENT_FEATURES

            # Build node features tensor
            x = []
            y = []
            for node in graph.nodes:
                x.append(node.get_feature_vector(feature_names))
                y.append(node.label if node.label is not None else -1)

            x = torch.tensor(x, dtype=torch.float)
            y = torch.tensor(y, dtype=torch.long)

            # Build edge index
            sources, targets = graph.get_edge_index()
            edge_index = torch.tensor([sources, targets], dtype=torch.long)

            # Create PyG Data object
            data = Data(x=x, edge_index=edge_index, y=y)

            # Add metadata
            data.num_nodes = len(graph.nodes)
            data.num_edges = len(graph.edges)

            torch.save(data, output_path)

        except ImportError:
            logger.error("PyTorch and PyTorch Geometric required for PyG export")
            # Fallback to JSON
            self._export_json(graph, output_path.with_suffix('.json'))

    def _export_dgl(
        self,
        graph: GraphData,
        output_path: Path,
        feature_names: list[str]
    ) -> None:
        """Export to DGL format"""
        try:
            import dgl
            import torch

            feature_names = feature_names or self.DEFAULT_ELEMENT_FEATURES

            # Build graph
            sources, targets = graph.get_edge_index()
            g = dgl.graph((sources, targets))

            # Add node features
            features = []
            labels = []
            for node in graph.nodes:
                features.append(node.get_feature_vector(feature_names))
                labels.append(node.label if node.label is not None else -1)

            g.ndata['feat'] = torch.tensor(features, dtype=torch.float)
            g.ndata['label'] = torch.tensor(labels, dtype=torch.long)

            dgl.save_graphs(str(output_path), [g])

        except ImportError:
            logger.error("DGL and PyTorch required for DGL export")
            self._export_json(graph, output_path.with_suffix('.json'))

    def _export_networkx(self, graph: GraphData, output_path: Path) -> None:
        """Export to NetworkX format (as GraphML)"""
        try:
            import networkx as nx

            G = nx.DiGraph()

            # Add nodes
            for node in graph.nodes:
                G.add_node(
                    node.node_id,
                    node_type=node.node_type.value,
                    label=node.label,
                    **{k: str(v) for k, v in node.features.items()}
                )

            # Add edges
            for edge in graph.edges:
                G.add_edge(
                    edge.source_id,
                    edge.target_id,
                    edge_type=edge.edge_type.value,
                    weight=edge.weight,
                    **{k: str(v) for k, v in edge.features.items()}
                )

            nx.write_graphml(G, output_path)

        except ImportError:
            logger.error("NetworkX required for GraphML export")
            self._export_json(graph, output_path.with_suffix('.json'))

    def _export_json(self, graph: GraphData, output_path: Path) -> None:
        """Export to JSON format"""
        data = {
            "nodes": [n.to_dict() for n in graph.nodes],
            "edges": [e.to_dict() for e in graph.edges],
            "metadata": graph.metadata,
            "statistics": graph.get_stats()
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _export_edgelist(self, graph: GraphData, output_path: Path) -> None:
        """Export to edge list format (simple text)"""
        # Build node index
        node_to_idx = {node.node_id: idx for idx, node in enumerate(graph.nodes)}

        with open(output_path, 'w') as f:
            for edge in graph.edges:
                src_idx = node_to_idx.get(edge.source_id, -1)
                tgt_idx = node_to_idx.get(edge.target_id, -1)
                if src_idx >= 0 and tgt_idx >= 0:
                    f.write(f"{src_idx} {tgt_idx} {edge.weight}\n")

    def get_stats(self) -> dict:
        """Get generation statistics"""
        node_type_counts = defaultdict(int)
        for node in self._nodes.values():
            node_type_counts[node.node_type.value] += 1

        edge_type_counts = defaultdict(int)
        for edge in self._edges:
            edge_type_counts[edge.edge_type.value] += 1

        return {
            "totalNodes": len(self._nodes),
            "totalEdges": len(self._edges),
            "nodeTypeCounts": dict(node_type_counts),
            "edgeTypeCounts": dict(edge_type_counts),
            "elementsWithLocation": len(self._element_locations),
            "containmentRelationships": len(self._containment)
        }
