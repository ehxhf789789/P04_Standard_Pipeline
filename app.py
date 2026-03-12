"""
BIM-to-AI Pipeline - Streamlit Visualization App

Visualizes all 5 stages of the pipeline with refined design:
1. Parse: Raw IFC -> Structured Objects + 3D Viewer
2. Validate: IDS-based validation results
3. Enrich: bSDD standardization
4. Transform: 4 AI formats
5. Package: Summary statistics
"""

import streamlit as st
import pandas as pd
import numpy as np
import json
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
import sys
import base64

# Add pipeline to path
sys.path.insert(0, str(Path(__file__).parent))

from pipeline.parser import IFCParser
from pipeline.validator import IDSValidator, ValidationResult
from pipeline.enricher import BSDDEnricher
from pipeline.transformer import AITransformer

# Page config
st.set_page_config(
    page_title="BIM-to-AI Pipeline",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for refined design
st.markdown("""
<style>
    /* Main theme */
    .stApp {
        background: linear-gradient(180deg, #0F172A 0%, #1E293B 100%);
    }

    /* Sidebar */
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%);
        border-right: 1px solid #334155;
    }

    /* Headers */
    .main-header {
        font-size: 2.8rem;
        font-weight: 700;
        background: linear-gradient(90deg, #0EA5E9 0%, #8B5CF6 50%, #EC4899 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
        text-align: center;
    }

    .sub-header {
        font-size: 1.1rem;
        color: #94A3B8;
        text-align: center;
        margin-bottom: 2rem;
    }

    .stage-header {
        font-size: 1.8rem;
        font-weight: 600;
        color: #F8FAFC;
        border-left: 4px solid #0EA5E9;
        padding-left: 1rem;
        margin-bottom: 1.5rem;
    }

    .section-title {
        font-size: 1.2rem;
        font-weight: 600;
        color: #E2E8F0;
        margin: 1.5rem 0 1rem 0;
    }

    /* Metric cards */
    .metric-container {
        background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
        border: 1px solid #475569;
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        transition: transform 0.2s, box-shadow 0.2s;
    }

    .metric-container:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }

    .metric-value {
        font-size: 2.5rem;
        font-weight: 700;
        color: #0EA5E9;
    }

    .metric-label {
        font-size: 0.9rem;
        color: #94A3B8;
        margin-top: 0.5rem;
    }

    /* Pipeline flow */
    .pipeline-step {
        background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
        border: 1px solid #475569;
        border-radius: 12px;
        padding: 1.2rem;
        text-align: center;
        position: relative;
    }

    .pipeline-step.active {
        border-color: #0EA5E9;
        box-shadow: 0 0 20px rgba(14, 165, 233, 0.3);
    }

    .step-number {
        font-size: 0.8rem;
        color: #0EA5E9;
        font-weight: 600;
    }

    .step-title {
        font-size: 1.1rem;
        color: #F8FAFC;
        font-weight: 600;
        margin: 0.5rem 0;
    }

    .step-value {
        font-size: 1.5rem;
        color: #10B981;
        font-weight: 700;
    }

    .step-desc {
        font-size: 0.85rem;
        color: #64748B;
    }

    /* Status badges */
    .badge-pass {
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    .badge-fail {
        background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
        color: white;
        padding: 0.3rem 0.8rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* Code blocks */
    .code-block {
        background: #0F172A;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 1rem;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.85rem;
        overflow-x: auto;
    }

    /* Cards */
    .info-card {
        background: linear-gradient(135deg, #1E293B 0%, #334155 100%);
        border: 1px solid #475569;
        border-radius: 12px;
        padding: 1.5rem;
        margin: 1rem 0;
    }

    /* Tables */
    .dataframe {
        border-radius: 8px;
        overflow: hidden;
    }

    /* Graph container */
    .graph-container {
        background: #0F172A;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 1rem;
        min-height: 500px;
    }

    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}

    /* Tabs styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #1E293B;
        border-radius: 8px;
        padding: 4px;
    }

    .stTabs [data-baseweb="tab"] {
        background-color: transparent;
        border-radius: 6px;
        color: #94A3B8;
        padding: 8px 16px;
    }

    .stTabs [aria-selected="true"] {
        background-color: #0EA5E9;
        color: white;
    }
</style>
""", unsafe_allow_html=True)


@st.cache_resource
def load_pipeline_data():
    """Load and cache all pipeline data."""
    ifc_path = "data/sample.ifc"
    kb_path = "data/bsdd_knowledge_base/classes.json"
    cls_path = "data/bsdd_knowledge_base/classification_map.json"

    if not Path(ifc_path).exists():
        return None

    # Parse
    parser = IFCParser(ifc_path)
    parsed_elements = parser.parse_all_elements()
    parser_stats = parser.get_statistics()
    spatial_tree = parser.get_spatial_tree()
    raw_preview = parser.get_raw_text_preview(2000)

    # Validate
    with open(kb_path) as f:
        bsdd_kb = json.load(f)
    validator = IDSValidator(bsdd_kb)
    validations = validator.validate(parsed_elements)
    validation_summary = validator.get_summary(validations)

    # Enrich
    enricher = BSDDEnricher(kb_path, cls_path)
    enriched_elements = enricher.enrich_all(parsed_elements)
    enrichment_summary = enricher.get_enrichment_summary(enriched_elements)

    # Transform
    transformer = AITransformer(enriched_elements, parsed_elements, spatial_tree)
    transform_result = transformer.transform_all("outputs")

    # Load summary
    summary_path = Path("outputs/summary.json")
    summary = {}
    if summary_path.exists():
        with open(summary_path) as f:
            summary = json.load(f)

    return {
        "parser": parser,
        "parsed": parsed_elements,
        "parser_stats": parser_stats,
        "spatial_tree": spatial_tree,
        "raw_preview": raw_preview,
        "validations": validations,
        "validation_summary": validation_summary,
        "enriched": enriched_elements,
        "enrichment_summary": enrichment_summary,
        "transform_result": transform_result,
        "summary": summary,
        "bsdd_kb": bsdd_kb,
        "ifc_path": ifc_path,
    }


def create_3d_ifc_viewer(parsed_elements, spatial_tree):
    """Create a 3D visualization of IFC elements using Plotly."""

    # Generate mock 3D positions based on element types and spatial structure
    element_positions = []
    colors = []
    texts = []
    sizes = []

    color_map = {
        "IfcWall": "#3B82F6",      # Blue
        "IfcDoor": "#F59E0B",      # Amber
        "IfcWindow": "#06B6D4",    # Cyan
        "IfcSlab": "#6366F1",      # Indigo
        "IfcBeam": "#EF4444",      # Red
        "IfcColumn": "#10B981",    # Emerald
        "IfcRoof": "#8B5CF6",      # Purple
        "IfcStair": "#EC4899",     # Pink
    }

    size_map = {
        "IfcWall": 40,
        "IfcDoor": 25,
        "IfcWindow": 20,
        "IfcSlab": 50,
        "IfcBeam": 35,
        "IfcColumn": 30,
        "IfcRoof": 45,
        "IfcStair": 35,
    }

    np.random.seed(42)

    for i, el in enumerate(parsed_elements):
        ifc_class = el["ifc_class"]

        # Position based on element type
        base_x = (i % 3) * 5
        base_y = (i // 3) * 5
        base_z = 0

        # Add some variation
        x = base_x + np.random.uniform(-1, 1)
        y = base_y + np.random.uniform(-1, 1)

        if ifc_class == "IfcSlab":
            z = -0.5
        elif ifc_class == "IfcRoof":
            z = 4
        elif ifc_class in ["IfcBeam"]:
            z = 3
        else:
            z = np.random.uniform(0, 2.5)

        element_positions.append([x, y, z])
        colors.append(color_map.get(ifc_class, "#64748B"))
        texts.append(f"{ifc_class}<br>{el.get('name', 'Unknown')}")
        sizes.append(size_map.get(ifc_class, 25))

    positions = np.array(element_positions)

    fig = go.Figure()

    # Add elements as scatter3d
    for ifc_class in color_map.keys():
        mask = [el["ifc_class"] == ifc_class for el in parsed_elements]
        if any(mask):
            indices = [i for i, m in enumerate(mask) if m]
            fig.add_trace(go.Scatter3d(
                x=[positions[i][0] for i in indices],
                y=[positions[i][1] for i in indices],
                z=[positions[i][2] for i in indices],
                mode='markers',
                marker=dict(
                    size=[sizes[i] for i in indices],
                    color=color_map[ifc_class],
                    opacity=0.8,
                    line=dict(width=1, color='white')
                ),
                text=[texts[i] for i in indices],
                hovertemplate='%{text}<extra></extra>',
                name=ifc_class
            ))

    # Add floor plane
    floor_x = np.array([[-2, 12], [-2, 12]])
    floor_y = np.array([[-2, -2], [12, 12]])
    floor_z = np.array([[-0.5, -0.5], [-0.5, -0.5]])

    fig.add_trace(go.Surface(
        x=floor_x, y=floor_y, z=floor_z,
        colorscale=[[0, '#1E293B'], [1, '#334155']],
        showscale=False,
        opacity=0.5,
        name='Floor'
    ))

    fig.update_layout(
        scene=dict(
            xaxis=dict(showgrid=False, showticklabels=False, title='', showbackground=False),
            yaxis=dict(showgrid=False, showticklabels=False, title='', showbackground=False),
            zaxis=dict(showgrid=False, showticklabels=False, title='', showbackground=False),
            bgcolor='rgba(15,23,42,0)',
            camera=dict(
                up=dict(x=0, y=0, z=1),
                center=dict(x=0, y=0, z=0),
                eye=dict(x=1.5, y=1.5, z=1.2)
            )
        ),
        paper_bgcolor='rgba(15,23,42,1)',
        plot_bgcolor='rgba(15,23,42,1)',
        margin=dict(l=0, r=0, t=0, b=0),
        legend=dict(
            bgcolor='rgba(30,41,59,0.8)',
            bordercolor='#475569',
            borderwidth=1,
            font=dict(color='#E2E8F0'),
            x=0.02,
            y=0.98
        ),
        height=500
    )

    return fig


def create_network_graph_plotly(data):
    """Create network graph using Plotly instead of Pyvis for better Streamlit compatibility."""

    elements = data["parsed"]
    enriched = data["enriched"]

    # Build graph data
    nodes = []
    edges = []

    # Node positions using force-directed layout simulation
    np.random.seed(42)
    n_elements = len(elements)

    # Create positions in a circular layout with some randomness
    positions = {}

    # Center: Elements
    for i, el in enumerate(elements):
        angle = 2 * np.pi * i / n_elements
        r = 2
        x = r * np.cos(angle) + np.random.uniform(-0.3, 0.3)
        y = r * np.sin(angle) + np.random.uniform(-0.3, 0.3)
        positions[el["global_id"]] = (x, y)
        nodes.append({
            "id": el["global_id"],
            "label": f'{el["ifc_class"]}\n{el.get("name", "")}',
            "type": "element",
            "class": el["ifc_class"],
            "x": x,
            "y": y
        })

    # Outer ring: Property sets
    pset_idx = 0
    for el in elements:
        for pset_name in el.get("property_sets", {}).keys():
            pset_id = f"pset_{el['global_id']}_{pset_name}"
            if pset_id not in positions:
                angle = 2 * np.pi * pset_idx / 20
                r = 4
                x = r * np.cos(angle)
                y = r * np.sin(angle)
                positions[pset_id] = (x, y)
                nodes.append({
                    "id": pset_id,
                    "label": pset_name,
                    "type": "pset",
                    "x": x,
                    "y": y
                })
                edges.append({
                    "source": el["global_id"],
                    "target": pset_id,
                    "type": "HAS_PSET"
                })
                pset_idx += 1

    # Add material and classification nodes
    mat_idx = 0
    for el in elements:
        materials = el.get("material") or []
        for mat in materials:
            mat_name = mat.get("name", "Unknown")
            mat_id = f"mat_{mat_name}"
            if mat_id not in positions:
                angle = 2 * np.pi * mat_idx / 8 + 0.5
                r = 5
                x = r * np.cos(angle)
                y = r * np.sin(angle)
                positions[mat_id] = (x, y)
                nodes.append({
                    "id": mat_id,
                    "label": f"Material\n{mat_name}",
                    "type": "material",
                    "x": x,
                    "y": y
                })
                mat_idx += 1
            edges.append({
                "source": el["global_id"],
                "target": mat_id,
                "type": "HAS_MATERIAL"
            })

    # Create Plotly figure
    fig = go.Figure()

    # Draw edges
    for edge in edges:
        if edge["source"] in positions and edge["target"] in positions:
            x0, y0 = positions[edge["source"]]
            x1, y1 = positions[edge["target"]]

            edge_color = "#475569"
            if edge["type"] == "HAS_MATERIAL":
                edge_color = "#10B981"
            elif edge["type"] == "HAS_PSET":
                edge_color = "#6366F1"

            fig.add_trace(go.Scatter(
                x=[x0, x1, None],
                y=[y0, y1, None],
                mode='lines',
                line=dict(width=1, color=edge_color),
                hoverinfo='none',
                showlegend=False
            ))

    # Draw nodes by type
    node_colors = {
        "element": "#0EA5E9",
        "pset": "#8B5CF6",
        "material": "#10B981",
        "classification": "#F59E0B"
    }

    node_sizes = {
        "element": 30,
        "pset": 15,
        "material": 20,
        "classification": 18
    }

    for node_type in ["pset", "material", "classification", "element"]:
        type_nodes = [n for n in nodes if n["type"] == node_type]
        if type_nodes:
            fig.add_trace(go.Scatter(
                x=[n["x"] for n in type_nodes],
                y=[n["y"] for n in type_nodes],
                mode='markers+text',
                marker=dict(
                    size=node_sizes.get(node_type, 20),
                    color=node_colors.get(node_type, "#64748B"),
                    line=dict(width=2, color='white')
                ),
                text=[n["label"].split('\n')[0] for n in type_nodes],
                textposition="bottom center",
                textfont=dict(size=9, color='#E2E8F0'),
                hovertext=[n["label"].replace('\n', '<br>') for n in type_nodes],
                hovertemplate='%{hovertext}<extra></extra>',
                name=node_type.capitalize(),
                showlegend=True
            ))

    fig.update_layout(
        paper_bgcolor='rgba(15,23,42,1)',
        plot_bgcolor='rgba(15,23,42,1)',
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        margin=dict(l=20, r=20, t=20, b=20),
        legend=dict(
            bgcolor='rgba(30,41,59,0.9)',
            bordercolor='#475569',
            borderwidth=1,
            font=dict(color='#E2E8F0'),
            x=0.02,
            y=0.98
        ),
        height=550
    )

    return fig


def main():
    # Sidebar
    with st.sidebar:
        st.markdown("## 🏗️ BIM-to-AI")
        st.markdown("---")

        stage = st.radio(
            "Pipeline Stage",
            [
                "🏠 Overview",
                "📄 1. Parse",
                "✅ 2. Validate",
                "🔗 3. Enrich",
                "🤖 4. Transform",
                "📦 5. Package"
            ],
            index=0
        )

        st.markdown("---")
        st.markdown("### 📋 Standards")
        st.markdown("""
        <div style='font-size: 0.85rem; color: #94A3B8;'>
        • IFC 4.3 (ISO 16739)<br>
        • IDS 1.0 (ISO 7817)<br>
        • bSDD (ISO 23386)<br>
        • ICDD (ISO 21597)
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("""
        <div style='text-align: center; font-size: 0.8rem; color: #64748B;'>
        Built with IfcOpenShell<br>
        & Sentence Transformers
        </div>
        """, unsafe_allow_html=True)

    # Load data
    data = load_pipeline_data()
    if data is None:
        st.error("❌ Pipeline data not found. Run `python -m pipeline.data_collector` first.")
        st.stop()

    # Route
    if "Overview" in stage:
        show_overview(data)
    elif "1. Parse" in stage:
        show_parse_stage(data)
    elif "2. Validate" in stage:
        show_validate_stage(data)
    elif "3. Enrich" in stage:
        show_enrich_stage(data)
    elif "4. Transform" in stage:
        show_transform_stage(data)
    elif "5. Package" in stage:
        show_package_stage(data)


def show_overview(data):
    """Overview dashboard with refined design."""
    st.markdown('<p class="main-header">🏗️ BIM-to-AI Pipeline</p>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">Transform IFC building data into AI-ready formats using international standards</p>', unsafe_allow_html=True)

    # Metrics row
    col1, col2, col3, col4 = st.columns(4)

    val_summary = data["validation_summary"]
    enrich_summary = data["enrichment_summary"]
    transform_stats = data["transform_result"].statistics

    with col1:
        st.markdown(f"""
        <div class="metric-container">
            <div class="metric-value">{data["parser_stats"]["building_elements"]}</div>
            <div class="metric-label">Building Elements</div>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        color = "#10B981" if val_summary['element_pass_rate'] > 70 else "#F59E0B" if val_summary['element_pass_rate'] > 40 else "#EF4444"
        st.markdown(f"""
        <div class="metric-container">
            <div class="metric-value" style="color: {color}">{val_summary['element_pass_rate']}%</div>
            <div class="metric-label">Validation Pass Rate</div>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown(f"""
        <div class="metric-container">
            <div class="metric-value" style="color: #8B5CF6">{enrich_summary['overall_mapping_rate']}%</div>
            <div class="metric-label">bSDD Mapping Rate</div>
        </div>
        """, unsafe_allow_html=True)

    with col4:
        st.markdown(f"""
        <div class="metric-container">
            <div class="metric-value" style="color: #EC4899">4</div>
            <div class="metric-label">AI Output Formats</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Pipeline flow
    st.markdown('<p class="section-title">📊 Pipeline Flow</p>', unsafe_allow_html=True)

    cols = st.columns(5)
    steps = [
        ("1", "Parse", f"{data['parser_stats']['building_elements']}", "IFC → Objects"),
        ("2", "Validate", f"{val_summary['element_pass_rate']}%", "IDS Rules"),
        ("3", "Enrich", f"{enrich_summary['overall_mapping_rate']}%", "bSDD Standards"),
        ("4", "Transform", "4", "AI Formats"),
        ("5", "Package", "✓", "Summary"),
    ]

    for col, (num, title, value, desc) in zip(cols, steps):
        with col:
            st.markdown(f"""
            <div class="pipeline-step">
                <div class="step-number">STAGE {num}</div>
                <div class="step-title">{title}</div>
                <div class="step-value">{value}</div>
                <div class="step-desc">{desc}</div>
            </div>
            """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # Two column layout
    col1, col2 = st.columns(2)

    with col1:
        st.markdown('<p class="section-title">🏛️ Element Distribution</p>', unsafe_allow_html=True)
        type_dist = data["parser_stats"]["type_distribution"]
        building_types = {k: v for k, v in type_dist.items()
                        if k not in ["IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace"]}

        fig = px.pie(
            values=list(building_types.values()),
            names=list(building_types.keys()),
            color_discrete_sequence=['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
        )
        fig.update_layout(
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='#E2E8F0'),
            legend=dict(
                bgcolor='rgba(30,41,59,0.8)',
                bordercolor='#475569'
            ),
            margin=dict(t=20, b=20, l=20, r=20)
        )
        fig.update_traces(textinfo='percent+label', textfont_size=11)
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.markdown('<p class="section-title">🎯 Validation Overview</p>', unsafe_allow_html=True)

        failures = val_summary.get("failures_by_type", {})
        if failures:
            # Simplify labels
            simple_failures = {}
            for k, v in failures.items():
                label = k.split(": ")[-1] if ": " in k else k
                simple_failures[label] = v

            fig = px.bar(
                x=list(simple_failures.values()),
                y=list(simple_failures.keys()),
                orientation='h',
                color=list(simple_failures.values()),
                color_continuous_scale=['#FCD34D', '#EF4444']
            )
            fig.update_layout(
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#E2E8F0'),
                xaxis_title="Count",
                yaxis_title="",
                showlegend=False,
                coloraxis_showscale=False,
                margin=dict(t=20, b=40, l=20, r=20),
                xaxis=dict(gridcolor='#334155'),
                yaxis=dict(gridcolor='#334155')
            )
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.success("✅ All validations passed!")


def show_parse_stage(data):
    """Parse stage with 3D viewer."""
    st.markdown('<p class="stage-header">📄 Stage 1: Parse - IFC to Structured Objects</p>', unsafe_allow_html=True)

    # Tabs for different views
    tab1, tab2, tab3 = st.tabs(["🏗️ 3D Viewer", "📝 Raw vs Structured", "🌳 Spatial Tree"])

    with tab1:
        st.markdown('<p class="section-title">3D Building Model Visualization</p>', unsafe_allow_html=True)
        fig = create_3d_ifc_viewer(data["parsed"], data["spatial_tree"])
        st.plotly_chart(fig, use_container_width=True)

        st.info("💡 Drag to rotate, scroll to zoom, right-click to pan")

    with tab2:
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("#### BEFORE: Raw IFC (EXPRESS/STEP)")
            st.code(data["raw_preview"][:1500] + "\n...", language="text")

        with col2:
            st.markdown("#### AFTER: Structured Objects")
            if data["parsed"]:
                st.json(data["parsed"][0])

    with tab3:
        st.markdown("#### Spatial Structure Tree")
        st.json(data["spatial_tree"])

    # Statistics
    st.markdown("---")
    st.markdown('<p class="section-title">📊 File Statistics</p>', unsafe_allow_html=True)

    stats = data["parser_stats"]
    cols = st.columns(5)
    metrics = [
        ("File Size", f"{stats['file_size_kb']} KB"),
        ("Schema", stats['schema']),
        ("Total Elements", stats['total_elements']),
        ("Building Elements", stats['building_elements']),
        ("Relationships", stats['relationship_count']),
    ]

    for col, (label, value) in zip(cols, metrics):
        col.metric(label, value)


def show_validate_stage(data):
    """Validation stage visualization."""
    st.markdown('<p class="stage-header">✅ Stage 2: Validate - IDS Rule-Based Validation</p>', unsafe_allow_html=True)

    summary = data["validation_summary"]

    # Summary metrics
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Elements Checked", summary['total_elements'])
    col2.metric("Passed", summary['elements_passed'], delta=f"{summary['element_pass_rate']}%")
    col3.metric("Failed", summary['elements_failed'], delta=None if summary['elements_failed'] == 0 else f"-{summary['elements_failed']}")
    col4.metric("Total Checks", summary['total_checks'])

    st.markdown("---")

    # Results table
    st.markdown('<p class="section-title">📋 Validation Results by Element</p>', unsafe_allow_html=True)

    rows = []
    for v in data["validations"]:
        rows.append({
            "Status": "✅ PASS" if v.status == "PASS" else "❌ FAIL" if v.status == "FAIL" else "⚠️ WARN",
            "IFC Class": v.ifc_class,
            "Name": v.name,
            "Passed": v.pass_count,
            "Failed": v.fail_count,
            "Pass Rate": f"{v.pass_rate*100:.0f}%",
        })

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)

    # Detailed failures
    st.markdown("---")
    st.markdown('<p class="section-title">🔍 Failure Details</p>', unsafe_allow_html=True)

    failed_elements = [v for v in data["validations"] if v.status == "FAIL"]

    if failed_elements:
        for v in failed_elements[:3]:  # Show first 3
            with st.expander(f"❌ {v.ifc_class}: {v.name}"):
                for check in v.checks:
                    if check.result == ValidationResult.FAIL:
                        st.markdown(f"""
                        **{check.facet_type}**: {check.rule_name}
                        - Expected: `{check.expected}`
                        - Actual: `{check.actual}`
                        """)
    else:
        st.success("✅ No failures to display!")


def show_enrich_stage(data):
    """Enrichment stage visualization."""
    st.markdown('<p class="stage-header">🔗 Stage 3: Enrich - bSDD Standardization</p>', unsafe_allow_html=True)

    summary = data["enrichment_summary"]

    # Metrics
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Properties", summary['total_properties'])
    col2.metric("Mapped (Exact)", summary['properties_mapped_exact'])
    col3.metric("Mapping Rate", f"{summary['overall_mapping_rate']}%")
    col4.metric("With Classification", summary['elements_with_classification'])

    st.markdown("---")

    # Before/After comparison
    st.markdown('<p class="section-title">🔄 Property Standardization</p>', unsafe_allow_html=True)

    for el in data["enriched"]:
        if hasattr(el, 'standardized_properties') and el.standardized_properties:
            col1, col2 = st.columns(2)

            with col1:
                st.markdown(f"#### Original: {el.name}")
                st.json(el.original_properties)

            with col2:
                st.markdown("#### Standardized (bSDD)")
                std_display = {}
                for key, prop in el.standardized_properties.items():
                    status_icon = "✅" if prop.mapping_status == "MAPPED" else "🔍" if prop.mapping_status == "FUZZY_MATCH" else "❓"
                    std_display[f"{status_icon} {prop.standard_name}"] = {
                        "value": prop.normalized_value,
                        "bSDD": prop.bsdd_uri[:50] + "..." if prop.bsdd_uri else "Not found"
                    }
                st.json(std_display)
            break

    # Classification mapping
    st.markdown("---")
    st.markdown('<p class="section-title">🏷️ Classification Cross-Links</p>', unsafe_allow_html=True)

    cls_data = []
    seen = set()
    for el in data["enriched"]:
        if hasattr(el, 'classification_links') and el.ifc_class not in seen:
            row = {"IFC Class": el.ifc_class}
            for sys_name, cls_info in el.classification_links.items():
                if isinstance(cls_info, dict):
                    row[sys_name.upper()] = cls_info.get("code") or cls_info.get("uri", "")[:25]
            cls_data.append(row)
            seen.add(el.ifc_class)

    if cls_data:
        df = pd.DataFrame(cls_data)
        st.dataframe(df, use_container_width=True, hide_index=True)


def show_transform_stage(data):
    """Transformation stage with Plotly-based network graph."""
    st.markdown('<p class="stage-header">🤖 Stage 4: Transform - AI-Ready Formats</p>', unsafe_allow_html=True)

    stats = data["transform_result"].statistics

    # Format tabs
    tab1, tab2, tab3, tab4 = st.tabs(["🕸️ Knowledge Graph", "📊 Embeddings", "📋 Tabular", "🔗 GNN"])

    with tab1:
        col1, col2, col3 = st.columns(3)
        col1.metric("Nodes", stats['kg_nodes'])
        col2.metric("Edges", stats['kg_edges'])
        col3.metric("Node Types", "4")

        st.markdown('<p class="section-title">Interactive Knowledge Graph</p>', unsafe_allow_html=True)
        fig = create_network_graph_plotly(data)
        st.plotly_chart(fig, use_container_width=True)

        st.info("💡 Node types: Elements (blue), Property Sets (purple), Materials (green)")

    with tab2:
        col1, col2 = st.columns(2)
        col1.metric("Vectors", stats['embedding_count'])
        col2.metric("Dimensions", stats['embedding_dim'])

        embed_meta = data["transform_result"].embedding_metadata

        if embed_meta.get("embeddings_2d"):
            st.markdown('<p class="section-title">2D Embedding Visualization (PCA)</p>', unsafe_allow_html=True)

            embeddings_2d = np.array(embed_meta["embeddings_2d"])
            types = embed_meta.get("element_types", [])
            names = embed_meta.get("element_names", [])

            fig = px.scatter(
                x=embeddings_2d[:, 0],
                y=embeddings_2d[:, 1],
                color=types,
                hover_data={"Name": names},
                color_discrete_sequence=['#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899']
            )
            fig.update_layout(
                paper_bgcolor='rgba(0,0,0,0)',
                plot_bgcolor='rgba(15,23,42,1)',
                font=dict(color='#E2E8F0'),
                xaxis=dict(gridcolor='#334155', title='PC1'),
                yaxis=dict(gridcolor='#334155', title='PC2'),
                legend=dict(bgcolor='rgba(30,41,59,0.8)', bordercolor='#475569')
            )
            fig.update_traces(marker=dict(size=15, line=dict(width=2, color='white')))
            st.plotly_chart(fig, use_container_width=True)

        if embed_meta.get("similarity_matrix"):
            st.markdown('<p class="section-title">Element Similarity Matrix</p>', unsafe_allow_html=True)
            sim_matrix = np.array(embed_meta["similarity_matrix"])
            names = embed_meta.get("element_names", [f"E{i}" for i in range(len(sim_matrix))])

            fig = px.imshow(
                sim_matrix,
                x=names, y=names,
                color_continuous_scale='Blues',
                labels=dict(color="Similarity")
            )
            fig.update_layout(
                paper_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#E2E8F0'),
                margin=dict(t=20, b=20)
            )
            st.plotly_chart(fig, use_container_width=True)

    with tab3:
        col1, col2 = st.columns(2)
        col1.metric("Rows", stats['table_rows'])
        col2.metric("Columns", stats['table_cols'])

        df = data["transform_result"].tabular_df
        if df is not None:
            st.dataframe(df, use_container_width=True, hide_index=True)

            col1, col2 = st.columns(2)
            with col1:
                csv = df.to_csv(index=False)
                st.download_button("📥 Download CSV", csv, "bim_dataset.csv", "text/csv")
            with col2:
                st.download_button("📥 Download Parquet", df.to_parquet(), "bim_dataset.parquet")

    with tab4:
        gnn = data["transform_result"].graph_structure

        col1, col2, col3 = st.columns(3)
        col1.metric("Nodes", gnn.get('num_nodes', 0))
        col2.metric("Edges", gnn.get('num_edges', 0))
        col3.metric("Features", gnn.get('num_features', 0))

        if gnn.get("adjacency_matrix") is not None:
            st.markdown('<p class="section-title">Adjacency Matrix</p>', unsafe_allow_html=True)

            adj_matrix = np.array(gnn["adjacency_matrix"])
            labels = gnn.get("node_labels", [])

            fig = px.imshow(
                adj_matrix,
                x=labels, y=labels,
                color_continuous_scale='Viridis'
            )
            fig.update_layout(
                paper_bgcolor='rgba(0,0,0,0)',
                font=dict(color='#E2E8F0'),
                margin=dict(t=20, b=20)
            )
            st.plotly_chart(fig, use_container_width=True)

        st.markdown('<p class="section-title">Feature Names</p>', unsafe_allow_html=True)
        if gnn.get("feature_names"):
            st.code(", ".join(gnn["feature_names"]))


def show_package_stage(data):
    """Package/Summary stage."""
    st.markdown('<p class="stage-header">📦 Stage 5: Package - Pipeline Summary</p>', unsafe_allow_html=True)

    summary = data.get("summary", {})

    if not summary:
        st.warning("⚠️ Summary not available. Run the complete pipeline first.")
        return

    # Execution info
    col1, col2, col3 = st.columns(3)
    col1.metric("Execution ID", summary.get("execution_id", "N/A")[:12])
    col2.metric("Timestamp", summary.get("execution_timestamp", "N/A")[:10])
    col3.metric("Duration", f"{summary.get('execution_time_seconds', 0):.2f}s")

    st.markdown("---")

    # Summary cards
    col1, col2 = st.columns(2)

    with col1:
        st.markdown('<p class="section-title">📥 Input</p>', unsafe_allow_html=True)
        input_data = summary.get("input", {})
        st.json(input_data)

        st.markdown('<p class="section-title">✅ Validation</p>', unsafe_allow_html=True)
        val_data = summary.get("validation", {})
        st.json(val_data)

    with col2:
        st.markdown('<p class="section-title">🔗 Enrichment</p>', unsafe_allow_html=True)
        enrich_data = summary.get("enrichment", {})
        st.json(enrich_data)

        st.markdown('<p class="section-title">🤖 Transformation</p>', unsafe_allow_html=True)
        transform_data = summary.get("transformation", {})
        st.json(transform_data)

    st.markdown("---")

    # Output files
    st.markdown('<p class="section-title">📁 Output Files</p>', unsafe_allow_html=True)
    output_files = summary.get("output_files", [])
    if output_files:
        df = pd.DataFrame(output_files)
        st.dataframe(df, use_container_width=True, hide_index=True)

    # Download
    st.download_button(
        "📥 Download Full Summary (JSON)",
        json.dumps(summary, indent=2),
        "pipeline_summary.json",
        "application/json"
    )


if __name__ == "__main__":
    main()
