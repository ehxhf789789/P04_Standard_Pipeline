"""
Stage 5: Package - Result Aggregation and Summary

Collects results from all pipeline stages and generates:
- Comprehensive summary statistics
- JSON output files
- Pipeline execution report
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field, asdict


@dataclass
class PipelineInput:
    """Input file information."""
    file_name: str
    file_path: str
    file_size_kb: float
    schema: str
    total_elements: int
    building_elements: int
    type_distribution: dict = field(default_factory=dict)


@dataclass
class ValidationSummary:
    """Validation stage summary."""
    total_elements: int
    elements_passed: int
    elements_failed: int
    element_pass_rate: float
    total_checks: int
    checks_passed: int
    checks_failed: int
    check_pass_rate: float
    failures_by_type: dict = field(default_factory=dict)
    bcf_issues_count: int = 0


@dataclass
class EnrichmentSummary:
    """Enrichment stage summary."""
    total_elements: int
    total_properties: int
    properties_mapped_exact: int
    properties_mapped_fuzzy: int
    properties_not_found: int
    mapping_rate: float
    elements_with_classification: int


@dataclass
class TransformationSummary:
    """Transformation stage summary."""
    knowledge_graph_nodes: int
    knowledge_graph_edges: int
    embedding_count: int
    embedding_dimension: int
    tabular_rows: int
    tabular_columns: int
    gnn_nodes: int
    gnn_edges: int
    gnn_features: int


@dataclass
class PipelineSummary:
    """Complete pipeline execution summary."""
    execution_id: str
    execution_timestamp: str
    input: PipelineInput
    validation: ValidationSummary
    enrichment: EnrichmentSummary
    transformation: TransformationSummary
    standards_used: list = field(default_factory=list)
    output_files: list = field(default_factory=list)
    execution_time_seconds: float = 0.0


class PipelinePackager:
    """
    Aggregates results from all pipeline stages.

    Collects:
    - Parser output (statistics, raw data)
    - Validator output (validation results, BCF issues)
    - Enricher output (standardization results)
    - Transformer output (4 AI formats)

    Generates:
    - summary.json: Comprehensive statistics
    - report.md: Human-readable report
    """

    STANDARDS_USED = [
        "ISO 16739-1:2024 (IFC 4.3)",
        "ISO 7817-1:2024 (LOIN) + IDS 1.0",
        "bSDD (ISO 23386/23387/12006-3)",
        "ISO 21597 (ICDD) - packaging concept",
    ]

    def __init__(self):
        """Initialize packager."""
        self.execution_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.start_time = datetime.now()

    def package(
        self,
        parser_stats: dict,
        validation_summary: dict,
        enrichment_summary: dict,
        transformation_stats: dict,
        output_dir: str = "outputs"
    ) -> PipelineSummary:
        """
        Package all pipeline results into a summary.

        Args:
            parser_stats: Statistics from IFCParser
            validation_summary: Summary from IDSValidator
            enrichment_summary: Summary from BSDDEnricher
            transformation_stats: Statistics from AITransformer
            output_dir: Directory for output files

        Returns:
            PipelineSummary dataclass
        """
        output_path = Path(output_dir)

        # Build summary
        summary = PipelineSummary(
            execution_id=self.execution_id,
            execution_timestamp=datetime.now().isoformat(),
            input=PipelineInput(
                file_name=parser_stats.get("file_name", "unknown"),
                file_path=parser_stats.get("file_path", ""),
                file_size_kb=parser_stats.get("file_size_kb", 0),
                schema=parser_stats.get("schema", "IFC4"),
                total_elements=parser_stats.get("total_elements", 0),
                building_elements=parser_stats.get("building_elements", 0),
                type_distribution=parser_stats.get("type_distribution", {}),
            ),
            validation=ValidationSummary(
                total_elements=validation_summary.get("total_elements", 0),
                elements_passed=validation_summary.get("elements_passed", 0),
                elements_failed=validation_summary.get("elements_failed", 0),
                element_pass_rate=validation_summary.get("element_pass_rate", 0),
                total_checks=validation_summary.get("total_checks", 0),
                checks_passed=validation_summary.get("checks_passed", 0),
                checks_failed=validation_summary.get("checks_failed", 0),
                check_pass_rate=validation_summary.get("check_pass_rate", 0),
                failures_by_type=validation_summary.get("failures_by_type", {}),
                bcf_issues_count=validation_summary.get("bcf_issues_count", 0),
            ),
            enrichment=EnrichmentSummary(
                total_elements=enrichment_summary.get("total_elements", 0),
                total_properties=enrichment_summary.get("total_properties", 0),
                properties_mapped_exact=enrichment_summary.get("properties_mapped_exact", 0),
                properties_mapped_fuzzy=enrichment_summary.get("properties_mapped_fuzzy", 0),
                properties_not_found=enrichment_summary.get("properties_not_found", 0),
                mapping_rate=enrichment_summary.get("overall_mapping_rate", 0),
                elements_with_classification=enrichment_summary.get("elements_with_classification", 0),
            ),
            transformation=TransformationSummary(
                knowledge_graph_nodes=transformation_stats.get("kg_nodes", 0),
                knowledge_graph_edges=transformation_stats.get("kg_edges", 0),
                embedding_count=transformation_stats.get("embedding_count", 0),
                embedding_dimension=transformation_stats.get("embedding_dim", 0),
                tabular_rows=transformation_stats.get("table_rows", 0),
                tabular_columns=transformation_stats.get("table_cols", 0),
                gnn_nodes=transformation_stats.get("gnn_nodes", 0),
                gnn_edges=transformation_stats.get("gnn_edges", 0),
                gnn_features=transformation_stats.get("num_features", 0),
            ),
            standards_used=self.STANDARDS_USED,
            output_files=[],
            execution_time_seconds=(datetime.now() - self.start_time).total_seconds(),
        )

        # List output files
        for f in output_path.glob("*"):
            if f.is_file():
                summary.output_files.append({
                    "name": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 2),
                    "type": f.suffix[1:] if f.suffix else "unknown"
                })

        # Save summary JSON
        summary_path = output_path / "summary.json"
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(asdict(summary), f, indent=2, ensure_ascii=False, default=str)

        # Generate markdown report
        report_path = output_path / "report.md"
        self._generate_report(summary, report_path)

        return summary

    def _generate_report(self, summary: PipelineSummary, output_path: Path):
        """Generate human-readable markdown report."""
        report = f"""# BIM-to-AI Pipeline Execution Report

**Execution ID:** {summary.execution_id}
**Timestamp:** {summary.execution_timestamp}
**Execution Time:** {summary.execution_time_seconds:.2f} seconds

---

## 1. Input File

| Property | Value |
|----------|-------|
| File Name | {summary.input.file_name} |
| File Size | {summary.input.file_size_kb} KB |
| Schema | {summary.input.schema} |
| Total Elements | {summary.input.total_elements} |
| Building Elements | {summary.input.building_elements} |

### Element Distribution

"""
        for elem_type, count in summary.input.type_distribution.items():
            report += f"- **{elem_type}**: {count}\n"

        report += f"""
---

## 2. Validation Results (IDS-based)

| Metric | Value |
|--------|-------|
| Elements Passed | {summary.validation.elements_passed} / {summary.validation.total_elements} |
| Pass Rate | {summary.validation.element_pass_rate}% |
| Total Checks | {summary.validation.total_checks} |
| Checks Passed | {summary.validation.checks_passed} |
| Checks Failed | {summary.validation.checks_failed} |
| Check Pass Rate | {summary.validation.check_pass_rate}% |
| BCF Issues Generated | {summary.validation.bcf_issues_count} |

### Failures by Type

"""
        for failure_type, count in summary.validation.failures_by_type.items():
            report += f"- **{failure_type}**: {count}\n"

        report += f"""
---

## 3. Enrichment Results (bSDD Standardization)

| Metric | Value |
|--------|-------|
| Total Properties | {summary.enrichment.total_properties} |
| Mapped (Exact) | {summary.enrichment.properties_mapped_exact} |
| Mapped (Fuzzy) | {summary.enrichment.properties_mapped_fuzzy} |
| Not Found | {summary.enrichment.properties_not_found} |
| Mapping Rate | {summary.enrichment.mapping_rate}% |
| Elements with Classification | {summary.enrichment.elements_with_classification} |

---

## 4. AI Transformation Results

### 4.1 Knowledge Graph

| Metric | Value |
|--------|-------|
| Nodes | {summary.transformation.knowledge_graph_nodes} |
| Edges | {summary.transformation.knowledge_graph_edges} |

### 4.2 Vector Embeddings

| Metric | Value |
|--------|-------|
| Embedding Count | {summary.transformation.embedding_count} |
| Dimension | {summary.transformation.embedding_dimension} |

### 4.3 Tabular Dataset

| Metric | Value |
|--------|-------|
| Rows | {summary.transformation.tabular_rows} |
| Columns | {summary.transformation.tabular_columns} |

### 4.4 GNN Graph Structure

| Metric | Value |
|--------|-------|
| Nodes | {summary.transformation.gnn_nodes} |
| Edges | {summary.transformation.gnn_edges} |
| Features | {summary.transformation.gnn_features} |

---

## 5. Standards Referenced

"""
        for standard in summary.standards_used:
            report += f"- {standard}\n"

        report += f"""
---

## 6. Output Files

| File | Size | Type |
|------|------|------|
"""
        for f in summary.output_files:
            report += f"| {f['name']} | {f['size_kb']} KB | {f['type']} |\n"

        report += """
---

*Generated by BIM-to-AI Pipeline*
"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)

    def get_summary_dict(self, summary: PipelineSummary) -> dict:
        """Convert summary to dictionary."""
        return asdict(summary)


# Convenience function to run complete pipeline
def run_complete_pipeline(ifc_path: str, output_dir: str = "outputs") -> PipelineSummary:
    """
    Run the complete 5-stage pipeline.

    Args:
        ifc_path: Path to IFC file
        output_dir: Output directory

    Returns:
        PipelineSummary with all results
    """
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))

    from pipeline.parser import IFCParser
    from pipeline.validator import IDSValidator
    from pipeline.enricher import BSDDEnricher
    from pipeline.transformer import AITransformer

    print("=" * 70)
    print("  BIM-to-AI Pipeline - Complete Execution")
    print("=" * 70)

    packager = PipelinePackager()

    # Stage 1: Parse
    print("\n[Stage 1/5] Parsing IFC file...")
    parser = IFCParser(ifc_path)
    parsed_elements = parser.parse_all_elements()
    parser_stats = parser.get_statistics()
    parser_stats["file_path"] = ifc_path
    spatial_tree = parser.get_spatial_tree()
    print(f"  -> Parsed {len(parsed_elements)} elements")

    # Stage 2: Validate
    print("\n[Stage 2/5] Validating against IDS rules...")
    print("  -> Loading LOIN requirements (ISO 7817-1)...")
    kb_path = Path("data/bsdd_knowledge_base/classes.json")
    loin_path = Path("data/loin_requirements.json")
    with open(kb_path) as f:
        bsdd_kb = json.load(f)

    validator = IDSValidator(
        bsdd_kb,
        loin_config_path=str(loin_path) if loin_path.exists() else None
    )
    validations = validator.validate(parsed_elements)
    validation_summary = validator.get_summary(validations)
    bcf_issues = validator.generate_bcf_issues(validations)
    validation_summary["bcf_issues_count"] = len(bcf_issues)
    print(f"  -> {validation_summary['elements_passed']}/{validation_summary['total_elements']} elements passed")

    # Save generated IDS rules
    ids_xml = validator.generate_ids_xml()
    ids_output_path = Path(output_dir) / "generated_rules.ids"
    with open(ids_output_path, 'w', encoding='utf-8') as f:
        f.write(ids_xml)
    print(f"  -> Generated IDS rules saved to {ids_output_path}")

    # Stage 3: Enrich
    print("\n[Stage 3/5] Enriching with bSDD standardization...")
    enricher = BSDDEnricher(
        "data/bsdd_knowledge_base/classes.json",
        "data/bsdd_knowledge_base/classification_map.json"
    )
    enriched_elements = enricher.enrich_all(parsed_elements)
    enrichment_summary = enricher.get_enrichment_summary(enriched_elements)
    print(f"  -> {enrichment_summary['overall_mapping_rate']}% properties mapped")

    # Stage 4: Transform
    print("\n[Stage 4/5] Transforming to AI formats...")
    transformer = AITransformer(enriched_elements, parsed_elements, spatial_tree)
    transform_result = transformer.transform_all(output_dir)
    print(f"  -> 4 AI formats generated")

    # Stage 5: Package
    print("\n[Stage 5/5] Packaging results...")
    summary = packager.package(
        parser_stats=parser_stats,
        validation_summary=validation_summary,
        enrichment_summary=enrichment_summary,
        transformation_stats=transform_result.statistics,
        output_dir=output_dir
    )
    print(f"  -> Summary saved to {output_dir}/summary.json")

    print("\n" + "=" * 70)
    print("  Pipeline Complete!")
    print("=" * 70)
    print(f"\nExecution Time: {summary.execution_time_seconds:.2f} seconds")
    print(f"Output Directory: {output_dir}/")
    print("\nOutput Files:")
    for f in summary.output_files:
        print(f"  - {f['name']} ({f['size_kb']} KB)")

    return summary


# Test
if __name__ == "__main__":
    summary = run_complete_pipeline("data/sample.ifc", "outputs")

    print("\n" + "=" * 70)
    print("  Final Summary")
    print("=" * 70)
    print(f"\nInput: {summary.input.file_name} ({summary.input.total_elements} elements)")
    print(f"Validation: {summary.validation.element_pass_rate}% pass rate")
    print(f"Enrichment: {summary.enrichment.mapping_rate}% mapped")
    print(f"Transformation:")
    print(f"  - Knowledge Graph: {summary.transformation.knowledge_graph_nodes} nodes, {summary.transformation.knowledge_graph_edges} edges")
    print(f"  - Embeddings: {summary.transformation.embedding_count} x {summary.transformation.embedding_dimension}D")
    print(f"  - Tabular: {summary.transformation.tabular_rows} x {summary.transformation.tabular_columns}")
    print(f"  - GNN: {summary.transformation.gnn_nodes} nodes, {summary.transformation.gnn_edges} edges")
