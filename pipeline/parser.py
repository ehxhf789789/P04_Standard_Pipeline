"""
Stage 1: Parse - IFC to Structured Objects

Parses IFC files using IfcOpenShell and converts them to structured
Python dictionaries suitable for downstream processing.
"""

import ifcopenshell
import ifcopenshell.util.element
import ifcopenshell.util.placement
from pathlib import Path
from typing import Optional
import json


class IFCParser:
    """Parses IFC files into structured Python objects."""

    def __init__(self, ifc_path: str):
        """
        Initialize parser with an IFC file.

        Args:
            ifc_path: Path to the IFC file
        """
        self.ifc_path = Path(ifc_path)
        self.ifc = ifcopenshell.open(str(ifc_path))

        # Read raw text for display purposes
        with open(ifc_path, 'r', encoding='utf-8', errors='ignore') as f:
            self.raw_text = f.read()

        self.schema = self.ifc.schema
        self._element_cache = {}

    def parse_all_elements(self) -> list[dict]:
        """
        Parse all IfcProduct elements into structured dictionaries.

        Returns:
            List of element dictionaries with properties, materials, etc.
        """
        elements = []

        for product in self.ifc.by_type("IfcProduct"):
            # Skip spatial structure elements for main list
            if product.is_a("IfcSpatialStructureElement"):
                continue

            element = self._parse_element(product)
            elements.append(element)
            self._element_cache[product.GlobalId] = element

        return elements

    def _parse_element(self, product) -> dict:
        """Parse a single IfcProduct into a structured dictionary."""
        element = {
            "global_id": product.GlobalId,
            "ifc_class": product.is_a(),
            "name": product.Name,
            "description": product.Description,
            "object_type": getattr(product, 'ObjectType', None),
            "tag": getattr(product, 'Tag', None),
            "spatial_container": self._get_container(product),
            "property_sets": self._get_all_psets(product),
            "material": self._get_material(product),
            "classification": self._get_classification(product),
            "quantities": self._get_quantities(product),
            "relationships": self._get_relationships(product),
            "placement": self._get_placement_info(product),
        }
        return element

    def _get_container(self, element) -> Optional[dict]:
        """Get the spatial container (IfcBuildingStorey, IfcSpace, etc.)."""
        try:
            container = ifcopenshell.util.element.get_container(element)
            if container:
                return {
                    "global_id": container.GlobalId,
                    "name": container.Name,
                    "type": container.is_a(),
                    "elevation": getattr(container, 'Elevation', None)
                }
        except:
            pass
        return None

    def _get_all_psets(self, element) -> dict:
        """Get all property sets with their properties."""
        try:
            psets = ifcopenshell.util.element.get_psets(element)
            # Filter out quantity sets (handled separately)
            return {k: v for k, v in psets.items() if not k.startswith('Qto_')}
        except:
            return {}

    def _get_quantities(self, element) -> dict:
        """Get quantity sets (Qto_*)."""
        try:
            psets = ifcopenshell.util.element.get_psets(element, qtos_only=True)
            return psets
        except:
            return {}

    def _get_material(self, element) -> Optional[list[dict]]:
        """
        Get material information from IfcRelAssociatesMaterial.

        Returns:
            List of material dictionaries with name and thickness (if layered)
        """
        try:
            material = ifcopenshell.util.element.get_material(element)
            if not material:
                return None

            materials = []

            if material.is_a("IfcMaterialLayerSetUsage"):
                for layer in material.ForLayerSet.MaterialLayers:
                    mat_info = {
                        "name": layer.Material.Name if layer.Material else "Unknown",
                        "thickness": layer.LayerThickness,
                        "type": "layer"
                    }
                    materials.append(mat_info)

            elif material.is_a("IfcMaterialLayerSet"):
                for layer in material.MaterialLayers:
                    mat_info = {
                        "name": layer.Material.Name if layer.Material else "Unknown",
                        "thickness": layer.LayerThickness,
                        "type": "layer"
                    }
                    materials.append(mat_info)

            elif material.is_a("IfcMaterialProfileSetUsage"):
                profile_set = material.ForProfileSet
                if profile_set:
                    for profile in profile_set.MaterialProfiles:
                        mat_info = {
                            "name": profile.Material.Name if profile.Material else "Unknown",
                            "profile": profile.Profile.ProfileName if profile.Profile else None,
                            "type": "profile"
                        }
                        materials.append(mat_info)

            elif material.is_a("IfcMaterial"):
                materials.append({
                    "name": material.Name,
                    "type": "single"
                })

            elif material.is_a("IfcMaterialList"):
                for mat in material.Materials:
                    materials.append({
                        "name": mat.Name,
                        "type": "list"
                    })

            return materials if materials else None

        except Exception as e:
            return None

    def _get_classification(self, element) -> Optional[list[dict]]:
        """
        Get classification references from IfcRelAssociatesClassification.

        Returns:
            List of classification dictionaries with system and code
        """
        classifications = []
        try:
            # Navigate through HasAssociations inverse attribute
            for rel in getattr(element, 'HasAssociations', []):
                if rel.is_a("IfcRelAssociatesClassification"):
                    ref = rel.RelatingClassification
                    if ref.is_a("IfcClassificationReference"):
                        cls_info = {
                            "system": ref.ReferencedSource.Name if ref.ReferencedSource else None,
                            "code": ref.Identification or ref.ItemReference,
                            "name": ref.Name,
                            "location": ref.Location
                        }
                        classifications.append(cls_info)
        except:
            pass

        return classifications if classifications else None

    def _get_relationships(self, element) -> dict:
        """
        Get various IFC relationships for the element.

        Returns:
            Dictionary of relationship types and related elements
        """
        rels = {
            "voids": [],      # Elements voiding this (openings)
            "fills": [],      # Elements filling openings
            "connected": [],  # Connected elements
            "aggregates": [], # Aggregated elements
        }

        try:
            # IfcRelVoidsElement - Openings in walls, slabs
            for rel in getattr(element, 'HasOpenings', []):
                if rel.is_a("IfcRelVoidsElement"):
                    opening = rel.RelatedOpeningElement
                    rels["voids"].append({
                        "global_id": opening.GlobalId,
                        "name": opening.Name,
                        "type": opening.is_a()
                    })

            # IfcRelFillsElement - Doors/windows filling openings
            if element.is_a("IfcOpeningElement"):
                for rel in getattr(element, 'HasFillings', []):
                    if rel.is_a("IfcRelFillsElement"):
                        filling = rel.RelatedBuildingElement
                        rels["fills"].append({
                            "global_id": filling.GlobalId,
                            "name": filling.Name,
                            "type": filling.is_a()
                        })

            # IfcRelConnectsElements - Physical connections
            for rel in getattr(element, 'ConnectedTo', []):
                if rel.is_a("IfcRelConnectsElements"):
                    connected = rel.RelatedElement
                    rels["connected"].append({
                        "global_id": connected.GlobalId,
                        "name": connected.Name,
                        "type": connected.is_a(),
                        "connection_type": rel.is_a()
                    })

            # IfcRelAggregates - Part-whole relationships
            for rel in getattr(element, 'IsDecomposedBy', []):
                if rel.is_a("IfcRelAggregates"):
                    for part in rel.RelatedObjects:
                        rels["aggregates"].append({
                            "global_id": part.GlobalId,
                            "name": part.Name,
                            "type": part.is_a()
                        })

        except Exception as e:
            pass

        # Remove empty lists
        return {k: v for k, v in rels.items() if v}

    def _get_placement_info(self, element) -> Optional[dict]:
        """Get basic placement information."""
        try:
            placement = element.ObjectPlacement
            if placement and placement.is_a("IfcLocalPlacement"):
                return {
                    "type": "local",
                    "has_placement": True
                }
        except:
            pass
        return None

    def get_spatial_tree(self) -> dict:
        """
        Extract the spatial hierarchy tree.

        Structure: IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → IfcSpace

        Returns:
            Nested dictionary representing spatial structure
        """
        tree = {"type": "root", "children": []}

        # Get project
        projects = self.ifc.by_type("IfcProject")
        for project in projects:
            project_node = {
                "type": "IfcProject",
                "global_id": project.GlobalId,
                "name": project.Name,
                "children": []
            }

            # Get sites
            for rel in getattr(project, 'IsDecomposedBy', []):
                for site in rel.RelatedObjects:
                    if site.is_a("IfcSite"):
                        site_node = self._build_spatial_node(site)
                        project_node["children"].append(site_node)

            tree["children"].append(project_node)

        return tree

    def _build_spatial_node(self, spatial_element) -> dict:
        """Recursively build spatial tree node."""
        node = {
            "type": spatial_element.is_a(),
            "global_id": spatial_element.GlobalId,
            "name": spatial_element.Name,
            "children": [],
            "contained_elements": []
        }

        # Get decomposed children (aggregation)
        for rel in getattr(spatial_element, 'IsDecomposedBy', []):
            for child in rel.RelatedObjects:
                if child.is_a("IfcSpatialStructureElement"):
                    child_node = self._build_spatial_node(child)
                    node["children"].append(child_node)

        # Get contained elements
        for rel in getattr(spatial_element, 'ContainsElements', []):
            for element in rel.RelatedElements:
                node["contained_elements"].append({
                    "global_id": element.GlobalId,
                    "name": element.Name,
                    "type": element.is_a()
                })

        return node

    def get_statistics(self) -> dict:
        """
        Get file statistics and element distribution.

        Returns:
            Dictionary with file info and element counts
        """
        # Count by type
        type_counts = {}
        for product in self.ifc.by_type("IfcProduct"):
            ifc_class = product.is_a()
            type_counts[ifc_class] = type_counts.get(ifc_class, 0) + 1

        # File info
        file_size = self.ifc_path.stat().st_size if self.ifc_path.exists() else 0

        return {
            "file_name": self.ifc_path.name,
            "file_size_bytes": file_size,
            "file_size_kb": round(file_size / 1024, 2),
            "schema": self.schema,
            "total_elements": len(self.ifc.by_type("IfcProduct")),
            "building_elements": len(self.ifc.by_type("IfcBuildingElement")),
            "spatial_elements": len(self.ifc.by_type("IfcSpatialStructureElement")),
            "type_distribution": type_counts,
            "relationship_count": len(self.ifc.by_type("IfcRelationship")),
            "property_set_count": len(self.ifc.by_type("IfcPropertySet")),
        }

    def get_raw_text_preview(self, max_chars: int = 3000) -> str:
        """Get preview of raw IFC text."""
        return self.raw_text[:max_chars]

    def to_json(self, elements: list[dict], output_path: str):
        """Save parsed elements to JSON file."""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(elements, f, indent=2, ensure_ascii=False, default=str)


# Test the parser
if __name__ == "__main__":
    import sys

    ifc_path = "data/sample.ifc"
    if len(sys.argv) > 1:
        ifc_path = sys.argv[1]

    print("=" * 60)
    print("Stage 1: Parse - IFC to Structured Objects")
    print("=" * 60)

    parser = IFCParser(ifc_path)

    # Statistics
    print("\nFile Statistics:")
    stats = parser.get_statistics()
    for key, value in stats.items():
        if key == "type_distribution":
            print(f"  {key}:")
            for t, c in value.items():
                print(f"    - {t}: {c}")
        else:
            print(f"  {key}: {value}")

    # Parse elements
    print("\nParsing elements...")
    elements = parser.parse_all_elements()
    print(f"  Parsed {len(elements)} elements")

    # Show sample element
    if elements:
        print("\nSample parsed element:")
        sample = elements[0]
        print(json.dumps(sample, indent=2, default=str)[:1000])

    # Spatial tree
    print("\nSpatial Tree:")
    tree = parser.get_spatial_tree()
    print(json.dumps(tree, indent=2)[:800])
