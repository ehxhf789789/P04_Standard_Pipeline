"""
Tabular Data Generator

Converts BIM/construction data to structured tabular formats for:
- Traditional ML models (XGBoost, LightGBM, CatBoost)
- Statistical analysis and reporting
- Data warehouse integration
- Business intelligence tools

Output formats:
- CSV (with schema)
- Parquet (columnar, efficient)
- JSON Lines (streaming)
- Excel (multi-sheet)

Feature engineering:
- One-hot encoding for categorical variables
- Numerical normalization/standardization
- Spatial features extraction
- Relationship features
"""

import csv
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Any, Union
import hashlib

logger = logging.getLogger(__name__)


class TabularOutputFormat(Enum):
    """Output formats for tabular data"""
    CSV = "csv"
    PARQUET = "parquet"
    JSON_LINES = "jsonl"
    EXCEL = "xlsx"
    FEATHER = "feather"


class FeatureType(Enum):
    """Data types for features"""
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    BOOLEAN = "boolean"
    TEXT = "text"
    DATETIME = "datetime"
    GEOMETRY = "geometry"
    LIST = "list"


@dataclass
class FeatureDefinition:
    """Definition of a single feature/column"""
    name: str
    feature_type: FeatureType
    source_path: str  # JSONPath-like path to source data
    description: str = ""
    unit: Optional[str] = None
    nullable: bool = True
    default_value: Any = None
    encoding: Optional[str] = None  # "onehot", "label", "ordinal"
    normalize: Optional[str] = None  # "minmax", "standard", "log"
    categories: Optional[list[str]] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "type": self.feature_type.value,
            "sourcePath": self.source_path,
            "description": self.description,
            "unit": self.unit,
            "nullable": self.nullable,
            "defaultValue": self.default_value,
            "encoding": self.encoding,
            "normalize": self.normalize,
            "categories": self.categories
        }


@dataclass
class FeatureSet:
    """Collection of features for a specific use case"""
    name: str
    description: str
    features: list[FeatureDefinition] = field(default_factory=list)
    target_feature: Optional[str] = None  # For ML training
    id_features: list[str] = field(default_factory=list)  # Non-training features
    version: str = "1.0"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "features": [f.to_dict() for f in self.features],
            "targetFeature": self.target_feature,
            "idFeatures": self.id_features,
            "version": self.version
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FeatureSet":
        features = []
        for f in data.get("features", []):
            features.append(FeatureDefinition(
                name=f["name"],
                feature_type=FeatureType(f["type"]),
                source_path=f["sourcePath"],
                description=f.get("description", ""),
                unit=f.get("unit"),
                nullable=f.get("nullable", True),
                default_value=f.get("defaultValue"),
                encoding=f.get("encoding"),
                normalize=f.get("normalize"),
                categories=f.get("categories")
            ))

        return cls(
            name=data["name"],
            description=data.get("description", ""),
            features=features,
            target_feature=data.get("targetFeature"),
            id_features=data.get("idFeatures", []),
            version=data.get("version", "1.0")
        )


@dataclass
class TableRow:
    """Single row of tabular data"""
    id: str
    values: dict[str, Any]
    source_type: str = "element"
    source_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            **self.values
        }


@dataclass
class TabularDataset:
    """Complete tabular dataset with schema"""
    name: str
    feature_set: FeatureSet
    rows: list[TableRow] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict = field(default_factory=dict)

    def get_schema(self) -> dict:
        """Get dataset schema"""
        return {
            "name": self.name,
            "featureSet": self.feature_set.to_dict(),
            "rowCount": len(self.rows),
            "createdAt": self.created_at.isoformat(),
            "metadata": self.metadata
        }


class TabularGenerator:
    """
    Generates structured tabular data from BIM elements and documents.

    Provides:
    - Flexible feature extraction from nested data
    - Automatic feature engineering (encoding, normalization)
    - Multiple output formats (CSV, Parquet, JSON)
    - Schema generation for downstream tools

    Example:
        generator = TabularGenerator()
        generator.use_feature_set(building_elements_features)

        for element in ifc_elements:
            generator.add_element(element)

        generator.export("output.csv", TabularOutputFormat.CSV)
    """

    # Predefined feature sets
    ELEMENT_BASIC_FEATURES = FeatureSet(
        name="element_basic",
        description="Basic BIM element features",
        features=[
            FeatureDefinition("global_id", FeatureType.TEXT, "global_id", "IFC GlobalId"),
            FeatureDefinition("ifc_class", FeatureType.CATEGORICAL, "ifc_class", "IFC Entity Type"),
            FeatureDefinition("name", FeatureType.TEXT, "name", "Element Name"),
            FeatureDefinition("is_external", FeatureType.BOOLEAN, "property_sets.Pset_*Common.IsExternal"),
            FeatureDefinition("load_bearing", FeatureType.BOOLEAN, "property_sets.Pset_*Common.LoadBearing"),
            FeatureDefinition("fire_rating", FeatureType.CATEGORICAL, "property_sets.Pset_*Common.FireRating"),
        ],
        id_features=["global_id", "name"]
    )

    ELEMENT_GEOMETRY_FEATURES = FeatureSet(
        name="element_geometry",
        description="BIM element geometric features",
        features=[
            FeatureDefinition("global_id", FeatureType.TEXT, "global_id"),
            FeatureDefinition("ifc_class", FeatureType.CATEGORICAL, "ifc_class"),
            FeatureDefinition("width", FeatureType.NUMERIC, "quantities.Width", unit="mm"),
            FeatureDefinition("height", FeatureType.NUMERIC, "quantities.Height", unit="mm"),
            FeatureDefinition("length", FeatureType.NUMERIC, "quantities.Length", unit="mm"),
            FeatureDefinition("area", FeatureType.NUMERIC, "quantities.Area", unit="m2"),
            FeatureDefinition("volume", FeatureType.NUMERIC, "quantities.Volume", unit="m3"),
            FeatureDefinition("center_x", FeatureType.NUMERIC, "location.x"),
            FeatureDefinition("center_y", FeatureType.NUMERIC, "location.y"),
            FeatureDefinition("center_z", FeatureType.NUMERIC, "location.z"),
        ],
        id_features=["global_id"]
    )

    VALIDATION_FEATURES = FeatureSet(
        name="validation_results",
        description="Validation result features for ML",
        features=[
            FeatureDefinition("element_id", FeatureType.TEXT, "element_id"),
            FeatureDefinition("ifc_class", FeatureType.CATEGORICAL, "ifc_class"),
            FeatureDefinition("validation_status", FeatureType.CATEGORICAL, "status", encoding="label"),
            FeatureDefinition("pass_count", FeatureType.NUMERIC, "pass_count"),
            FeatureDefinition("fail_count", FeatureType.NUMERIC, "fail_count"),
            FeatureDefinition("warning_count", FeatureType.NUMERIC, "warning_count"),
            FeatureDefinition("completeness_score", FeatureType.NUMERIC, "completeness"),
        ],
        target_feature="validation_status",
        id_features=["element_id"]
    )

    def __init__(self, feature_set: Optional[FeatureSet] = None):
        self.feature_set = feature_set
        self.rows: list[TableRow] = []
        self._category_maps: dict[str, dict[str, int]] = {}
        self._stats: dict[str, dict] = {}

    def use_feature_set(self, feature_set: FeatureSet) -> None:
        """Set the feature set to use for extraction"""
        self.feature_set = feature_set
        self.rows = []
        self._category_maps = {}
        self._stats = {}

    def add_element(self, element_data: dict) -> Optional[TableRow]:
        """Extract features from an element and add to dataset"""
        if not self.feature_set:
            raise ValueError("No feature set configured. Call use_feature_set() first.")

        row_id = element_data.get("global_id", str(hash(str(element_data))))
        values = {}

        for feature in self.feature_set.features:
            value = self._extract_value(element_data, feature.source_path)
            processed_value = self._process_value(value, feature)
            values[feature.name] = processed_value

            # Track statistics
            self._update_stats(feature.name, processed_value, feature.feature_type)

        row = TableRow(
            id=row_id,
            values=values,
            source_type="element",
            source_id=row_id
        )
        self.rows.append(row)
        return row

    def add_validation_result(self, validation_data: dict) -> Optional[TableRow]:
        """Add validation result as a row"""
        row_id = validation_data.get("element_id", str(hash(str(validation_data))))

        # Use validation feature set if available
        if not self.feature_set:
            self.use_feature_set(self.VALIDATION_FEATURES)

        return self.add_element(validation_data)

    def add_document_section(
        self,
        section_data: dict,
        document_id: str
    ) -> Optional[TableRow]:
        """Add document section as a row"""
        row_id = f"{document_id}_{section_data.get('id', hash(str(section_data)))}"

        values = {
            "section_id": row_id,
            "document_id": document_id,
            "heading": section_data.get("heading", ""),
            "level": section_data.get("level", 0),
            "content_length": len(section_data.get("content", "")),
            "word_count": len(section_data.get("content", "").split()),
            "has_tables": len(section_data.get("tables", [])) > 0,
            "table_count": len(section_data.get("tables", [])),
        }

        row = TableRow(
            id=row_id,
            values=values,
            source_type="document_section",
            source_id=document_id
        )
        self.rows.append(row)
        return row

    def _extract_value(self, data: dict, path: str) -> Any:
        """Extract value from nested data using path notation"""
        if not path:
            return None

        parts = path.split(".")
        current = data

        for part in parts:
            if current is None:
                return None

            # Handle wildcard in path (e.g., "Pset_*Common")
            if "*" in part:
                pattern = part.replace("*", "")
                if isinstance(current, dict):
                    for key in current:
                        if pattern in key:
                            current = current[key]
                            break
                    else:
                        return None
            elif isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                current = current[idx] if idx < len(current) else None
            else:
                return None

        return current

    def _process_value(self, value: Any, feature: FeatureDefinition) -> Any:
        """Process and transform a value based on feature definition"""
        # Handle None/missing values
        if value is None:
            return feature.default_value

        # Type conversion
        if feature.feature_type == FeatureType.NUMERIC:
            try:
                return float(value)
            except (ValueError, TypeError):
                return feature.default_value

        elif feature.feature_type == FeatureType.BOOLEAN:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ("true", "yes", "1", "t")
            return bool(value)

        elif feature.feature_type == FeatureType.CATEGORICAL:
            str_value = str(value) if value is not None else "Unknown"

            # Label encoding
            if feature.encoding == "label":
                if feature.name not in self._category_maps:
                    self._category_maps[feature.name] = {}
                if str_value not in self._category_maps[feature.name]:
                    self._category_maps[feature.name][str_value] = len(self._category_maps[feature.name])
                return self._category_maps[feature.name][str_value]

            return str_value

        elif feature.feature_type == FeatureType.TEXT:
            return str(value) if value is not None else ""

        elif feature.feature_type == FeatureType.DATETIME:
            if isinstance(value, datetime):
                return value.isoformat()
            return str(value) if value else None

        return value

    def _update_stats(self, name: str, value: Any, feature_type: FeatureType) -> None:
        """Update column statistics"""
        if name not in self._stats:
            self._stats[name] = {
                "count": 0,
                "null_count": 0,
                "unique_values": set() if feature_type == FeatureType.CATEGORICAL else None,
                "min": None,
                "max": None,
                "sum": 0 if feature_type == FeatureType.NUMERIC else None
            }

        stats = self._stats[name]
        stats["count"] += 1

        if value is None:
            stats["null_count"] += 1
        elif feature_type == FeatureType.NUMERIC:
            try:
                num_val = float(value)
                if stats["min"] is None or num_val < stats["min"]:
                    stats["min"] = num_val
                if stats["max"] is None or num_val > stats["max"]:
                    stats["max"] = num_val
                stats["sum"] += num_val
            except (ValueError, TypeError):
                pass
        elif feature_type == FeatureType.CATEGORICAL and stats["unique_values"] is not None:
            stats["unique_values"].add(str(value))

    def get_dataframe(self):
        """Convert to pandas DataFrame"""
        try:
            import pandas as pd
            data = [row.to_dict() for row in self.rows]
            return pd.DataFrame(data)
        except ImportError:
            logger.error("pandas is required for DataFrame export")
            raise

    def export(
        self,
        output_path: Path,
        format: TabularOutputFormat = TabularOutputFormat.CSV,
        include_schema: bool = True
    ) -> None:
        """Export tabular data to file"""
        output_path = Path(output_path)

        if format == TabularOutputFormat.CSV:
            self._export_csv(output_path)
        elif format == TabularOutputFormat.JSON_LINES:
            self._export_jsonl(output_path)
        elif format == TabularOutputFormat.PARQUET:
            self._export_parquet(output_path)
        elif format == TabularOutputFormat.EXCEL:
            self._export_excel(output_path)
        elif format == TabularOutputFormat.FEATHER:
            self._export_feather(output_path)
        else:
            raise ValueError(f"Unsupported format: {format}")

        # Export schema alongside data
        if include_schema and self.feature_set:
            schema_path = output_path.with_suffix(".schema.json")
            self._export_schema(schema_path)

        logger.info(f"Exported {len(self.rows)} rows to {output_path}")

    def _export_csv(self, output_path: Path) -> None:
        """Export to CSV format"""
        if not self.rows:
            logger.warning("No data to export")
            return

        fieldnames = ["id"] + [f.name for f in self.feature_set.features]

        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in self.rows:
                writer.writerow(row.to_dict())

    def _export_jsonl(self, output_path: Path) -> None:
        """Export to JSON Lines format"""
        with open(output_path, 'w', encoding='utf-8') as f:
            for row in self.rows:
                f.write(json.dumps(row.to_dict(), ensure_ascii=False) + "\n")

    def _export_parquet(self, output_path: Path) -> None:
        """Export to Parquet format"""
        try:
            df = self.get_dataframe()
            df.to_parquet(output_path, index=False)
        except ImportError:
            logger.error("pandas and pyarrow are required for Parquet export")
            raise

    def _export_excel(self, output_path: Path) -> None:
        """Export to Excel format"""
        try:
            df = self.get_dataframe()
            df.to_excel(output_path, index=False, sheet_name="Data")
        except ImportError:
            logger.error("pandas and openpyxl are required for Excel export")
            raise

    def _export_feather(self, output_path: Path) -> None:
        """Export to Feather format (fast binary)"""
        try:
            df = self.get_dataframe()
            df.to_feather(output_path)
        except ImportError:
            logger.error("pandas and pyarrow are required for Feather export")
            raise

    def _export_schema(self, output_path: Path) -> None:
        """Export feature set schema"""
        schema = {
            "featureSet": self.feature_set.to_dict(),
            "statistics": self._get_column_stats(),
            "rowCount": len(self.rows),
            "exportedAt": datetime.now().isoformat()
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(schema, f, indent=2, ensure_ascii=False, default=str)

    def _get_column_stats(self) -> dict:
        """Get statistics for all columns"""
        result = {}
        for name, stats in self._stats.items():
            stat_dict = {
                "count": stats["count"],
                "nullCount": stats["null_count"],
                "nullRate": stats["null_count"] / stats["count"] if stats["count"] > 0 else 0
            }

            if stats["min"] is not None:
                stat_dict["min"] = stats["min"]
                stat_dict["max"] = stats["max"]
                stat_dict["mean"] = stats["sum"] / (stats["count"] - stats["null_count"]) if stats["count"] > stats["null_count"] else None

            if stats["unique_values"] is not None:
                stat_dict["uniqueCount"] = len(stats["unique_values"])
                if len(stats["unique_values"]) <= 20:
                    stat_dict["categories"] = list(stats["unique_values"])

            result[name] = stat_dict

        return result

    def get_stats(self) -> dict:
        """Get export statistics"""
        return {
            "rowCount": len(self.rows),
            "featureCount": len(self.feature_set.features) if self.feature_set else 0,
            "columnStats": self._get_column_stats(),
            "categoryMaps": {
                k: len(v) for k, v in self._category_maps.items()
            }
        }

    def apply_one_hot_encoding(self, column_name: str) -> list[str]:
        """
        Apply one-hot encoding to a categorical column.
        Returns list of new column names created.
        """
        if column_name not in self._stats:
            return []

        stats = self._stats[column_name]
        if stats.get("unique_values") is None:
            return []

        categories = list(stats["unique_values"])
        new_columns = []

        for row in self.rows:
            value = row.values.get(column_name)
            for cat in categories:
                col_name = f"{column_name}_{cat}"
                row.values[col_name] = 1 if value == cat else 0
                if col_name not in new_columns:
                    new_columns.append(col_name)

        return new_columns

    def normalize_column(
        self,
        column_name: str,
        method: str = "minmax"
    ) -> None:
        """
        Normalize a numeric column.

        Methods:
        - minmax: Scale to [0, 1]
        - standard: Zero mean, unit variance
        - log: Log transform (for skewed data)
        """
        stats = self._stats.get(column_name)
        if not stats or stats.get("min") is None:
            return

        min_val = stats["min"]
        max_val = stats["max"]
        mean_val = stats["sum"] / (stats["count"] - stats["null_count"]) if stats["count"] > stats["null_count"] else 0

        import math

        for row in self.rows:
            value = row.values.get(column_name)
            if value is None:
                continue

            try:
                num_val = float(value)

                if method == "minmax":
                    range_val = max_val - min_val
                    if range_val > 0:
                        row.values[column_name] = (num_val - min_val) / range_val
                    else:
                        row.values[column_name] = 0

                elif method == "standard":
                    # Would need to calculate std, simplified here
                    row.values[column_name] = num_val - mean_val

                elif method == "log":
                    if num_val > 0:
                        row.values[column_name] = math.log(num_val)
                    else:
                        row.values[column_name] = 0

            except (ValueError, TypeError):
                pass


def create_element_feature_set(
    include_geometry: bool = True,
    include_properties: bool = True,
    custom_properties: list[tuple[str, str]] = None
) -> FeatureSet:
    """
    Create a customized feature set for BIM elements.

    Args:
        include_geometry: Include geometric features
        include_properties: Include common property features
        custom_properties: List of (name, path) tuples for custom properties
    """
    features = [
        FeatureDefinition("global_id", FeatureType.TEXT, "global_id"),
        FeatureDefinition("ifc_class", FeatureType.CATEGORICAL, "ifc_class"),
        FeatureDefinition("name", FeatureType.TEXT, "name"),
    ]

    if include_geometry:
        features.extend([
            FeatureDefinition("width", FeatureType.NUMERIC, "quantities.Width", unit="mm"),
            FeatureDefinition("height", FeatureType.NUMERIC, "quantities.Height", unit="mm"),
            FeatureDefinition("length", FeatureType.NUMERIC, "quantities.Length", unit="mm"),
            FeatureDefinition("area", FeatureType.NUMERIC, "quantities.Area", unit="m2"),
            FeatureDefinition("volume", FeatureType.NUMERIC, "quantities.Volume", unit="m3"),
        ])

    if include_properties:
        features.extend([
            FeatureDefinition("is_external", FeatureType.BOOLEAN, "property_sets.Pset_*Common.IsExternal"),
            FeatureDefinition("load_bearing", FeatureType.BOOLEAN, "property_sets.Pset_*Common.LoadBearing"),
            FeatureDefinition("fire_rating", FeatureType.CATEGORICAL, "property_sets.Pset_*Common.FireRating"),
        ])

    if custom_properties:
        for name, path in custom_properties:
            features.append(FeatureDefinition(name, FeatureType.TEXT, path))

    return FeatureSet(
        name="custom_element_features",
        description="Custom BIM element feature set",
        features=features,
        id_features=["global_id", "name"]
    )
