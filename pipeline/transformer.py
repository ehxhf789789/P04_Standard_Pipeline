"""
Stage 4: Transform - Convert to 4 AI-Ready Formats

Transforms enriched IFC data into:
1. Knowledge Graph (NetworkX + Pyvis visualization)
2. Vector Embeddings (sentence-transformers)
3. Tabular Dataset (pandas DataFrame)
4. Graph Structure (GNN-ready format)
"""

import json
import numpy as np
import pandas as pd
import networkx as nx
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field


@dataclass
class TransformationResult:
    """Container for all transformation outputs."""
    knowledge_graph: Optional[nx.DiGraph] = None
    kg_html_path: Optional[str] = None
    embeddings: Optional[np.ndarray] = None
    embedding_metadata: dict = field(default_factory=dict)
    tabular_df: Optional[pd.DataFrame] = None
    graph_structure: dict = field(default_factory=dict)
    statistics: dict = field(default_factory=dict)


class AITransformer:
    """
    Transforms enriched BIM data into 4 AI-ready formats.

    Formats:
    1. Knowledge Graph: Graph database representation with nodes and edges
    2. Vector Embeddings: Dense vectors for semantic search/similarity
    3. Tabular Dataset: Flat table for ML models
    4. Graph Structure: Adjacency + feature matrices for GNNs
    """

    # Node type colors for visualization
    NODE_COLORS = {
        "element": "#0891B2",      # Cyan - building elements
        "spatial": "#F59E0B",      # Amber - spatial structure
        "property": "#94A3B8",     # Slate - properties
        "material": "#10B981",     # Emerald - materials
        "classification": "#8B5CF6", # Purple - classifications
        "pset": "#EC4899",         # Pink - property sets
    }

    def __init__(self, enriched_elements: list, parsed_elements: list = None, spatial_tree: dict = None):
        """
        Initialize transformer with enriched elements.

        Args:
            enriched_elements: List of EnrichedElement or dicts
            parsed_elements: Original parsed elements (for additional data)
            spatial_tree: Spatial hierarchy tree from parser
        """
        # Convert EnrichedElement to dicts if needed
        self.elements = []
        for e in enriched_elements:
            if hasattr(e, 'global_id'):  # EnrichedElement
                self.elements.append(self._enriched_to_dict(e))
            else:
                self.elements.append(e)

        self.parsed_elements = parsed_elements or []
        self.spatial_tree = spatial_tree or {}

        # Build element lookup
        self._element_lookup = {e["global_id"]: e for e in self.elements}

        # Build parsed lookup for extra data (material, relationships)
        self._parsed_lookup = {}
        for pe in self.parsed_elements:
            self._parsed_lookup[pe["global_id"]] = pe

    def _enriched_to_dict(self, enriched) -> dict:
        """Convert EnrichedElement to dictionary."""
        return {
            "global_id": enriched.global_id,
            "ifc_class": enriched.ifc_class,
            "name": enriched.name,
            "bsdd_class_uri": enriched.bsdd_class_uri,
            "standardized_properties": {
                k: {
                    "original_name": v.original_name,
                    "standard_name": v.standard_name,
                    "original_value": v.original_value,
                    "normalized_value": v.normalized_value,
                    "property_set": v.property_set,
                    "bsdd_uri": v.bsdd_uri,
                    "mapping_status": v.mapping_status
                }
                for k, v in enriched.standardized_properties.items()
            },
            "classification_links": enriched.classification_links,
            "enrichment_stats": enriched.enrichment_stats
        }

    def transform_all(self, output_dir: str = "outputs") -> TransformationResult:
        """
        Run all transformations and save outputs.

        Args:
            output_dir: Directory for output files

        Returns:
            TransformationResult with all outputs
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        result = TransformationResult()

        # 1. Knowledge Graph
        print("  [1/4] Building Knowledge Graph...")
        result.knowledge_graph, result.kg_html_path = self.to_knowledge_graph(
            str(output_path / "knowledge_graph.html")
        )

        # 2. Vector Embeddings
        print("  [2/4] Generating Vector Embeddings...")
        result.embeddings, result.embedding_metadata = self.to_vector_embeddings()
        np.save(str(output_path / "embeddings.npy"), result.embeddings)

        # 3. Tabular Dataset
        print("  [3/4] Creating Tabular Dataset...")
        result.tabular_df = self.to_tabular()
        result.tabular_df.to_csv(str(output_path / "dataset.csv"), index=False)
        result.tabular_df.to_parquet(str(output_path / "dataset.parquet"), index=False)

        # 4. Graph Structure
        print("  [4/4] Building GNN Graph Structure...")
        result.graph_structure = self.to_graph_structure()
        with open(str(output_path / "graph_structure.json"), 'w') as f:
            # Convert numpy arrays to lists for JSON serialization
            json_safe = {
                k: v.tolist() if isinstance(v, np.ndarray) else v
                for k, v in result.graph_structure.items()
            }
            json.dump(json_safe, f, indent=2)

        # Statistics
        result.statistics = {
            "kg_nodes": result.knowledge_graph.number_of_nodes() if result.knowledge_graph else 0,
            "kg_edges": result.knowledge_graph.number_of_edges() if result.knowledge_graph else 0,
            "embedding_count": len(result.embeddings) if result.embeddings is not None else 0,
            "embedding_dim": result.embeddings.shape[1] if result.embeddings is not None and len(result.embeddings.shape) > 1 else 0,
            "table_rows": len(result.tabular_df) if result.tabular_df is not None else 0,
            "table_cols": len(result.tabular_df.columns) if result.tabular_df is not None else 0,
            "gnn_nodes": result.graph_structure.get("num_nodes", 0),
            "gnn_edges": result.graph_structure.get("num_edges", 0),
        }

        return result

    # ═══════════════════════════════════════════════════════════════════════
    # 1. KNOWLEDGE GRAPH
    # ═══════════════════════════════════════════════════════════════════════

    def to_knowledge_graph(self, output_html_path: str = None) -> tuple[nx.DiGraph, str]:
        """
        Build a knowledge graph from enriched elements.

        Node types:
        - element: Building elements (IfcWall, IfcDoor, etc.)
        - spatial: Spatial structure (IfcBuilding, IfcBuildingStorey)
        - property: Individual properties
        - material: Materials
        - classification: Classification codes
        - pset: Property sets

        Edge types:
        - CONTAINED_IN: element -> spatial
        - HAS_PSET: element -> pset
        - HAS_PROPERTY: pset -> property
        - HAS_MATERIAL: element -> material
        - CLASSIFIED_AS: element -> classification
        - SAME_STOREY: element <-> element (same spatial container)

        Returns:
            Tuple of (NetworkX DiGraph, HTML file path)
        """
        G = nx.DiGraph()

        # Add element nodes
        for el in self.elements:
            el_id = el["global_id"]
            G.add_node(el_id,
                       node_type="element",
                       ifc_class=el["ifc_class"],
                       name=el.get("name", "Unknown"),
                       label=f'{el["ifc_class"]}\n{el.get("name", "")}')

            # Add property set and property nodes
            for key, prop in el.get("standardized_properties", {}).items():
                pset_name = prop.get("property_set", "Unknown")
                pset_id = f"pset_{el_id}_{pset_name}"
                prop_id = f"prop_{el_id}_{key}"

                # Property set node
                if not G.has_node(pset_id):
                    G.add_node(pset_id,
                               node_type="pset",
                               name=pset_name,
                               label=pset_name)
                    G.add_edge(el_id, pset_id, edge_type="HAS_PSET")

                # Property node
                value = prop.get("normalized_value", prop.get("original_value"))
                G.add_node(prop_id,
                           node_type="property",
                           name=prop.get("standard_name"),
                           value=str(value),
                           bsdd_uri=prop.get("bsdd_uri"),
                           label=f'{prop.get("standard_name")}\n={value}')
                G.add_edge(pset_id, prop_id, edge_type="HAS_PROPERTY")

            # Add classification nodes
            cls_links = el.get("classification_links", {})
            for sys_name, cls_data in cls_links.items():
                if cls_data and isinstance(cls_data, dict):
                    code = cls_data.get("code") or cls_data.get("uri", "")
                    if code:
                        cls_id = f"cls_{sys_name}_{code}"
                        if not G.has_node(cls_id):
                            G.add_node(cls_id,
                                       node_type="classification",
                                       system=sys_name,
                                       code=code,
                                       label=f'{sys_name}\n{code}')
                        G.add_edge(el_id, cls_id, edge_type="CLASSIFIED_AS")

        # Add material nodes from parsed elements
        for pe in self.parsed_elements:
            el_id = pe["global_id"]
            if el_id not in G:
                continue

            materials = pe.get("material", [])
            if materials:
                for mat in materials:
                    mat_name = mat.get("name", "Unknown")
                    mat_id = f"mat_{mat_name}"
                    if not G.has_node(mat_id):
                        G.add_node(mat_id,
                                   node_type="material",
                                   name=mat_name,
                                   label=f'Material\n{mat_name}')
                    G.add_edge(el_id, mat_id, edge_type="HAS_MATERIAL")

            # Add spatial containment
            container = pe.get("spatial_container")
            if container:
                cont_id = container.get("global_id")
                if cont_id:
                    if not G.has_node(cont_id):
                        G.add_node(cont_id,
                                   node_type="spatial",
                                   ifc_class=container.get("type"),
                                   name=container.get("name"),
                                   label=f'{container.get("type")}\n{container.get("name")}')
                    G.add_edge(el_id, cont_id, edge_type="CONTAINED_IN")

        # Add SAME_STOREY edges (elements in same spatial container)
        storey_elements = {}
        for pe in self.parsed_elements:
            container = pe.get("spatial_container")
            if container:
                storey = container.get("global_id")
                if storey not in storey_elements:
                    storey_elements[storey] = []
                storey_elements[storey].append(pe["global_id"])

        for storey, elements in storey_elements.items():
            for i, el1 in enumerate(elements):
                for el2 in elements[i+1:]:
                    if G.has_node(el1) and G.has_node(el2):
                        G.add_edge(el1, el2, edge_type="SAME_STOREY")

        # Generate HTML visualization using Pyvis
        html_path = output_html_path or "outputs/knowledge_graph.html"
        self._create_pyvis_html(G, html_path)

        return G, html_path

    def _create_pyvis_html(self, G: nx.DiGraph, output_path: str):
        """Create interactive HTML visualization using Pyvis."""
        try:
            from pyvis.network import Network

            # Create Pyvis network
            net = Network(
                height="600px",
                width="100%",
                directed=True,
                bgcolor="#0B1120",
                font_color="white",
                select_menu=True,
                filter_menu=True
            )

            # Add nodes with colors based on type
            for node_id in G.nodes():
                node_data = G.nodes[node_id]
                node_type = node_data.get("node_type", "unknown")
                color = self.NODE_COLORS.get(node_type, "#475569")
                label = node_data.get("label", str(node_id)[:20])

                # Size based on type
                size = 25 if node_type in ["element", "spatial"] else 15

                net.add_node(
                    node_id,
                    label=label,
                    color=color,
                    size=size,
                    title=json.dumps(dict(node_data), indent=2, default=str)
                )

            # Add edges
            for u, v, data in G.edges(data=True):
                edge_type = data.get("edge_type", "")
                net.add_edge(u, v, title=edge_type, label=edge_type[:15])

            # Configure physics
            net.set_options('''
            {
                "nodes": {
                    "font": {"size": 12}
                },
                "edges": {
                    "arrows": {"to": {"enabled": true, "scaleFactor": 0.5}},
                    "color": {"color": "#64748B"},
                    "font": {"size": 8, "color": "#94A3B8"}
                },
                "physics": {
                    "forceAtlas2Based": {
                        "gravitationalConstant": -50,
                        "centralGravity": 0.01,
                        "springLength": 100,
                        "springConstant": 0.08
                    },
                    "solver": "forceAtlas2Based",
                    "stabilization": {"iterations": 150}
                }
            }
            ''')

            # Save
            net.save_graph(output_path)

        except ImportError:
            print("  Warning: Pyvis not available, skipping HTML visualization")

    # ═══════════════════════════════════════════════════════════════════════
    # 2. VECTOR EMBEDDINGS
    # ═══════════════════════════════════════════════════════════════════════

    def to_vector_embeddings(self) -> tuple[np.ndarray, dict]:
        """
        Generate vector embeddings for each element using sentence-transformers.

        Text composition for each element:
        "{ifc_class} {name} located on {storey} with properties: {prop=value, ...}
         material: {material} classification: {code}"

        Returns:
            Tuple of (embeddings array [N, dim], metadata dict)
        """
        try:
            from sentence_transformers import SentenceTransformer

            print("    Loading sentence-transformers model...")
            model = SentenceTransformer('all-MiniLM-L6-v2')

            # Build text descriptions
            texts = []
            ids = []

            for el in self.elements:
                text_parts = [el["ifc_class"], el.get("name", "")]

                # Get spatial container from parsed elements
                pe = self._parsed_lookup.get(el["global_id"], {})
                container = pe.get("spatial_container")
                if container:
                    text_parts.append(f"on {container.get('name', '')}")

                # Add standardized properties
                for key, prop in el.get("standardized_properties", {}).items():
                    name = prop.get("standard_name", key)
                    value = prop.get("normalized_value", prop.get("original_value", ""))
                    text_parts.append(f"{name}={value}")

                # Add material
                materials = pe.get("material", [])
                if materials:
                    mat_names = [m.get("name", "") for m in materials]
                    text_parts.append(f"material:{','.join(mat_names)}")

                # Add classification
                cls_links = el.get("classification_links", {})
                for sys_name, cls_data in cls_links.items():
                    if cls_data and isinstance(cls_data, dict):
                        code = cls_data.get("code")
                        if code:
                            text_parts.append(f"class:{code}")
                            break  # Just use first classification

                text = " ".join(str(p) for p in text_parts if p)
                texts.append(text)
                ids.append(el["global_id"])

            # Generate embeddings
            print(f"    Encoding {len(texts)} elements...")
            embeddings = model.encode(texts, show_progress_bar=True)

            # Calculate similarity matrix
            from sklearn.metrics.pairwise import cosine_similarity
            similarity_matrix = cosine_similarity(embeddings)

            # 2D projection for visualization
            if len(embeddings) > 2:
                from sklearn.decomposition import PCA
                pca = PCA(n_components=2)
                embeddings_2d = pca.fit_transform(embeddings)
            else:
                embeddings_2d = embeddings[:, :2] if embeddings.shape[1] >= 2 else embeddings

            metadata = {
                "element_ids": ids,
                "element_types": [el["ifc_class"] for el in self.elements],
                "element_names": [el.get("name", "") for el in self.elements],
                "texts": texts,
                "dimension": embeddings.shape[1],
                "model_name": "all-MiniLM-L6-v2",
                "embeddings_2d": embeddings_2d.tolist(),
                "similarity_matrix": similarity_matrix.tolist(),
            }

            return embeddings, metadata

        except ImportError as e:
            print(f"  Warning: sentence-transformers not available: {e}")
            # Return dummy embeddings
            n = len(self.elements)
            return np.zeros((n, 384)), {"error": str(e)}

    # ═══════════════════════════════════════════════════════════════════════
    # 3. TABULAR DATASET
    # ═══════════════════════════════════════════════════════════════════════

    def to_tabular(self) -> pd.DataFrame:
        """
        Convert elements to tabular format suitable for ML.

        Each row is one element, columns are:
        - GlobalId, IFC_Class, Name, Storey
        - Material
        - Classification codes
        - All standardized property values (flattened)

        Returns:
            pandas DataFrame
        """
        rows = []

        for el in self.elements:
            pe = self._parsed_lookup.get(el["global_id"], {})

            row = {
                "GlobalId": el["global_id"],
                "IFC_Class": el["ifc_class"],
                "Name": el.get("name"),
            }

            # Spatial container
            container = pe.get("spatial_container")
            row["Storey"] = container.get("name") if container else None

            # Material
            materials = pe.get("material", [])
            row["Material"] = materials[0].get("name") if materials else None

            # Classification
            cls_links = el.get("classification_links", {})
            for sys_name in ["uniclass2015", "omniclass"]:
                cls_data = cls_links.get(sys_name, {})
                if isinstance(cls_data, dict):
                    row[f"Classification_{sys_name}"] = cls_data.get("code")

            # Flattened properties
            for key, prop in el.get("standardized_properties", {}).items():
                col_name = prop.get("standard_name", key).replace(" ", "_")
                row[col_name] = prop.get("normalized_value", prop.get("original_value"))

            rows.append(row)

        df = pd.DataFrame(rows)

        # Reorder columns
        priority_cols = ["GlobalId", "IFC_Class", "Name", "Storey", "Material"]
        other_cols = [c for c in df.columns if c not in priority_cols]
        df = df[priority_cols + sorted(other_cols)]

        return df

    # ═══════════════════════════════════════════════════════════════════════
    # 4. GRAPH STRUCTURE (GNN)
    # ═══════════════════════════════════════════════════════════════════════

    def to_graph_structure(self) -> dict:
        """
        Build GNN-ready graph structure.

        Returns dict with:
        - feature_matrix: [N, F] node features (one-hot type + numeric properties)
        - adjacency_matrix: [N, N] connections
        - edge_index: [2, E] COO format edge indices
        - node_labels: [N] IFC class labels
        - feature_names: [F] feature column names

        Edges connect elements that:
        - Are in the same storey
        - Have the same material
        - Have the same classification
        """
        n = len(self.elements)
        if n == 0:
            return {"error": "No elements"}

        # Build type vocabulary
        all_types = sorted(set(el["ifc_class"] for el in self.elements))
        type_to_idx = {t: i for i, t in enumerate(all_types)}
        n_types = len(all_types)

        # Numeric features (max 10)
        numeric_features = [
            "Fire_Rating", "Thermal_Transmittance", "Load_Bearing", "Is_External"
        ]
        n_numeric = len(numeric_features)

        # Feature matrix: [N, n_types + n_numeric]
        feature_dim = n_types + n_numeric
        feature_matrix = np.zeros((n, feature_dim))

        for i, el in enumerate(self.elements):
            # One-hot encoding of type
            type_idx = type_to_idx.get(el["ifc_class"], 0)
            feature_matrix[i, type_idx] = 1.0

            # Numeric features
            for j, feat_name in enumerate(numeric_features):
                for key, prop in el.get("standardized_properties", {}).items():
                    std_name = prop.get("standard_name", "").replace(" ", "_")
                    if std_name == feat_name:
                        value = prop.get("normalized_value")
                        if isinstance(value, bool):
                            feature_matrix[i, n_types + j] = 1.0 if value else 0.0
                        elif isinstance(value, (int, float)):
                            feature_matrix[i, n_types + j] = float(value)
                        break

        # Adjacency matrix
        adjacency = np.zeros((n, n))
        id_to_idx = {el["global_id"]: i for i, el in enumerate(self.elements)}

        # Connect elements in same storey
        storey_elements = {}
        for pe in self.parsed_elements:
            container = pe.get("spatial_container")
            if container:
                storey = container.get("global_id")
                if storey not in storey_elements:
                    storey_elements[storey] = []
                if pe["global_id"] in id_to_idx:
                    storey_elements[storey].append(pe["global_id"])

        for storey, elements in storey_elements.items():
            for i, el1 in enumerate(elements):
                for el2 in elements[i+1:]:
                    idx1 = id_to_idx.get(el1)
                    idx2 = id_to_idx.get(el2)
                    if idx1 is not None and idx2 is not None:
                        adjacency[idx1, idx2] = 1.0
                        adjacency[idx2, idx1] = 1.0  # Undirected

        # Connect elements with same material
        material_elements = {}
        for pe in self.parsed_elements:
            materials = pe.get("material") or []
            for mat in materials:
                mat_name = mat.get("name")
                if mat_name:
                    if mat_name not in material_elements:
                        material_elements[mat_name] = []
                    if pe["global_id"] in id_to_idx:
                        material_elements[mat_name].append(pe["global_id"])

        for mat, elements in material_elements.items():
            for i, el1 in enumerate(elements):
                for el2 in elements[i+1:]:
                    idx1 = id_to_idx.get(el1)
                    idx2 = id_to_idx.get(el2)
                    if idx1 is not None and idx2 is not None:
                        adjacency[idx1, idx2] = 1.0
                        adjacency[idx2, idx1] = 1.0

        # Convert to edge index (COO format for PyTorch Geometric)
        edge_indices = np.where(adjacency > 0)
        edge_index = np.array([edge_indices[0], edge_indices[1]])

        return {
            "feature_matrix": feature_matrix,
            "adjacency_matrix": adjacency,
            "edge_index": edge_index,
            "num_nodes": n,
            "num_edges": len(edge_indices[0]),
            "num_features": feature_dim,
            "node_labels": [el["ifc_class"] for el in self.elements],
            "node_ids": [el["global_id"] for el in self.elements],
            "feature_names": all_types + numeric_features,
            "type_vocabulary": type_to_idx,
        }


# Test the transformer
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from pipeline.parser import IFCParser
    from pipeline.enricher import BSDDEnricher

    print("=" * 60)
    print("Stage 4: Transform - 4 AI-Ready Formats")
    print("=" * 60)

    # Parse
    parser = IFCParser("data/sample.ifc")
    parsed = parser.parse_all_elements()
    spatial_tree = parser.get_spatial_tree()
    print(f"\nParsed {len(parsed)} elements")

    # Enrich
    enricher = BSDDEnricher(
        "data/bsdd_knowledge_base/classes.json",
        "data/bsdd_knowledge_base/classification_map.json"
    )
    enriched = enricher.enrich_all(parsed)
    print(f"Enriched {len(enriched)} elements")

    # Transform
    print("\nTransforming to AI formats...")
    transformer = AITransformer(enriched, parsed, spatial_tree)
    result = transformer.transform_all("outputs")

    # Print results
    print("\n" + "=" * 60)
    print("Transformation Results:")
    print("=" * 60)

    print("\n[1] Knowledge Graph:")
    print(f"    Nodes: {result.statistics['kg_nodes']}")
    print(f"    Edges: {result.statistics['kg_edges']}")
    print(f"    HTML: {result.kg_html_path}")

    print("\n[2] Vector Embeddings:")
    print(f"    Count: {result.statistics['embedding_count']}")
    print(f"    Dimension: {result.statistics['embedding_dim']}")
    if result.embedding_metadata.get("texts"):
        print(f"    Sample text: {result.embedding_metadata['texts'][0][:80]}...")

    print("\n[3] Tabular Dataset:")
    print(f"    Rows: {result.statistics['table_rows']}")
    print(f"    Columns: {result.statistics['table_cols']}")
    if result.tabular_df is not None:
        print(f"    Columns: {list(result.tabular_df.columns)}")

    print("\n[4] Graph Structure (GNN):")
    print(f"    Nodes: {result.statistics['gnn_nodes']}")
    print(f"    Edges: {result.statistics['gnn_edges']}")
    print(f"    Feature dim: {result.graph_structure.get('num_features', 0)}")

    print("\n[OK] All outputs saved to outputs/")
