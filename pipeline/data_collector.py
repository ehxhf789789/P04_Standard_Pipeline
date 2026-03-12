"""
Phase A: Standard Data Collection

Collects real standard data from:
- bSDD (buildingSMART Data Dictionary) API
- IDS (Information Delivery Specification) schema
- Sample IFC files
- Classification systems (Uniclass, OmniClass)
"""

import json
import os
import requests
import urllib3
from pathlib import Path
from typing import Optional

# Disable SSL warnings for corporate proxy environments
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class BSDDCollector:
    """Collects property definitions from bSDD API."""

    BASE_URL = "https://api.bsdd.buildingsmart.org"
    IFC_43_URI = "https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3"

    # Main building element classes to collect
    TARGET_CLASSES = [
        "IfcWall", "IfcDoor", "IfcWindow", "IfcSlab",
        "IfcBeam", "IfcColumn", "IfcSpace", "IfcRoof",
        "IfcStair", "IfcRamp", "IfcCurtainWall", "IfcPlate",
        "IfcMember", "IfcFooting", "IfcPile", "IfcRailing",
        "IfcCovering", "IfcBuildingElementProxy"
    ]

    def __init__(self, output_dir: str = "data/bsdd_knowledge_base"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.verify = False  # Handle corporate proxy SSL issues

    def collect_all_classes(self) -> dict:
        """Collect property definitions for all target IFC classes."""
        print("=" * 60)
        print("Phase A-1: Collecting bSDD Knowledge Base")
        print("=" * 60)

        knowledge_base = {}

        for ifc_class in self.TARGET_CLASSES:
            print(f"\nCollecting {ifc_class}...")
            class_data = self._collect_class_properties(ifc_class)
            if class_data:
                knowledge_base[ifc_class] = class_data
                print(f"  [OK] {len(class_data.get('properties', []))} properties collected")
            else:
                print(f"  [FAIL] Failed to collect")

        # Save to JSON
        output_path = self.output_dir / "classes.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(knowledge_base, f, indent=2, ensure_ascii=False)

        print(f"\n[OK] Saved to {output_path}")
        print(f"  Total classes: {len(knowledge_base)}")
        total_props = sum(len(c.get('properties', [])) for c in knowledge_base.values())
        print(f"  Total properties: {total_props}")

        return knowledge_base

    def _collect_class_properties(self, ifc_class: str) -> Optional[dict]:
        """Collect all properties for a single IFC class."""
        try:
            # Get class info with properties
            class_uri = f"{self.IFC_43_URI}/class/{ifc_class}"
            response = self.session.get(
                f"{self.BASE_URL}/api/Class/v1",
                params={
                    "Uri": class_uri,
                    "IncludeClassProperties": "true"
                },
                timeout=30
            )

            if response.status_code != 200:
                return None

            data = response.json()

            # Extract relevant information
            properties = []
            for prop in data.get("classProperties", []):
                properties.append({
                    "name": prop.get("name"),
                    "propertySet": prop.get("propertySet"),
                    "uri": prop.get("propertyUri"),
                    "dataType": prop.get("dataType"),
                    "definition": prop.get("description"),
                    "unit": prop.get("unit"),
                    "allowedValues": prop.get("allowedValues"),
                    "isRequired": prop.get("isRequired", False),
                })

            return {
                "uri": class_uri,
                "name": data.get("name"),
                "definition": data.get("definition"),
                "parentClass": data.get("parentClassCode"),
                "properties": properties,
                "propertyCount": len(properties)
            }

        except Exception as e:
            print(f"  Error: {e}")
            return None


class IDSCollector:
    """Downloads IDS schema and examples from buildingSMART GitHub."""

    IDS_REPO_BASE = "https://raw.githubusercontent.com/buildingSMART/IDS/development"

    def __init__(self, output_dir: str = "data/ids"):
        self.output_dir = Path(output_dir)
        self.schema_dir = self.output_dir / "schema"
        self.examples_dir = self.output_dir / "examples"
        self.schema_dir.mkdir(parents=True, exist_ok=True)
        self.examples_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.verify = False

    def collect_schema_and_examples(self) -> dict:
        """Download IDS XSD schema and example files."""
        print("\n" + "=" * 60)
        print("Phase A-2: Collecting IDS Schema and Examples")
        print("=" * 60)

        results = {
            "schema_files": [],
            "example_files": []
        }

        # Download IDS 1.0 XSD schema
        schema_files = [
            ("IDS_1.0.xsd", f"{self.IDS_REPO_BASE}/Development/IDS_1.0.xsd"),
        ]

        for filename, url in schema_files:
            print(f"\nDownloading {filename}...")
            if self._download_file(url, self.schema_dir / filename):
                results["schema_files"].append(filename)
                print(f"  [OK] Saved to {self.schema_dir / filename}")
            else:
                print(f"  [FAIL] Failed to download")

        # Create a sample IDS rules file based on bSDD
        self._generate_sample_ids_rules()
        results["example_files"].append("sample_rules.ids")

        return results

    def _download_file(self, url: str, output_path: Path) -> bool:
        """Download a file from URL."""
        try:
            response = self.session.get(url, timeout=30)
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                return True
        except Exception as e:
            print(f"  Error: {e}")
        return False

    def _generate_sample_ids_rules(self):
        """Generate sample IDS rules based on common requirements."""
        ids_content = '''<?xml version="1.0" encoding="UTF-8"?>
<ids xmlns="http://standards.buildingsmart.org/IDS"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <info>
    <title>BIM-to-AI Pipeline Validation Rules</title>
    <description>Auto-generated IDS rules for common building elements</description>
  </info>
  <specifications>

    <!-- IfcWall Requirements -->
    <specification name="Wall Fire Rating" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCWALL</name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IFCLABEL" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_WallCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>FireRating</simpleValue>
          </baseName>
        </property>
        <property dataType="IFCBOOLEAN" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_WallCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>IsExternal</simpleValue>
          </baseName>
        </property>
        <property dataType="IFCBOOLEAN" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_WallCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>LoadBearing</simpleValue>
          </baseName>
        </property>
      </requirements>
    </specification>

    <!-- IfcDoor Requirements -->
    <specification name="Door Properties" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCDOOR</name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IFCLABEL" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_DoorCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>FireRating</simpleValue>
          </baseName>
        </property>
        <property dataType="IFCBOOLEAN" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_DoorCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>IsExternal</simpleValue>
          </baseName>
        </property>
      </requirements>
    </specification>

    <!-- IfcWindow Requirements -->
    <specification name="Window Properties" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCWINDOW</name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IFCTHERMALTRANSMITTANCEMEASURE" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_WindowCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>ThermalTransmittance</simpleValue>
          </baseName>
        </property>
      </requirements>
    </specification>

    <!-- IfcSlab Requirements -->
    <specification name="Slab Properties" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCSLAB</name>
        </entity>
      </applicability>
      <requirements>
        <property dataType="IFCBOOLEAN" minOccurs="1">
          <propertySet>
            <simpleValue>Pset_SlabCommon</simpleValue>
          </propertySet>
          <baseName>
            <simpleValue>LoadBearing</simpleValue>
          </baseName>
        </property>
      </requirements>
    </specification>

    <!-- Material Requirement for structural elements -->
    <specification name="Structural Elements Material" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCBEAM</name>
        </entity>
      </applicability>
      <requirements>
        <material minOccurs="1"/>
      </requirements>
    </specification>

    <specification name="Column Material" ifcVersion="IFC4X3">
      <applicability>
        <entity>
          <name>IFCCOLUMN</name>
        </entity>
      </applicability>
      <requirements>
        <material minOccurs="1"/>
      </requirements>
    </specification>

  </specifications>
</ids>'''

        output_path = self.output_dir / "generated_rules.ids"
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(ids_content)
        print(f"\n[OK] Generated sample IDS rules: {output_path}")


class IFCDownloader:
    """Downloads sample IFC files from public repositories."""

    SAMPLE_FILES = {
        "FZK-Haus": "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0/ACCA/Duplex_A_20110907.ifc",
        "Duplex": "https://raw.githubusercontent.com/buildingSMART/Sample-Test-Files/main/IFC%204.0/NIST_V4/Architectural%20Duplex/Revit/Duplex_A.ifc",
    }

    # Backup: Use a simpler IFC file if main ones fail
    BACKUP_URL = "https://raw.githubusercontent.com/IFCjs/test-ifc-files/main/Revit/empty.ifc"

    def __init__(self, output_dir: str = "data"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.verify = False

    def download_sample(self) -> Optional[str]:
        """Download a sample IFC file."""
        print("\n" + "=" * 60)
        print("Phase A-3: Downloading Sample IFC File")
        print("=" * 60)

        output_path = self.output_dir / "sample.ifc"

        for name, url in self.SAMPLE_FILES.items():
            print(f"\nTrying to download {name}...")
            try:
                response = self.session.get(url, timeout=60)
                if response.status_code == 200 and b"ISO-10303-21" in response.content:
                    with open(output_path, 'wb') as f:
                        f.write(response.content)
                    print(f"  [OK] Downloaded {name} ({len(response.content) / 1024:.1f} KB)")
                    print(f"  [OK] Saved to {output_path}")
                    return str(output_path)
            except Exception as e:
                print(f"  [FAIL] Failed: {e}")

        # Try backup
        print("\nTrying backup source...")
        try:
            response = self.session.get(self.BACKUP_URL, timeout=60)
            if response.status_code == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print(f"  [OK] Downloaded backup file")
                return str(output_path)
        except Exception as e:
            print(f"  [FAIL] Backup failed: {e}")

        # Create minimal IFC file if all downloads fail
        print("\nCreating minimal IFC file...")
        self._create_minimal_ifc(output_path)
        return str(output_path)

    def _create_minimal_ifc(self, output_path: Path):
        """Create a minimal IFC file using ifcopenshell."""
        try:
            import ifcopenshell
            import ifcopenshell.api

            # Create new IFC file
            ifc = ifcopenshell.api.run("project.create_file", version="IFC4")

            # Create project
            project = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcProject", name="BIM-to-AI Demo Project")

            # Create site
            site = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcSite", name="Demo Site")
            ifcopenshell.api.run("aggregate.assign_object", ifc,
                products=[site], relating_object=project)

            # Create building
            building = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcBuilding", name="Demo Building")
            ifcopenshell.api.run("aggregate.assign_object", ifc,
                products=[building], relating_object=site)

            # Create storey
            storey = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcBuildingStorey", name="Ground Floor")
            ifcopenshell.api.run("aggregate.assign_object", ifc,
                products=[storey], relating_object=building)

            # Create walls with properties
            for i in range(3):
                wall = ifcopenshell.api.run("root.create_entity", ifc,
                    ifc_class="IfcWall", name=f"Wall-{i+1:03d}")
                ifcopenshell.api.run("spatial.assign_container", ifc,
                    products=[wall], relating_structure=storey)

                # Add property set
                pset = ifcopenshell.api.run("pset.add_pset", ifc,
                    product=wall, name="Pset_WallCommon")

                # Add properties (some intentionally missing for validation demo)
                if i == 0:  # Full properties
                    ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties={
                        "FireRating": "2HR",
                        "IsExternal": True,
                        "LoadBearing": True,
                        "ThermalTransmittance": 0.25
                    })
                elif i == 1:  # Missing FireRating
                    ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties={
                        "IsExternal": False,
                        "LoadBearing": True
                    })
                # Wall 3: No properties at all (for validation fail demo)

            # Create doors
            for i in range(2):
                door = ifcopenshell.api.run("root.create_entity", ifc,
                    ifc_class="IfcDoor", name=f"Door-{i+1:03d}")
                ifcopenshell.api.run("spatial.assign_container", ifc,
                    products=[door], relating_structure=storey)

                if i == 0:
                    pset = ifcopenshell.api.run("pset.add_pset", ifc,
                        product=door, name="Pset_DoorCommon")
                    ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties={
                        "FireRating": "1HR",
                        "IsExternal": True
                    })

            # Create window
            window = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcWindow", name="Window-001")
            ifcopenshell.api.run("spatial.assign_container", ifc,
                products=[window], relating_structure=storey)

            # Create beam with material
            beam = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcBeam", name="Beam-001")
            ifcopenshell.api.run("spatial.assign_container", ifc,
                products=[beam], relating_structure=storey)

            # Add material to beam
            material = ifcopenshell.api.run("material.add_material", ifc, name="Steel")
            ifcopenshell.api.run("material.assign_material", ifc,
                products=[beam], material=material)

            # Create column without material (for validation fail demo)
            column = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcColumn", name="Column-001")
            ifcopenshell.api.run("spatial.assign_container", ifc,
                products=[column], relating_structure=storey)

            # Create slab
            slab = ifcopenshell.api.run("root.create_entity", ifc,
                ifc_class="IfcSlab", name="Slab-001")
            ifcopenshell.api.run("spatial.assign_container", ifc,
                products=[slab], relating_structure=storey)
            pset = ifcopenshell.api.run("pset.add_pset", ifc,
                product=slab, name="Pset_SlabCommon")
            ifcopenshell.api.run("pset.edit_pset", ifc, pset=pset, properties={
                "LoadBearing": True
            })

            # Save file
            ifc.write(str(output_path))
            print(f"  [OK] Created minimal IFC file with demo elements")
            print(f"    - 3 Walls (1 full, 1 partial, 1 empty properties)")
            print(f"    - 2 Doors (1 with properties, 1 without)")
            print(f"    - 1 Window")
            print(f"    - 1 Beam (with material)")
            print(f"    - 1 Column (no material)")
            print(f"    - 1 Slab")

        except Exception as e:
            print(f"  [FAIL] Error creating IFC: {e}")
            # Write minimal STEP file manually
            minimal_ifc = '''ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [DesignTransfer]'),'2;1');
FILE_NAME('sample.ifc','2024-01-01T00:00:00',(''),(''),'IfcOpenShell','IfcOpenShell','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('1234567890123',#2,'Demo Project',$,$,$,$,$,$);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,1234567890,$,$,1234567890);
#3=IFCPERSONANDORGANIZATION(#5,#6,$);
#4=IFCAPPLICATION(#6,'0.0','Demo','Demo');
#5=IFCPERSON($,'Demo','User',$,$,$,$,$);
#6=IFCORGANIZATION($,'Demo',$,$,$);
ENDSEC;
END-ISO-10303-21;'''
            with open(output_path, 'w') as f:
                f.write(minimal_ifc)
            print(f"  [OK] Created minimal STEP file")


class ClassificationCollector:
    """Collects classification system data from bSDD."""

    BASE_URL = "https://api.bsdd.buildingsmart.org"

    # Classification system URIs in bSDD
    CLASSIFICATION_URIS = {
        "Uniclass2015": "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1",
        "OmniClass": "https://identifier.buildingsmart.org/uri/csi/omniclass/2"
    }

    # Common IFC class to classification mappings (partial)
    IFC_TO_UNICLASS = {
        "IfcWall": {"code": "Ss_25_10_30", "name": "Wall systems"},
        "IfcDoor": {"code": "Pr_30_59_29", "name": "Doors"},
        "IfcWindow": {"code": "Pr_30_59_98", "name": "Windows"},
        "IfcSlab": {"code": "Ss_25_10_25", "name": "Floor systems"},
        "IfcBeam": {"code": "Ss_25_30_20", "name": "Beam and girder systems"},
        "IfcColumn": {"code": "Ss_25_30_30", "name": "Column systems"},
        "IfcRoof": {"code": "Ss_25_10_65", "name": "Roof systems"},
        "IfcStair": {"code": "Ss_25_60_75", "name": "Stair systems"},
    }

    IFC_TO_OMNICLASS = {
        "IfcWall": {"code": "21-02 10 10", "name": "Walls"},
        "IfcDoor": {"code": "23-17 11 00", "name": "Doors"},
        "IfcWindow": {"code": "23-17 17 00", "name": "Windows"},
        "IfcSlab": {"code": "21-02 20 10", "name": "Floors"},
        "IfcBeam": {"code": "21-02 10 20 20", "name": "Beams"},
        "IfcColumn": {"code": "21-02 10 20 10", "name": "Columns"},
        "IfcRoof": {"code": "21-02 30 10", "name": "Roofs"},
        "IfcStair": {"code": "21-02 40 40", "name": "Stairs"},
    }

    def __init__(self, output_dir: str = "data/bsdd_knowledge_base"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.verify = False

    def collect_classification_mappings(self) -> dict:
        """Collect and build cross-reference classification mappings."""
        print("\n" + "=" * 60)
        print("Phase A-4: Collecting Classification Mappings")
        print("=" * 60)

        classification_map = {}

        for ifc_class in self.IFC_TO_UNICLASS.keys():
            print(f"\nMapping {ifc_class}...")

            uniclass = self.IFC_TO_UNICLASS.get(ifc_class, {})
            omniclass = self.IFC_TO_OMNICLASS.get(ifc_class, {})

            # Try to get bSDD GUID
            bsdd_data = self._lookup_bsdd_class(ifc_class)

            classification_map[ifc_class] = {
                "uniclass2015": uniclass,
                "omniclass": omniclass,
                "bsdd": {
                    "uri": bsdd_data.get("uri") if bsdd_data else None,
                    "guid": bsdd_data.get("code") if bsdd_data else None
                }
            }

            print(f"  Uniclass: {uniclass.get('code', 'N/A')}")
            print(f"  OmniClass: {omniclass.get('code', 'N/A')}")
            print(f"  bSDD: {bsdd_data.get('code', 'N/A') if bsdd_data else 'N/A'}")

        # Save mapping
        output_path = self.output_dir / "classification_map.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(classification_map, f, indent=2, ensure_ascii=False)

        print(f"\n[OK] Saved classification mappings to {output_path}")

        return classification_map

    def _lookup_bsdd_class(self, ifc_class: str) -> Optional[dict]:
        """Look up IFC class in bSDD."""
        try:
            uri = f"https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/{ifc_class}"
            response = self.session.get(
                f"{self.BASE_URL}/api/Class/v1",
                params={"Uri": uri},
                timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "uri": uri,
                    "code": data.get("code"),
                    "name": data.get("name")
                }
        except:
            pass
        return None


def collect_all():
    """Run all data collection phases."""
    print("\n" + "=" * 70)
    print("  BIM-to-AI Pipeline: Phase A - Standard Data Collection")
    print("=" * 70)

    results = {}

    # A-1: bSDD Knowledge Base
    bsdd = BSDDCollector()
    results["bsdd"] = bsdd.collect_all_classes()

    # A-2: IDS Schema
    ids = IDSCollector()
    results["ids"] = ids.collect_schema_and_examples()

    # A-3: Sample IFC
    ifc = IFCDownloader()
    results["ifc_path"] = ifc.download_sample()

    # A-4: Classification Mappings
    classification = ClassificationCollector()
    results["classification"] = classification.collect_classification_mappings()

    print("\n" + "=" * 70)
    print("  Phase A Complete!")
    print("=" * 70)
    print(f"\nData collected:")
    print(f"  - bSDD classes: {len(results['bsdd'])}")
    print(f"  - IDS schema files: {len(results['ids']['schema_files'])}")
    print(f"  - IFC sample: {results['ifc_path']}")
    print(f"  - Classification mappings: {len(results['classification'])}")

    return results


if __name__ == "__main__":
    collect_all()
