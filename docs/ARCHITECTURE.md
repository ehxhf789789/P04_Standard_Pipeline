# BIM-to-AI Pipeline Platform Architecture

## Executive Summary

This document defines the comprehensive architecture for the **AI-Ready openBIM Data Integration Pipeline Framework** based on the buildingSMART International standards and ISO specifications. The platform transforms raw construction data (IFC, documents, sensors) into AI-ready datasets through a standards-governed pipeline.

---

## 1. System Overview

### 1.1 Core Objectives

| Objective | Description |
|-----------|-------------|
| **Single Source of Truth (SSOT)** | Central data repository ensuring data reliability across lifecycle |
| **Seamless Standard Integration** | Connect ISO/bSI standards across Design, Construction, O&M phases |
| **Immediate AI Utilization** | No complex preprocessing needed for AI/ML consumption |
| **Collaboration-Centric** | External accessibility for multi-stakeholder collaboration |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL ACCESS LAYER                                │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   Web App   │  │  REST API   │  │  WebSocket  │  │  openCDE API│       │
│   │  (Next.js)  │  │  (FastAPI)  │  │  (Real-time)│  │  (ISO 19650)│       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION & GATEWAY                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  OAuth2 + JWT │ Role-Based Access Control │ API Rate Limiting       │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PIPELINE EXECUTION ENGINE                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  INGEST  │→ │  PARSE   │→ │ VALIDATE │→ │  ENRICH  │→ │TRANSFORM │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│       ↑                            │                            │           │
│       │                      ┌─────┴─────┐                      ↓           │
│       │                      │ BCF 3.0   │              ┌──────────┐        │
│       └──────────────────────│ Feedback  │              │ PACKAGE  │        │
│                              └───────────┘              └──────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CENTRAL DATA MANAGEMENT                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │   Neo4j     │  │  Qdrant     │  │   MinIO     │        │
│  │ (Relational)│  │ (Graph DB)  │  │ (Vector DB) │  │ (Object S3) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AI OUTPUT LAYER                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Knowledge  │  │   Vector    │  │  Tabular    │  │    GNN      │        │
│  │   Graphs    │  │ Embeddings  │  │  Datasets   │  │  Structures │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Lifecycle Phase Standards Integration

### 2.1 Standards Mapping by Phase

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                    COMMON GOVERNANCE ENVIRONMENT (CDE)                          │
│     ISO 19650-1/2 (CDE Governance) │ ISO 29481 (IDM) │ ISO 19650-5 (Security)  │
└────────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │
┌───────┴────────┐   ┌───────┴────────┐   ┌───────┴────────┐
│     DESIGN     │   │  CONSTRUCTION  │   │      O&M       │
├────────────────┤   ├────────────────┤   ├────────────────┤
│ Gov: ISO 19650 │   │ Gov: ISO 19650 │   │ Asset: ISO 55000│
│ Process: 29481 │   │ Process: 29481 │   │ Asset: COBie   │
│ Schema: IFC4.3 │   │ Schema: IFC4.3 │   │ Class: 81346-12│
│ LOIN: ISO 7817 │   │ LOIN: ISO 7817 │   │ Pkg: ISO 21597 │
│ Valid: IDS 1.0 │   │ Valid: IDS 1.0 │   │ Spatial: GIS   │
│ Class: bSDD    │   │ Collab: BCF3.0 │   │ IoT: Sensors   │
│ Class: 12006   │   │ Pkg: ISO 21597 │   │                │
└────────────────┘   └────────────────┘   └────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │Published│    →     │Published│    →     │Published│
   │  Gate   │  ETL     │  Gate   │  ETL     │  Gate   │
   └─────────┘          └─────────┘          └─────────┘
```

### 2.2 Document Types & Standards Compliance

| Document Type | Standards Applied | Validation Rules |
|--------------|-------------------|------------------|
| **IFC Files** | ISO 16739, IDS 1.0, LOIN | 6-facet rule check, entity/property/classification/material/attribute/partOf |
| **PDF** | ISO 32000, ISO 19005 (PDF/A) | Metadata extraction, OCR for scanned docs |
| **DOCX** | ISO/IEC 29500 (OOXML) | Structure validation, metadata compliance |
| **XLSX** | ISO/IEC 29500 (OOXML) | Schema validation, data type checking |
| **PPTX** | ISO/IEC 29500 (OOXML) | Slide structure, embedded media extraction |
| **HWPX** | Korean OASIS standard | Structure parsing, metadata extraction |
| **DWG/DXF** | OpenDesign Alliance | Geometry extraction, layer parsing |

---

## 3. Pipeline Stages Detail

### 3.1 Stage 1: INGEST

```python
class IngestStage:
    """
    Supported Input Sources:
    - IFC files (STEP/JSON/XML formats)
    - Documents (PDF, DOCX, XLSX, PPTX, HWPX)
    - Photos/Drawings (JPG, PNG, DWG, DXF)
    - Sensor Data (IoT streams, CSV)
    """

    supported_formats = {
        'bim': ['.ifc', '.ifcxml', '.ifcjson'],
        'document': ['.pdf', '.docx', '.xlsx', '.pptx', '.hwpx', '.hwp'],
        'cad': ['.dwg', '.dxf', '.rvt'],
        'image': ['.jpg', '.png', '.tiff'],
        'data': ['.csv', '.json', '.xml']
    }
```

### 3.2 Stage 2: PARSE

```
IFC Parsing Flow:
┌─────────────────┐
│ .ifc EXPRESS    │
│ text file       │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Read line by    │
│ line (STEP)     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Resolve entity  │
│ references      │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Build spatial   │
│ hierarchy       │
│ Site→Building   │
│ →Storey→Element │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Extract Psets   │
│ & QuantitySets  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Link geometry   │
│ representation  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Structured JSON │
│ objects         │
└─────────────────┘

Document Parsing Flow:
┌─────────────────┐
│ DOCX/PDF/XLSX   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Extract text    │
│ & structure     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Identify tables │
│ & sections      │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Extract metadata│
│ (author, date)  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Link to BIM     │
│ objects (if any)│
└────────┬────────┘
         ▼
┌─────────────────┐
│ Structured JSON │
│ with provenance │
└─────────────────┘
```

### 3.3 Stage 3: VALIDATE

```
Validation Engine (IDS 1.0 Based):
┌─────────────────────────────────────────────────────────┐
│                    LOIN Requirements                     │
│  (ISO 7817 - Level of Information Need)                 │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              IDS XML Generation                          │
│  LOIN → Machine-readable validation rules               │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              6-Facet Rule Check                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ Entity  │ │Property │ │Classifi-│                    │
│  │         │ │         │ │ cation  │                    │
│  └─────────┘ └─────────┘ └─────────┘                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │Material │ │Attribute│ │ PartOf  │                    │
│  │         │ │         │ │         │                    │
│  └─────────┘ └─────────┘ └─────────┘                    │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Per-Element Results                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Element ID │ Facet    │ Status │ Message        │    │
│  │ #123       │ Property │ FAIL   │ Missing Pset_* │    │
│  │ #124       │ Entity   │ PASS   │ -              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
        ┌─────────┐             ┌─────────┐
        │  PASS   │             │  FAIL   │
        │ → Next  │             │ → BCF   │
        │  Stage  │             │Feedback │
        └─────────┘             └─────────┘
```

### 3.4 Stage 4: ENRICH

```
bSDD Enrichment Flow:
┌─────────────────────────────────────────────────────────┐
│                 Validated Objects                        │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Query bSDD API                              │
│  - Property name normalization                           │
│  - International terminology mapping                     │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Unit & Value Standardization                │
│  - SI unit conversion                                    │
│  - Value range validation                                │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Cross-Classification Linkage                │
│  - ISO 12006-2/3 mapping                                │
│  - Uniclass / OmniClass / ETIM linkage                  │
│  - ISO 81346-12 (Reference Designation)                 │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Attach Data Templates                       │
│  - ISO 23386/23387 compliance                           │
│  - Property definition alignment                         │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Standardized BIM Objects                    │
│  - International property names                          │
│  - Cross-linked classification codes                     │
│  - Normalized values and units                          │
└─────────────────────────────────────────────────────────┘
```

### 3.5 Stage 5: TRANSFORM

```
AI-Ready Data Transformation:
┌─────────────────────────────────────────────────────────┐
│              Standardized BIM Objects                    │
└────────┬────────────┬────────────┬────────────┬─────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Knowledge   │ │   Vector    │ │  Tabular    │ │    GNN      │
│   Graph     │ │ Embeddings  │ │  Dataset    │ │  Structure  │
├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤
│IFC→RDF/OWL  │ │Sentence     │ │Pandas/      │ │DGL/PyG      │
│ifcOWL/BOT   │ │Transformers │ │Parquet      │ │format       │
│Neo4j LPG    │ │FAISS/Qdrant │ │PostgreSQL   │ │             │
├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤
│AI Use Cases:│ │AI Use Cases:│ │AI Use Cases:│ │AI Use Cases:│
│- NL Query   │ │- RAG/LLM    │ │- Cost pred. │ │- Clash det. │
│- SPARQL     │ │- Similarity │ │- Schedule   │ │- Gen design │
│- Reasoning  │ │- Search     │ │- Analytics  │ │- Layout opt │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

### 3.6 Stage 6: PACKAGE (ICDD)

```
ISO 21597 ICDD Packaging:
┌─────────────────────────────────────────────────────────┐
│                 ICDD Container (.icdd)                   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │ Payload Documents/                               │    │
│  │  ├── model.ifc                                  │    │
│  │  ├── specifications.pdf                         │    │
│  │  ├── schedules.xlsx                            │    │
│  │  └── drawings/                                  │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Ontology Resources/                              │    │
│  │  ├── linkset.rdf      (semantic links)          │    │
│  │  └── container.rdf    (container metadata)      │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ AI Outputs/                                      │    │
│  │  ├── knowledge_graph.json                       │    │
│  │  ├── embeddings.npy                             │    │
│  │  ├── tabular_data.parquet                       │    │
│  │  └── gnn_structure.pt                           │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Central Database Architecture

### 4.1 Multi-Database Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   PostgreSQL    │  │     Neo4j       │  │     Qdrant      │             │
│  │  (Primary DB)   │  │   (Graph DB)    │  │   (Vector DB)   │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ - Projects      │  │ - Knowledge     │  │ - Text          │             │
│  │ - Users/Roles   │  │   Graphs        │  │   Embeddings    │             │
│  │ - Files/Docs    │  │ - IFC Relations │  │ - Image         │             │
│  │ - Audit Logs    │  │ - Spatial       │  │   Embeddings    │             │
│  │ - Validation    │  │   Topology      │  │ - Similarity    │             │
│  │   Results       │  │ - BOT Ontology  │  │   Search        │             │
│  │ - CDE Workflow  │  │                 │  │                 │             │
│  │   States        │  │                 │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────┴───────────┐                               │
│                    │    MinIO (S3)         │                               │
│                    │   Object Storage      │                               │
│                    ├───────────────────────┤                               │
│                    │ - Raw IFC files       │                               │
│                    │ - Documents (PDF,etc) │                               │
│                    │ - Generated outputs   │                               │
│                    │ - ICDD packages       │                               │
│                    └───────────────────────┘                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 PostgreSQL Schema

```sql
-- Core Tables
CREATE SCHEMA core;
CREATE SCHEMA documents;
CREATE SCHEMA pipeline;
CREATE SCHEMA standards;
CREATE SCHEMA ai_outputs;

-- =====================================================
-- CORE SCHEMA - Users, Projects, Organizations
-- =====================================================

CREATE TABLE core.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'appointing_party', 'lead_appointed', 'task_team'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    organization_id UUID REFERENCES core.organizations(id),
    role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'engineer', 'viewer'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE core.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lifecycle_phase VARCHAR(50) NOT NULL, -- 'design', 'construction', 'operation'
    organization_id UUID REFERENCES core.organizations(id),
    created_by UUID REFERENCES core.users(id),

    -- ISO 19650 Metadata
    eir_document_id UUID, -- Exchange Information Requirements
    oir_document_id UUID, -- Organization Information Requirements
    pir_document_id UUID, -- Project Information Requirements
    bep_document_id UUID, -- BIM Execution Plan

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DOCUMENTS SCHEMA - File Management & CDE States
-- =====================================================

CREATE TYPE documents.cde_state AS ENUM (
    'wip',       -- Work in Progress
    'shared',    -- Under Review
    'published', -- Approved (triggers AI pipeline)
    'archived'   -- Superseded
);

CREATE TYPE documents.file_type AS ENUM (
    'ifc', 'ifcxml', 'ifcjson',
    'pdf', 'docx', 'xlsx', 'pptx', 'hwpx', 'hwp',
    'dwg', 'dxf', 'rvt',
    'jpg', 'png', 'tiff',
    'csv', 'json', 'xml', 'ids'
);

CREATE TABLE documents.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,

    -- File Info
    filename VARCHAR(500) NOT NULL,
    file_type documents.file_type NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL, -- MinIO path
    checksum VARCHAR(64) NOT NULL, -- SHA-256

    -- CDE Workflow (ISO 19650)
    cde_state documents.cde_state DEFAULT 'wip',
    version INTEGER DEFAULT 1,
    revision VARCHAR(10),

    -- Metadata
    uploaded_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ, -- When moved to 'published' state

    -- Document-specific metadata (extracted)
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE documents.file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_by UUID REFERENCES core.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    change_description TEXT
);

-- =====================================================
-- PIPELINE SCHEMA - Processing State & Results
-- =====================================================

CREATE TYPE pipeline.stage_name AS ENUM (
    'ingest', 'parse', 'validate', 'enrich', 'transform', 'package'
);

CREATE TYPE pipeline.run_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TABLE pipeline.runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES core.projects(id) ON DELETE CASCADE,
    file_id UUID REFERENCES documents.files(id) ON DELETE CASCADE,

    status pipeline.run_status DEFAULT 'pending',
    current_stage pipeline.stage_name,

    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Configuration
    config JSONB DEFAULT '{}',

    -- Triggered by CDE state change
    triggered_by VARCHAR(50), -- 'manual', 'cde_publish', 'schedule'

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pipeline.stage_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,
    stage pipeline.stage_name NOT NULL,

    status pipeline.run_status NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Results
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,

    -- Metrics
    elements_processed INTEGER,
    elements_passed INTEGER,
    elements_failed INTEGER
);

-- =====================================================
-- STANDARDS SCHEMA - LOIN, IDS, bSDD Integration
-- =====================================================

CREATE TABLE standards.loin_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES core.projects(id),

    -- LOIN Specification (ISO 7817)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lifecycle_phase VARCHAR(50),

    -- Requirements
    geometry_requirements JSONB, -- Level of Geometry
    information_requirements JSONB, -- Level of Information
    documentation_requirements JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE standards.ids_rulesets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loin_requirement_id UUID REFERENCES standards.loin_requirements(id),

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- IDS XML content
    ids_xml TEXT NOT NULL,

    -- Parsed rules for quick access
    rules JSONB NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE standards.validation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,
    file_id UUID REFERENCES documents.files(id),
    ids_ruleset_id UUID REFERENCES standards.ids_rulesets(id),

    -- Overall result
    total_elements INTEGER,
    passed_elements INTEGER,
    failed_elements INTEGER,
    pass_rate DECIMAL(5,2),

    -- Detailed results per element
    element_results JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE standards.bsdd_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Original property
    original_name VARCHAR(255) NOT NULL,
    original_pset VARCHAR(255),
    ifc_class VARCHAR(100),

    -- bSDD mapping
    bsdd_domain VARCHAR(255),
    bsdd_class_uri VARCHAR(500),
    bsdd_property_uri VARCHAR(500),
    international_name VARCHAR(255),

    -- Cross-classification
    uniclass_code VARCHAR(50),
    omniclass_code VARCHAR(50),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI_OUTPUTS SCHEMA - Generated AI-Ready Data
-- =====================================================

CREATE TABLE ai_outputs.knowledge_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Graph metadata
    node_count INTEGER,
    edge_count INTEGER,

    -- Storage references
    neo4j_graph_name VARCHAR(255),
    rdf_file_path VARCHAR(1000),

    -- Graph statistics
    statistics JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Embedding metadata
    model_name VARCHAR(100) NOT NULL, -- e.g., 'all-MiniLM-L6-v2'
    embedding_dimension INTEGER NOT NULL,
    total_vectors INTEGER,

    -- Storage references
    qdrant_collection_name VARCHAR(255),
    numpy_file_path VARCHAR(1000),

    -- Statistics
    statistics JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.tabular_datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- Dataset metadata
    table_name VARCHAR(255) NOT NULL,
    row_count INTEGER,
    column_count INTEGER,
    columns JSONB, -- Column definitions

    -- Storage references
    parquet_file_path VARCHAR(1000),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_outputs.gnn_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID REFERENCES pipeline.runs(id) ON DELETE CASCADE,

    -- GNN metadata
    node_features_dim INTEGER,
    edge_features_dim INTEGER,
    node_count INTEGER,
    edge_count INTEGER,

    -- Storage references
    pytorch_file_path VARCHAR(1000), -- .pt file
    dgl_file_path VARCHAR(1000),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_files_project ON documents.files(project_id);
CREATE INDEX idx_files_cde_state ON documents.files(cde_state);
CREATE INDEX idx_files_type ON documents.files(file_type);
CREATE INDEX idx_pipeline_runs_project ON pipeline.runs(project_id);
CREATE INDEX idx_pipeline_runs_status ON pipeline.runs(status);
CREATE INDEX idx_validation_results_run ON standards.validation_results(run_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-trigger pipeline when file is published
CREATE OR REPLACE FUNCTION documents.trigger_pipeline_on_publish()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cde_state = 'published' AND OLD.cde_state != 'published' THEN
        INSERT INTO pipeline.runs (project_id, file_id, triggered_by)
        VALUES (NEW.project_id, NEW.id, 'cde_publish');

        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_file_publish
    BEFORE UPDATE ON documents.files
    FOR EACH ROW
    EXECUTE FUNCTION documents.trigger_pipeline_on_publish();
```

### 4.3 Neo4j Graph Schema

```cypher
// =====================================================
// NODE LABELS - Based on ifcOWL & BOT Ontology
// =====================================================

// Spatial Structure (BOT Ontology)
(:Site {guid, name, coordinates})
(:Building {guid, name, address})
(:Storey {guid, name, elevation})
(:Space {guid, name, area, volume})

// Building Elements (IFC)
(:Element {guid, name, ifc_class, object_type})
(:Wall {guid, name, length, height, thickness})
(:Slab {guid, name, area, thickness})
(:Beam {guid, name, span, section})
(:Column {guid, name, height, section})
(:Door {guid, name, width, height})
(:Window {guid, name, width, height})

// Properties & Materials
(:PropertySet {name})
(:Property {name, value, unit, data_type})
(:Material {name, category})
(:MaterialLayer {name, thickness})

// Classification
(:Classification {system, code, name})
(:bSDDClass {uri, name, domain})

// Documents
(:Document {id, filename, type})
(:DocumentSection {id, title, content})

// =====================================================
// RELATIONSHIP TYPES
// =====================================================

// Spatial Containment (BOT)
(Site)-[:HAS_BUILDING]->(Building)
(Building)-[:HAS_STOREY]->(Storey)
(Storey)-[:HAS_SPACE]->(Space)
(Space)-[:CONTAINS_ELEMENT]->(Element)

// Element Relationships (IFC)
(Element)-[:IS_DEFINED_BY]->(PropertySet)
(PropertySet)-[:HAS_PROPERTY]->(Property)
(Element)-[:HAS_MATERIAL]->(Material)
(Material)-[:HAS_LAYER]->(MaterialLayer)

// Classification
(Element)-[:CLASSIFIED_AS]->(Classification)
(Element)-[:MAPPED_TO]->(bSDDClass)

// Document Linkage
(Element)-[:REFERENCED_IN]->(Document)
(Element)-[:DESCRIBED_IN]->(DocumentSection)

// Connectivity
(Element)-[:CONNECTED_TO]->(Element)
(Element)-[:FILLS]->(Opening)
(Opening)-[:VOIDS]->(Element)

// =====================================================
// EXAMPLE QUERIES
// =====================================================

// Find all walls on a specific storey with their properties
MATCH (s:Storey {name: 'Level 1'})-[:HAS_SPACE]->(sp:Space)-[:CONTAINS_ELEMENT]->(w:Wall)
MATCH (w)-[:IS_DEFINED_BY]->(ps:PropertySet)-[:HAS_PROPERTY]->(p:Property)
RETURN w.name, ps.name, p.name, p.value

// Find all elements lacking required classification
MATCH (e:Element)
WHERE NOT (e)-[:CLASSIFIED_AS]->(:Classification)
RETURN e.guid, e.name, e.ifc_class

// Spatial query - find elements within a space
MATCH (sp:Space {guid: $space_guid})-[:CONTAINS_ELEMENT]->(e:Element)
RETURN e
```

---

## 5. Backend Architecture

### 5.1 Project Structure

```
apps/backend/
├── src/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry
│   ├── config.py                  # Configuration management
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py        # Shared dependencies
│   │   │
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py          # Main v1 router
│   │   │   │
│   │   │   ├── endpoints/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py        # Authentication endpoints
│   │   │   │   ├── users.py       # User management
│   │   │   │   ├── organizations.py
│   │   │   │   ├── projects.py
│   │   │   │   ├── files.py       # File upload/management
│   │   │   │   ├── cde.py         # CDE workflow endpoints
│   │   │   │   ├── pipeline.py    # Pipeline execution
│   │   │   │   ├── validation.py  # IDS validation
│   │   │   │   ├── enrichment.py  # bSDD enrichment
│   │   │   │   ├── outputs.py     # AI outputs retrieval
│   │   │   │   └── standards.py   # LOIN/IDS management
│   │   │   │
│   │   │   └── schemas/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py
│   │   │       ├── user.py
│   │   │       ├── project.py
│   │   │       ├── file.py
│   │   │       ├── pipeline.py
│   │   │       ├── validation.py
│   │   │       └── outputs.py
│   │   │
│   │   ├── opencde/               # openCDE API (ISO 19650)
│   │   │   ├── __init__.py
│   │   │   ├── router.py
│   │   │   ├── documents.py
│   │   │   └── workflows.py
│   │   │
│   │   └── websocket/
│   │       ├── __init__.py
│   │       ├── manager.py
│   │       └── events.py
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py            # JWT, OAuth2
│   │   ├── permissions.py         # RBAC
│   │   └── exceptions.py
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── session.py             # Database sessions
│   │   ├── postgres.py            # PostgreSQL connection
│   │   ├── neo4j.py               # Neo4j connection
│   │   ├── qdrant.py              # Qdrant connection
│   │   └── minio.py               # MinIO client
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── organization.py
│   │   ├── project.py
│   │   ├── file.py
│   │   ├── pipeline.py
│   │   └── standards.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── file_service.py
│   │   ├── cde_service.py         # CDE workflow management
│   │   ├── pipeline_service.py
│   │   └── notification_service.py
│   │
│   ├── pipeline/
│   │   ├── __init__.py
│   │   ├── executor.py            # Pipeline orchestration
│   │   │
│   │   ├── stages/
│   │   │   ├── __init__.py
│   │   │   ├── base.py            # Base stage class
│   │   │   ├── ingest.py
│   │   │   ├── parse/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── ifc_parser.py
│   │   │   │   ├── pdf_parser.py
│   │   │   │   ├── docx_parser.py
│   │   │   │   ├── xlsx_parser.py
│   │   │   │   ├── pptx_parser.py
│   │   │   │   └── hwpx_parser.py
│   │   │   ├── validate.py
│   │   │   ├── enrich.py
│   │   │   ├── transform/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── knowledge_graph.py
│   │   │   │   ├── embeddings.py
│   │   │   │   ├── tabular.py
│   │   │   │   └── gnn.py
│   │   │   └── package.py
│   │   │
│   │   └── standards/
│   │       ├── __init__.py
│   │       ├── loin_processor.py
│   │       ├── ids_validator.py
│   │       ├── bsdd_client.py
│   │       └── bcf_handler.py
│   │
│   └── workers/
│       ├── __init__.py
│       ├── celery_app.py
│       └── tasks/
│           ├── __init__.py
│           ├── pipeline_tasks.py
│           ├── notification_tasks.py
│           └── cleanup_tasks.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_api/
│   ├── test_pipeline/
│   └── test_standards/
│
├── alembic/                       # Database migrations
│   ├── versions/
│   └── env.py
│
├── pyproject.toml
├── Dockerfile
└── Dockerfile.prod
```

### 5.2 Key Backend Components

```python
# src/pipeline/stages/base.py
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel

class StageInput(BaseModel):
    file_id: str
    file_path: str
    file_type: str
    previous_output: Optional[Dict[str, Any]] = None
    config: Dict[str, Any] = {}

class StageOutput(BaseModel):
    success: bool
    data: Dict[str, Any]
    errors: list[str] = []
    warnings: list[str] = []
    metrics: Dict[str, Any] = {}

class PipelineStage(ABC):
    """Base class for all pipeline stages"""

    name: str

    @abstractmethod
    async def execute(self, input: StageInput) -> StageOutput:
        """Execute the pipeline stage"""
        pass

    @abstractmethod
    async def validate_input(self, input: StageInput) -> bool:
        """Validate input before processing"""
        pass


# src/pipeline/stages/parse/ifc_parser.py
import ifcopenshell
from typing import Dict, Any, List
from ..base import PipelineStage, StageInput, StageOutput

class IFCParser(PipelineStage):
    name = "ifc_parse"

    async def execute(self, input: StageInput) -> StageOutput:
        try:
            ifc_file = ifcopenshell.open(input.file_path)

            # Build spatial hierarchy
            spatial_structure = self._build_spatial_hierarchy(ifc_file)

            # Extract elements with properties
            elements = self._extract_elements(ifc_file)

            # Extract relationships
            relationships = self._extract_relationships(ifc_file)

            return StageOutput(
                success=True,
                data={
                    'schema_version': ifc_file.schema,
                    'spatial_structure': spatial_structure,
                    'elements': elements,
                    'relationships': relationships,
                    'element_count': len(elements)
                },
                metrics={
                    'total_elements': len(elements),
                    'ifc_classes': self._count_by_class(elements)
                }
            )
        except Exception as e:
            return StageOutput(
                success=False,
                data={},
                errors=[str(e)]
            )

    def _build_spatial_hierarchy(self, ifc_file) -> Dict:
        """Build Site -> Building -> Storey -> Space hierarchy"""
        hierarchy = {'sites': []}

        for site in ifc_file.by_type('IfcSite'):
            site_data = {
                'guid': site.GlobalId,
                'name': site.Name,
                'buildings': []
            }

            for rel in site.IsDecomposedBy:
                for building in rel.RelatedObjects:
                    if building.is_a('IfcBuilding'):
                        building_data = self._process_building(building)
                        site_data['buildings'].append(building_data)

            hierarchy['sites'].append(site_data)

        return hierarchy

    def _extract_elements(self, ifc_file) -> List[Dict]:
        """Extract all building elements with properties"""
        elements = []

        for element in ifc_file.by_type('IfcElement'):
            element_data = {
                'guid': element.GlobalId,
                'name': element.Name,
                'ifc_class': element.is_a(),
                'object_type': getattr(element, 'ObjectType', None),
                'properties': {},
                'quantities': {},
                'materials': []
            }

            # Extract property sets
            for definition in element.IsDefinedBy:
                if definition.is_a('IfcRelDefinesByProperties'):
                    pset = definition.RelatingPropertyDefinition
                    if pset.is_a('IfcPropertySet'):
                        element_data['properties'][pset.Name] = {
                            prop.Name: self._get_property_value(prop)
                            for prop in pset.HasProperties
                        }
                    elif pset.is_a('IfcElementQuantity'):
                        element_data['quantities'][pset.Name] = {
                            qty.Name: self._get_quantity_value(qty)
                            for qty in pset.Quantities
                        }

            # Extract materials
            for rel in getattr(element, 'HasAssociations', []):
                if rel.is_a('IfcRelAssociatesMaterial'):
                    element_data['materials'] = self._extract_materials(
                        rel.RelatingMaterial
                    )

            elements.append(element_data)

        return elements


# src/pipeline/stages/validate.py
from lxml import etree
from typing import Dict, Any, List
from .base import PipelineStage, StageInput, StageOutput

class IDSValidator(PipelineStage):
    name = "ids_validate"

    FACETS = ['entity', 'property', 'classification', 'material', 'attribute', 'partOf']

    async def execute(self, input: StageInput) -> StageOutput:
        elements = input.previous_output.get('elements', [])
        ids_rules = await self._load_ids_rules(input.config.get('ids_ruleset_id'))

        results = []
        passed = 0
        failed = 0

        for element in elements:
            element_result = {
                'guid': element['guid'],
                'ifc_class': element['ifc_class'],
                'facet_results': {}
            }

            element_passed = True
            for facet in self.FACETS:
                facet_result = await self._check_facet(
                    element, facet, ids_rules
                )
                element_result['facet_results'][facet] = facet_result
                if not facet_result['passed']:
                    element_passed = False

            element_result['passed'] = element_passed
            results.append(element_result)

            if element_passed:
                passed += 1
            else:
                failed += 1

        return StageOutput(
            success=True,
            data={
                'validation_results': results,
                'summary': {
                    'total': len(elements),
                    'passed': passed,
                    'failed': failed,
                    'pass_rate': (passed / len(elements) * 100) if elements else 0
                }
            },
            metrics={
                'elements_processed': len(elements),
                'elements_passed': passed,
                'elements_failed': failed
            }
        )

    async def _check_facet(
        self, element: Dict, facet: str, rules: Dict
    ) -> Dict[str, Any]:
        """Check a specific IDS facet for an element"""

        if facet == 'property':
            return self._check_property_facet(element, rules)
        elif facet == 'classification':
            return self._check_classification_facet(element, rules)
        elif facet == 'material':
            return self._check_material_facet(element, rules)
        # ... other facets

    def _check_property_facet(
        self, element: Dict, rules: Dict
    ) -> Dict[str, Any]:
        """Check if required properties exist with correct values"""
        required_props = rules.get('required_properties', {})
        ifc_class = element['ifc_class']

        missing = []
        invalid = []

        class_requirements = required_props.get(ifc_class, [])
        for req in class_requirements:
            pset_name = req['property_set']
            prop_name = req['property_name']

            if pset_name not in element['properties']:
                missing.append(f"{pset_name}.{prop_name}")
            elif prop_name not in element['properties'][pset_name]:
                missing.append(f"{pset_name}.{prop_name}")
            elif req.get('expected_value'):
                actual = element['properties'][pset_name][prop_name]
                if actual != req['expected_value']:
                    invalid.append({
                        'property': f"{pset_name}.{prop_name}",
                        'expected': req['expected_value'],
                        'actual': actual
                    })

        return {
            'passed': len(missing) == 0 and len(invalid) == 0,
            'missing_properties': missing,
            'invalid_values': invalid
        }


# src/pipeline/stages/transform/embeddings.py
import numpy as np
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from .base import PipelineStage, StageInput, StageOutput

class EmbeddingsTransformer(PipelineStage):
    name = "embeddings_transform"

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name
        self.embedding_dim = self.model.get_sentence_embedding_dimension()

    async def execute(self, input: StageInput) -> StageOutput:
        elements = input.previous_output.get('elements', [])

        # Generate text representations for each element
        texts = []
        metadata = []

        for elem in elements:
            text = self._element_to_text(elem)
            texts.append(text)
            metadata.append({
                'guid': elem['guid'],
                'ifc_class': elem['ifc_class'],
                'name': elem.get('name', ''),
                'text': text
            })

        # Generate embeddings
        embeddings = self.model.encode(texts, show_progress_bar=True)

        # Store in Qdrant
        collection_name = f"project_{input.config['project_id']}_embeddings"
        await self._store_in_qdrant(collection_name, embeddings, metadata)

        # Also save as numpy for offline use
        numpy_path = f"outputs/{input.config['run_id']}/embeddings.npy"
        np.save(numpy_path, embeddings)

        # Generate 2D projection for visualization (PCA)
        from sklearn.decomposition import PCA
        pca = PCA(n_components=2)
        projections = pca.fit_transform(embeddings)

        return StageOutput(
            success=True,
            data={
                'collection_name': collection_name,
                'numpy_path': numpy_path,
                'total_vectors': len(embeddings),
                'embedding_dimension': self.embedding_dim,
                'projections_2d': projections.tolist(),
                'metadata': metadata
            },
            metrics={
                'vectors_created': len(embeddings),
                'model_used': self.model_name
            }
        )

    def _element_to_text(self, element: Dict) -> str:
        """Convert element to text representation for embedding"""
        parts = [
            f"IFC Class: {element['ifc_class']}",
            f"Name: {element.get('name', 'Unnamed')}",
            f"Type: {element.get('object_type', 'Unknown')}"
        ]

        # Add key properties
        for pset_name, props in element.get('properties', {}).items():
            for prop_name, value in props.items():
                parts.append(f"{pset_name}.{prop_name}: {value}")

        # Add materials
        for material in element.get('materials', []):
            parts.append(f"Material: {material.get('name', 'Unknown')}")

        return " | ".join(parts)

    async def _store_in_qdrant(
        self, collection_name: str, embeddings: np.ndarray, metadata: List[Dict]
    ):
        client = QdrantClient(host="qdrant", port=6333)

        # Create collection if not exists
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=self.embedding_dim,
                distance=Distance.COSINE
            )
        )

        # Insert points
        points = [
            PointStruct(
                id=i,
                vector=embeddings[i].tolist(),
                payload=metadata[i]
            )
            for i in range(len(embeddings))
        ]

        client.upsert(collection_name=collection_name, points=points)
```

---

## 6. Frontend Architecture

### 6.1 Project Structure

```
apps/frontend/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx           # Dashboard home
│   │   │   │
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx       # Project list
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx   # Project detail
│   │   │   │       ├── files/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── cde/
│   │   │   │       │   └── page.tsx  # CDE workflow
│   │   │   │       ├── pipeline/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── validation/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── enrichment/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── outputs/
│   │   │   │       │   ├── page.tsx
│   │   │   │       │   ├── knowledge-graph/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   ├── embeddings/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   ├── tabular/
│   │   │   │       │   │   └── page.tsx
│   │   │   │       │   └── gnn/
│   │   │   │       │       └── page.tsx
│   │   │   │       └── viewer/
│   │   │   │           └── page.tsx  # IFC 3D Viewer
│   │   │   │
│   │   │   ├── standards/
│   │   │   │   ├── loin/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── ids/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── bsdd/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── collaboration/
│   │   │   │   ├── bcf/
│   │   │   │   │   └── page.tsx   # BCF Issues
│   │   │   │   └── teams/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/                   # API Routes (if needed)
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── ui/                    # Base UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Breadcrumb.tsx
│   │   │
│   │   ├── project/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── ProjectForm.tsx
│   │   │   └── ProjectStats.tsx
│   │   │
│   │   ├── files/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── FileList.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── CDEStateSelector.tsx
│   │   │
│   │   ├── pipeline/
│   │   │   ├── PipelineControls.tsx
│   │   │   ├── PipelineProgress.tsx
│   │   │   ├── PipelineTimeline.tsx
│   │   │   └── StageDetail.tsx
│   │   │
│   │   ├── validation/
│   │   │   ├── ValidationSummary.tsx
│   │   │   ├── FacetResults.tsx
│   │   │   ├── ElementValidation.tsx
│   │   │   └── LOINEditor.tsx
│   │   │
│   │   ├── outputs/
│   │   │   ├── KnowledgeGraph.tsx    # D3.js/Cytoscape
│   │   │   ├── EmbeddingsPlot.tsx    # Plotly/Deck.gl
│   │   │   ├── TabularViewer.tsx     # AG Grid/TanStack
│   │   │   └── GNNViewer.tsx
│   │   │
│   │   ├── viewer/
│   │   │   ├── IFCViewer.tsx         # Three.js + web-ifc
│   │   │   ├── ViewerControls.tsx
│   │   │   ├── PropertyPanel.tsx
│   │   │   └── SpatialTree.tsx
│   │   │
│   │   └── collaboration/
│   │       ├── BCFPanel.tsx
│   │       ├── CommentThread.tsx
│   │       └── TeamMembers.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProject.ts
│   │   ├── usePipeline.ts
│   │   ├── useWebSocket.ts
│   │   ├── useIFCViewer.ts
│   │   └── useValidation.ts
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts          # Axios/Fetch client
│   │   │   ├── auth.ts
│   │   │   ├── projects.ts
│   │   │   ├── files.ts
│   │   │   ├── pipeline.ts
│   │   │   ├── validation.ts
│   │   │   └── outputs.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── cn.ts              # Class name utility
│   │   │   ├── format.ts
│   │   │   └── validation.ts
│   │   │
│   │   └── viewer/
│   │       ├── IFCLoader.ts
│   │       ├── ThreeViewer.ts
│   │       └── PropertyExtractor.ts
│   │
│   ├── store/
│   │   ├── authStore.ts           # Zustand stores
│   │   ├── projectStore.ts
│   │   └── pipelineStore.ts
│   │
│   └── types/
│       ├── api.ts
│       ├── project.ts
│       ├── file.ts
│       ├── pipeline.ts
│       └── validation.ts
│
├── public/
│   ├── wasm/                      # web-ifc WASM files
│   └── assets/
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 6.2 Key Frontend Components

```tsx
// src/components/outputs/EmbeddingsPlot.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

interface EmbeddingPoint {
  x: number;
  y: number;
  guid: string;
  ifc_class: string;
  name: string;
}

interface EmbeddingsPlotProps {
  data: EmbeddingPoint[];
  onPointClick?: (point: EmbeddingPoint) => void;
}

// IFC Class color mapping
const IFC_CLASS_COLORS: Record<string, string> = {
  'IfcWall': '#4299E1',
  'IfcSlab': '#48BB78',
  'IfcBeam': '#ED8936',
  'IfcColumn': '#9F7AEA',
  'IfcDoor': '#F56565',
  'IfcWindow': '#38B2AC',
  'IfcStair': '#ED64A6',
  'IfcRoof': '#667EEA',
  'IfcSpace': '#E2E8F0',
  'default': '#A0AEC0'
};

export function EmbeddingsPlot({ data, onPointClick }: EmbeddingsPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const width = 800;
  const height = 600;
  const margin = { top: 20, right: 20, bottom: 40, left: 40 };

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create scales
    const xExtent = d3.extent(data, d => d.x) as [number, number];
    const yExtent = d3.extent(data, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 0.1, xExtent[1] + 0.1])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 0.1, yExtent[1] + 0.1])
      .range([height - margin.bottom, margin.top]);

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    setZoom(zoomBehavior);

    // Main container for zoom
    const container = svg.append('g');

    // Add grid
    const gridGroup = container.append('g').attr('class', 'grid');

    gridGroup.selectAll('line.x-grid')
      .data(xScale.ticks(10))
      .enter()
      .append('line')
      .attr('class', 'x-grid')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,2');

    gridGroup.selectAll('line.y-grid')
      .data(yScale.ticks(10))
      .enter()
      .append('line')
      .attr('class', 'y-grid')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e2e8f0')
      .attr('stroke-dasharray', '2,2');

    // Add points
    const points = container.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 6)
      .attr('fill', d => IFC_CLASS_COLORS[d.ifc_class] || IFC_CLASS_COLORS.default)
      .attr('opacity', d => selectedClass ? (d.ifc_class === selectedClass ? 1 : 0.2) : 0.8)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 10)
          .attr('stroke-width', 2);

        // Show tooltip
        tooltip
          .style('opacity', 1)
          .html(`
            <div class="font-semibold">${d.name || 'Unnamed'}</div>
            <div class="text-sm text-gray-500">${d.ifc_class}</div>
            <div class="text-xs text-gray-400">${d.guid}</div>
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', 6)
          .attr('stroke-width', 1);

        tooltip.style('opacity', 0);
      })
      .on('click', (event, d) => {
        onPointClick?.(d);
      });

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'absolute bg-white border rounded-lg shadow-lg p-2 pointer-events-none z-50')
      .style('opacity', 0);

    return () => {
      tooltip.remove();
    };
  }, [data, selectedClass, onPointClick]);

  const handleReset = () => {
    if (svgRef.current && zoom) {
      d3.select(svgRef.current)
        .transition()
        .duration(500)
        .call(zoom.transform, d3.zoomIdentity);
    }
  };

  const handleZoomIn = () => {
    if (svgRef.current && zoom) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoom.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoom) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoom.scaleBy, 0.67);
    }
  };

  // Get unique IFC classes for legend
  const uniqueClasses = [...new Set(data.map(d => d.ifc_class))];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Vector Embeddings (2D PCA Projection)</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {uniqueClasses.map(cls => (
            <Badge
              key={cls}
              variant={selectedClass === cls ? 'default' : 'outline'}
              className="cursor-pointer"
              style={{
                backgroundColor: selectedClass === cls
                  ? IFC_CLASS_COLORS[cls] || IFC_CLASS_COLORS.default
                  : 'transparent',
                borderColor: IFC_CLASS_COLORS[cls] || IFC_CLASS_COLORS.default,
                color: selectedClass === cls ? '#fff' : IFC_CLASS_COLORS[cls]
              }}
              onClick={() => setSelectedClass(
                selectedClass === cls ? null : cls
              )}
            >
              {cls} ({data.filter(d => d.ifc_class === cls).length})
            </Badge>
          ))}
        </div>

        {/* SVG Plot */}
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="w-full h-auto"
            viewBox={`0 0 ${width} ${height}`}
          />
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          <span>Total Points: {data.length}</span>
          <span>Unique Classes: {uniqueClasses.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 7. Document Processing Pipeline

### 7.1 Document Type Handlers

```python
# src/pipeline/stages/parse/document_parser.py
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pathlib import Path

class DocumentParser(ABC):
    """Base class for document parsers"""

    supported_extensions: List[str] = []

    @abstractmethod
    async def parse(self, file_path: Path) -> Dict[str, Any]:
        """Parse document and extract structured data"""
        pass

    @abstractmethod
    async def extract_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Extract document metadata"""
        pass

    @abstractmethod
    async def extract_text(self, file_path: Path) -> str:
        """Extract full text content"""
        pass


# PDF Parser
import fitz  # PyMuPDF
from pdf2image import convert_from_path
import pytesseract

class PDFParser(DocumentParser):
    supported_extensions = ['.pdf']

    async def parse(self, file_path: Path) -> Dict[str, Any]:
        doc = fitz.open(file_path)

        pages = []
        tables = []
        images = []

        for page_num, page in enumerate(doc):
            # Extract text
            text = page.get_text("text")

            # Extract tables
            page_tables = self._extract_tables(page)
            tables.extend(page_tables)

            # Extract images
            image_list = page.get_images(full=True)
            for img in image_list:
                images.append({
                    'page': page_num,
                    'xref': img[0],
                    'width': img[2],
                    'height': img[3]
                })

            pages.append({
                'number': page_num + 1,
                'text': text,
                'tables': page_tables
            })

        # Check if OCR is needed (scanned PDF)
        total_text = ''.join(p['text'] for p in pages)
        if len(total_text.strip()) < 100 and len(pages) > 0:
            pages = await self._ocr_pages(file_path)

        return {
            'type': 'pdf',
            'page_count': len(pages),
            'pages': pages,
            'tables': tables,
            'images': images,
            'metadata': await self.extract_metadata(file_path)
        }

    async def _ocr_pages(self, file_path: Path) -> List[Dict]:
        """OCR for scanned PDFs"""
        images = convert_from_path(file_path)
        pages = []

        for i, image in enumerate(images):
            text = pytesseract.image_to_string(image, lang='eng+kor')
            pages.append({
                'number': i + 1,
                'text': text,
                'tables': [],
                'ocr': True
            })

        return pages


# DOCX Parser
from docx import Document
from docx.table import Table

class DOCXParser(DocumentParser):
    supported_extensions = ['.docx']

    async def parse(self, file_path: Path) -> Dict[str, Any]:
        doc = Document(file_path)

        sections = []
        tables = []
        current_section = {'heading': None, 'paragraphs': []}

        for element in doc.element.body:
            if element.tag.endswith('p'):
                para = self._process_paragraph(element, doc)
                if para.get('is_heading'):
                    if current_section['paragraphs']:
                        sections.append(current_section)
                    current_section = {
                        'heading': para['text'],
                        'level': para.get('heading_level', 1),
                        'paragraphs': []
                    }
                else:
                    current_section['paragraphs'].append(para)

            elif element.tag.endswith('tbl'):
                table_data = self._extract_table(element, doc)
                tables.append(table_data)

        if current_section['paragraphs']:
            sections.append(current_section)

        return {
            'type': 'docx',
            'sections': sections,
            'tables': tables,
            'metadata': await self.extract_metadata(file_path)
        }

    async def extract_metadata(self, file_path: Path) -> Dict[str, Any]:
        doc = Document(file_path)
        props = doc.core_properties

        return {
            'title': props.title,
            'author': props.author,
            'created': props.created.isoformat() if props.created else None,
            'modified': props.modified.isoformat() if props.modified else None,
            'subject': props.subject,
            'keywords': props.keywords
        }


# XLSX Parser
import openpyxl
import pandas as pd

class XLSXParser(DocumentParser):
    supported_extensions = ['.xlsx', '.xls']

    async def parse(self, file_path: Path) -> Dict[str, Any]:
        workbook = openpyxl.load_workbook(file_path, data_only=True)

        sheets = []
        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]

            # Read as DataFrame for better handling
            df = pd.read_excel(file_path, sheet_name=sheet_name)

            sheets.append({
                'name': sheet_name,
                'row_count': len(df),
                'column_count': len(df.columns),
                'columns': df.columns.tolist(),
                'data': df.to_dict(orient='records'),
                'dtypes': df.dtypes.astype(str).to_dict()
            })

        return {
            'type': 'xlsx',
            'sheet_count': len(sheets),
            'sheets': sheets,
            'metadata': await self.extract_metadata(file_path)
        }


# HWPX Parser (Korean HWP format)
from hwpx import HWPXFile

class HWPXParser(DocumentParser):
    supported_extensions = ['.hwpx', '.hwp']

    async def parse(self, file_path: Path) -> Dict[str, Any]:
        hwpx = HWPXFile(file_path)

        sections = []
        tables = []

        for section in hwpx.body.sections:
            section_data = {
                'paragraphs': [],
                'tables': []
            }

            for paragraph in section.paragraphs:
                para_text = paragraph.get_text()
                section_data['paragraphs'].append({
                    'text': para_text,
                    'style': paragraph.style_name
                })

            for table in section.tables:
                table_data = self._extract_hwpx_table(table)
                section_data['tables'].append(table_data)
                tables.append(table_data)

            sections.append(section_data)

        return {
            'type': 'hwpx',
            'sections': sections,
            'tables': tables,
            'metadata': await self.extract_metadata(file_path)
        }
```

### 7.2 Standards Compliance Checker for Documents

```python
# src/pipeline/standards/document_validator.py
from typing import Dict, Any, List
from enum import Enum

class DocumentStandard(Enum):
    ISO_19650 = "iso_19650"
    ISO_21597 = "iso_21597"  # ICDD
    COBie = "cobie"

class DocumentValidationResult:
    def __init__(self):
        self.passed = True
        self.checks: List[Dict] = []
        self.warnings: List[str] = []
        self.errors: List[str] = []

class DocumentStandardsValidator:
    """Validate documents against construction industry standards"""

    # Required metadata fields by standard
    REQUIRED_METADATA = {
        DocumentStandard.ISO_19650: [
            'project_id',
            'originator',
            'functional_breakdown',
            'spatial_breakdown',
            'form',
            'discipline',
            'number',
            'revision',
            'status',
            'classification'
        ],
        DocumentStandard.COBie: [
            'facility_name',
            'project_name',
            'site_name',
            'contact'
        ]
    }

    async def validate_document(
        self,
        document: Dict[str, Any],
        standard: DocumentStandard,
        lifecycle_phase: str
    ) -> DocumentValidationResult:
        result = DocumentValidationResult()

        # Check required metadata
        await self._check_metadata(document, standard, result)

        # Check naming convention (ISO 19650)
        if standard == DocumentStandard.ISO_19650:
            await self._check_naming_convention(document, result)

        # Check content structure
        await self._check_structure(document, lifecycle_phase, result)

        # Check for required sections based on lifecycle phase
        await self._check_required_sections(document, lifecycle_phase, result)

        return result

    async def _check_naming_convention(
        self, document: Dict, result: DocumentValidationResult
    ):
        """Check ISO 19650 naming convention"""
        filename = document.get('filename', '')

        # ISO 19650 naming: Project-Originator-Volume-Level-Type-Role-Number
        pattern = r'^[A-Z0-9]+-[A-Z]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z]+-[A-Z]+-[0-9]+$'

        import re
        if not re.match(pattern, filename.split('.')[0].upper()):
            result.warnings.append(
                f"Filename '{filename}' does not follow ISO 19650 naming convention"
            )
            result.checks.append({
                'check': 'naming_convention',
                'passed': False,
                'message': 'Non-compliant filename format'
            })
        else:
            result.checks.append({
                'check': 'naming_convention',
                'passed': True
            })

    async def _check_required_sections(
        self, document: Dict, lifecycle_phase: str, result: DocumentValidationResult
    ):
        """Check for required document sections based on lifecycle phase"""

        REQUIRED_SECTIONS = {
            'design': {
                'specification': ['scope', 'materials', 'workmanship'],
                'drawing': ['title_block', 'revision_history', 'scale'],
                'report': ['executive_summary', 'methodology', 'conclusions']
            },
            'construction': {
                'method_statement': ['scope', 'hazards', 'controls', 'sequence'],
                'inspection': ['checklist', 'photos', 'signatures'],
                'as_built': ['deviations', 'installed_items']
            },
            'operation': {
                'manual': ['safety', 'operation', 'maintenance', 'troubleshooting'],
                'inspection_report': ['condition', 'recommendations', 'photos']
            }
        }

        doc_type = document.get('type', 'unknown')
        phase_requirements = REQUIRED_SECTIONS.get(lifecycle_phase, {})
        type_requirements = phase_requirements.get(doc_type, [])

        sections = document.get('sections', [])
        section_headings = [s.get('heading', '').lower() for s in sections]

        for required in type_requirements:
            found = any(required in h for h in section_headings)
            result.checks.append({
                'check': f'required_section_{required}',
                'passed': found,
                'message': f"Section '{required}' {'found' if found else 'missing'}"
            })
            if not found:
                result.warnings.append(f"Missing required section: {required}")
```

---

## 8. Deployment Architecture

### 8.1 Docker Compose (Production)

```yaml
# docker/docker-compose.prod.yml
version: '3.8'

services:
  # ===========================================
  # DATABASES
  # ===========================================

  postgres:
    image: postgres:16-alpine
    container_name: bim-pipeline-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - bim-network

  neo4j:
    image: neo4j:5-community
    container_name: bim-pipeline-neo4j
    restart: unless-stopped
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_dbms_memory_heap_max__size: 2G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    ports:
      - "7474:7474"  # Browser
      - "7687:7687"  # Bolt
    healthcheck:
      test: ["CMD", "neo4j", "status"]
      interval: 30s
      timeout: 10s
      retries: 5
    networks:
      - bim-network

  qdrant:
    image: qdrant/qdrant:latest
    container_name: bim-pipeline-qdrant
    restart: unless-stopped
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "6333:6333"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - bim-network

  redis:
    image: redis:7-alpine
    container_name: bim-pipeline-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - bim-network

  minio:
    image: minio/minio
    container_name: bim-pipeline-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - bim-network

  # ===========================================
  # APPLICATION SERVICES
  # ===========================================

  backend:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile.prod
    container_name: bim-pipeline-backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - QDRANT_HOST=qdrant
      - QDRANT_PORT=6333
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - CORS_ORIGINS=${CORS_ORIGINS}
      - DEBUG=false
    volumes:
      - pipeline_outputs:/app/outputs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      neo4j:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - bim-network

  celery-worker:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile.prod
    container_name: bim-pipeline-celery-worker
    restart: unless-stopped
    command: celery -A src.workers.celery_app worker --loglevel=info --concurrency=4
    environment:
      - DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - QDRANT_HOST=qdrant
      - QDRANT_PORT=6333
      - MINIO_ENDPOINT=minio:9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
    volumes:
      - pipeline_outputs:/app/outputs
    depends_on:
      - backend
      - redis
    networks:
      - bim-network

  celery-beat:
    build:
      context: ../apps/backend
      dockerfile: Dockerfile.prod
    container_name: bim-pipeline-celery-beat
    restart: unless-stopped
    command: celery -A src.workers.celery_app beat --loglevel=info
    environment:
      - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
    depends_on:
      - redis
    networks:
      - bim-network

  frontend:
    build:
      context: ../apps/frontend
      dockerfile: Dockerfile.prod
      args:
        - NEXT_PUBLIC_API_URL=${API_URL}
        - NEXT_PUBLIC_WS_URL=${WS_URL}
    container_name: bim-pipeline-frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - bim-network

  # ===========================================
  # REVERSE PROXY & SSL
  # ===========================================

  nginx:
    image: nginx:alpine
    container_name: bim-pipeline-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - bim-network

volumes:
  postgres_data:
  neo4j_data:
  neo4j_logs:
  qdrant_data:
  redis_data:
  minio_data:
  pipeline_outputs:

networks:
  bim-network:
    driver: bridge
```

### 8.2 Nginx Configuration

```nginx
# docker/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript
               application/xml application/xml+rss text/javascript application/wasm;

    # File upload size (for large IFC files)
    client_max_body_size 500M;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:8000;
    }

    # HTTP -> HTTPS redirect
    server {
        listen 80;
        server_name _;
        return 301 https://$host$request_uri;
    }

    # Main HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api/ {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Timeouts for long-running operations
            proxy_connect_timeout 60s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }

        # File uploads
        location /api/v1/files/upload {
            limit_req zone=upload burst=5 nodelay;

            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # Large file upload settings
            proxy_request_buffering off;
            proxy_connect_timeout 60s;
            proxy_send_timeout 600s;
            proxy_read_timeout 600s;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }

        # openCDE API (ISO 19650 compliance)
        location /opencde/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up multi-database infrastructure (PostgreSQL, Neo4j, Qdrant)
- [ ] Implement core authentication & authorization
- [ ] Create base pipeline executor framework
- [ ] Set up CI/CD pipeline

### Phase 2: Pipeline Core (Weeks 3-4)
- [ ] Implement IFC parser with ifcopenshell
- [ ] Implement document parsers (PDF, DOCX, XLSX, HWPX)
- [ ] Create IDS validation engine
- [ ] Integrate bSDD API for enrichment

### Phase 3: AI Outputs (Weeks 5-6)
- [ ] Implement Knowledge Graph transformation (Neo4j)
- [ ] Implement Vector Embeddings generation (Qdrant)
- [ ] Implement Tabular dataset generation
- [ ] Implement GNN structure generation

### Phase 4: Frontend (Weeks 7-8)
- [ ] Implement project management UI
- [ ] Create CDE workflow interface
- [ ] Build IFC 3D viewer
- [ ] Create AI output visualizations

### Phase 5: Integration & Testing (Weeks 9-10)
- [ ] End-to-end integration testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation

---

## 10. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Multi-DB Architecture** | PostgreSQL for ACID transactions, Neo4j for graph queries, Qdrant for vector similarity |
| **Celery for Background Tasks** | Pipeline stages are long-running; async execution is essential |
| **WebSocket for Real-time Updates** | Provide live progress feedback during pipeline execution |
| **Next.js App Router** | Server components for better performance, client components for interactivity |
| **ISO 21597 ICDD Packaging** | Standard container format for AI-ready data delivery |
| **Standards-First Design** | Every stage references ISO/bSI standards for compliance |

---

*Document Version: 2.0*
*Last Updated: 2026-03-16*
